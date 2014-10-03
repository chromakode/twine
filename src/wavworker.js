function wav(rate, channels) {
  // only implement 16 bit signed samples for now
  var bits = 16

  var sampleCount = channels[0].length
  var dataLength = sampleCount * channels.length * 2  // 2 bytes per sample
  var buffer = new Uint8Array(36 + dataLength)  // +36 for RIFF header
  var pos = 0

  function writeInt(n, bytes) {
    // Convert a number into a binary string of the specified byte length, little-endian.
    for (var i = 0; i < bytes; i++) {
      buffer[pos] = (n >> i*8) & 0xff
      pos++
    }
  }

  function writeStr(str) {
    for (var i = 0; i < str.length; i++) {
      buffer[pos] = str[i].charCodeAt(0)
      pos++
    }
  }

  // Thanks to https://ccrma.stanford.edu/courses/422/projects/WaveFormat/
  writeStr("RIFF")                               // Start of RIFF header
  writeInt(36 + dataLength, 4)                   // Rest of file size
  writeStr("WAVE")                               // Format
  writeStr("fmt ")                               // Subchunk 1 id
  writeInt(16, 4)                                // Subchunk size
  writeInt(1, 2)                                 // Linear quantization
  writeInt(channels.length, 2)                   // Channels
  writeInt(rate, 4)                              // Sample rate
  writeInt(rate * channels.length * bits/8, 4)   // Byte rate
  writeInt(channels.length * bits/8, 2)          // Block align
  writeInt(bits, 2)                              // Bits per sample
  writeStr("data")                               // Subchunk 2 id
  writeInt(dataLength, 4)                        // Subchunk size

  var scale = Math.pow(2, bits - 1)
  for (var i = 0; i < sampleCount; i++) {
    for (var c = 0; c < channels.length; c++) {
      var val = Math.floor(channels[c][i] * scale)
      writeInt(val, bits / 8)
    }
  }

  var blob = new Blob([buffer], {type: 'audio/wav'})
  return blob
}


onmessage = function(ev) {
  var d = ev.data
  var wavBlob = wav(d.sampleRate, d.channels)
  // FIXME: for some reason, passing wavBlob as a transferable fails :(
  postMessage(wavBlob)
  self.close()
}
