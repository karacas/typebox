'use strict';

const ReactDom = require('react-dom');
const themeManager = require('@render/theme_manager.js');

function init() {
   themeManager.init(document);

   const render = () => ReactDom.render(<div>aaa</div>, document.getElementById('contentReact'));

   setTimeout(render);
   themeManager.removeLoader();
}

module.exports.init = init;
