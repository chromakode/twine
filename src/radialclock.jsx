/** @jsx React.DOM */
var React = require('react')

svgRadial = require('./utils').svgRadial


module.exports = RadialClock = React.createClass({
  render: function() {
    var w = this.props.width
    var h = this.props.height
    var d = svgRadial(this.props.innerSize, this.props.outerSize, this.props.start, this.props.end)
    return (
      <svg className={'radial-clock ' + this.props.className} width={w} height={h}>
        <path d={d} transform={'translate(' + w/2 + ' ' + h/2 + ') rotate(-90 0 0)'} className={this.props.className} />
      </svg>
    )
  }
})
