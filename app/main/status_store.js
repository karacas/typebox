const { getVersion } = require('electron').app;
const Logger = require('@main/main_logger.js');
const EventEmitter = require('eventemitter3');
const diff = require('deep-object-diff').diff;
const { cloneDeep, uniqueElementsBy, get, equal, normalicePath, extendObj, pick, has } = require('@aux/aux_global.js');
const { debounce } = require('lodash');
const { loadGenericJson, saveGenericJson } = require('@aux/aux_fs.js');
const { Subscribe, Container } = require('unstated');
//KTODO: Cambiar unstated por  icaro: https://github.com/GianlucaGuarini/icaro

const ExportStatus = {};

let initiated = false;
let sharedObj = null;
let settings = null;
let eventCounter = 0;
let lastStatus = {};
let statusEvent = new EventEmitter();
let _dev = false;
let status = null;
let defaultStatus = null;
let fileLastStatus = null;
let savedStatus = {};
let keys2save = [];
let needSave = false;
let objToSaveLast = null;

function initDefaultStatus() {
   if (defaultStatus) return defaultStatus;
   if (!settings) return {};

   let x = null;
   let y = null;

   if (settings.dev && get(settings, 'here_are_dragons.setDevPos') && get(settings, 'here_are_dragons.chromiumConsole')) {
      x = 20;
      y = 20;
   }

   keys2save = ['win_user_X', 'win_user_Y', 'show_rule_score', 'maxItemsVisible', 'width', 'starts', 'lastVersion', 'totalSessionsTime'];

   defaultStatus = cloneDeep({
      show_rule_score: _dev,
      maximized: false,
      mrdoob_stats: false,
      focused: null,
      freshInstall: false,
      in_test: false,
      ioHook: false,
      always_on_top: get(settings, 'here_are_dragons.alwaysOnTop') || false,
      maxItemsVisible: get(settings, 'maxItemsVisible') || 8,
      width: get(settings, 'width') || null,
      win_user_X: x,
      win_user_Y: y,
      reloads: 0,
      starts: 0,
      version: getVersion(),
      initTime: sharedObj.INIT_TIME,
      lastVersion: null,
      totalSessionsTime: 0,
      test: 0,
      test_obj: { a: 1 },
   });

   return defaultStatus;
}

class StatusContainer extends Container {
   constructor(props = {}) {
      super();
      this.state = extendObj(initDefaultStatus(), savedStatus);
   }
   async switch(objPath, val) {
      let pathVal = get(this.state, objPath);
      if (pathVal !== !!pathVal) return null /*no boolean*/;
      if (val === undefined) val = !pathVal;
      await this.setState({ [objPath]: !!val });
      return true;
   }
   async set_mrdoob_stats(val) {
      return this.switch('mrdoob_stats', val);
   }
}

function init() {
   if (initiated) return;

   initiated = true;
   sharedObj = global.sharedObj;
   settings = sharedObj.settings_manager.getSettings();
   _dev = !!get(settings, 'dev');
   if (get(settings, 'statusPersist')) makeLoadStatus();
   status = new StatusContainer();
   lastStatus = cloneDeep(status.state);
   status.subscribe(checkDiffDeb);

   setTimeout(() => {
      if (initiated && sharedObj) {
         if (sharedObj.app_window_and_systray) {
            sharedObj.app_window_and_systray.windowEvent.on('QUIT', () => {
               saveStatus(true);
               endStatus();
            });
         }
         sharedObj.idleTime.getIdleEvent().on('idle', saveStatus);
      }
   }, 128);
}

function endStatus() {
   initiated = false;
   if (status && status.unsubscribe) status.unsubscribe(checkDiffDeb);
   if (statusEvent.removeAllListeners) statusEvent.removeAllListeners();
}

const checkDiff = () => {
   if (!initiated || equal(lastStatus, status.state)) return;

   const differences = diff(lastStatus, status.state);

   if (!differences || differences.constructor !== Object || Object.entries(differences).length === 0) return;

   if (_dev && false) Logger.log('[MAIN STATUS CHANGE]:', JSON.stringify({ diffs: differences }), JSON.stringify({ eventCounter }));
   if (_dev && false) Logger.log('status:', JSON.stringify(status.state));

   needSave = true;
   lastStatus = cloneDeep(status.state);

   statusEvent.emit('change', differences);
   if (has(differences, 'focused')) {
      let focus = get(differences, 'focused');
      if (focus) statusEvent.emit('focus');
      if (!focus) statusEvent.emit('blur');
   }
};

const checkDiffDeb = debounce(checkDiff, 4);

const makeLoadStatus = () => {
   if (!initiated || !settings) return null;
   fileLastStatus = normalicePath(`${get(settings, 'here_are_dragons.paths.app_status')}/${get(settings, 'here_are_dragons.paths.statusFile')}`, false);
   if (fileLastStatus) {
      savedStatus = loadGenericJson(fileLastStatus, false) || {};
   }
};

const saveStatus = (last = false) => {
   if (!last && !needSave) return;
   if (!initiated || !settings || !fileLastStatus || !keys2save) return;
   const objToSave = pick(keys2save, status.state);

   if (last) {
      objToSave.lastVersion = status.state.version;
      objToSave.starts = Number(status.state.starts) + 1;
      objToSave.totalSessionsTime = Math.round(status.state.totalSessionsTime + (new Date() - new Date(status.state.initTime)) / 1000);
   }

   if (equal(objToSave, objToSaveLast)) return;
   objToSaveLast = cloneDeep(objToSave);

   if (objToSave) {
      let resp = saveGenericJson(objToSave, fileLastStatus);
      if (resp) {
         Logger.log('[status] saved');
         needSave = false;
      }
   }
};

ExportStatus.get = obj => {
   if (!initiated) return;
   if (!obj) return status.state;
   return get(status.state, obj);
};

ExportStatus.set = async (...args) => {
   if (!initiated) return;
   let obj = [...args][0];
   if (!(obj !== null && typeof obj === 'object') || !obj) {
      Logger.log('[MAIN STATUS]: set() warn:', obj);
      return;
   }
   await status.setState(...args);
   return true;
};

ExportStatus.switch = async (...args) => {
   if (!initiated) return;
   // Logger.log(...args);
   await status.switch(...args);
   return true;
};

ExportStatus.on = (...args) => {
   if (!initiated) return;
   eventCounter++;
   return statusEvent.on(...args);
};

ExportStatus.once = (...args) => {
   if (!initiated) return;
   return statusEvent.once(...args);
};

ExportStatus.off = (...args) => {
   if (!initiated) return;
   eventCounter--;
   return statusEvent.off(...args);
};

ExportStatus.init = init;
ExportStatus.actions = status;
ExportStatus.initiated = initiated;
ExportStatus.initDefaultStatus = initDefaultStatus;

module.exports = ExportStatus;
