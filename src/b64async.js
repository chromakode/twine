var _ = require('lodash')
var Promise = require("bluebird")


B64WORKER_URL = document.getElementById('b64worker').src


B64Worker = module.exports = function() {
  this._seq = -1
  this._waiting = {}

  this.worker = new Worker(B64WORKER_URL)

  this.worker.onmessage = this.onMessage.bind(this)
  this.worker.onerror = this.onError.bind(this)
}

_.extend(B64Worker.prototype, {
  onMessage: function(ev) {
    var waiting = this._waiting[ev.data.seq]
    if (waiting) {
      waiting.resolve(ev.data.payload)
    }
  },

  onError: function(ev) {
    for (var key in this._waiting) {
      if (!this._waiting.hasOwnProperty(key)) {
        continue
      }

      this._waiting[key].reject(ev)
    }
  },

  _queue: function(seq) {
    var waiting = this._waiting[seq]
    if (waiting) {
      return waiting.promise
    }

    var deferred = {}
    deferred.promise = new Promise(function(resolve, reject) {
      deferred.resolve = resolve
      deferred.reject = reject
    })

    this._waiting[seq] = deferred
    return deferred.promise
  },

  _doCmd: function(cmd, payload) {
    this._seq++

    var promise = this._queue(this._seq)

    this.worker.postMessage({
      seq: this._seq,
      cmd: cmd,
      payload: payload
    })

    return promise
  },

  decode: function(str) {
    return this._doCmd('decode', str)
  },

  encode: function(arrays) {
    return this._doCmd('encode', arrays)
  },

  settle: function() {
    return this._queue(this._seq)
  }
})
