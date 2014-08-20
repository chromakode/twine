var EventEmitter = require('events')
var _ = require('lodash')

var quantize = require('./utils').quantize

Metronome = module.exports = function(ctx, destNode, clock) {
  this.ctx = ctx
  this.destNode = destNode
  this.clock = clock
  this._timeout = null
}

_.extend(Metronome.prototype, EventEmitter.prototype, {
  start: function() {
    if (this._timeout) {
      return
    }
    this.scheduleTick()
  },

  scheduleTick: function() {
    this.stop()

    var now = this.clock.syncedTime()
    var nextTick = this.clock.nextTickAfter(now + .05)
    var isBar = nextTick.toFixed(2) == this.clock.nextBarAfter(now + .05).toFixed(2)
    this._playTick(nextTick, isBar)

    var wait = (nextTick - now) * 1000
    this._timeout = setTimeout(this.tick.bind(this), wait)
  },

  tick: function() {
    this.emit('tick')
    this.scheduleTick()
  },

  stop: function() {
    if (this._timeout) {
      clearTimeout(this._timeout)
      this._timeout = null
    }
  },

  _playTick: function(time, isBar) {
    time = this.clock.audioTime(time)
    var o = this.ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = 440 * 3
    var g = this.ctx.createGain()
    g.gain.setValueAtTime(0, time)
    g.gain.linearRampToValueAtTime(isBar ? 6 : 2, time + .001)
    g.gain.linearRampToValueAtTime(0, time + .005)
    o.connect(g)
    g.connect(this.destNode)
    o.start(time)
    o.stop(time + .05)
    setTimeout(function() {
      o.disconnect(0)
      g.disconnect(0)
    }, (time - this.ctx.currentTime) * 1000 + 100)
  }
})
