/** @jsx React.DOM */
var React = require('react/addons')
var _ = require('lodash')

var Loop = require('./loop.jsx')
var VolumeControl = require('./volumecontrol.jsx')
var LevelsBar = require('./levelsbar.jsx')
var LatencyTapper = require('./latencytapper.js')
var quantize = require('./utils').quantize


function readSetting(key, defaultValue) {
  try {
    return JSON.parse(localStorage['setting.' + key])
  } catch (e) {
    return defaultValue
  }
}

function writeSetting(key, value) {
  localStorage['setting.' + key] = JSON.stringify(value)
}

module.exports = Loops = React.createClass({
  mixins: [React.addons.PureRenderMixin],

  getInitialState: function() {
    return {
      metronomeOn: false
    }
  },

  componentDidMount: function() {
    this.setState({
      volumeMuted: readSetting('volumeMuted', false),
      volumeLevel: readSetting('volumeLevel', .75),
      metronomeOn: readSetting('metronomeOn', false),
      recordLatency: readSetting('recordLatency', 0)
    })
  },

  componentDidUpdate: function(prevProps, prevState) {
    if (!this.props.looperStarted) {
      return
    }

    var started = this.props.looperStarted != prevProps.looperStarted

    if (started) {
      this.latencyTapper = new LatencyTapper(this.props.looper.clock)
    }

    if (this.state.metronomeOn != prevState.metronomeOn || started) {
      var metronome = this.props.looper.metronome

      if (started) {
        metronome.on('tick', this.tickMetronome)
      }

      if (this.state.metronomeOn) {
        metronome.start()
      } else {
        metronome.stop()
      }
      writeSetting('metronomeOn', this.state.metronomeOn)
    }

    if (this.state.volumeLevel != prevState.volumeLevel || this.state.volumeMuted != prevState.volumeMuted || started) {
      var level = this.state.volumeMuted ? 0 : this.state.volumeLevel
      this.props.looper.setVolume(level, prevState.level == undefined)
      writeSetting('volumeMuted', this.state.volumeMuted)
      writeSetting('volumeLevel', this.state.volumeLevel)
    }

    if (this.state.recordLatency != prevState.recordLatency || started) {
      this.props.looper.clock.setLatency(this.state.recordLatency)
      writeSetting('recordLatency', this.state.recordLatency)
    }
  },

  onKeyPress: function(ev) {
    if (ev.ctrlKey) {
      return
    }

    if (ev.which == 192) {  // ~ key
      this.setState({
        recordLatency: this.latencyTapper.tap()
      })
    }

    key = String.fromCharCode(ev.which).toLowerCase()

    if (!/[a-z]/.test(key)) {
      return
    }

    var id = this.props.looper.byKey(key)
    if (id && this.props.looper.has(id)) {
      this.props.looper.toggleLoop(id)
    } else {
      this.props.looper.recordLoop(null, {
        key: key
      })
    }
  },

  toggleLoop: function(loopId) {
    this.props.looper.toggleLoop(loopId)
  },

  toggleMetronome: function(ev) {
    this.setState({
      metronomeOn: ev.target.checked
    })
  },

  changeRecordMode: function(ev) {
    this.props.looper.setState({
      _recordMode: ev.currentTarget.value
    })
  },

  tickMetronome: function() {
    this.setState({
      metronomeTick: Math.round(this.props.curBeat) % 2
    })
  },

  onVolumeChange: function(muted, level) {
    this.setState({
      volumeMuted: muted,
      volumeLevel: level
    })
  },

  onLoopAction: function(loopId, action) {
    switch (action) {
      case 'archive':
        this.props.looper.archiveLoop(loopId)
        break
      case 'mute':
        this.props.looper.muteLoop(loopId)
        break
      case 'unmute':
        this.props.looper.unmuteLoop(loopId)
        break
    }
  },

  onLoopRename: function(loopId, fields) {
    this.props.looper.setLoopState(loopId, fields)
  },

  toggleRecord: function() {
    this.props.looper.toggleRecord()
  },

  changeSnap: function(ev) {
    this.props.looper.setState({
      _snap: ev.target.value
    })
  },

  changeRecordLength: function(ev) {
    this.props.looper.setState({
      _recordLength: ev.target.value
    })
  },

  snapOptions: [
    {value: 'b1', label: 'bar'},
    {value: '1', label: 'beat'},
    {value: '/2', label: 'beat/2'},
    {value: '/4', label: 'beat/4'},
    {value: 'none', label: 'off'}
  ],

  recordLengthOptions: [
    {value: 'b16', label: '16 bars'},
    {value: 'b8', label: '8 bars'},
    {value: 'b4', label: '4 bars'},
    {value: 'b3', label: '3 bars'},
    {value: 'b2', label: '2 bars'},
    {value: 'b1', label: 'bar'},
    {value: '1', label: 'beat'},
    {value: '/2', label: 'beat/2'},
    {value: 'none', label: 'manual'}
  ],

  render: function() {
    if (!this.props.ready) {
      return (
        <h1>waiting for audio input access...</h1>
      )
    }

    var cx = React.addons.classSet

    var metronomeClasses = cx({
      'metronome-toggle': true,
      'icon': true,
      'on': this.state.metronomeOn,
      'tick': this.state.metronomeOn && this.state.metronomeTick
    })

    var looper = this.props.looper

    var looperClasses = cx({
      'looper': true,
      'started': this.props.looperStarted
    })

    var recordMode = looper.state._recordMode

    var recordClasses = cx({
      'record': true,
      'icon': true,
      'recording': looper.state._recording
    })

    var recordRot = {
      'transform': 'rotate(' + quantize((this.props.curBeat % looper.clock.beatsPerBar / looper.clock.beatsPerBar), 30).toFixed(2) + 'turn)'
    }

    var snapChoice = _.find(this.snapOptions, {value: looper.state._snap})
    var snapLabel = snapChoice && snapChoice.label

    var recordLengthChoice = _.find(this.recordLengthOptions, {value: looper.state._recordLength})
    var recordLengthLabel = recordLengthChoice && recordLengthChoice.label

    recordLatency = (this.state.recordLatency * 1000).toFixed(0)

    return (
      <div className={looperClasses}>
        <header>
          <h1>{this.props.name}</h1>
          <VolumeControl muted={this.state.volumeMuted} level={this.state.volumeLevel} onChange={this.onVolumeChange} />
          <label className={metronomeClasses}><input type="checkbox" checked={this.state.metronomeOn} onChange={this.toggleMetronome} /></label>
          <div className="timing-info">
            <span>{looper.clock.bpm}<span className="unit">bpm</span></span>
            <span>{looper.clock.beatsPerBar}<span className="unit">beats / bar</span></span>
          </div>
        </header>
        <ul className="loops">
          {looper.map(function(loop, id) {
            if (loop.archived) {
              return
            }

            return (
              <li key={id}>
                <Loop key={id} loop={loop} width={200} height={200} curBeat={this.props.curBeat} onClick={_.partial(this.toggleLoop, id)} onAction={_.partial(this.onLoopAction, id)} onRename={_.partial(this.onLoopRename, id)}></Loop>
              </li>
            )
          }, this)}
        </ul>
        <footer>
          <button className={recordClasses} onClick={this.toggleRecord} style={recordRot} />
          <LevelsBar levels={looper.levels} />
          <div className="option-group">
            <label className={cx({'on': recordMode == 'manual'})}>
              <input type="radio" name="record-mode" checked={recordMode == 'manual'} value="manual" onChange={this.changeRecordMode} />
              manual
            </label>
            <label className={cx({'on': recordMode == 'auto'})}>
              <input type="radio" name="record-mode" checked={recordMode == 'auto'} value="auto" onChange={this.changeRecordMode} />
              auto-record
            </label>
            <label className={cx({'on': recordMode == 'continuous'})}>
              <input type="radio" name="record-mode" checked={recordMode == 'continuous'} value="continuous" onChange={this.changeRecordMode} />
              continuous
            </label>
          </div>
          <div className="snap">
            <label>snap:</label>
            <span className="value">{snapLabel}</span>
            <select value={looper.state._snap} onChange={this.changeSnap}>
              {_.map(this.snapOptions, function(option) {
                return <option key={option.value} value={option.value}>{option.label}</option>
              })}
            </select>
          </div>
          <div className="record-length">
            <label>duration:</label>
            <span className="value">{recordLengthLabel}</span>
            <select value={looper.state._recordLength} onChange={this.changeRecordLength}>
              {_.map(this.recordLengthOptions, function(option) {
                return <option key={option.value} value={option.value}>{option.label}</option>
              })}
            </select>
          </div>
          <div className="latency">
            <span className="value">{recordLatency} ms</span>
            <span className="label">record latency</span>
          </div>
        </footer>
      </div>
    )
  }
})
