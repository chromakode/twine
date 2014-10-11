var EventEmitter = require('events')
var _ = require('lodash')

var clamp = require('./utils').clamp


Levels = module.exports = function(ctx, inNode) {
  this.ctx = ctx
  this.inNode = inNode
  this.channelCount = this.inNode.numberOfOutputs
  this.analyseNode = this.ctx.createScriptProcessor(0, this.channelCount, this.channelCount)
  this.bufferSize = this.analyseNode.bufferSize
  this.analyseNode.addEventListener('audioprocess', this._update.bind(this))
  this.inNode.connect(this.analyseNode)
  this.analyseNode.connect(this.ctx.destination)
}

_.extend(Levels.prototype, EventEmitter.prototype, {
  _update: function(ev) {
    var levels = []
    var channelDatas = []
    var buf = ev.inputBuffer
    var startTime = this.ctx.currentTime - buf.length / this.ctx.sampleRate
    for (var c = 0; c < buf.numberOfChannels; c++) {
      var data = buf.getChannelData(c)
      channelDatas.push(data)
      var sum = 0
      var sampleCount = 100
      var step = Math.floor(data.length / sampleCount)
      for (var i = 0; i < data.length; i += step) {
        sum += Math.abs(data[i])
      }
      var avg = sum / sampleCount
      var max = _.max(data)

      levels.push({
        avg: clamp(0, avg, 1),
        max: clamp(0, max, 1),
        clip: max >= 1
      })
    }

    this.emit('levels', {
      startTime: startTime,
      max: _.max(_.pluck(levels, 'max')),
      levels: levels,
      channelDatas: channelDatas
    })
  }
})
