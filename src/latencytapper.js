var _ = require('lodash')


module.exports = LatencyTapper = function(clock) {
  this.clock = clock
  this.latencyTaps = []
}

_.extend(LatencyTapper.prototype, {
  tap: function() {
    var beat = this.clock.beatTime()
    if (beat < 0) {
      // no time travelers here!
      return
    }

    beat = beat - Math.round(beat)
    var offset = this.clock.beatsToSeconds(beat)
    this.latencyTaps.push(offset)

    var samples = _.last(this.latencyTaps, 30)
    var sum = _.reduce(samples, function(a, b) {
        return a + b
    }, 0)

    return sum / samples.length
  }
})
