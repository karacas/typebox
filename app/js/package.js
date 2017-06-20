'use strict';

const path = require('path');
const _ = require('lodash');
const JSON5 = require('json5');
const ruleManager = require('../js/ruleManager.js');
const Executor = require('../js/executor.js');
const ListViewStore = require('../js/listViewStore.js');
const auxjs = require('../auxfs.js');
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');
const driveManager = require('../js/aux_driveManager.js');
const favManager = require('../js/favManager.js');
const lastRulesManager = require('../js/lastRulesManager.js');
const aux_webManager = require('../js/aux_webManager.js');
const aux_viewer = require('../js/aux_viewer.js');
const packagesManager = require('../js/packagesManager.js');
const commandCheckerRegExOld = /^\s?(.*?)\s?\((.*?)\)\s?\!$/g;
const commandCheckerRegEx = /^\s?(.*?)\s?\:\s?(.*?)\s?\!$/g;

let robot = null;

try {
    robot = require('robotjs');
} catch (e) {
    Logger.error('NO ROBOTJS', e);
}

module.exports = (name, pack, url) => {
    const app = {
        logger: Logger,
        allSetting: Config.getAll(),
        getSetting: setting => {
            return Config.get(setting);
        },
        writeString: Executor.auxPlaceString,
        copyToClipboard: Executor.auxCopyToClipboard,
        placeExecutors: Executor.auxCallExecutors,
        aux_webManager: aux_webManager,
        createViewerHtml: aux_viewer.createViewerHtml,
        createViewerWebView: aux_viewer.createViewerWebView,
        createComponentFromHtml: aux_viewer.createComponentFromHtml,
        onIdleTimeInterval: sharedData.idleTime.onIdleTimeInterval,
        getQuery: () => {
            return ListViewStore.store.getState().search_text;
        },
        setQuery: string => {
            setTimeout(() => {
                ListViewStore.storeActions.changeQuery(string);
            });
        },
        setResult: string => {
            setTimeout(() => {
                ListViewStore.storeActions.changeResult(string);
            });
        },
        getPath: () => {
            //KTODO: Cambiar nombre getRulesPath
            return ListViewStore.store.getState().rulesPath;
        },
        getDriveManager: () => {
            //KTODO: Cambiar nombre getRulesPath
            return driveManager;
        },
        setPath: changePathObj => {
            //KTODO: Cambiar nombre setRulesPath
            setTimeout(() => {
                ListViewStore.storeActions.changeRulesPath(changePathObj);
            });
        },
        addRules: rules => {
            return ruleManager.setVirtualRules(rules, name, false);
        },
        setRules: rules => {
            return ruleManager.setVirtualRules(rules, name, true);
        },
        deleteRules: () => {
            return ruleManager.deleteVirtualRules(name);
        },
        addPermanentRules: rules => {
            return ruleManager.pushRulePack(rules);
        },
        _addLoader: path => {
            return ruleManager.addLoader(path, name, false);
        },
        putLoader: path => {
            return ruleManager.addLoader(path, name, true);
        },
        add2fav: obj => {
            return favManager.push(obj);
        },
        toggle: obj => {
            return favManager.toggle(obj);
        },
        removeLoader: path => {
            return ruleManager.removeLoader(path, name);
        },
        forceRefreshRules: () => {
            return ruleManager.forceRefreshRules();
        },
        reloadApp: () => {
            return sharedData.app_window_and_systray.refreshListWindow();
        },
        devModeOn: () => {
            return sharedData.app_window_and_systray.setDevMode(true);
        },
        printSettings: () => {
            return sharedData.app_window_and_systray.printSettings();
        },
        openDevTools: () => {
            return sharedData.app_window_and_systray.openDevTools();
        },
        quit: () => {
            return sharedData.app_window_and_systray.quit();
        },
        hide: () => {
            return sharedData.app_window_and_systray.unpopWin();
        },
        getRobotJs: () => {
            return robot;
        },
        getRealClock: () => {
            return sharedData.realClock;
        },
        getTime: () => {
            return sharedData.realClock;
        },
        require: req => {
            return require(req);
        },
        getlastItemsPath: lastRulesManager.getlastItemsPath
    };

    //EVENTS
    app.on = (textEvent, callback) => {
        if (!callback) {
            return;
        }
        if (textEvent === 'changeQuery') {
            ListViewStore.storeEvents.on('CHANGE_SEARCH_TEXT', obj => {
                try {
                    callback(obj);
                } catch (error) {
                    onCatchErrorPackage(name, error);
                    return null;
                }
            });
        }
        if (textEvent === 'changeCommand') {
            ListViewStore.storeEvents.on('CHANGE_SEARCH_TEXT', commandLine => {
                if (!commandLine.match(/\!$/)) return;
                if (!commandLine.match(commandCheckerRegEx)) return;

                let exec = commandCheckerRegEx.exec(commandLine);
                if (!exec) return;

                let command = exec[1];
                let args = exec[2];

                if (args === 'on' || args === 'true') {
                    args = true;
                }
                if (args === 'off' || args === 'false') {
                    args = false;
                }

                try {
                    Logger.info('[!Command] : ', command, args);
                    callback({ command, args });
                } catch (error) {
                    onCatchErrorPackage(name, error);
                    return null;
                }
            });
        }
        if (textEvent === 'avoidCache') {
            ListViewStore.storeEvents.on('AVOID_CACHE', obj => {
                try {
                    callback(obj);
                } catch (error) {
                    onCatchErrorPackage(name, error);
                    return null;
                }
            });
        }
        if (textEvent === 'changePath') {
            ListViewStore.storeEvents.on('CHANGE_PATH', obj => {
                try {
                    callback(obj.path, obj);
                } catch (error) {
                    onCatchErrorPackage(name, error);
                    return null;
                }
            });
        }
        if (textEvent === 'show') {
            sharedData.app_window_and_systray.windowEvent.on('SHOW', () => {
                try {
                    callback();
                } catch (error) {
                    onCatchErrorPackage(name, error);
                    return null;
                }
            });
        }
        if (textEvent === 'hide') {
            sharedData.app_window_and_systray.windowEvent.on('HIDE', () => {
                try {
                    callback();
                } catch (error) {
                    onCatchErrorPackage(name, error);
                    return null;
                }
            });
        }
        if (textEvent === 'quit') {
            sharedData.app_window_and_systray.windowEvent.on('QUIT', () => {
                try {
                    callback();
                } catch (error) {
                    onCatchErrorPackage(name, error);
                    return null;
                }
            });
        }
        if (textEvent === 'changeSettings') {
            Config.getChangeSettingsEvent().on('changeSettings', (path, dif) => {
                try {
                    callback(path, dif);
                } catch (error) {
                    onCatchErrorPackage(name, error);
                    return null;
                }
            });
        }
        if (textEvent === 'idle') {
            sharedData.idleTime.getIdleEvent().on('idle', () => {
                try {
                    callback();
                } catch (error) {
                    onCatchErrorPackage(name, error);
                    return null;
                }
            });
        }
    };

    //Check
    if (_.isFunction(pack)) {
        pack = pack(app);
    } else {
        onCatchErrorPackage(name, 'no export function');
    }

    if (!name) {
        onCatchErrorPackage(name, 'no name');
        return null;
    }

    if (pack.name) {
        onCatchErrorPackage(name, 'invalid pack: package already have a name:', pack.name);
        return null;
    }

    if (!_.isObject(pack)) {
        onCatchErrorPackage(name, 'is not an object');
        return null;
    }

    let packageDir = () => {
        return url;
    };

    //Set name
    pack.name = name;

    //Set config
    if (pack.config && !_.isEmpty(pack.config)) {
        let settingsPackUserUrl = packagesManager.getPackcageSettingsFile(name, true);
        let settingsPackUser = sharedData.dataManager.getFile(settingsPackUserUrl, 'JSON5', false);

        if (!settingsPackUser) {
            let packConfigUser = JSON.stringify(pack.config, null, 4);
            let packConfigUserCommented = '/*' + packConfigUser.replace(/\*/g, '#') + '*/' + '\r\n{\r\n\r\n}';
            sharedData.dataManager.setFile(settingsPackUserUrl, packConfigUserCommented, 'TXT');
        } else {
            pack.config = auxjs.extendObj(pack.config, settingsPackUser);
        }
    }

    return pack;
};

function onCatchErrorPackage(name, error) {
    Logger.error('Package: ', name, '/ error:', error);
}
