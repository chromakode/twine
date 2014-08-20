var _ = require('lodash')


module.exports.clamp = function(min, v, max) {
  return Math.min(Math.max(min, v), max)
}

module.exports.quantize = function(v, steps) {
  return Math.round(v * steps) / steps
}

module.exports.svgRadial = function(innerSize, outerSize, startFrac, endFrac) {
  var inner = innerSize
  var outer = outerSize
  var fracSize = Math.abs(endFrac - startFrac)
  var startAngle = 2 * Math.PI * startFrac
  var endAngle = 2 * Math.PI * endFrac
  var cosStartAngle = Math.cos(startAngle)
  var sinStartAngle = Math.sin(startAngle)
  var cosEndAngle = Math.cos(endAngle)
  var sinEndAngle = Math.sin(endAngle)
  var d = []
  d.push(['M', inner * cosStartAngle, inner * sinStartAngle])
  d.push(['A',
    // radius
    inner, inner,
    // flags
    0,
    fracSize >= .5 ? 1 : 0,
    startFrac < endFrac ? 1 : 0,
    // end point
    inner * cosEndAngle, inner * sinEndAngle
  ])
  if (outerSize) {
    d.push(['L', outer * cosEndAngle, outer * sinEndAngle])
    d.push(['A',
      // radius
      outer, outer,
      // flags
      0,
      fracSize >= .5 ? 1 : 0,
      startFrac < endFrac ? 0 : 1,
      // end point
      outer * cosStartAngle, outer * sinStartAngle
    ])
    d.push(['L', inner * cosStartAngle, inner * sinStartAngle])
    d.push('Z')
  }
  return _.flatten(d).join(' ')
}
