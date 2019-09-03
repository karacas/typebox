'use strict';
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const { replaceJSX } = require('@aux/aux_replace_jsx.js');
let _loadJSX = Config.get('here_are_dragons.loadJSX');
let _init = false;

const init = () => {
   if (_init) return;
   _init = true;

   /*[@babel/sucrase]  JSX*/
   if (_loadJSX) {
      try {
         let register;
         if (!true) {
            require('@babel/register')({ ignore: ['node_modules'], extensions: ['.jsx'] });
            register = '@babel';
         } else {
            require('sucrase/register/jsx');
            register = 'sucrase';
         }
         Logger.log('[@babel/sucrase] register ok / register: ', register);
         _loadJSX = true;
      } catch (e) {
         Logger.warn('[@babel/sucrase] require fail', e);
         _loadJSX = false;
      }
   }
};

const _require = (dir, file) => {
   if (!dir || !file) return null;
   init();
   let result = null;
   if (_loadJSX) {
      try {
         result = require(file);
         Logger.log('[@babel/sucrase] / require JSX', file);
      } catch (e) {
         result = null;
         Logger.warn('[@babel/sucrase] fail require JSX', file);
      }
   }

   if (result === null) {
      const $file = replaceJSX(file);
      result = require($file);
      Logger.log('[@babel/sucrase] / require JSX transpiled', file, $file);
   }
   return result;
};

const _replaceJSX = file => {
   if (_loadJSX) {
      Logger.info('[@babel/sucrase] / require JSX', file);
      return file;
   } else {
      let $file = replaceJSX(file);
      Logger.log('[@babel/sucrase] / require', file, 'JS transpiled', $file);
      return $file;
   }
};

module.exports.init = init;
module.exports.require = _require;
module.exports.replaceJSX = _replaceJSX;
module.exports.useJSX = !!_loadJSX;
