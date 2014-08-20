var b64ab = require('base64-arraybuffer')


cmds = {}

cmds.decode = function(str) {
  return str.split('|').map(function(itemStr) {
    return new Float32Array(b64ab.decode(itemStr))
  })
}

cmds.encode = function(arrays) {
  return arrays.map(function(array) {
    // kludge the array to be the right length, since b64ab doesn't know about the typed array offset
    return b64ab.encode(new Uint8Array(array.buffer, array.byteOffset, array.length * 4))
  }).join('|')
}


onmessage = function(ev) {
  postMessage({
    seq: ev.data.seq,
    payload: cmds[ev.data.cmd](ev.data.payload)
  })
}
