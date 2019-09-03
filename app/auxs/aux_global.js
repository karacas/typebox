'use strict';

const { mergeWith, debounce, cloneDeep, get, memoize, has } = require('lodash');
const { makeHash } = require('./aux_crypt.js');
const { promisify } = require('util');
const mkpath = require('make-dir');
const fs = require('fs');
const path = require('path');
const mergeOptions = require('merge-options');
const resolvePath = require('object-resolve-path');
const equal = require('fast-deep-equal');
const removeDiacritics = require('diacritics').remove;
const lrucache = require('lru-cache');
const $timeout = ms => new Promise(res => setTimeout(res, ms));
const cache_normalize = new lrucache({ max: 4096 * 2 });
const isString = val => typeof val === 'string';

const deepClone30 = obj => {
   if (obj == null || typeof obj === 'string') return obj;
   let clone = Object.assign({}, obj);
   Object.keys(clone).forEach(key => (clone[key] = typeof obj[key] === 'object' ? deepClone30(obj[key]) : obj[key]));
   return Array.isArray(obj) && obj.length ? (clone.length = obj.length) && Array.from(clone) : Array.isArray(obj) ? Array.from(obj) : clone;
};

const _memoizeDebounce = (func, wait = 0, options = {}) => {
   let mem = memoize(param => {
      return debounce(func, wait, options);
   });
   return param => {
      mem(param)(param);
   };
};

const uniqueElementsBy = (arr, fn) =>
   arr.reduce((acc, v) => {
      if (!acc.some(x => fn(v, x))) acc.push(v);
      return acc;
   }, []);

const _cloneDeep = obj => {
   if (!obj || typeof obj === 'string' || typeof obj === 'number') return obj;
   if (typeof obj !== 'object') return cloneDeep(obj);
   return JSON.parse(JSON.stringify(obj));
};

const _get = (o, path) => {
   if (!o || !path || typeof o !== 'object' || typeof path !== 'string') return o;

   //No valid path to object-resolve-path
   if (path.indexOf('-') !== -1) return get(o, path);

   return resolvePath(o, path);
};

const customizer = (objValue, srcValue) => {
   if (Array.isArray(srcValue)) {
      return srcValue;
   }
};

const isExist = obj => {
   return !(null === obj || undefined === obj);
};

let yieldablejson = null;
const JSON_parse_async = async data => {
   yieldablejson = yieldablejson || require('yieldable-json');
   return new Promise(async (resolve, reject) => {
      if (!data) {
         resolve(null);
         return;
      }
      yieldablejson.parseAsync(data, (err, data) => {
         if (err) data = null;
         resolve(data);
      });
   });
};

const extendObj = (obj1, obj2, obj3, $customizer) => {
   //KTDO: ver https://github.com/zxdong262/recursive-assign está bueno!
   if (!$customizer) $customizer = customizer;
   if (!obj3) {
      return mergeWith(obj1, obj2, $customizer);
   } else {
      return mergeWith(obj1, obj2, obj3, $customizer);
   }
};

const mergeObj = (obj1, obj2, obj3) => {
   if (!obj3) {
      return mergeOptions(obj1, obj2);
   } else {
      return mergeOptions(obj1, obj2, obj3);
   }
};

const getDirectories = srcpath => {
   if (typeof srcpath !== 'string') return [];
   srcpath = normalicePath(srcpath);
   return fs.readdirSync(srcpath).filter(file => {
      return fs.statSync(normalicePath(path.join(srcpath, '/', file))).isDirectory();
   });
};

const getFiles = (dir, funcFilter) => {
   if (!fs.existsSync(dir)) {
      mkpath.sync(dir);
   }

   let dirFiles = fs.readdirSync(dir);
   if (funcFilter) dirFiles = dirFiles.filter(funcFilter);

   return dirFiles.map(file => {
      let name = `${dir}/${file}`;
      name = normalicePath(name, false);
      if (fs.statSync(name).isDirectory()) {
         return getFiles(name);
      } else {
         return name;
      }
   });
};

const getFilesAsync = async (dir, funcFilter) => {
   return new Promise(async res => {
      const _exist = await promisify(fs.exists)(dir);

      if (!_exist) {
         mkpath.sync(dir);
      }

      let dirFiles = await promisify(fs.readdir)(dir);
      if (funcFilter) dirFiles = dirFiles.filter(funcFilter);

      let result = [];

      await Promise.all(
         dirFiles.map(async file => {
            let name = `${dir}/${file}`;
            name = normalicePath(name, false);
            const isDir = await promisify(fs.stat)(name);
            if (isDir.isDirectory()) {
               const moreFiles = await getFilesAsync(name);
               result = result.concat(moreFiles);
            } else {
               result.push(name);
            }
            return;
         })
      );

      res([...result]);
   });
};

const bindKet2actualOs = bind => {
   if (!bind) return '';
   let mod = 'ctrl';
   if (process.platform === 'darwin') mod = 'command';
   return bind.replace('mod', mod);
};

const getKeyFromConfig = (arr, action) => {
   let k = (arr || []).find(k => k.action === action);
   if (!k || !k.keys) return '';
   k = k.keys[0];
   return bindKet2actualOs(k);
};

const getAllKeysFromConfig = (arr, action) => {
   let k = (arr || []).find(k => k.action === action);
   if (!k || !k.keys) return '';
   return k.keys.map(bindKet2actualOs);
};

const krange = ($value, $oldMin, $oldMax, $newMin, $newMax, $outPutLimit) => {
   let oldMin = $oldMin || 0;
   let oldMax = $oldMax || 1;
   let newMin = $newMin || 0;
   let newMax = $newMax || 1;
   let outPutLimit = $outPutLimit || false;

   let range1 = ($value - oldMin) / (oldMax - oldMin);
   let range2 = (newMax - newMin) * range1 + newMin;

   if (outPutLimit) {
      if (range2 < newMin) range2 = newMin;
      if (range2 > newMax) range2 = newMax;
   }

   return range2;
};

const aux_getDirName = $__dirname => {
   let __$dirname = String($__dirname);
   if (__$dirname.includes('resources')) {
      __$dirname = __$dirname.slice(0, __$dirname.indexOf('resources'));
   }
   if (__$dirname.includes('node_modules')) {
      __$dirname = __$dirname.slice(0, __$dirname.indexOf('node_modules'));
   }
   return normalicePath(__$dirname, false);
};

const process_env = process.env;

const pathsReplaceEnvVar = p => {
   if (process.platform !== 'win32' || p.indexOf('%') === -1) return p;
   return path.normalize(
      String(p).replace(/%([^%]+)%/g, (_, n) => {
         let val = process_env[n];
         if (!val || val == 'undefined') val = null;
         return val || n;
      })
   );
};

const normalicePath = (p, replaceWinSlash = false) => {
   if (!p) return p;

   const cacheArgs = p + replaceWinSlash;
   const cacheP = cache_normalize.get(cacheArgs);
   if (cacheP) {
      return cacheP;
   }

   let $p = path.normalize(p);
   $p = pathsReplaceEnvVar(p);
   $p = $p.replace(/(\\\/|\/\\|\/\/\/\/|\/\/|\\\\|\\)/g, '/');

   if (replaceWinSlash && process.platform === 'win32') $p = $p.replace(/(\/)/g, '\\');

   cache_normalize.set(cacheArgs, $p);

   return $p;
};

const normaliceString = str => {
   if (!str) return '';
   str = extractSnippet(String(str));
   return str.replace(/\u200B/g, '').replace(/\u00a0/g, ' ');
};

const extractSnippet = str => {
   // betwin ```snip <something> ```
   if (str.indexOf('```') != -1 && str.split('```').length > 2) {
      if (/```.*snip/.test(str)) {
         //REMOVE FIRST LINE OF ``` snip
         str = str.replace(/(.*?|\n)+?```.*snip.*\n/, '');
      } else {
         //REMOVE FIRST LINE OF ```
         str = str.replace(/(.*?|\n)+?```.*\n/, '');
      }
      //REMOVE SECOND LINE OF ``` .*
      str = str.replace(/(\n)(.*)```(.*?|\n)+/, '');
   }
   return str;
};

const filterPromise = async (arr, callback) => {
   const fail = Symbol();
   return (await Promise.all(arr.map(async item => ((await callback(item)) ? item : fail)))).filter(i => i !== fail);
};

const isFunction = val => typeof val === 'function';

const NULL_FUNCT = () => null;

const textToHTML = text => {
   if (typeof text !== 'string') {
      logger.warn('[textToHTML]', text, 'is no string  / ', typeof text);
      return '';
   }
   return `${text || ''}` // make sure it is a string;
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\t/g, '    ')
      .replace(/ /g, '&nbsp;')
      .replace(/\r\n|\r|\n/g, '<br />');
};

let _escape = null;
const escapeCodeHTML = text => {
   _escape = _escape || require('escape-html');
   return _escape(text);
};

const safeResult = param => {
   // safeResult(()=>a.b)
   try {
      return param();
   } catch (e) {
      return null;
   }
};

const safeSet = param => {
   // let a = {b:2}
   // safeSet(()=>a.b = 1)
   try {
      return param();
   } catch (e) {
      return null;
   }
};

function json_pretty(json) {
   return JSON.stringify(JSON.parse(json), null, 2);
}

function pick(arr, obj) {
   if (!arr || !arr.length || !obj) return {};
   return Object.assign({}, ...arr.map(key => ({ [key]: obj[key] })));
}

const flatten = list => list.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), []);

module.exports.cloneDeep = _cloneDeep;
module.exports.memoizeDebounce = _memoizeDebounce;
module.exports.isFunction = isFunction;
module.exports.NULL_FUNCT = NULL_FUNCT;
module.exports.get = _get;
module.exports.has = has;
module.exports.extendObj = extendObj;
module.exports.mergeObj = mergeObj;
module.exports.getDirectories = getDirectories;
module.exports.getFiles = getFiles;
module.exports.getFilesAsync = getFilesAsync;
module.exports.krange = krange;
module.exports.bindKet2actualOs = bindKet2actualOs;
module.exports.getKeyFromConfig = getKeyFromConfig;
module.exports.getAllKeysFromConfig = getAllKeysFromConfig;
module.exports.aux_getDirName = aux_getDirName;
module.exports.pathsReplaceEnvVar = pathsReplaceEnvVar;
module.exports.normalicePath = normalicePath;
module.exports.normaliceString = normaliceString;
module.exports.extractSnippet = extractSnippet;
module.exports.filterPromise = filterPromise;
module.exports.safeResult = safeResult;
module.exports.safeSet = safeSet;
module.exports.makeHash = makeHash;
module.exports.textToHTML = textToHTML;
module.exports.escapeCodeHTML = escapeCodeHTML;
module.exports.debounce = debounce;
module.exports.flatten = flatten;
module.exports.isExist = isExist;
module.exports.JSON_parse_async = JSON_parse_async;
module.exports.equal = equal;
module.exports.uniqueElementsBy = uniqueElementsBy;
module.exports.removeDiacritics = removeDiacritics;
module.exports.json_pretty = json_pretty;
module.exports.$timeout = $timeout;
module.exports.$pasue = $timeout;
module.exports.pick = pick;
module.exports.isString = isString;
module.exports.isWin = process.platform === 'win32';
module.exports.isMac = process.platform === 'darwin';
module.exports.isLinux = process.platform === 'linux' || process.platform === 'freebsd' || process.platform === 'sunos';
