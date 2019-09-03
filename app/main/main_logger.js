'use strict';

const { app } = require('electron');
const mkpath = require('@aux/aux_fs.js').mkpath;
const path = require('path');
const electronlog = require('electron-log');
const { aux_getDirName, normalicePath, get, NULL_FUNCT } = require('@aux/aux_global.js');
const typeboxLogo = require('@aux/ascii_logo.js');
const { is } = require('electron-util');
const isRunningInAsar = is.usingAsar;
const isWindows = is.windows;

let settings = {};
let globals = {};
let loggerChild = null;
let nodeConsole = null;
let _console = null;

let logger = {
   log: console.log,
   info: console.info,
   error: (...args) => {
      if (get(settings, 'here_are_dragons.logger.notificationsErrors')) {
         // KTODO: 2LangModule
         if (globals.toaster) globals.toaster.notify('An error had occured. Please see the log file.');
      }
      if (loggerChild && loggerChild.error) {
         loggerChild.error(...args);
      }
      console.error(...args);
   },
   warn: console.warn,
   dir: console.dir,
   debug: console.debug,
   group: console.group,
   groupEnd: console.groupEnd,
   resetConsole: null,
};

logger.init = ($settings, $globals) => {
   settings = $settings || {};
   globals = $globals || {};

   console.log(typeboxLogo.replace('{{version}}', get(settings, 'here_are_dragons.report.version')));

   if (isWindows && isRunningInAsar && get(settings, 'here_are_dragons.logger.cliLogger') && !!process.stdout && !!process.stderr) {
      nodeConsole = nodeConsole || require('console');
      _console = new nodeConsole.Console(process.stdout, process.stderr);
   }

   //PRODUCTION or FORCE
   if (!settings.dev && !get(settings, 'verbose')) {
      if (electronlog.log && get(settings, 'here_are_dragons.logger.level') === 'verbose') {
         logger.log = electronlog.log;
      } else {
         logger.log = NULL_FUNCT;
      }

      if (electronlog.info) logger.info = electronlog.info;
      if (electronlog.warn) logger.warn = electronlog.warn;

      logger.error = (...args) => {
         if (get(settings, 'here_are_dragons.logger.notificationsErrors')) {
            // KTODO: 2LangModule
            if (globals.toaster) globals.toaster.notify('An error had occured. Please see the log file.');
         }
         if (electronlog.error) electronlog.error(...args);
      };
   }
};

logger.changeToChild = $logger => {
   if (!$logger || !$logger.info) return;
   if (get(settings, 'here_are_dragons.logger_changeToChild')) {
      try {
         loggerChild = $logger;

         logger.log = loggerChild.log;
         logger.debug = loggerChild.debug;
         logger.group = loggerChild.group;
         logger.groupEnd = loggerChild.groupEnd;
         logger.info = loggerChild.info;
         logger.error = loggerChild.error;
         logger.warn = loggerChild.warn;
         logger.dir = loggerChild.dir;

         if (loggerChild.resetConsole) logger.resetConsole = loggerChild.resetConsole;

         logger.info('MainLooger is ChildLogger / Can reset:', !!logger.resetConsole);
         if (false && settings.dev) logger.debug('DEBUG TEST', {});
         if (false && settings.dev) logger.error('ERROR TEST');
      } catch (e) {}
   }
};

module.exports = logger;
