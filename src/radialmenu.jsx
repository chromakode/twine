/** @jsx React.DOM */
var _ = require('lodash')
var React = require('react/addons')

svgRadial = require('./utils').svgRadial


module.exports = RadialMenu = React.createClass({
  mixins: [React.addons.PureRenderMixin],

  onClick: function(ev) {
    var action = this.props.items.split('|')[ev.currentTarget.dataset.id]
    this.props.onAction(action)
  },

  render: function() {
    var w = this.props.width
    var h = this.props.height

    var middleRadius = this.props.innerSize + (this.props.outerSize - this.props.innerSize) / 2
    var fontSize = middleRadius / 4

    var menuItems = this.props.items.split('|')
    var menuFrac = 1 / menuItems.length

    var defs = []
    var buttons = []
    _.each(menuItems, function(menuText, idx) {
      var startFrac = idx * menuFrac
      var endFrac = (idx + 1) * menuFrac

      if (startFrac < .25) {
        var textD = svgRadial(middleRadius - fontSize / 3, null, startFrac, endFrac)
      } else {
        var textD = svgRadial(middleRadius + fontSize / 4, null, endFrac, startFrac)
      }
      defs.push(<path key={idx} id={'text-path-' + idx} d={textD} />)

      var itemD = svgRadial(this.props.innerSize, this.props.outerSize, startFrac, endFrac)
      buttons.push(
        <g key={idx} data-id={idx} className={'item ' + menuText} onClick={this.onClick}>
          <path d={itemD} className="item" />
          <text textAnchor="middle" fontSize={fontSize + 'px'} dangerouslySetInnerHTML={{__html: '<textPath startOffset="50%" xlink:href="#text-path-' + idx + '">' + _.escape(menuText) +  '</textPath>'}} />
        </g>
      )
    }, this)

    // wrap with a div because css transitioning the <svg> behaves oddly in Chrome
    return (
      <div className="radial-menu" onMouseEnter={this.props.onMouseEnter}>
        <svg width={w} height={h}>
          <g transform={'translate(' + w/2 + ' ' + h/2 + ') rotate(' + (360 * (-menuFrac / 2) - 90) + ' 0 0)'}>
            <defs>
              {defs}
            </defs>
            {buttons}
          </g>
        </svg>
      </div>
    )
  }
})
