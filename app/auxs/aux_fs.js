'use strict';
const fs = require('fs');
const path = require('path');
const mkpath = require('make-dir');
const moveFile = require('move-file');
const JSON5 = require('json5');
const logger = require('@main/main_logger.js');
const global_aux = require('@aux/aux_global.js');
const isValidPath = require('is-valid-path');
const lrucache = require('lru-cache');
const rimraf = require('rimraf');
const get = global_aux.get;
const cache_pathExists = new lrucache({ max: 4096 * 2, maxAge: 1000 });

let yaml = null;

//_________________________________________
//GenericJson
//_________________________________________
//KTODO PARAMETRIZAR EL TIPO
function saveGenericJson(data, fileName, async = false) {
   if (async) {
      return new Promise((resolve, reject) => {
         if (!existsSync(path.dirname(fileName))) mkpath.sync(path.dirname(fileName));
         fs.writeFile(fileName, JSON.stringify(data), err => {
            if (err) {
               reject(err);
               return;
            }
            resolve();
         });
      });
   }
   return saveFileSync(fileName, data, 'json');
}

function _isValidAndSecurePath($path) {
   if (!$path || typeof $path !== 'string') return false;
   if ($path.length < 3 && !$path.startsWith('/')) return false;
   $path = global_aux.normalicePath($path);
   //KTODO: Agregar seguridad
   return isValidPath($path);
}

function _isPath($path) {
   if (!$path || typeof $path !== 'string') return false;
   if ($path.length < 3 && !$path.startsWith('/')) return false;
   $path = global_aux.normalicePath($path);
   return isValidPath($path) && existsSync($path);
}

function existsSync(filename) {
   try {
      fs.accessSync(filename);
      return true;
   } catch (ex) {
      return false;
   }
}

function pathExists($path, withCache = false) {
   if (!$path || typeof $path !== 'string') return false;

   if (withCache) {
      const cache = cache_pathExists.get($path);
      if (cache) return cache;
   }

   const exists = existsSync($path);
   if (withCache) cache_pathExists.set($path, exists);

   return exists;
}

const fileExists = pathExists;

function loadGenericJson(fileName, useBackup = false) {
   let genericJson = existsSync(fileName) ? loadFileSync(fileName, 'json') : null;

   if (!useBackup) {
      return genericJson;
   }

   if (genericJson && typeof genericJson === 'object') {
      //make backup
      if (existsSync(`${fileName}.bak`)) {
         fs.rename(`${fileName}.bak`, `${fileName}.bak2`, () => {});
      }
      saveFileSync(`${fileName}.bak`, genericJson, 'json');
   } else {
      //try bakup
      genericJson = loadFileSync(`${fileName}.bak`, 'json');
   }

   return genericJson;
}

//_________________________________________
//INTERNAL AUX
//_________________________________________

function loadFileSync(filename, type, printError = true) {
   let result = null;

   if (type && type.length > 0) type = type.toLowerCase();
   let originalType = type;

   if (!type || type === 'auto') {
      let extension = path.extname(filename).toLowerCase();
      if (extension === '.yaml') type = 'yaml';
      if (extension === '.yml') type = 'yaml';
      if (extension === '.json5') type = 'json5';
      if (extension === '.json') type = 'json';
      if (extension === '.txt') type = 'plain';
      if (extension === '.html') type = 'plain';
      if (extension === '.css') type = 'plain';
      if (extension === '.js') type = 'plain';
   }

   if (existsSync(filename)) {
      if (!type || type === null) {
         try {
            result = fs.readFileSync(filename);
         } catch (e) {
            result = null;
         }
      } else if (type === 'plain') {
         try {
            result = fs.readFileSync(filename, 'utf8');
         } catch (e) {
            result = null;
         }
      } else if (type === 'yaml') {
         yaml = yaml || require('js-yaml');
         try {
            const file = fs.readFileSync(filename, 'utf8');
            result = yaml.safeLoad(file);
         } catch (e) {
            result = null;
         }
      } else if (type === 'json') {
         let $fileData = fs.readFileSync(filename, 'utf8');
         try {
            result = JSON.parse($fileData);
         } catch (e) {
            try {
               result = JSON5.parse($fileData);
            } catch (e) {
               result = null;
            }
         }
      } else if (type === 'json5') {
         try {
            result = JSON5.parse(fs.readFileSync(filename, 'utf8'));
         } catch (e) {
            result = null;
         }
      }

      if (result === null && originalType === 'auto') {
         let flieData = null;

         //try JSON
         if (!result || typeof result !== 'object') {
            try {
               result = JSON.parse(flieData);
            } catch (e) {
               result = null;
            }
         }

         //try yaml
         if (!result || typeof result !== 'object') {
            yaml = yaml || require('js-yaml');
            try {
               const file = fs.readFileSync(filename, 'utf8');
               result = yaml.safeLoad(file);
            } catch (e) {
               result = null;
            }
         }

         //try JSON5
         if (!result || typeof result !== 'object') {
            try {
               result = JSON5.parse(flieData);
            } catch (e) {
               result = null;
            }
         }
      }
   }

   if (!result && result !== '') {
      if (printError && logger.warn) {
         logger.warn('Cant Loading: ', filename, result, type);
      }
   }

   return result;
}

function saveFileSync(filename, data, type = 'plain', async = false) {
   let result = false;

   //KTODO: Validar q filename sea un archivo y sea seguro

   if (!filename && logger.error) {
      logger.error('No filename:', filename);
      return;
   }

   if (!_isValidAndSecurePath(path.dirname(filename))) {
      if (logger.error) logger.error('[saveFileSync] no valid path', path.dirname(filename), filename);
      return false;
   }

   try {
      mkpath.sync(path.dirname(filename));
   } catch (err) {
      if (logger.error) logger.error('[saveFileSync] mkpath', filename, err);
      return false;
   }

   if (type && type.length > 0) type = type.toLowerCase();

   try {
      if (type === 'plain' || type === 'text' || type === 'txt' || type === null) {
         data = String(data);
      }
      if (type === 'json') {
         data = JSON.stringify(data);
      }
      if (type === 'json5') {
         data = JSON5.stringify(data, null, 4);
      }

      if (async) {
         return new Promise((resolve, reject) => {
            fs.writeFile(filename, data, err => {
               if (err) {
                  reject(err);
                  return;
               }
               resolve();
               return;
            });
         });
      }

      result = fs.writeFileSync(filename, data);
   } catch (err) {
      //KTODO: make Logger
      if (logger.error) logger.error('[saveFileSync] writeFileSync', filename, err);
      return false;
   }

   return true;
}

module.exports = {
   saveGenericJson,
   loadGenericJson,
   loadFileSync,
   saveFileSync,
   getFile: loadFileSync,
   setFile: saveFileSync,
   _isPath,
   fileExists,
   pathExists,
   _isValidAndSecurePath,
   mkpath,
   fileDelete: rimraf,
   normalicePath: global_aux.normalicePath,
   moveFile,
};
