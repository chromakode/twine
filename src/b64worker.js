var b64ab = require('base64-arraybuffer')


cmds = {}

cmds.decode = function(str) {
  return str.split('|').map(function(itemStr) {
    return new Float32Array(b64ab.decode(itemStr))
  })
}

cmds.encode = function(arrays) {
  var totalLen = 0
  for (var i = 0; i < arrays.length; i++) {
    totalLen += arrays[i][0].byteLength
  }

  var channelCount = arrays[0].length
  var channelDatas = []
  for (var c = 0; c < channelCount; c++) {
    channelDatas.push(new Uint8Array(totalLen))
  }

  var pos = 0
  for (var i = 0; i < arrays.length; i++) {
    for (var c = 0; c < channelCount; c++) {
      var buffer = arrays[i][c]
      var view = new Uint8Array(buffer)
      channelDatas[c].set(view, pos)
      pos += view.length
    }
  }

  return channelDatas.map(function(array) {
    // kludge the array to be the right length, since b64ab doesn't know about the typed array offset
    return b64ab.encode(array)
  }).join('|')
}


onmessage = function(ev) {
  postMessage({
    seq: ev.data.seq,
    payload: cmds[ev.data.cmd](ev.data.payload)
  })
}
