const React = require('react');
const { useEffect } = React;
const { get, cloneDeep, equal } = require('@aux/aux_global.js');
const { has } = require('lodash');

let mrdoob_stats = null;
let statsjs = null;
let animate = null;

const viewStats = el => {
   if (!el) return;
   statsjs = statsjs || require('stats-js');
   if (!mrdoob_stats) {
      mrdoob_stats = new statsjs();
      mrdoob_stats.showPanel(0);
   }
   animate = () => {
      if (!(document && document.getElementById('mrdoob_stats'))) {
         resetView();
         return;
      }
      mrdoob_stats.update();
      requestAnimationFrame(animate);
   };
   el.appendChild(mrdoob_stats.dom);
   requestAnimationFrame(animate);
};

const resetView = () => {
   animate = () => {};
};

const MrDoobStatsChild = props => {
   useEffect(() => {
      if (props.enabled) {
         document && viewStats(document.getElementById('mrdoob_stats'));
      } else {
         resetView();
      }
   }, [props.enabled]);
   return props.enabled ? <div id="mrdoob_stats" /> : null;
};

module.exports = MrDoobStatsChild;
