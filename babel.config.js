'use strict';

//KTODO: Usar una variable de entorno
let presets = null;
let plugins = null;

presets = ['@babel/preset-react'];
plugins = [
   [
      '@babel/plugin-transform-react-jsx',
      {
         useBuiltIns: false,
         imports: false,
      },
   ],
   [
      'emotion',
      {
         sourceMap: false,
         cssPropOptimization: true,
      },
   ],
];

module.exports = function(api) {
   api.cache(true);
   api.cache.forever();
   return {
      presets,
      plugins,
   };
};
