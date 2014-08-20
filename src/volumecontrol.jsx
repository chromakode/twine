/** @jsx React.DOM */
var React = require('react')

var clamp = require('./utils').clamp


module.exports = VolumeControl = React.createClass({
  getInitialState: function() {
    return {
      dragging: false
    }
  },

  onClick: function(ev) {
    if (ev.target.className == 'level' || ev.target.className == 'active') {
      return
    }

    var muted = !this.props.muted
    var level = this.props.level
    if (!muted && level == 0) {
      level = .75
    }
    this.props.onChange(muted, level)
  },

  onMouseDown: function(ev) {
    if (ev.button != 0) {
      return
    }

    this._drag(ev)
    this.setState({dragging: true})
    document.body.style.cursor = 'pointer'
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
  },

  onMouseUp: function() {
    this.setState({dragging: false})
    document.body.style.cursor = null
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
  },

  onMouseMove: function(ev) {
    if (this.state.dragging) {
      this._drag(ev)
    }
  },

  _drag: function(ev) {
    var levelEl = this.refs.level.getDOMNode()
    var level = clamp(0, (ev.clientX - levelEl.offsetLeft) / levelEl.clientWidth, 1)
    level = Math.round(level * 1000) / 1000
    this.props.onChange(level == 0, level)
  },

  render: function() {
    var classes = React.addons.classSet({
      'volume-control': true,
      'muted': this.props.muted || this.props.level == 0
    })

    var levelStyle = {
      width: Math.round(100 * this.props.level) + '%'
    }

    return (
      <div className={classes} onClick={this.onClick}>
        <div className="icon" />
        <div ref="level" className="level" onMouseDown={this.onMouseDown} onMouseUp={this.onMouseUp} onMouseMove={this.onMouseMove}>
          <div className="active" style={levelStyle}></div>
        </div>
      </div>
    )
  }
})
