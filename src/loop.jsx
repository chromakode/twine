/** @jsx React.DOM */
var React = require('react/addons')
var RadialClock = require('./radialclock.jsx')
var RadialWave = require('./radialwave.jsx')
var RadialMenu = require('./radialmenu.jsx')

var clamp = require('./utils').clamp
var quantize = require('./utils').quantize


function isVisible(el) {
  return window.getComputedStyle(el).opacity != 0
}

module.exports = Loop = React.createClass({
  mixins: [React.addons.PureRenderMixin],

  getInitialState: function() {
    return {
      key: null,
      label: null,
      menuShowing: false,
      confirmArchive: false
    }
  },

  showMenu: function(ev) {
    if (this.state.editing) {
      return
    }

    // allow users to re-catch the fading menu, unless it has disappeared completely
    if (!isVisible(ev.currentTarget)) {
      return
    }

    this.setState({
      menuShowing: true
    })
  },

  hideMenu: function() {
    this.setState({
      menuShowing: false,
      confirmArchive: false
    })
  },

  onClick: function(ev) {
    if (this.state.editing) {
      return
    }

    var menuEl = this.refs.menu.getDOMNode()
    if (isVisible(menuEl) && menuEl.contains(ev.target)) {
      return
    }
    this.props.onClick(ev)
  },

  onAction: function(action) {
    var menuEl = this.refs.menu.getDOMNode()
    if (!isVisible(menuEl)) {
      return
    }

    if (action == 'archive' && !this.state.confirmArchive) {
      this.setState({confirmArchive: true})
    } else if (action == 'rename') {
      this.hideMenu()
      this.startEditing()
    } else {
      this.props.onAction(action)
    }
  },

  changeValue: function(ev) {
    var update = {}
    update[ev.target.name] = ev.target.value
    this.setState(update)
  },

  startEditing: function() {
    this.setState({
      key: this.props.loop.key,
      label: this.props.loop.label,
      editing: true
    })
    this.refs.labelEntry.getDOMNode().focus()
  },

  finishEditing: function() {
    if (!this.state.editing) {
      return
    }

    this.props.onRename({
      key: this.state.key,
      label: this.state.label
    })

    this.setState({
      key: null,
      label: null,
      editing: false
    })
  },

  onEditBlur: function(ev) {
    var formEl = this.refs.rename_form.getDOMNode()
    if (!formEl.contains(ev.relatedTarget)) {
      this.finishEditing()
    }
  },

  onEditSubmit: function(ev) {
    this.finishEditing()
    ev.preventDefault()
  },

  render: function() {
    var loop = this.props.loop

    var w = this.props.width
    var h = this.props.height

    var curBeat = this.props.curBeat

    // progress radial clock
    var percent
    if (loop.recording && loop._buffer) {
      percent = loop._recordSample / loop._buffer.length
    } else if (!loop.stopBeat || loop.stopBeat > curBeat) {
      if (loop.startBeat < curBeat) {
        percent = ((curBeat - loop.startBeat) / loop.beats) % 1
      } else if (loop._prevStartBeat < curBeat && loop._prevStopBeat > curBeat) {
        percent = ((curBeat - loop._prevStartBeat) / loop.beats) % 1
      }
    }
    percent = clamp(0, percent, 1)
    percent = percent && quantize(percent, 360)

    // display a radial clock when we're waiting for something queued
    var pendingPercent = null
    var pendingBase = 0
    if (loop.recording) {
      if (loop._recordStartBeat > curBeat) {
        // herald a recording take
        pendingPercent = ((curBeat - loop._recordStartBeat) / loop.beats) % 1
      }
    } else if (loop.startBeat && loop.startBeat > curBeat) {
      if (!loop.stopBeat || loop.stopBeat > loop.startBeat) {
        // herald a coming start to the loop
        pendingPercent = ((curBeat - loop.startBeat) / loop.beats) % 1
      }
    } else if (loop.stopBeat && loop.stopBeat > curBeat) {
      // herald an end to the loop
      pendingPercent = percent + ((loop.stopBeat - curBeat) / loop.beats) % 1
      pendingBase = percent
    }
    pendingPercent = pendingPercent && quantize(pendingPercent, 360)

    // make the radial clock jiggle with the beats
    var clockSize = w / 2
    if (percent && loop._buffer) {
      var count = 0
      var sum = 0
      var channelCount = loop._buffer.numberOfChannels
      for (var i = percent * loop._buffer.length - 1; i > 0; i -= 20) {
        i = Math.floor(i)
        for (var c = 0; c < channelCount; c++) {
          sum += Math.abs(loop._buffer.getChannelData(c)[i])
        }
        sum /= channelCount
        count++
        if (count > 10) {
          break
        }
      }
      clockSize *= (2/3) + (1/3) * Math.pow(sum / (count || 1), 1/3)
      clockSize = quantize(clockSize, 100)
    }

    var classes = React.addons.classSet({
      'loop': true,
      'editing': this.state.editing,
      'recording': loop.recording,
      'muted': loop._muted,
      'menu-showing': this.state.menuShowing,
      'confirm-archive': this.state.confirmArchive
    })

    var menuItems = [
      'rename',
      'archive',
      loop._muted ? 'unmute' : 'mute'
    ]

    // encode as a string so that PureRenderMixin can compare easily. maybe someday I'll encode these as child elements
    menuItems = menuItems.join('|')

    return (
      <div className={classes} onMouseLeave={this.hideMenu} onClick={this.onClick}>
        <RadialClock className="status" width={w} height={h} start={0} end={percent || 0} innerSize={w / 4} outerSize={clockSize} />
        {pendingPercent != null ? <RadialClock className="pending" width={w} height={h} start={pendingBase} end={pendingPercent} innerSize={w / 4} outerSize={w / 2} /> : null}

        {loop._buffer && <RadialWave width={w} height={h} innerSize={w / 4} loop={loop} curBeat={curBeat} />}

        <RadialMenu ref="menu" width={w} height={h} innerSize={w / 4} outerSize={w / 2} items={menuItems} onMouseEnter={this.showMenu} onAction={this.onAction} />
        <div className="menu-trigger" style={{width: w / 2, height: w / 2}} onMouseEnter={this.showMenu}>
          <form ref="rename_form" onSubmit={this.onEditSubmit}>
            <input className="key" name="key" type="text" value={this.state.editing ? this.state.key : this.props.loop.key} maxLength="1" placeholder="?" readOnly={!this.state.editing} onChange={this.changeValue} onBlur={this.onEditBlur} />
            <input className="label" name="label" ref="labelEntry" type="text" placeholder="untitled" value={this.state.editing ? this.state.label : this.props.loop.label} readOnly={!this.state.editing} onChange={this.changeValue} onBlur={this.onEditBlur} />
            <button type="submit" />
          </form>
        </div>
      </div>
    )
  }
})
