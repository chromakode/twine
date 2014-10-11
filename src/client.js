var _ = require('lodash')
var uuid = require('node-uuid')
var Promise = require("bluebird")
var Ivy = require('ivy-client')

var B64Worker = require('./b64async')
var ServerTimeSync = require('./timesync').ServerTimeSync


function stripPrivate(obj) {
  return _.omit(obj, function(val, key) {
    return key[0] == '_'
  })
}


function await(emitter, eventName) {
  return new Promise(function(resolve) {
    emitter.once(eventName, resolve)
  })
}


Client = module.exports = function(channel, ui, looper) {
  this.ui = ui
  this.looper = looper
  this.channel = '/' + channel
  this.id = uuid.v1().replace(/-/g, '')
  this.timeSync = new ServerTimeSync(this.looper.clock, this)

  // TODO: get from server?
  this.chunkSize = Math.ceil(64 * 1024 / this.looper.levels.bufferSize / 4)

  // worker -> loop id mapping for async encode/decode
  this._sendBuffers = {}
  this._workers = {}
  this._fetches = {}
}

_.extend(Client.prototype, {
  connect: function(host) {
    this.ivy = new Ivy(host + '/ivy')
    this.ivy.on('ready', this.onReady.bind(this))
  },

  onReady: function() {
    this.looper.on('state:change', this.onLocalStateChange.bind(this))
    this.ivy.load(this.channel + '/state', {count: 1})
    this.ivy.on(this.channel + '/state', this.onRemoteStateChange.bind(this))

    this.looper.on('loop:record-progress', this.onStreamRecording.bind(this))
    this.looper.on('loop:record-finish', this.onStreamFinishRecording.bind(this))
    this.looper.on('loop:change', this.onLocalLoopChange.bind(this))
    this.looper.on('loop:play', this.ensureLoopLoaded.bind(this))
    this.ivy.load(this.channel + '/loop/*/control', {count: 1})
    this.ivy.on(this.channel + '/loop', this.onRemoteLoopChange.bind(this))

    this.ivy.subscribe(this.channel)

    Promise.join(
      await(this.timeSync, 'sync'),
      await(this.ivy, this.channel + '/state'),
      function() {
        this.looper.start(this.timeSync)
        this.ui.setProps({
          looperStarted: true
        })
      }.bind(this)
    )

    this.timeSync.on('sync', function(offset) {
      this.looper.clock.setOffset(offset)
    }.bind(this))
    this.timeSync.start()
  },

  _getWorker: function(id) {
    var worker = this._workers[id]
    if (!worker) {
      worker = this._workers[id] = new B64Worker()
    }
    return worker
  },

  _releaseWorker: function(id) {
    var worker = this._workers[id]
    if (!worker) {
      return
    }

    return worker.settle().then(function() {
      delete this._workers[id]
    }.bind(this))
  },

  onLocalStateChange: function(props) {
    props = stripPrivate(props)
    if (_.isEmpty(props)) {
      return
    }
    this.ivy.send(this.channel + '/state', JSON.stringify(props))
  },

  onRemoteStateChange: function(path, data) {
    var props = JSON.parse(data)
    console.debug('state', props)
    this.looper.setState(props, true)
  },

  _sendLoopBuffer: function(id, callback) {
    this._getWorker(id).encode(this._sendBuffers[id]).then(function(str) {
      this.ivy.sendLarge(this.channel + '/loop/' + id + '/audio', str, callback)
    }.bind(this))
  },

  onStreamRecording: function(id, channelDatas) {
    if (!_.has(this._sendBuffers, id)) {
      this._sendBuffers[id] = []
    }

    channelDatas = channelDatas.map(function(array) {
      return array.buffer.slice(0)
    })
    this._sendBuffers[id].push(channelDatas)

    if (this._sendBuffers[id].length >= this.chunkSize) {
      this._sendLoopBuffer(id)
      delete this._sendBuffers[id]
    }
  },

  onStreamFinishRecording: function(id, bufferInfo) {
    var finish = function() {
      this.ivy.send(this.channel + '/loop/' + id + '/audio', JSON.stringify(bufferInfo))
      delete this._sendBuffers[id]
    }.bind(this)

    this._releaseWorker(id).then(function() {
      if (_.has(this._sendBuffers, id)) {
        // flush the chunk buffer
        this._sendLoopBuffer(id, finish)
      } else {
        finish()
      }
    }.bind(this))
  },

  onLocalLoopChange: function(id, props, loop) {
    props = stripPrivate(props)
    if (_.isEmpty(props)) {
      return
    }

    loop = stripPrivate(loop)
    this.ivy.send(this.channel + '/loop/' + id + '/control', JSON.stringify(loop))
  },

  onRemoteLoopChange: function(path, data) {
    path = path.split('/')
    path.shift()  // starting slash
    path.shift()  // channel
    path.shift()  // loop
    var id = path.shift()
    var kind = path.shift()
    if (kind == 'control') {
      var props = JSON.parse(data)
      console.debug('loop/control', id, props)
      this.looper.receiveLoopState(id, props, true)
    } else if (kind == 'audio') {
      if (data.fetch) {
        if (!this._fetches[id]) {
          this._fetches[id] = []
        }
        this._fetches[id].push(new Promise(function(resolve) {
          data.fetch(resolve)
        }))
        return
      }

      if (data[0] == '{') {
        Promise.all(this._fetches[id] || []).then(function() {
          delete this._fetches[id]
          this._releaseWorker(id).then(function() {
            console.debug('loop/audio complete', id)
            this.looper.finishReceiveLoopAudio(id, JSON.parse(data))
          }.bind(this))
        }.bind(this))
      } else {
        this._getWorker(id).decode(data).then(function(arrays) {
          this.looper.receiveLoopAudio(id, arrays)
        }.bind(this))
      }
    }
  },

  ensureLoopLoaded: function(id) {
    var loop = this.looper.loops[id]
    if (!loop._buffer) {
      this.ivy.load(this.channel + '/loop/' + id + '/audio')
    }
  }
})
