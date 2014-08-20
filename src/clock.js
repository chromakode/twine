var _ = require('lodash')

var audio = require('./audio')
var ServerTimeSync = require('./timesync').ServerTimeSync


function now() {
  return (performance.timing.navigationStart + performance.now()) / 1000
}

module.exports = Clock = function(ctx) {
  this.ctx = ctx
  this.ctxStartTime = 0
  this.offset = 0
  this.latency = 0
}

_.extend(Clock.prototype, {
  start: function() {
    audio.startClock(this.ctx)
    this.ctxStartTime = now() - this.ctx.currentTime
  },

  setOffset: function(offset) {
    this.offset = offset
  },

  setRhythm: function(bpm, beatsPerBar) {
    this.bpm = bpm
    this.beatsPerBar = beatsPerBar
  },

  setLatency: function(latency) {
    this.latency = latency
  },

  now: function() {
    return this.ctxStartTime + this.ctx.currentTime
  },

  syncedTime: function() {
    return this.now() + this.offset
  },

  beats: function(time) {
    return time / (60 / this.bpm)
  },

  beatsToSeconds: function(beats) {
    return beats * (60 / this.bpm)
  },

  snappedBeats: function(beats, snap) {
    return snap ? Math.ceil(beats / snap) * snap : beats
  },

  beatTime: function() {
    return this.beats(this.syncedTime())
  },

  snappedBeatTime: function(snap) {
    return this.snappedBeats(this.beatTime(), snap)
  },

  beatLatency: function() {
    return this.beats(this.latency)
  },

  audioTime: function(time) {
    return time - this.ctxStartTime - this.offset
  },

  // FIXME: this name is really long
  beatTimeToAudioTime: function(beatTime) {
    return this.audioTime(beatTime * (60 / this.bpm))
  },

  _nextAfter: function(time, period) {
    return (Math.floor(time / period) + 1) * period
  },

  nextTickAfter: function(time) {
    return this._nextAfter(time, 60 / this.bpm)
  },

  nextBarAfter: function(time) {
    return this._nextAfter(time, this.beatsPerBar * (60 / this.bpm))
  }
})
