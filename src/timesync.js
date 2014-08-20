var EventEmitter = require('events')
var _ = require('lodash')
var Promise = require("bluebird")

ServerTimeSync = module.exports.ServerTimeSync = function(clock, client) {
  this.clock = clock
  this.client = client
}

_.extend(ServerTimeSync.prototype, EventEmitter.prototype, {
  samples: 5,
  spread: 100,
  interval: 60 * 1000,

  start: function() {
    this.offset = 0
    this.update()
  },

  update: function() {
    var self = this
    var promises = []
    for (var i = 0; i < this.samples; i++) {
      var p = new Promise(function(resolve) {
        function getTimestamp() {
          var requestTime = self.clock.now()
          self.client.ivy.getTimestamp(function(serverTime) {
            resolve({
              request: requestTime,
              server: serverTime,
              response: self.clock.now()
            })
          })
        }

        setTimeout(getTimestamp, i * self.spread)
      })
      promises.push(p)
    }

    Promise.all(promises).then(function(timings) {
      var offsetSum = 0
      _.each(timings, function(timing) {
        offsetSum += ((timing.server - timing.request) + (timing.server - timing.response)) / 2
      })
      this.offset = offsetSum / timings.length
      console.debug('[sync] offset', this.offset, 'from', timings.length, 'samples')
      this.emit('sync', this.offset)
      setTimeout(this.update.bind(this), this.interval)
    }.bind(this))
  }
})

// simple average delay consensus time offset synchronization
// TODO: rolling average offsets per client to accomodate jitter

AvgTimeSync = module.exports.AvgTimeSync = function(clock, client, ivyPath) {
  this.clock = clock
  this.client = client
  this.ivyPath = ivyPath
  this.offset = 0
  this.interval = 1
  this.correctionFactor = 2
  this.offsets = {}
}

_.extend(AvgTimeSync.prototype, EventEmitter.prototype, {
  start: function() {
    this.client.ivy.on(this.ivyPath + '/time', this._receiveTimestamp.bind(this))
    this.cycle()
  },

  _receiveTimestamp: function(path, data) {
    var id = path.split('/').pop()
    var ts = JSON.parse(data)
    var offset = this.clock.now() - ts
    this.offsets[id] = offset
    console.debug('[sync] recv offset', offset, 'from', id)
  },

  _sendTimestamp: function(ts) {
    this.client.ivy.send(this.ivyPath + '/time/' + this.client.id, JSON.stringify(ts))
  },

  _updateOffset: function() {
    if (_.isEmpty(this.offsets)) {
      return
    }

    var offsets = _.values(this.offsets)
    var sum = _.reduce(offsets, function(sum, x) {
      return sum + x
    })
    var avg = sum / (offsets.length + 1)  // include self with 0 offset in avg

    this.offset = ((this.correctionFactor - 1) * this.offset + avg) / this.correctionFactor
    this.offsets = {}

    this.emit('sync', this.offset)
  },

  cycle: function() {
    var now = this.clock.now()
    this._sendTimestamp(now)
    this._updateOffset()
    now -= this.offset
    var wait = (Math.round(now / this.interval) + 1) * this.interval - now
    setTimeout(this.cycle.bind(this), wait * 1000)
    console.debug('[sync] pulse', wait, this.offset)
  },
})
