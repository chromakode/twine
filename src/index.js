//
// loopre
// by Max Goodman (chromakode)
//

var React = require('react')
var _ = require('lodash')

var Client = require('./client')
var Looper = require('./looper')
var Loops = require('./loops.jsx')

window.Ivy = require('ivy-client')


var channelMatch = location.pathname.match(/\/play\/(\w+)/)
if (!channelMatch) {
  document.write('invalid channel')
}
var channel = channelMatch[1]

var ui = window.ui = React.renderComponent(
  Loops({
    ready: false,
    curBeat: null,
    looper: null
  }),
  document.getElementById('content')
)

document.addEventListener('keydown', function(ev) {
  if (ev.target.localName == 'input') {
    return
  }
  ui.onKeyPress(ev)
}, false)

navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia
window.AudioContext = window.AudioContext || window.webkitAudioContext

navigator.getUserMedia({audio: true},
  function success(inStream) {
    var ctx = new AudioContext()

    var looper = window.looper = new Looper(ctx, inStream)
    looper.outNode.connect(ctx.destination)

    var client = window.client = new Client(channel, ui, looper)
    client.connect(location.hostname)

    ui.setProps({
      ready: true,
      name: client.channel,
      looper: looper
    })

    looper.on('change', function() {
      this.ui.setProps({looper: looper})
    }.bind(this))

    function updateClock() {
      ui.setProps({
        curBeat: looper.clock.beatTime()
      })
      requestAnimationFrame(updateClock)
    }
    updateClock()

    window.reactPerf = React.addons.Perf
  },
  function fail() {
    // FIXME
  }
)
