'use strict';

const { app } = require('electron');
const electronlog = require('electron-log');
const shortcut_normalize = require('electron-shortcut-normalizer');
const isAccelerator = require('electron-is-accelerator');
const { is } = require('electron-util');
const __dirnameRoot = String(app.getAppPath());
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const mkpath = require('@aux/aux_fs.js').mkpath;
const os = require('os');
const { uniqWith, each, debounce } = require('lodash');
const EventEmitter = require('eventemitter3');
const diff = require('deep-diff').diff;
const default_config = require('@main/config_defaults.js');
const logger = require('@main/main_logger.js');
const global_aux = require('@aux/aux_global.js');
const defSettings = default_config.settings;
const { watch } = require('chokidar');
const get = global_aux.get;
const isElevated = require('is-elevated');
const { loadFileSync, saveFileSync } = require('@aux/aux_fs.js');

let initiated = false;
let settings = null;
let user_settings_file = null;
let user_settings = null;
let publicSettings = null;
let dataLoaded = {};
let forceDev = false;
let argv = {};
let lastUserSettings = null;
let changeSettingsEvent = new EventEmitter();

const getSettings = () => publicSettings;

const $boolean = value => {
   if (value === 'true') value = true;
   if (value === 'false') value = false;
   return value;
};

function init($argv) {
   if (initiated || global.sharedObj) {
      module.exports.init = function() {
         logger.log('data_io is already definded');
      };
      module.exports.settings = global.sharedObj.settings_manager;
      return;
   }

   if ($argv !== null && typeof $argv === 'object') argv = $argv;

   load_and_makeSettings();
   setShares();
   configLogger();
   watchSettings();
   setTimeout(watchAppChanges, 5000);

   initiated = true;
   return;
}

function configLogger() {
   let logPath = get(publicSettings, 'here_are_dragons.paths.logpath') + get(publicSettings, 'here_are_dragons.paths.logfile');
   mkpath.sync(path.dirname(logPath));
   /**/
   electronlog.transports.mainConsole = !!get(publicSettings, 'here_are_dragons.logger.console_level');
   electronlog.transports.console.level = get(publicSettings, 'here_are_dragons.logger.console_level');
   electronlog.transports.rendererConsole.level = get(publicSettings, 'here_are_dragons.logger.console_level');
   /**/
   electronlog.transports.file.file = logPath;
   electronlog.transports.file.level = get(publicSettings, 'here_are_dragons.logger.file_level');
   electronlog.transports.file.maxSize = get(publicSettings, 'here_are_dragons.logger.maxSize');
   logger.init(settings, global.sharedObj);
}

//KTODO Mover a un modulo aparte
function setShares() {
   // #2345624
   if (initiated || global.sharedObj) {
      return;
   }
   global.sharedObj = {};
   let $global = global.sharedObj;
   $global.settings_manager = module.exports.settings;
   $global.mainLogger = logger;
   $global.app_window_and_systray = {};
   $global.app_window_and_systray.setDevMode = setDevMode;
   $global.app_window_and_systray.printSettings = printSettings;
}

function setDevMode(val) {
   publicSettings.dev = Boolean(val);
   if (publicSettings.here_are_dragons) {
      publicSettings.here_are_dragons.chromiumConsole = Boolean(val);
      publicSettings.here_are_dragons.deleteSearchOnFire = Boolean(!val);
      publicSettings.here_are_dragons.unpopAfterCopy = Boolean(!val);
   }
   if (publicSettings.here_are_dragons && publicSettings.here_are_dragons.debug) {
      publicSettings.here_are_dragons.debug.noUnpopWin = val;
   }
   publicSettings.verbose = Boolean(val);
   settings.verbose = Boolean(val);
   settings.dev = Boolean(val);
   forceDev = Boolean(val);
}

function printSettings() {
   logger.info(getSettings());
}

function load_and_makeSettings() {
   settings = global_aux.cloneDeep(defSettings);
   argv = argv || {};

   //USER SETTINGS
   user_settings_file = settings.here_are_dragons.paths.user + settings.here_are_dragons.paths.userSettingsFile;
   if (argv.user_settings_file) {
      user_settings_file = argv.user_settings_file;
   }
   settings.here_are_dragons.report.__user_settings = user_settings_file;
   user_settings = null;
   let exist_user_settings = fs.existsSync(user_settings_file);
   if (exist_user_settings) {
      user_settings = loadFileSync(user_settings_file, 'JSON5');
      saveFileSync(`${user_settings_file}.bak`, user_settings, 'JSON5'); //Make bakup
   } else {
      let user_settings_w_comments = `${settings2comments(defSettings)}{\r\n\r\n}`;
      saveFileSync(user_settings_file, user_settings_w_comments, 'TXT');
   }
   user_settings = user_settings || {};
   user_settings.here_are_dragons = user_settings.here_are_dragons || {};

   //KTODO: Aprolijar
   settings = extendSettings(defSettings, user_settings);

   settings.dev = is.development;

   settings.here_are_dragons.electron_windows_list_options.width = settings.width;

   if (settings.visibleInTaskBar) {
      settings.here_are_dragons.electron_windows_list_options.skipTaskbar = false;
      settings.here_are_dragons.electron_windows_list_options.show = true;
      settings.here_are_dragons.electron_windows_list_options.minimizable = true;
      settings.here_are_dragons.startOpen = true;
      settings.here_are_dragons.hideOnBlur = false;
   }

   if (user_settings.dev !== undefined) {
      settings.dev = Boolean(user_settings.dev);
   }

   //Keys mainShortcut
   settings.mainShortcut = shortcut_normalize(settings.mainShortcut, process.platform);
   if (!isAccelerator(settings.mainShortcut)) {
      settings.mainShortcut = shortcut_normalize(defSettings.mainShortcut);
      logger.warn('settings.mainShortcut is not a valid Accelerator');
   }

   //EXTEND ARGS
   for (let [key, value] of Object.entries(argv)) {
      if (key !== 'user_settings_file' && key !== 'dev' && key !== 'prod' && key !== 'verbose') {
         value = $boolean(value);
         if (settings.hasOwnProperty(key)) {
            settings[key] = value;
         }
         if (settings.here_are_dragons && settings.here_are_dragons.hasOwnProperty(key)) {
            settings.here_are_dragons[key] = value;
         }
      }
   }

   //Force dev in command line
   if (argv.dev) {
      // --dev
      settings.dev = Boolean(argv.dev);
   }
   if (argv.prod) {
      // --prod
      settings.dev = !Boolean(argv.prod);
   }

   if (forceDev) {
      settings.dev = true;
   }

   if (settings.dev) {
      process.env.NODE_ENV = null;
   } else {
      process.env.NODE_ENV = 'production';
   }

   settings.verbose = false;

   if (settings.dev) {
      //DEV
      settings.verbose = true;
      settings.here_are_dragons.verbose = true;
      settings.here_are_dragons.chromiumConsole = true;
      settings.here_are_dragons.canListenKeyboard = settings.here_are_dragons.debug.canListenKeyboard;
   } else {
      //PROD
      settings.verbose = settings.here_are_dragons.verbose;
      settings.here_are_dragons.debug = {};
      settings.here_are_dragons.verboseTimes = false;
      if (settings.here_are_dragons.testConfig) {
         settings.here_are_dragons.testConfig.quitOnFinish = false;
         if (!settings.userkaracas) {
            settings.here_are_dragons.testConfig.writeReport = false;
         }
      }
   }

   if (argv.verbose == true) {
      settings.verbose = true;
      settings.here_are_dragons.verbose = true;
      settings.here_are_dragons.chromiumConsole = true;
      settings.here_are_dragons.logger_changeToChild = true;
   }

   if (argv.tests) {
      settings.here_are_dragons.testConfig.autoRunTests = true;
      settings.here_are_dragons.testConfig.quitOnFinish = true;
      settings.here_are_dragons.testConfig.toastOnFinish = false;
   }

   if (argv.isTestSuite != undefined) {
      settings.here_are_dragons.testConfig.isTestSuite = !!argv.isTestSuite;
   }

   if (argv.quitOnFinish != undefined) {
      settings.here_are_dragons.testConfig.quitOnFinish = !!argv.quitOnFinishTest;
   }

   if (user_settings.here_are_dragons.debug != undefined) {
      settings.debug = user_settings.debug;
   }

   settings.here_are_dragons.report.__dirnameRootApp = __dirnameRoot;
   settings.here_are_dragons.report.__dir_appexe = String(app.getPath('exe'));
   /**/
   settings.here_are_dragons.report.__dir__temp = String(app.getPath('temp'));

   try {
      settings.here_are_dragons.report.__dir__logs = String(app.getPath('logs'));
   } catch (e) {}

   if (settings.here_are_dragons.report.electronIsDev) {
      app.setPath('userData', `${String(app.getPath('userData'))}dev`);
   }

   settings.here_are_dragons.report.__dir__module = String(app.getPath('module'));
   settings.here_are_dragons.report.__dir__userData = String(app.getPath('userData'));
   settings.here_are_dragons.report.__dir__appData = String(app.getPath('appData'));
   settings.here_are_dragons.report.__dir__home = String(app.getPath('home'));
   settings.here_are_dragons.report.version = app.getVersion();
   settings.here_are_dragons.report.__termnameK = process.env['TERMNAME'] || null;
   settings.here_are_dragons.report.__termname = settings.here_are_dragons.terminalName;
   settings.here_are_dragons.report.__hostname = os.hostname ? os.hostname() : null;
   settings.here_are_dragons.report.__os_totalmem = os.totalmem ? os.totalmem() : null;
   settings.here_are_dragons.report.__os_freemem = os.freemem ? os.freemem() : null;
   settings.here_are_dragons.report.__os_uptime = os.uptime ? os.uptime() : null;
   settings.here_are_dragons.report.__os_userInfo = os.userInfo ? os.userInfo().username : null;
   settings.here_are_dragons.report.__process_uptime = process.uptime ? process.uptime() : null;
   settings.here_are_dragons.argv = argv;

   //Concat computername 2 paths
   //KTODO: Hacer un replace para todos los paths de manera automatica, que sea en el save/load
   let replaceTermName = process.env['TERMNAME'] || settings.here_are_dragons.terminalName;
   if (settings.here_are_dragons.addTermNametoPaths && replaceTermName && replaceTermName.length && replaceTermName != 'undefined') {
      replaceTermName = `_${replaceTermName}`;
      settings.here_are_dragons.paths.logfile = settings.here_are_dragons.paths.logfile.replace('%TERMNAME%', replaceTermName);
      settings.here_are_dragons.paths.historyfile = settings.here_are_dragons.paths.historyfile.replace('%TERMNAME%', replaceTermName);
      settings.here_are_dragons.paths.favfile = settings.here_are_dragons.paths.favfile.replace('%TERMNAME%', replaceTermName);
      settings.here_are_dragons.paths.lastfile = settings.here_are_dragons.paths.lastfile.replace('%TERMNAME%', replaceTermName);
      settings.here_are_dragons.paths.launcherCachefile = settings.here_are_dragons.paths.launcherCachefile.replace('%TERMNAME%', replaceTermName);
      settings.here_are_dragons.paths.newsfile = settings.here_are_dragons.paths.newsfile.replace('%TERMNAME%', replaceTermName);
      settings.here_are_dragons.paths.hiddenRulesfile = settings.here_are_dragons.paths.hiddenRulesfile.replace('%TERMNAME%', replaceTermName);
      settings.here_are_dragons.paths.flagFreshInstall = settings.here_are_dragons.paths.flagFreshInstall.replace('%TERMNAME%', replaceTermName);
   }

   for (let [key, value] of Object.entries(settings.here_are_dragons.paths)) {
      settings.here_are_dragons.paths[key] = global_aux.normalicePath(value, true) || value;
   }

   if (process && process.versions) {
      settings.here_are_dragons.report.version_electron = process.versions.electron;
      settings.here_are_dragons.report.version_chrome = process.versions.chrome;
      settings.here_are_dragons.report.version_node = process.versions.node;
   }

   if (process && process.env) {
      settings.here_are_dragons.report.process_env_NODE_ENV = process.env.NODE_ENV;
   }

   settings.here_are_dragons.ostype = os.type();
   settings.here_are_dragons.os = process.platform;

   //FORCE OVERWRITES
   if (user_settings.here_are_dragons.chromiumConsole !== undefined) {
      settings.here_are_dragons.chromiumConsole = user_settings.here_are_dragons.chromiumConsole;
   }
   if (user_settings.here_are_dragons.startOpen !== undefined) {
      settings.here_are_dragons.startOpen = user_settings.here_are_dragons.startOpen;
   }
   if (argv.chromiumConsole !== undefined) {
      settings.here_are_dragons.chromiumConsole = $boolean(argv.chromiumConsole);
   }
   if (argv.startOpen !== undefined) {
      settings.here_are_dragons.startOpen = $boolean(argv.startOpen);
   }

   publicSettings = global_aux.cloneDeep(settings);

   isElevated().then(ele => {
      publicSettings.here_are_dragons.report.isElevated = ele;
   });

   //DELETE TMP
   if (fs.existsSync(settings.here_are_dragons.paths.tmp)) {
      try {
         rimraf(settings.here_are_dragons.paths.tmp, () => {}, () => {});
      } catch (e) {}
   }

   //SAVE USER.LAST
   saveFileSync(`${user_settings_file}.last`, settings, 'json5'); //Make example
}

function extendSettings($default_settings, $user_settings) {
   let $settings = global_aux.cloneDeep($default_settings);
   if ($user_settings) {
      $settings = global_aux.mergeObj($settings, $user_settings);
   }
   return $settings;
}

function changeSettings() {
   logger.log('Watch settings fired');

   load_and_makeSettings();

   if (global_aux.equal(settings, lastUserSettings)) return;

   //KTODO: Use deep-object-diff
   let differences = uniqWith(diff(settings, lastUserSettings), JSON.stringify);
   let all_path = '';
   let diffs = [];

   if (differences && differences.length) {
      each(differences, dif => {
         all_path = '';
         let dif_path = uniqWith(dif.path, JSON.stringify);
         each(dif_path, path => {
            if (all_path.length) {
               all_path += `.${path}`;
            } else {
               all_path = path;
            }
            diffs.push(dif);
            changeSettingsEvent.emit('change', all_path, dif);
            logger.log('[changeSettings event emited]', all_path);
         });
      });

      logger.log('[USER SETTINGS]', {
         user_settings,
         all_path,
         diffs,
      });

      lastUserSettings = settings;
   }
}
function changeApp(evt, name) {
   let $parent = global_aux.normalicePath(path.join(name, '/../'), false);
   let $root = global_aux.normalicePath(path.join(`${__dirnameRoot}/app/`), false);

   if ($parent === $root) {
      console.log('[relaunch!]');
      changeSettingsEvent.emit('relaunchApp', evt, name);
      return;
   }

   changeSettingsEvent.emit('changeApp', evt, name);
}

function watchAppChanges() {
   if (!settings.dev || !__dirnameRoot || !settings.here_are_dragons.reloadOnAppChanges) return;
   let reloadOnAppChangesTime = get(settings, 'here_are_dragons.reloadOnAppChangesTime') || 1024;
   let changeAppDebounce = debounce(changeApp, reloadOnAppChangesTime);

   console.log('[watchAppChanges]', reloadOnAppChangesTime);

   let chokidarOptions = {
      ignored: [/node_modules/, /.css/, /.styl/, /.map/, /.txt/, /tests.json/],
      depth: 5,
      ignoreInitial: true,
      followSymlinks: true,
      useFsEvents: false,
   };

   //KTODO: agregar if setting
   let dirWatch = path.normalize(path.join(`${__dirnameRoot}/app/`));
   if (dirWatch && fs.existsSync(dirWatch)) {
      watch(dirWatch, chokidarOptions).on('change', (name, evt) => {
         if (global.sharedObj.status.get().in_test) return;
         if (!settings.here_are_dragons.reloadOnAppChanges) return;
         changeAppDebounce(evt, name);
      });
   } else {
      logger.warn('Cant watch app changes');
   }

   let dirWatchPackages = path.normalize(path.join(__dirnameRoot, '\\packages_dev\\'));
   if (dirWatchPackages && fs.existsSync(dirWatchPackages)) {
      watch(dirWatchPackages, chokidarOptions).on('change', (name, evt) => {
         changeAppDebounce(evt, name);
      });
   } else {
      logger.info('Cant watch app packages changes', dirWatchPackages);
   }
}

function watchSettings() {
   let dir = settings.here_are_dragons.paths.user;
   let userSettings = settings.here_are_dragons.paths.userSettingsFile;
   let changeSettingsDebounce = debounce(changeSettings, 128);

   let chokidarOptions = {
      ignored: [/node_modules/, /.css/, /.styl/, /.map/, /.txt/],
      depth: 5,
      ignoreInitial: true,
      followSymlinks: true,
      useFsEvents: false,
   };

   let exist_userSettings = fs.existsSync(dir + userSettings);

   if (exist_userSettings) {
      let dirWatch = path.normalize(path.join(dir + userSettings));

      watch(dirWatch, chokidarOptions).on('change', (name, evt) => {
         console.log('[settings File]', '%s changed!', name);
         changeSettingsDebounce();
      });
   } else {
      logger.warn('Cant watch user settings');
   }

   lastUserSettings = settings;

   if (get(settings, 'here_are_dragons.printFirstSettings') && true) logger.log('\r\n', '\r\nSETTINGS:\r\n\r\n', JSON.stringify(settings, null, 2), '\r\n');
}

function setAndSaveSettings(file, obj) {
   /*KTODO: QUE LE AGREGUE LOS COMMENTS*/

   try {
      obj = JSON.parse(JSON.stringify(obj));
   } catch (e) {
      logger.warn('setAndSaveSettings param not valid', e, obj);
      return false;
   }

   if (!global_aux.isExist(obj)) {
      logger.warn('setAndSaveSettings param not valid', obj);
      return false;
   }

   //userSettings
   if (file === 'userSettings') {
      let changedSettings = global_aux.cloneDeep(extendSettings(user_settings, obj));
      let changedSettingsAll = global_aux.cloneDeep(extendSettings(settings, obj));

      if (global_aux.equal(settings, changedSettingsAll)) {
         return;
      }

      delete changedSettings.load_user_settings;
      delete changedSettings.user_settingsLoaded;
      delete changedSettings.load_user_settings_error;

      let user_settings_to_save = settings2comments(defSettings) + JSON.stringify(changedSettings, null, 4);

      if (getSettings().here_are_dragons.setAndSaveSettings_enabled) {
         saveFileSync(user_settings_file, user_settings_to_save, 'TXT');

         return true;
      }
   }
   //KTODO: Una rule para modificar los settings de los packages
}

function settings2comments($settings) {
   let settingsComments = global_aux.cloneDeep($settings);
   try {
      delete settingsComments.load_user_settings;
      delete settingsComments.user_settingsLoaded;
      delete settingsComments.load_user_settings_error;
      delete settingsComments.here_are_dragons;
      delete settingsComments.overwriteDefaultFileAssociations;
      delete settingsComments.defaultTerminalApp;
   } catch (e) {
      return null;
   }
   return `/*${JSON.stringify(settingsComments, null, 4).replace(/\*/g, '#')}*/` + `\r\n`;
}

//_________________________________________
//SET PUBLIC
//_________________________________________
module.exports.init = init;
module.exports.settings = {
   getSettings: () => global_aux.cloneDeep(publicSettings),
   getDefaultSettings: () => global_aux.cloneDeep(defSettings),
   getUserSettings: () => (user_settings ? global_aux.cloneDeep(user_settings) : {}),
   getChangeSettingsEvent: () => changeSettingsEvent,
   setAndSaveSettings: setAndSaveSettings,
};
