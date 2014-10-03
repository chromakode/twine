var _ = require('lodash')
var Promise = require("bluebird")


WAVWORKER_URL = document.getElementById('wavworker').src


var wavAsync = module.exports = function(buffer) {
  var channels = []
  for (var c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c))
  }

  var worker = new Worker(WAVWORKER_URL)

  var promise = new Promise(function(resolve, reject) {
    worker.onerror = reject
    worker.onmessage = function(ev) {
      resolve(ev.data)
    }
  })

  // FIXME: passing channels as a transferable crashes Chrome
  worker.postMessage({
    sampleRate: buffer.sampleRate,
    channels: channels
  })
  return promise
}
