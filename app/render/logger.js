'use strict';

const { remote } = window.require('electron');
const dayjs = require('dayjs');
const Config = require('@render/config.js');
const sharedData = require('@render/shared_data.js');
const status = sharedData.status;
const firstDate = new Date(status.get('initTime') || Date.now());
const mkpath = require('@aux/aux_fs.js').mkpath;
const path = require('path');
const electronlog = remote.require('electron-log');
const { aux_getDirName, normalicePath, get, NULL_FUNCT, cloneDeep } = require('@aux/aux_global.js');
const typeboxLogo = require('@aux/ascii_logo.js');

let lastDate = Date.now();
console.info(`%c${typeboxLogo.replace('{{version}}', Config.get('here_are_dragons.report.version'))}`, 'color: #eb9844');

const JSONtoLog = $json => {
   let $jsonCopy = cloneDeep($json);
   try {
      delete $jsonCopy.overwriteDefaultFileAssociations;
      if ($jsonCopy.here_are_dragons) {
         delete $jsonCopy.here_are_dragons.bindKeys;
         delete $jsonCopy.here_are_dragons.disableKeysOnSearchBox;
         delete $jsonCopy.here_are_dragons.language;
         delete $jsonCopy.here_are_dragons.realClockOptions;
         delete $jsonCopy.here_are_dragons.defaultTerminalApp;
      }
   } catch (e) {
      logger.warn('JSONtoLog', e);
   }
   return $jsonCopy;
};

function logTime(val) {
   let now = Date.now();
   let nowTxt = dayjs(now).format('HH:mm:ss.SSS');
   let dif = now - new Date(Config.get('here_are_dragons.report.backgroundStartDate') || 0);
   let dif2 = (now - lastDate) / 1000;
   let uptime = LOGGER.getUptime();
   lastDate = now;

   if (Config.get('userkaracas')) {
      LOGGER.info('%c[TIMER]', 'color: #3399ff', ` [ self: ${dif2} s.]`, ` [ total: ${uptime} s.]`, ` [${nowTxt}]`, ' / ', val);
   } else {
      LOGGER.info(`[TIMER] ${val}:`, ` [ time: ${dif2} s.]` + ` [${nowTxt}]`);
   }
}

const LOGGER = {
   log: console.log,
   info: console.info,
   error: (...args) => {
      if (Config.get('here_are_dragons.notificationsErrors')) {
         //KTODO: 2LangModule
         sharedData.toaster.notify('An error had occured. Please see the log file.');
      }
      console.error(...args);
   },
   warn: console.warn,
   dir: console.dir,
   debug: console.debug,
   group: console.group,
   table: console.table,
   groupEnd: console.groupEnd,
   clear: console.clear,
   logTime: logTime,
};

if (!Config.isDev) {
   if (electronlog.info) LOGGER.info = electronlog.info;
   if (electronlog.warn) LOGGER.warn = electronlog.warn;

   LOGGER.error = (...args) => {
      if (Config.get('here_are_dragons.notificationsErrors')) {
         //KTODO: Agregar a módulo de notificaciones (las rules con notif.)
         //KTODO: 2LangModule
         sharedData.toaster.notify('An error had occured. Please see the log file.');
      }
      if (electronlog.error) electronlog.error(...args);
   };

   if (Config.get('here_are_dragons.logger.level') === 'verbose' && electronlog.log) {
      LOGGER.log = electronlog.log;
   } else {
      LOGGER.log = NULL_FUNCT;
   }

   LOGGER.group = NULL_FUNCT;
   LOGGER.groupEnd = NULL_FUNCT;
   LOGGER.debug = NULL_FUNCT;
   LOGGER.table = NULL_FUNCT;
   LOGGER.info(JSON.stringify(JSONtoLog(Config.getAll())));
} else {
   LOGGER.info(Config.getAll());
}

LOGGER.resetConsole = () => {
   LOGGER.log = console.log;
   LOGGER.info = console.info;
   LOGGER.error = console.error;
   LOGGER.warn = console.warn;
   LOGGER.dir = console.dir;
   LOGGER.debug = console.debug;
   LOGGER.group = console.group;
   LOGGER.groupEnd = console.groupEnd;
   LOGGER.logTime = logTime;
   LOGGER.table = console.table;
   LOGGER.clear = console.clear;
};

const destroyConsole = () => {
   LOGGER.log = NULL_FUNCT;
   LOGGER.info = NULL_FUNCT;
   LOGGER.error = NULL_FUNCT;
   LOGGER.warn = NULL_FUNCT;
   LOGGER.dir = NULL_FUNCT;
   LOGGER.debug = NULL_FUNCT;
   LOGGER.group = NULL_FUNCT;
   LOGGER.groupEnd = NULL_FUNCT;
   LOGGER.logTime = NULL_FUNCT;
   LOGGER.table = NULL_FUNCT;
   LOGGER.clear = NULL_FUNCT;
};

if (sharedData && sharedData.mainLogger && sharedData.mainLogger.changeToChild && sharedData.app_window_and_systray) {
   sharedData.app_window_and_systray.windowEvent.on('QUIT', destroyConsole);
   sharedData.mainLogger.changeToChild(LOGGER);
}

if (window && (Config.get('here_are_dragons.exposeLogger') || Config.isDev)) {
   window.logger = LOGGER;
   window.electronlog = electronlog;
   window.resetConsole = LOGGER.resetConsole;
}

// LOGGER.getUptime = () => ~~(process.uptime() * 100) / 100;
LOGGER.getUptime = () => ~~(((Date.now() - firstDate) / 1000) * 100) / 100;
module.exports = LOGGER;
