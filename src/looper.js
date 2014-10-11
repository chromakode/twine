var EventEmitter = require('events')
var uuid = require('node-uuid')
var _ = require('lodash')
var React = require('react/addons')

var audio = require('./audio')
var Clock = require('./clock')
var Metronome = require('./metronome')
var Levels = require('./levels')
var clamp = require('./utils').clamp


Looper = module.exports = function(audioCtx, inStream) {
  this.ctx = audioCtx

  this.inStream = inStream
  this.inNode = this.ctx.createMediaStreamSource(inStream)
  this.levels = new Levels(this.ctx, this.inNode)
  this.outNode = this.ctx.createGain()

  this.clock = new Clock(this.ctx)
  this.clock.start()
  this.loops = {}
  this._idsSortedByDate = []
  this.state = {
    _started: false,
    _recording: false,
    _recordMode: 'manual',
    _recordLength: 'b1',
    _autoRecordThreshold: .75,
    _snap: 'b1',
    bpm: 120,
    beatsPerBar: 4
  }
}

_.extend(Looper.prototype, EventEmitter.prototype, {
  start: function(timeSync) {
    this.setState({_started: true})
    this.levels.on('levels', this._onAudio.bind(this))
    this.metronome = new Metronome(this.ctx, this.outNode, this.clock)
    _.each(this.loops, function(loop, id) {
      this._updatePlayback(id, null, this.loops[id])
    }, this)
  },

  setVolume: function(level, immediate) {
    var now = this.ctx.currentTime
    this.outNode.gain.cancelScheduledValues(now)
    if (immediate) {
      this.outNode.gain.setValueAtTime(level, now)
    } else {
      this.outNode.gain.setValueAtTime(node.gain.value, now)
      this.outNode.gain.linearRampToValueAtTime(level, now + .15)
    }
  },

  _parseDuration: function(dur) {
    if (dur == 'none') {
      return 0
    }

    if (dur[0] == 'b') {
      return parseInt(dur.substr(1), 10) * this.clock.beatsPerBar
    }

    if (dur[0] == '/') {
      return 1 / parseInt(dur.substr(1), 10)
    }

    return parseInt(dur, 10)
  },

  _snapNow: function() {
    return this.clock.snappedBeatTime(this._parseDuration(this.state._snap))
  },

  _updatePlayback: function(id, prev, cur) {
    if (!this.state._started || cur.archived) {
      return
    }

    var curBeat = this.clock.beatTime()

    prev = prev || {}
    if (prev.startBeat != cur.startBeat
        || prev.stopBeat != cur.stopBeat
        || prev._buffer != cur._buffer
        || prev._muted != cur._muted) {

      if (!cur.startBeat || cur._muted) {
        this._stopLoop(id)
        return
      }

      var isStopped = cur.stopBeat && cur.stopBeat <= curBeat
      if (!isStopped) {
        this.emit('loop:play', id)
        if (cur._buffer) {
          this._playLoop(id, cur.startBeat)
        }
      }

      if (cur.stopBeat) {
        this._stopLoop(id, cur.stopBeat)
      }
    }
  },

  setState: function(props, silent) {
    this.state = React.addons.update(this.state, {$merge: props})
    this.clock.setRhythm(this.state.bpm, this.state.beatsPerBar)
    if (!silent) {
      this.emit('state:change', props, this.state)
    }
  },

  setLoopState: function(id, props, silent) {
    var update = {}
    var prev = this.loops[id]

    if (prev) {
      update[id] = {$merge: props}
    } else {
      update[id] = {$set: props}

      var indexEntry = {id: id, key: props.recordTime}
      var idx = _.sortedIndex(this._idsSortedByDate, indexEntry, 'key')
      this._idsSortedByDate.splice(idx, 0, indexEntry)
    }

    this.loops = React.addons.update(this.loops, update)

    this._updatePlayback(id, prev, this.loops[id])

    if (!silent) {
      this.emit('loop:change', id, props, this.loops[id])
    }

    return this.loops[id]
  },

  _loopSampleCount: function(loop) {
    return Math.round(loop.beats * (60 / loop.bpm) * this.ctx.sampleRate)
  },

  receiveLoopAudio: function(id, channelDatas) {
    var loop = this.loops[id]

    if (!loop) {
      // FIXME it's possible for audio to arrive before control -- how do we
      // determine the buffer length in that case?
      return
    }

    if (!loop._buffer) {
      var sampleCount
      if (loop.beats) {
        sampleCount = this._loopSampleCount(loop)
      }
      loop = this.setLoopState(id, {
        _recordSample: 0,
        _buffer: audio.createBuffer(this.ctx, channelDatas.length, sampleCount)
      }, true)
    }

    // double the buffer size if out of space
    var lengthRequired = loop._recordSample + channelDatas[0].length
    if (loop._buffer.length < lengthRequired) {
      console.debug('growing loop buffer', id, 'to', 2 * loop._buffer.length, 'to fit', lengthRequired)
      loop = this.setLoopState(id, {
        _buffer: audio.resizeBuffer(this.ctx, loop._buffer, 2 * loop._buffer.length)
      })
    }

    for (var c = 0; c < channelDatas.length; c++) {
      loop._buffer.getChannelData(c).set(channelDatas[c], loop._recordSample)
    }

    this.setLoopState(id, {
      _recordSample: loop._recordSample + channelDatas[0].length
    }, true)
  },

  finishReceiveLoopAudio: function(id, loopData) {
    var buffer = this.loops[id]._buffer
    var sampleCount = this._loopSampleCount(loopData)
    if (buffer.length != sampleCount) {
      console.debug('resizing loop buffer', id, 'from', buffer.length, 'to', sampleCount)
      this.setLoopState(id, {
        _buffer: audio.resizeBuffer(this.ctx, buffer, sampleCount)
      })
    }

    // fade abrupt starts/stops in loops
    var channelCount = buffer.numberOfChannels
    var ease = Math.round(this.ctx.sampleRate * .01)
    for (var i = 0; i < ease; i++) {
      for (var c = 0; c < channelCount; c++) {
        buffer.getChannelData(c)[i] *= i / ease
        buffer.getChannelData(c)[buffer.length - i] *= i / ease
      }
    }
  },

  receiveLoopState: function(id, props) {
    this.setLoopState(id, props, true)
  },

  has: function(id) {
    return _.has(this.loops, id)
  },

  byKey: function(key) {
    return _.findKey(this.loops, {key: key, archived: false})
  },

  map: function(callback, thisArg) {
    return _.map(this._idsSortedByDate, function(indexEntry) {
      var id = indexEntry.id

      if (!this.loops.hasOwnProperty(id)) {
        return
      }

      return callback.call(thisArg, this.loops[id], id)
    }, this)
  },

  _onAudio: function(audio) {
    if (!audio) {
      return
    }
    // buffer one time slice in case of late records
    this._lastAudio = audio

    // maybe trigger autorecord
    if (this.state._recordMode == 'auto' && audio.max > this.state._autoRecordThreshold) {
      // FIXME: need to start recording immediately and store offset
      this.recordLoop()
    }

    var recordId = this.state._recording
    if (!recordId) {
      return
    }
    var loop = this.loops[recordId]

    var startTime = audio.startTime
    if (startTime <= loop._recordLatestInput) {
      // skip samples we've already seen
      return
    }
    loop._recordLatestInput = startTime

    // figure out at what samples we need to begin recording
    var sampleCount = audio.channelDatas[0].length
    var startOffset = Math.max(0, Math.floor((loop._recordStartAudioTime - startTime) * this.ctx.sampleRate))
    if (startOffset > sampleCount) {
      return
    }

    // sadly, AudioProcessingEvent.playbackTime is not reliable as an input
    // timestamp; the time elapsed between events varies WRT the buffer size.
    // ctx.currentTime is similarly unreliable, but not significantly less so
    // than playbackTime. I do not currently know of a sample-precise time for
    // input. for this reason, we count the end time by samples already
    // recorded, not clock time.
    var endSample = Math.round((loop._recordEndAudioTime - loop._recordStartAudioTime) * this.ctx.sampleRate)
    var endOffset = loop._recordEndAudioTime ? clamp(0, endSample - loop._recordSample, sampleCount) : sampleCount

    // clip data arrays to exact samples
    var channelDatas
    if (startOffset > 0 || endOffset < sampleCount) {
      channelDatas = []
      for (var c = 0; c < audio.channelDatas.length; c++) {
        channelDatas[c] = audio.channelDatas[c].subarray(startOffset, endOffset)
      }
    } else {
      channelDatas = audio.channelDatas
    }

    // store the samples
    this.receiveLoopAudio(recordId, channelDatas)
    loop = this.loops[recordId]

    // send the samples
    this.emit('loop:record-progress', recordId, channelDatas)

    // check if we're done recording
    var loopTime = startTime + Math.round(endOffset / this.ctx.sampleRate)
    if (loop._recordEndAudioTime && (loop._recordSample >= endSample || loopTime >= loop._recordEndAudioTime)) {
      if (loopTime >= loop._recordEndAudioTime) {
        console.warn('late by ' + (loopTime - loop._recordEndAudioTime) + ' seconds while recording!')
      }

      // store some metadata about the buffer
      var bufferInfo = {
        sampleRate: this.ctx.sampleRate,
        sampleCount: loop._recordSample,
        beats: loop._recordEndBeat - loop._recordStartBeat,
        bpm: loop.bpm,
        seconds: loop._buffer.length / this.ctx.sampleRate,
        recordTime: loop._recordTime
      }

      this.finishReceiveLoopAudio(recordId, bufferInfo)
      // duplicate the information into the /audio channel (partially for future sanity checking)
      // though it is used by clients receiving live samples to trim their buffers since it is canonical
      this.emit('loop:record-finish', recordId, bufferInfo)

      // store the same on the loop control data
      bufferInfo.recording = false
      loop = this.setLoopState(recordId, bufferInfo)

      var expectedSamples = this._loopSampleCount(loop)
      if (loop._recordSample != expectedSamples) {
        console.warn('off by ' + (expectedSamples - loop._recordSample) + ' samples while recording!')
      }

      this.setState({_recording: false})

      if (this.state._recordMode == 'continuous') {
        var nextId = this.recordLoop(null, loop._recordEndBeat)
        this.setLoopState(recordId, {nextLoop: nextId})
        this.setLoopState(nextId, {prevLoop: recordId})
        this.finishLoop(recordId)
        this.archiveLoop(loop.prevLoop)
        this._onAudio(audio)
      }
    }
  },

  recordLoop: function(startBeat, extraProps) {
    var id = uuid.v1().replace(/-/g, '')

    if (this.state._recording) {
      return
    }

    var recordLength = this._parseDuration(this.state._recordLength)
    var startBeat = startBeat || this._snapNow()
    var endBeat = recordLength ? startBeat + recordLength : 0

    var loop = this.setLoopState(id, _.extend(
      {
        archived: false,
        recording: true,
        beats: recordLength || this.clock.beatsPerBar,  // default sizing to one bar
        bpm: this.clock.bpm,
        _buffer: null,
        _recordSample: 0,
        _recordStartBeat: startBeat,
        _recordEndBeat: endBeat,
        _recordTime: this.clock.beatsToSeconds(startBeat),
        // specify start/end times in terms of audio times so timeSync won't affect them
        _recordStartAudioTime: this.clock.beatTimeToAudioTime(startBeat + 2 * this.clock.beatLatency()),
        _recordEndAudioTime: endBeat && this.clock.beatTimeToAudioTime(endBeat + 2 * this.clock.beatLatency())
      },
      extraProps
    ))

    this.setState({_recording: id})

    if (this.state._recordMode == 'continuous') {
      this.setLoopState(id, {_muted: true})
    }

    this.playLoop(id, endBeat)

    this._onAudio(this._lastAudio)

    return id
  },

  stopRecord: function() {
    if (!this.state._recording) {
      return
    }

    var endBeat = this._snapNow()
    this.setLoopState(this.state._recording, {
      _recordEndBeat: endBeat,
      _recordEndAudioTime: this.clock.beatTimeToAudioTime(endBeat + 2 * this.clock.beatLatency())
    })
  },

  toggleRecord: function() {
    if (this.state._recording) {
      this.stopRecord()
    } else {
      this.recordLoop()
    }
  },

  _playLoop: function(id, startBeat) {
    this._stopLoop(id)
    var playback = audio.play(this.ctx, this.outNode, this.loops[id]._buffer, this.clock.beatTimeToAudioTime(startBeat))
    this.setLoopState(id, {
      _stop: playback.stop
    }, true)
  },

  playLoop: function(id, startBeat, silent) {
    startBeat = startBeat || this._snapNow()
    var loop = this.loops[id]
    this.setLoopState(id, {
      startBeat: startBeat,
      stopBeat: null,
      // previous values used to indicate queued actions in UI
      _prevStartBeat: loop.startBeat,
      _prevStopBeat: loop.stopBeat
    }, silent)
  },

  _stopLoop: function(id, stopBeat) {
    if (!this.loops[id]._stop) {
      return
    }

    var stopTime = null
    if (stopBeat) {
      stopTime = this.clock.beatTimeToAudioTime(stopBeat)
    }

    this.loops[id]._stop(stopTime)
    // FIXME: this prevents stopping in the future with a sooner time
    this.setLoopState(id, {
      _stop: null
    }, true)
  },

  stopLoop: function(id, stopBeat, silent) {
    stopBeat = stopBeat || this._snapNow()
    this.setLoopState(id, {
      stopBeat: stopBeat
    }, silent)
  },

  finishLoop: function(id) {
    var loop = this.loops[id]
    this.setLoopState(id, {
      stopBeat: loop.startBeat + loop.beats
    })
  },

  toggleLoop: function(id) {
    var now = this.clock.beatTime()
    if (!this.loops[id].stopBeat) {
      this.stopLoop(id)
    } else {
      this.playLoop(id)
    }
  },

  archiveLoop: function(id) {
    this.stopLoop(id, this.clock.beatTime())
    this.setLoopState(id, {archived: true})
  },

  muteLoop: function(id) {
    this.setLoopState(id, {_muted: true})
  },

  unmuteLoop: function(id) {
    this.setLoopState(id, {_muted: false})
  }
})
