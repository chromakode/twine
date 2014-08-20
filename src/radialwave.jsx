/** @jsx React.DOM */
var React = require('react')

module.exports = RadialWave = React.createClass({
  componentDidMount: function() {
    this.drawnSample = 0
    this.draw()
  },

  componentDidUpdate: function() {
    this.draw()
  },

  shouldComponentUpdate: function(nextProps, nextState) {
    // note: assumes that buffer data does not change
    if (nextProps.loop._buffer != this.props.loop._buffer) {
      return true
    }

    if (nextProps.loop._recordSample == null) {
      return false
    }

    return nextProps.loop._recordSample > this.drawnSample
  },

  draw: function() {
    var ctx = this.getDOMNode().getContext('2d')

    var w = this.props.width
    var h = this.props.height
    var lineLength = w / 2 - this.props.innerSize

    var loop = this.props.loop
    var buffer = loop._buffer
    var channelCount = buffer.numberOfChannels

    var levelCount = Math.floor(2 * Math.PI * w)
    var levelLength = Math.floor(buffer.length / levelCount)
    var levelStep = Math.max(1, Math.floor(levelLength / lineLength)) * 10

    var startLevel, endLevel
    if (loop._recordSample) {
      startLevel = Math.floor(this.drawnSample / levelLength)
      endLevel = Math.ceil(loop._recordSample / levelLength)
      this.drawnSample = loop._recordSample
    } else {
      startLevel = 0
      endLevel = levelCount
    }

    ctx.save()
    ctx.translate(w/2, h/2)
    ctx.rotate(-Math.PI/2)
    for (var l = startLevel; l < endLevel; l++) {
      var sum = 0
      var count = 0
      for (var s = l * levelLength; s < (l + 1) * levelLength; s += levelStep) {
        for (var c = 0; c < channelCount; c++) {
          sum += Math.abs(buffer.getChannelData(c)[s])
          count++
        }
      }
      var avg = sum / count
      // scale the amplitude a bit so we can see quiet samples
      var amplitude = Math.pow(avg, 1/3)

      var a = 2 * Math.PI * l / levelCount
      var ca = Math.cos(a)
      var sa = Math.sin(a)
      var innerSize = this.props.innerSize
      var outerSize = innerSize + amplitude * (w / 2 - innerSize)
      ctx.beginPath()
      ctx.moveTo(ca * innerSize, sa * innerSize)
      ctx.lineTo(ca * outerSize, sa * outerSize)
      var d = 155 - Math.floor(amplitude * 100)
      ctx.strokeStyle = 'rgb(' + d + ', ' + d + ', ' + d + ')'
      ctx.lineWidth = 1
      ctx.stroke()
    }
    ctx.restore()
  },

  render: function() {
    return <canvas className="radial-wave" width={this.props.height} height={this.props.width} />
  }
})
