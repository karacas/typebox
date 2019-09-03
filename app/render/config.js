'use strict';

const result = require('lodash').result;
const EventEmitter = require('eventemitter3');
const global_aux = require('@aux/aux_global.js');
const sharedData = require('@render/shared_data.js');

const get = global_aux.get;
const windowEvent = new EventEmitter();
const NULL_FUNCT = () => {};
const cloneDeep = global_aux.cloneDeep;
const config = {};

const getChangeSettingsEvent = result(sharedData, 'app_window_and_systray.windowEvent') || windowEvent;
let cacheSettings = cloneDeep(sharedData.settings_manager.getSettings());

getChangeSettingsEvent.on('changeSettings', (path, dif) => {
   cacheSettings = cloneDeep(sharedData.settings_manager.getSettings());
});

config.getDefaultSettings = () => {
   try {
      return cloneDeep(sharedData.settings_manager.getDefaultSettings());
   } catch (e) {
      return {};
   }
};

config.getUserSettings = NULL_FUNCT;
if (get(sharedData, 'settings_manager', 'getUserSettings')) {
   //KTODO: make cache
   config.getUserSettings = sharedData.settings_manager.getUserSettings;
}

config.get = obj => get(cacheSettings, obj);
config.getUserSettingsVal = obj => get(config.getUserSettings(), obj);
config.getDragons = obj => get(cacheSettings, `here_are_dragons.${obj}`);
config.getReport = obj => get(cacheSettings, `here_are_dragons.report.${obj}`);
config.getLang = obj => get(cacheSettings, `here_are_dragons.language.${obj}`);
config.getPath = obj => global_aux.normalicePath(String(get(cacheSettings, `here_are_dragons.paths.${obj}`) || ''));
config.getDeafult = obj => get(config.getDefaultSettings(), obj);
config.getAll = () => cacheSettings;
config.getChangeSettingsEvent = () => getChangeSettingsEvent;
Object.defineProperty(config, 'isDev', { get: () => config.get('dev') });

config.ifDev = config.isDev;
config.dev = config.isDev;
config.isWin = process.platform === 'win32';
config.isMac = process.platform === 'darwin';
config.isLinux = process.platform === 'linux' || process.platform === 'freebsd' || process.platform === 'sunos';
config.isDarwin = config.isMac;
config.isWindows = config.isWin;
config.isLnx = config.isLinux;
if (config.get('userkaracas') === true) config.userkaracas = true;

module.exports = config;

if ((config.isDev || config.get('here_are_dragons.exposeConfig')) && window) {
   window.config = config;
}
