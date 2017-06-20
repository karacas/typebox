'use strict';

const electron = require('electron');
const app = electron.app;
const __dirnameRoot = String(app.getAppPath());
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const mkpath = require('mkpath');
const os = require('os');
const _ = require('lodash');
const msgpack = require('msgpack-lite');
const JSON5 = require('json5');
const EventEmitter = require('events');
const diff = require('deep-diff').diff;
const default_config = require('./default_config.js');
const logger = require('./main_logger.js');
const auxjs = require('./auxfs.js');
const toaster = require('./toaster.js');
const defSettings = default_config.settings;
const electronlog = require('electron-log');
const watch = require('node-watch');
const shortcut_normalize = require('electron-shortcut-normalizer');
const isAccelerator = require('electron-is-accelerator');

let outPutsettings = null;
let outPutdataManager = null;

let initiated = false;
let settings = null;
let user_settings_file = null;
let user_settings = null;
let publicSettings = null;
let dataLoaded = {};
let forceDev = false;
let argv = null;
let lastUserSettings = null;
let changeSettingsEvent = new EventEmitter();

function init($argv) {
    if (initiated || global.sharedObj) {
        module.exports.init = function() {
            logger.log('data_io is already definded');
        };
        module.exports.settings = global.sharedObj.settings_manager;
        module.exports.dataManager = global.sharedObj.dataManager;
        return;
    }

    argv = $argv;

    load_and_makeSettings();
    loadLauncherCache();
    loadHistory();
    loadfav();
    loadlast();
    loadHiddenRules();
    loadNewsRules();
    setShares();
    configLogger();
    watchSettings();

    initiated = true;
    return;
}

function configLogger() {
    let logPath = _.result(publicSettings, 'here_are_dragons.paths.logpath') + _.result(publicSettings, 'here_are_dragons.paths.logfile');
    mkpath.sync(path.dirname(logPath));
    electronlog.transports.file.file = logPath;
    electronlog.transports.console.level = _.result(publicSettings, 'here_are_dragons.logger.level');
    electronlog.transports.file.level = _.result(publicSettings, 'here_are_dragons.logger.level');
    electronlog.transports.file.maxSize = _.result(publicSettings, 'here_are_dragons.logger.maxSize');
    logger.init(settings, global.sharedObj);
}

//KTODO Mover a un modulo aparte
function setShares() {
    if (initiated || global.sharedObj) {
        return;
    }
    global.sharedObj = {};
    let $global = global.sharedObj;
    $global.app = app;
    $global.settings_manager = module.exports.settings;
    $global.dataManager = module.exports.dataManager;
    $global.toaster = toaster;
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
    settings = _.cloneDeep(defSettings);

    user_settings_file = settings.here_are_dragons.paths.user + settings.here_are_dragons.paths.userSettingsFile;

    if (argv && argv.user_settings_file) {
        user_settings_file = argv.user_settings_file;
    }

    settings.here_are_dragons.report.__user_settings = user_settings_file;

    user_settings = null;

    let exist_user_settings = fs.existsSync(user_settings_file);
    if (exist_user_settings) {
        user_settings = loadFileSync(user_settings_file, 'JSON5');
        saveFileSync(user_settings_file + '.bak', user_settings, 'HJSON'); //Make bakup
    } else {
        let user_settings_w_comments = settings2comments(defSettings) + '{\r\n\r\n}';
        saveFileSync(user_settings_file, user_settings_w_comments, 'TXT');
    }

    //KTODO: Aprolijar
    settings = extendSettings(defSettings, user_settings);

    settings.dev = Boolean(require('electron-is-dev'));

    settings.here_are_dragons.electron_windows_list_options.width = settings.width;

    if (settings.visibleInTaskBar) {
        settings.here_are_dragons.electron_windows_list_options.skipTaskbar = false;
        settings.here_are_dragons.electron_windows_list_options.show = true;
        settings.here_are_dragons.electron_windows_list_options.minimizable = true;
        settings.here_are_dragons.startOpen = true;
        settings.here_are_dragons.search_box_main_window.hideOnBlur = false;
    }

    if (user_settings && user_settings.dev !== undefined) {
        settings.dev = Boolean(user_settings.dev);
    }

    //Keys mainShortcut
    settings.mainShortcut = shortcut_normalize(settings.mainShortcut, process.platform);
    if (!isAccelerator(settings.mainShortcut)) {
        settings.mainShortcut = shortcut_normalize(defSettings.mainShortcut);
        logger.warn('settings.mainShortcut is not a valid Accelerator');
    }

    //Force dev in command line
    if (argv && argv.dev) {
        // --dev
        settings.dev = Boolean(argv.dev);
    }
    if (argv && argv.prod) {
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
        settings.verbose = true;
    } else {
        settings.verbose = settings.here_are_dragons.verbose;
    }

    if (forceDev) {
        settings.verbose = true;
    }

    if (!settings.dev) {
        settings.here_are_dragons.debug = {};
        settings.here_are_dragons.verboseTimes = _.result(user_settings, 'here_are_dragons.verboseTimes') || false;
    }

    if (user_settings && user_settings.here_are_dragons && user_settings.here_are_dragons.debug != undefined) {
        settings.debug = user_settings.debug;
    }

    settings.here_are_dragons.report.__dirnameRootApp = __dirnameRoot;
    settings.here_are_dragons.report.version = app.getVersion();
    settings.here_are_dragons.argv = argv;

    //Concat computername 2 paths
    //KTODO: Hacer un replace para todos los paths de manera automatica, que sea en el save/load
    let replaceTermName = settings.here_are_dragons.terminalName;
    if (settings.here_are_dragons.addTermNametoPaths && replaceTermName && replaceTermName.length && replaceTermName != 'undefined') {
        replaceTermName = '_' + replaceTermName;
        settings.here_are_dragons.paths.logfile = settings.here_are_dragons.paths.logfile.replace('%TERMNAME%', replaceTermName);
        settings.here_are_dragons.paths.historyfile = settings.here_are_dragons.paths.historyfile.replace('%TERMNAME%', replaceTermName);
        settings.here_are_dragons.paths.favfile = settings.here_are_dragons.paths.favfile.replace('%TERMNAME%', replaceTermName);
        settings.here_are_dragons.paths.lastfile = settings.here_are_dragons.paths.lastfile.replace('%TERMNAME%', replaceTermName);
        settings.here_are_dragons.paths.launcherCachefile = settings.here_are_dragons.paths.launcherCachefile.replace('%TERMNAME%', replaceTermName);
        settings.here_are_dragons.paths.newsfile = settings.here_are_dragons.paths.newsfile.replace('%TERMNAME%', replaceTermName);
    }

    if (process && process.versions) {
        settings.here_are_dragons.report.version_electron = process.versions.electron;
        settings.here_are_dragons.report.version_chrome = process.versions.chrome;
        settings.here_are_dragons.report.version_node = process.versions.node;
    }

    //KTODO: Cambiar por: process.platform
    settings.here_are_dragons.os = os.type();
    publicSettings = auxjs.cloneDeep(settings);

    //DELETE TMP
    if (fs.existsSync(settings.here_are_dragons.paths.tmp)) {
        try {
            rimraf(settings.here_are_dragons.paths.tmp, () => {}, () => {});
        } catch (e) {}
    }

    //SAVE USER.LAST
    if (settings.dev) {
        saveFileSync(user_settings_file + '.last', settings, 'HJSON'); //Make example
    }
}

function extendSettings($default_settings, $user_settings) {
    let $settings = auxjs.cloneDeep($default_settings);
    if ($user_settings) {
        $settings = auxjs.extendObj($settings, $user_settings);
    }
    return $settings;
}

function getSettings() {
    return publicSettings;
}

function changeSettings() {
    logger.log('Watch settings fired [1]');

    load_and_makeSettings();

    let differences = _.uniqWith(diff(settings, lastUserSettings), JSON.stringify);
    let all_path = '';
    let diffs = [];

    if (differences && differences.length) {
        _.each(differences, dif => {
            all_path = '';
            let dif_path = _.uniqWith(dif.path, JSON.stringify);
            _.each(dif_path, path => {
                if (all_path.length) {
                    all_path += '.' + path;
                } else {
                    all_path = path;
                }
                diffs.push(dif);
                changeSettingsEvent.emit('change', all_path, dif);
            });
        });

        logger.log(
            '\r\n',
            '\r\nUSER SETTINGS:\r\n',
            JSON.stringify(user_settings, null, 2),
            '\r\nCHANGES:\r\n',
            'all_path: [2]',
            all_path,
            '\r\n',
            'diffs: [3] ',
            diffs,
            '\r\n'
        );

        lastUserSettings = settings;
    }
}

let changeSettingsDebounce = _.debounce(changeSettings, 120);

function watchSettings() {
    let dir = settings.here_are_dragons.paths.user;
    let userSettings = settings.here_are_dragons.paths.userSettingsFile;

    let exist_userSettings = fs.existsSync(dir + userSettings);

    if (exist_userSettings) {
        let dirWatch = path.normalize(path.join(dir + userSettings));
        watch(dirWatch, { recursive: true }, function(evt, name) {
            logger.log('%s changed!', name);
            // changeSettings();
            changeSettingsDebounce();
        });
    } else {
        logger.warn('Cant watch user settings');
    }

    lastUserSettings = settings;

    console.log('\r\n', '\r\nSETTINGS:\r\n\r\n', JSON.stringify(settings, null, 2), '\r\n');
}

//_________________________________________
//HISTORY
//_________________________________________
function saveHistory(data) {
    let fileName = getSettings().here_are_dragons.paths.historypath + getSettings().here_are_dragons.paths.historyfile;
    dataLoaded.history = data;
    return saveGenericJson(data, fileName);
}

function loadHistory() {
    let fileName = getSettings().here_are_dragons.paths.historypath + getSettings().here_are_dragons.paths.historyfile;
    dataLoaded.history = loadGenericJson(fileName, getSettings().here_are_dragons.historyBackups);
}

//_________________________________________
//FAV
//_________________________________________
function savefav(data) {
    let fileName = getSettings().here_are_dragons.paths.favpath + getSettings().here_are_dragons.paths.favfile;
    dataLoaded.fav = data;
    return saveGenericJson(data, fileName);
}

function loadfav() {
    let fileName = getSettings().here_are_dragons.paths.favpath + getSettings().here_are_dragons.paths.favfile;
    dataLoaded.fav = loadGenericJson(fileName, getSettings().here_are_dragons.favBackups);
}

//_________________________________________
//LAST
//_________________________________________
function savelast(data) {
    let fileName = getSettings().here_are_dragons.paths.lastpath + getSettings().here_are_dragons.paths.lastfile;
    dataLoaded.last = data;
    return saveGenericJson(data, fileName);
}

function loadlast() {
    let fileName = getSettings().here_are_dragons.paths.lastpath + getSettings().here_are_dragons.paths.lastfile;
    dataLoaded.last = loadGenericJson(fileName, getSettings().here_are_dragons.lastBackups);
}

//_________________________________________
//LAUNCHER CACHE
//_________________________________________
function saveLauncherCache(data) {
    if (!settings.here_are_dragons.launcherCache) return;
    let fileName = getSettings().here_are_dragons.paths.caches + getSettings().here_are_dragons.paths.launcherCachefile;
    dataLoaded.launcherCache = data;
    return saveGenericJson(data, fileName);
}

function loadLauncherCache() {
    if (!settings.here_are_dragons.launcherCache) return;
    let fileName = getSettings().here_are_dragons.paths.caches + getSettings().here_are_dragons.paths.launcherCachefile;
    dataLoaded.launcherCache = loadGenericJson(fileName, getSettings().here_are_dragons.launcherCacheBackups);
}

//_________________________________________
//HIDDEN RULES
//_________________________________________
function saveHiddenRules(data) {
    let fileName = getSettings().here_are_dragons.paths.hidden_path + getSettings().here_are_dragons.paths.hiddenRulesfile;
    dataLoaded.hiddenRules = data;
    return saveGenericJson(data, fileName);
}

function loadHiddenRules() {
    let fileName = getSettings().here_are_dragons.paths.hidden_path + getSettings().here_are_dragons.paths.hiddenRulesfile;
    dataLoaded.hiddenRules = loadGenericJson(fileName);
}

//_________________________________________
//NEWS RULES
//_________________________________________
function saveNewsRules(data) {
    let fileName = getSettings().here_are_dragons.paths.newspath + getSettings().here_are_dragons.paths.newsfile;
    dataLoaded.newsRules = data;
    return saveGenericJson(data, fileName);
}

function loadNewsRules() {
    let fileName = getSettings().here_are_dragons.paths.newspath + getSettings().here_are_dragons.paths.newsfile;
    dataLoaded.newsRules = loadGenericJson(fileName);
}

//_________________________________________
//GenericJson
//_________________________________________
function saveGenericJson(data, fileName) {
    return saveFileSync(fileName, auxjs.cloneDeep(data), 'msgpack');
}

function loadGenericJson(fileName, useBackup = false) {
    let genericJson = loadFileSync(fileName, 'msgpack');

    if (!genericJson && useBackup) {
        //try bakup
        genericJson = loadFileSync(fileName + '.bak', 'msgpack');
    } else if (useBackup) {
        //make backup
        saveFileSync(fileName + '.bak', auxjs.cloneDeep(genericJson), 'msgpack');
    }

    return genericJson;
}

//_________________________________________
//INTERNAL AUX
//_________________________________________

function loadFileSync(filename, type, printError = true) {
    let result = null;

    try {
        if (fs.existsSync(filename)) {
            if (!type) {
                result = fs.readFileSync(filename);
            }
            if (type === 'msgpack') {
                result = msgpack.decode(fs.readFileSync(filename));
            }
            if (type === 'JSON' || type === 'HJSON') {
                result = JSON.parse(fs.readFileSync(filename, 'utf8'));
            }
            if (type === 'JSON5') {
                result = JSON5.parse(fs.readFileSync(filename, 'utf8'));
            }
        }
    } catch (e) {
        result = null;
    }

    if (!result && printError) {
        logger.error('Error Loading: ', filename, result);
    }

    return result;
}

function saveFileSync(filename, data, type) {
    let result = false;

    if (!filename) {
        logger.error('No filename:', filename);
        return;
    }

    try {
        mkpath.sync(path.dirname(filename));
    } catch (err) {
        logger.error(err, filename);
        return false;
    }

    try {
        if (type === 'msgpack') {
            data = msgpack.encode(data);
        }
        if (type === 'JSON') {
            data = JSON.stringify(data);
        }
        if (type === 'HJSON') {
            data = JSON.stringify(data, null, 4);
        }
        if (type === 'JSON5') {
            data = JSON5.stringify(data, null, 4);
        }

        result = fs.writeFileSync(filename, data);
    } catch (err) {
        //KTODO: make Logger
        logger.error(err);
        return false;
    }

    return true;
}

function setAndSaveSettings(file, obj) {
    /*KTODO: QUE LE AGREGUE LOS COMMENTS*/

    try {
        obj = JSON.parse(JSON.stringify(obj));
    } catch (e) {
        logger.warn('setAndSaveSettings param not valid', e, obj);
        return false;
    }

    if (null == obj || 'undefined' == typeof obj) {
        logger.warn('setAndSaveSettings param not valid', obj);
        return false;
    }

    //userSettings
    if (file === 'userSettings') {
        let changedSettings = _.cloneDeep(extendSettings(user_settings, obj));
        let changedSettingsAll = _.cloneDeep(extendSettings(settings, obj));

        if (JSON.stringify(settings) === JSON.stringify(changedSettingsAll)) {
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
    let settingsComments = _.cloneDeep($settings);
    delete settingsComments.load_user_settings;
    delete settingsComments.user_settingsLoaded;
    delete settingsComments.load_user_settings_error;
    delete settingsComments.here_are_dragons;
    delete settingsComments.overwriteDefaultFileAssociations;
    delete settingsComments.defaultTerminalApp;
    return '/*' + JSON.stringify(settingsComments, null, 4).replace(/\*/g, '#') + '*/' + '\r\n';
}

function deleteUserData() {
    let userFolder = _.result(getSettings(), 'here_are_dragons.paths.user');
    if (!userFolder || !global || !global.sharedObj || !global.sharedObj.app_window_and_systray) return;
    try {
        rimraf.sync(userFolder);
        setTimeout(() => {
            load_and_makeSettings();
            setTimeout(() => {
                watchSettings();
                global.sharedObj.app_window_and_systray.refreshListWindow();
            }, 100);
        }, 100);
    } catch (e) {
        logger.warn(e);
    }
}

function deleteCaches() {
    let cacheFolder = _.result(getSettings(), 'here_are_dragons.paths.caches');
    if (!cacheFolder || !global || !global.sharedObj || !global.sharedObj.app_window_and_systray) return;
    saveLauncherCache(null);
    try {
        rimraf.sync(cacheFolder);
    } catch (e) {
        logger.warn(e);
    }
    global.sharedObj.app_window_and_systray.refreshListWindow();
}

//_________________________________________
//SET PUBLIC
//_________________________________________
module.exports.init = init;
module.exports.settings = {
    getSettings: getSettings,
    getDefaultSettings: () => _.cloneDeep(defSettings),
    getUserSettings: () => {
        if (!user_settings) {
            return {};
        }
        return _.cloneDeep(user_settings) || {};
    },
    getChangeSettingsEvent: () => {
        return changeSettingsEvent;
    }
};
module.exports.dataManager = {
    //KTODO: Move 2 aux
    saveHistory: saveHistory,
    dataLoaded: dataLoaded,
    savelast: savelast,
    savefav: savefav,
    saveNewsRules: saveNewsRules,
    saveHiddenRules: saveHiddenRules,
    getFile: loadFileSync,
    setFile: saveFileSync,
    saveLauncherCache: saveLauncherCache,
    saveGenericJson: saveGenericJson,
    loadGenericJson: loadGenericJson,
    setAndSaveSettings: setAndSaveSettings,
    deleteUserData: deleteUserData,
    deleteCaches: deleteCaches
};
