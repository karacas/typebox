const auxBabel = require('@aux/aux_babel.js');

const requireCompo = compo => {
   compo = compo.replace('.jsx', '').replace('.js', '');
   compo = `@components/${compo}.jsx`;
   let $compo = require(auxBabel.replaceJSX(compo));
   return $compo;
};

module.exports.requireCompo = requireCompo;
