'use strict';

const { app } = require('electron');
const { has, get, cloneDeep, aux_getDirName, normalicePath, $timeout, isWin } = require('@aux/aux_global.js');
const Logger = require('@main/main_logger.js');
const status = require('@main/status_store.js');
const EventEmitter = require('eventemitter3');
const { globalShortcut } = require('electron');

const RESET_BUFFER = 'RESET_BUFFER';
const END_BUFFER = 'END_BUFFER';
const BACK_BUFFER = 'BACK_BUFFER';

const KEYCHAR_BACKSPACE = 8;
const KEYCHAR_ENTER = 13;
const KEYCHAR_TAB = 9;
const KEYCHAR_ESC = 27;
const BUFFER_RESETERS = [KEYCHAR_ENTER, KEYCHAR_TAB, KEYCHAR_ESC];

let initiated = false;
let settings = null;
let sharedObj = null;
let ioHook = null;
let ioHookLoaded = false;
let expanderEvent = null;
let buffer = [];
let lastBuffer = null;
let _dev = null;
let timeToCleanKeyBuffer = 0;
let maxLengthAccelerator = 0;
let minLengthAccelerator = 0;
let keyCharEnd = 33;
let currentShortcut_StopKeyListener = null;
let currentShortcut_StartKeyListener = null;
let onChangeHardWay = false;

let __verboseKeys = false;
let __verbosebuffer2send = false;

const init = () => {
   if (initiated) return;

   sharedObj = global.sharedObj;
   settings = sharedObj.settings_manager.getSettings();
   _dev = !!get(settings, 'dev');
   status.on('change', onChangeStatus);
   sharedObj.expanders = [];

   //TEST
   if (!!get(settings, 'here_are_dragons.debug.canListenKeyboard')) {
      console.log('debug.canListenKeyboard');
      __verboseKeys = true;
      __verbosebuffer2send = true;
   }

   if (!settings.here_are_dragons.canListenKeyboard) {
      return;
   }

   expanderEvent = new EventEmitter();
   timeToCleanKeyBuffer = Number(get(settings, 'here_are_dragons.expander_timeToCleanKeyBuffer') || 5000);
   maxLengthAccelerator = Number(get(settings, 'here_are_dragons.expander_maxLengthAccelerator') || 12);
   minLengthAccelerator = Number(get(settings, 'here_are_dragons.expander_minLengthAccelerator') || 2);
   keyCharEnd = get(settings, 'here_are_dragons.expander_keyCharEnd') || keyCharEnd;
   if (typeof keyCharEnd === 'string') keyCharEnd = keyCharEnd.charCodeAt(0);

   currentShortcut_StopKeyListener = get(settings, 'mainShortcut_StopKeyListener');
   currentShortcut_StartKeyListener = get(settings, 'mainShortcut_StartKeyListener');

   const autostart = _dev ? true : get(settings, 'here_are_dragons.expander_autostart');

   initiated = true;

   if (sharedObj.app_window_and_systray && sharedObj.app_window_and_systray.windowEvent) {
      sharedObj.app_window_and_systray.windowEvent.once('VIEW_IS_USABLE', async () => {
         sharedObj.app_window_and_systray.windowEvent.once('QUIT', () => endIoHook(false));
         await $timeout(640);
         if (!initiated) return;
         registerStopKeyListener();
         registerStartKeyListener();
         if (autostart) initIoHook();
      });
   }
};

const extract_uiohook_dll = () => {
   if (!isWin) return;

   const isRunningInAsar = require('electron-util').is.usingAsar;
   if (!isRunningInAsar) return false;

   const APP_ASAR_TMP = './out/typebox-win32-x64/resources/app.asar';
   // const UIOHOOK_PATH = 'node_modules\\iohook\\builds\\electron-v70-win32-x64\\build\\Release\\uiohook.dll';
   // const UIOHOOK_PATH = 'node_modules\\iohook\\builds\\electron-v73-win32-x64\\build\\Release\\uiohook.dll';
   const UIOHOOK_PATH = 'node_modules\\iohook\\builds\\electron-v75-win32-x64\\build\\Release\\uiohook.dll';

   const fs = require('fs');

   // const iohookNodefilePath = normalicePath('%TEMP%' + '/uiohook.dll', true);
   let iohookNodefilePath = normalicePath('%TMP%' + '/uiohook.dll', true);
   if (fs.existsSync(iohookNodefilePath)) return;

   const asar = require('asar');
   const { app } = require('electron');
   const appAsar = isRunningInAsar ? String(app.getAppPath()) : APP_ASAR_TMP;
   let fileiohook = null;

   if (!fs.existsSync(appAsar)) {
      Logger.warn('fail make dll / not found', appAsar);
      return false;
   }

   try {
      fileiohook = asar.extractFile(appAsar, UIOHOOK_PATH);
      if (!fileiohook) return false;
      fs.writeFileSync(iohookNodefilePath, fileiohook);
      return true;
   } catch (e) {
      Logger.warn('fail make dll / extract', e, iohookNodefilePath);
      return false;
   }
};

const initIoHook = () => {
   if (!initiated || ioHookLoaded) return false;
   if (!settings.here_are_dragons.canListenKeyboard) return false;

   if (_dev) console.log('[iohook] starting ....');
   if (_dev) Logger.log('[iohook] starting ....');

   extract_uiohook_dll();

   try {
      ioHook = require('iohook');
   } catch (e) {
      if (true) console.warn('\n', 'iohook error:', e.toString());
      return false;
   }

   if (ioHook && ioHook.active === false) {
      ioHook.on('keypress', bufferManager);
      ioHook.on('mouseclick', resetBuffer);
      ioHook.start();
      ioHookLoaded = true;
      resetBuffer();
      setTimeout(() => {
         if (ioHookIsActive()) {
            _dev ? console.log('[iohook] start ok') : Logger.info('[iohook] start ok');
            status.switch('ioHook', true);
         } else {
            _dev ? console.log('[iohook] start fail') : Logger.info('[iohook] start fail !ioHookIsActive()');
         }
      }, 0);
      return ioHookIsActive();
   } else {
      _dev ? console.warn('\n', 'iohook fail', '\n') : Logger.warn('\n', 'iohook fail', '\n');
      return false;
   }
};

const endIoHook = (verbose = true) => {
   if (ioHook) {
      if (ioHook.off) ioHook.off('keypress', bufferManager);
      if (ioHook.off) ioHook.off('mouseclick', resetBuffer);
      if (ioHook.stop) ioHook.stop();
      if (ioHook.unload) ioHook.unload();
   }
   ioHookLoaded = false;
   if (ioHook !== null) ioHook = null;
   if (status && status.switch) status.switch('ioHook', false);
   if (verbose) Logger.log('[ioHook end]');
   return true;
};

const resetBuffer = () => {
   if (!initiated) return;
   if (buffer.length > 0) {
      buffer.length = 0;
      lastBuffer = Date.now();
   }
};

const passBufferTime = () => {
   if (!initiated) return false;
   if (buffer.length > 1 && lastBuffer && Date.now() - lastBuffer > timeToCleanKeyBuffer) {
      resetBuffer();
      lastBuffer = Date.now();
      return false;
   }
   lastBuffer = Date.now();
   return true;
};

const add2Buffer = val => {
   if (!initiated || !val) return;
   if (!passBufferTime()) return;
   buffer.push(val);
   if (buffer.length > maxLengthAccelerator) buffer = buffer.slice(-maxLengthAccelerator);
};

const backBuffer = () => {
   if (!initiated) return;
   if (!passBufferTime()) return;
   if (buffer && buffer.length > 0) buffer.pop();
};

const BufferKeyChar2Str = KeyChar => {
   if (KeyChar === undefined || KeyChar === null) return '';
   let str = String.fromCharCode(KeyChar);
   return str;
};

const checkBufferHasExpander = () => {
   if (!initiated) return;
   if (!passBufferTime()) return;
   if (buffer && buffer.length >= minLengthAccelerator) {
      let buffer2str = buffer.map(BufferKeyChar2Str).join('');
      let exp = findExpander(buffer2str, sharedObj.expanders);
      if (exp && exp.id) {
         expanderEvent.emit('accelerator', exp);
         if (__verbosebuffer2send) console.log('[expander found]', exp, buffer);
      }
   }
   resetBuffer();
};

const keyEventToBuffer = event => {
   if (!initiated) return;

   let type = event.type;
   let keypress = type === 'keypress';
   let keychar = keypress && event.keychar ? event.keychar : null;

   if (__verboseKeys) console.log('[keychar]', keychar, String.fromCharCode(keychar), event.rawcode);

   if (BUFFER_RESETERS.includes(keychar)) return RESET_BUFFER;
   if (keychar === KEYCHAR_BACKSPACE) return BACK_BUFFER;
   if (keychar === keyCharEnd) return END_BUFFER;

   return keychar;
};

const bufferManager = event => {
   if (!initiated || !ioHookLoaded || !event) return;

   let keyBuffer = null;
   let mouseBuffer = null;
   let type = event.type;
   let keypress = type === 'keypress';

   if (keypress) {
      keyBuffer = keyEventToBuffer(event);
      if (keyBuffer === RESET_BUFFER) resetBuffer();
      else if (keyBuffer === END_BUFFER) checkBufferHasExpander();
      else if (keyBuffer === BACK_BUFFER) backBuffer();
      else if (keyBuffer) add2Buffer(keyBuffer);
   }

   if (true && _dev && !get(settings, 'isWin')) {
      _dev ? console.log('iohook:', keyBuffer, buffer, event) : Logger.info('iohook:', keyBuffer, buffer, event);
   }
};

//KTODO: NO RESTARTEA BIEN #sd234234
const onChangeStatus = objPath => {
   if (has(objPath, 'ioHook')) {
      let _ioHook = get(objPath, 'ioHook');
      if (_ioHook !== ioHookIsActive()) {
         if (onChangeHardWay) {
            //HARD
            if (!_ioHook) {
               endIoHook();
            } else {
               let res = initIoHook();
            }
         } else {
            //SOFT
            if (!ioHookLoaded) initIoHook();
            if (!_ioHook) {
               if (ioHook) ioHook.stop();
            } else {
               if (ioHook) ioHook.start();
            }
         }

         setTimeout(() => status.switch('ioHook', ioHookIsActive()), 0);
      }
   }
};

const registerStopKeyListener = () => {
   if (currentShortcut_StopKeyListener && currentShortcut_StopKeyListener.length > 0 && globalShortcut.isRegistered(currentShortcut_StopKeyListener)) {
      globalShortcut.unregister(currentShortcut_StopKeyListener);
   }
   if (currentShortcut_StopKeyListener && currentShortcut_StopKeyListener.length > 0 && !globalShortcut.isRegistered(currentShortcut_StopKeyListener)) {
      globalShortcut.register(currentShortcut_StopKeyListener, () => {
         status.switch('ioHook', false);
         if (settings.dev) console.log('[STOP KEY LISTENER]');
      });
   }
};

const registerStartKeyListener = () => {
   if (currentShortcut_StartKeyListener && currentShortcut_StartKeyListener.length > 0 && globalShortcut.isRegistered(currentShortcut_StartKeyListener)) {
      globalShortcut.unregister(currentShortcut_StartKeyListener);
   }
   if (currentShortcut_StartKeyListener && currentShortcut_StartKeyListener.length > 0 && !globalShortcut.isRegistered(currentShortcut_StartKeyListener)) {
      globalShortcut.register(currentShortcut_StartKeyListener, () => {
         status.switch('ioHook', true);
         if (settings.dev) console.log('[START KEY LISTENER]');
      });
   }
};

const ioHookIsActive = () => {
   return ioHookLoaded && !!ioHook && ioHook.active;
};

const findExpander = (val, expanders) => {
   if (!initiated || !val || !val.length > 0 || !expanders || !expanders.length > 0) return null;

   const expandersMap = new Map();
   const isRegex = val.indexOf(':') >= minLengthAccelerator ? true : false;
   const valTmp = !isRegex ? val : val.slice(0, val.indexOf(':'));
   const parmTmp = !isRegex ? null : val.slice(1 + val.indexOf(':'));

   if (isRegex && !parmTmp) return null;

   //[WIP] regex
   expanders.forEach(ruleExp => {
      let _exp = ruleExp.accelerator;
      _exp = _exp.replace(/\s/g, '');

      if (isRegex) {
         let last = _exp.indexOf(':');
         if (last === -1) return;
         _exp = _exp.slice(0, _exp.indexOf(':'));
      }

      const valIndex = valTmp.lastIndexOf(_exp);

      if (_exp.length > 0 && valIndex !== -1) {
         const lastPos = valTmp.length - _exp.length;
         if (valIndex === lastPos) expandersMap.set(_exp, ruleExp.id);
      }
   });

   if (expandersMap.size === 0) return null;

   const largeKey = Array.from(expandersMap.keys()).reduce(($before, $actual) => {
      return !$before || $actual.length > $before.length ? $actual : $before;
   }, null);

   if (!largeKey) return null;

   const largeKeyRegEx = isRegex ? val.slice(val.indexOf(largeKey)) : null;

   return { id: expandersMap.get(largeKey) || null, accelerator: largeKeyRegEx || largeKey };
};

module.exports.on = (...args) => {
   if (!initiated || !expanderEvent) return;
   return expanderEvent.on(...args);
};

module.exports.off = (...args) => {
   if (!initiated || !expanderEvent) return;
   return expanderEvent.off(...args);
};

module.exports.keyIsActive = () => {
   return ioHookIsActive();
};

module.exports.keyStop = () => {
   return endIoHook();
};

module.exports.keyRestart = () => {
   return initIoHook();
};

module.exports.init = init;
module.exports.initiated = !!initiated;
