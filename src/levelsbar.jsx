/** @jsx React.DOM */
var _ = require('lodash')
var React = require('react/addons')


module.exports = LevelsBar = React.createClass({
  mixins: [React.addons.PureRenderMixin],

  getInitialState: function() {
    levels = []
    for (var i = 0; i < this.props.levels.channelCount; i++) {
      levels.push({
        avg: 0,
        max: 0,
        clip: false
      })
    }

    return {
      levels: levels
    }
  },

  componentDidMount: function() {
    this.props.levels.on('levels', this.setState.bind(this))
  },

  render: function() {
    var bars = _.map(this.state.levels, function(channel, idx) {
      var containerClasses = React.addons.classSet({
        'container': true,
        'clip': channel.clip
      })
      return (
        <div key={idx} className={containerClasses}>
          <div className="bar avg" style={{width: Math.round(100 * channel.avg) + '%'}} />
          <div className="bar max" style={{width: Math.round(100 * channel.max) + '%'}} />
        </div>
      )
    }, this)

    return (
      <div className="levels-meter">
        {bars}
      </div>
    )
  }
})
