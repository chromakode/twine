module.exports.startClock = function(ctx) {
  // the AudioContext doesn't start the clock until a node is connected to destination
  var o = ctx.createOscillator()
  o.connect(ctx.destination)
  o.disconnect()
}

module.exports.createBuffer = function(ctx, channelCount, sampleCount) {
  return ctx.createBuffer(channelCount, sampleCount, ctx.sampleRate)
}

module.exports.resizeBuffer = function(ctx, oldBuffer, sampleCount) {
  var newBuffer = ctx.createBuffer(oldBuffer.numberOfChannels, sampleCount, ctx.sampleRate)

  for (var c = 0; c < oldBuffer.numberOfChannels; c++) {
    var data = oldBuffer.getChannelData(c)
    if (sampleCount < oldBuffer.length) {
      data = data.subarray(0, sampleCount)
    }
    newBuffer.getChannelData(c).set(data)
  }
  return newBuffer
}

module.exports.play = function(ctx, destNode, buffer, startTime) {
  var bufferNode = ctx.createBufferSource()

  bufferNode.buffer = buffer
  bufferNode.loop = true
  bufferNode.connect(destNode)
  var now = ctx.currentTime
  var startTime = startTime || now
  var offset = 0
  if (startTime < now) {
    offset = (now - startTime) % buffer.duration
    startTime = now
  }
  bufferNode.start(startTime, offset)

  return {
    startTime: startTime,
    stop: function(stopTime) {
      bufferNode.stop(stopTime)
      setTimeout(function() {
        bufferNode.disconnect(0)
      }, Math.max(0, stopTime - ctx.currentTime) * 1000)
    }
  }
}
