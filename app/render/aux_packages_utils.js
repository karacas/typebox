'use strict';

const path = require('path');
const fs = require('fs');

const React = require('react');
const CreateReactClass = require('create-react-class');
const createElement = React.createElement;

const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const driveManager = require('@render/aux_drive_manager.js');
const aux_getDirName = require('@aux/aux_global.js').aux_getDirName;
const global_aux = require('@aux/aux_global.js');
const get = global_aux.get;

let spawn = null;
let lrucache, got;

const getString = file => {
   if (file) {
      let $file = global_aux.normalicePath(file, false);
      try {
         let string = fs.readFileSync($file, 'utf8');
         if (string || string == '') {
            return string;
         }
      } catch (e) {
         Logger.warn('[getString]', e, file, $file, 'not found');
      }
   }
   Logger.warn('[getString]', file, 'not found');
   return '';
};

const getStringFileByConcat = ($dirname, $file) => {
   if (!$dirname || !$file) {
      Logger.warn('getStringFileByConcat: ', $dirname, $file);
      return;
   }
   let file = path.join(aux_getDirName($dirname), $file);
   return getString(file);
};

const getFilePathByConcat = ($dirname, $file) => {
   if (!$dirname || !$file) {
      Logger.warn('getStringFileByConcat: ', $dirname, $file);
      return;
   }
   let file = global_aux.normalicePath(path.join(aux_getDirName($dirname), $file));
   return file;
};

const getFileBase64 = file => {
   if (file) {
      file = global_aux.normalicePath(file, false);
      try {
         return new Buffer(fs.readFileSync(file)).toString('base64');
      } catch (e) {
         Logger.warn(e);
      }
   }
   Logger.warn(file, 'not found');
   return null;
};

const iconFile2icontype = file => {
   let fileBase = getFileBase64(file);
   let icon = fileBase ? `data:image/png;base64,${fileBase}` : '';
   if (fileBase) {
      fileBase = '';
      return {
         type: 'iconSrc',
         iconData: icon,
      };
   } else {
      return null;
   }
};

const getGridRobotSpawn = () => {
   spawn = spawn || require('threads').spawn;
   return spawn((obj, done) => {
      const $robot = require('robotjs');
      const $cant = obj.gridCords.length;
      let $mapgrid = [];
      let cords;
      for (let i = 0; i < $cant; i++) {
         cords = obj.gridCords[i];
         $mapgrid.push($robot.getPixelColor(obj.mX + cords.X, obj.mY + cords.Y));
      }
      done($mapgrid);
   });
};

const setActiveWindow_deprecated = winstr => {
   if (!Config.isWin) {
      Logger.warn('setActiveWindow is available only in windows');
      return null;
   }
   if (!winstr) {
      Logger.warn('setActiveWindow no windows name');
      return null;
   }
   try {
      const ffi = require('ffi');
      if (!ffi) {
         Logger.warn('Error, no ffi');
         return;
      }
      let user32 = new ffi.Library('user32', {
         GetTopWindow: ['long', ['long']],
         FindWindowA: ['long', ['string', 'string']],
         SetActiveWindow: ['long', ['long']],
         SetForegroundWindow: ['bool', ['long']],
         BringWindowToTop: ['bool', ['long']],
         ShowWindow: ['bool', ['long', 'int']],
         SwitchToThisWindow: ['void', ['long', 'bool']],
         GetForegroundWindow: ['long', []],
         AttachThreadInput: ['bool', ['int', 'long', 'bool']],
         GetWindowThreadProcessId: ['int', ['long', 'int']],
         SetWindowPos: ['bool', ['long', 'long', 'int', 'int', 'int', 'int', 'uint']],
         SetFocus: ['long', ['long']],
      });

      if (!user32) {
         Logger.warn('Error, no user32');
         return null;
      }

      let kernel32 = new ffi.Library('Kernel32.dll', {
         GetCurrentThreadId: ['int', []],
      });

      let winToSetOnTop = user32.FindWindowA(null, winstr);

      if (!winToSetOnTop) {
         Logger.warn('Error, no FindWindowA', winstr);
         return null;
      }

      let foregroundHWnd = user32.GetForegroundWindow();
      let currentThreadId = kernel32.GetCurrentThreadId();
      let windowThreadProcessId = user32.GetWindowThreadProcessId(foregroundHWnd, null);
      let showWindow = user32.ShowWindow(winToSetOnTop, 9);
      let setWindowPos1 = user32.SetWindowPos(winToSetOnTop, -1, 0, 0, 0, 0, 3);
      let setWindowPos2 = user32.SetWindowPos(winToSetOnTop, -2, 0, 0, 0, 0, 3);
      let setForegroundWindow = user32.SetForegroundWindow(winToSetOnTop);
      let attachThreadInput = user32.AttachThreadInput(windowThreadProcessId, currentThreadId, 0);
      let setFocus = user32.SetFocus(winToSetOnTop);
      let setActiveWindow = user32.SetActiveWindow(winToSetOnTop);

      Logger.log('foregroundHWnd', foregroundHWnd, 'winToSetOnTop', winToSetOnTop, 'currentThreadId', currentThreadId);

      return true;
   } catch (e) {
      Logger.warn('setActiveWindow error:', e);
      return null;
   }
};

class RuleFetcher {
   constructor(options = {}) {
      Object.assign(
         this,
         {
            url: null,
            path: null,
            item2rule: null,
            debounceSearchSecs: 220,
            maxStrorage: 32,
            maxStrorageAge: 2 * 50 * 60 * 1000,
            getJson: true,
            headers: null,
            verbose: true,
         },
         options
      );

      // this._context = $context;
      this._lastKeyboard = null;
      this._lastRequest = null;
   }

   async fetchKeysAndSet(key, $path, $url) {
      const _id = key || $url;
      const _path = $path || this.path;

      if (!_id) {
         Logger.warn('[RuleFetcher]', 'no key or url');
         return null;
      }
      if (!_path) {
         Logger.warn('[RuleFetcher]', 'no path');
         return null;
      }
      if (!this.url && !$url) {
         Logger.warn('[RuleFetcher]', 'no url');
         return null;
      }
      if (!this.item2rule) {
         Logger.warn('[RuleFetcher]', 'no item2rule');
         return null;
      }

      lrucache = lrucache || require('lru-cache');
      this._storageAdapter = this._storageAdapter || new lrucache({ max: this.maxStrorage, maxAge: this.maxStrorageAge });

      if (this._context.getPath().path !== _path) return null;
      this._lastKeyboard = _id;

      await this._context.timeOut(8);

      if (this._lastRequest && this._lastRequest.cancel) this._lastRequest.cancel();
      if (this._context.getPath().path !== _path || this._lastKeyboard !== _id) {
         return null;
      }

      let packs = this._storageAdapter.get(_id);

      if (!packs) {
         await this._context.timeOut(this.debounceSearchSecs);

         if (this._lastRequest && this._lastRequest.cancel) this._lastRequest.cancel();

         if (this._context.getPath().path !== _path || this._lastKeyboard !== _id) {
            return null;
         }

         let urlfetch =
            key && this.url
               ? this.url
                    .replace('{{keyword}}', key)
                    .replace('{{keys}}', key)
                    .replace('{{key}}', key)
               : $url;

         got = got || require('got');
         this._lastRequest = got(urlfetch, { json: this.getJson, cache: this._storageAdapter, headers: this.headers || null });
         if (this.verbose) Logger.info('[RuleFetcher] load:', urlfetch, this._lastKeyboard, _id);

         let _body = null;
         try {
            const { body } = await this._lastRequest;
            _body = body;
            if (this.verbose) Logger.info('[RuleFetcher] resp:', { _body });
         } catch (e) {
            await this._context.timeOut(16);
            if (this._lastRequest.isCanceled) {
               this._lastRequest = null;
               return null;
            }
            Logger.warn(e, this._lastRequest);
            return null;
         }

         if (!_body || this._context.getPath().path !== _path || this._lastKeyboard !== _id) return null;
         packs = this.item2rule(_body, urlfetch, key);
         if (packs && packs.length) this._storageAdapter.set(_id || $url, packs);
      }

      this._context.setRules(this._context.cloneDeep(packs));
      return true;
   }

   async fetchURLAndSet($url, $path) {
      return this.fetchKeysAndSet(null, $path, $url);
   }
}

module.exports = {
   getString,
   RuleFetcher,
   getStringFileByConcat,
   aux_getDirName,
   getFilePathByConcat,
   getFileBase64,
   iconFile2icontype,
   getGridRobotSpawn,
   normalicePath: global_aux.normalicePath,
};

if (Config.isDev) {
   window.aux_packages_utils = module.exports;
   // window.setActiveWindow('Total Commander');
}
