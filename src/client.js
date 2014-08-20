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

  // worker -> loop id mapping for async encode/decode
  this._workers = {}
}

_.extend(Client.prototype, {
  connect: function(host) {
    this.ivy = new Ivy(host + '/ivy')
    this.ivy.on('ready', this.onReady.bind(this))
  },

  onReady: function() {
    this.looper.on('state:change', this.onLocalStateChange.bind(this))
    this.ivy.load(this.channel + '/state', 1)
    this.ivy.on(this.channel + '/state', this.onRemoteStateChange.bind(this))

    this.looper.on('loop:record-progress', this.onStreamRecording.bind(this))
    this.looper.on('loop:record-finish', this.onStreamFinishRecording.bind(this))
    this.looper.on('loop:change', this.onLocalLoopChange.bind(this))
    this.looper.on('loop:play', this.ensureLoopLoaded.bind(this))
    this.ivy.load(this.channel + '/loop/*/control', 1)
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

  onStreamRecording: function(id, channelDatas) {
    var worker = new B64Worker()
    worker.encode(channelDatas).then(function(str) {
      this.ivy.send(this.channel + '/loop/' + id + '/audio', str)
    }.bind(this))
  },

  onStreamFinishRecording: function(id, bufferInfo) {
    this.ivy.send(this.channel + '/loop/' + id + '/audio', JSON.stringify(bufferInfo))
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

      var worker = this._workers[id]
      if (!worker) {
        worker = this._workers[id] = new B64Worker()
      }

      if (data[0] == '{') {
        worker.settle().then(function() {
          console.debug('loop/audio complete', id)
          this.looper.finishReceiveLoopAudio(id, JSON.parse(data))
          delete this._workers[id]
        }.bind(this))
      } else {
        worker.decode(data).then(function(arrays) {
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
