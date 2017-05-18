'use strict';
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const Immutable = require('immutable');
const mkpath = require('mkpath');
const check = require('syntax-error');
const PackagesUtils = require('../js/packagesUtils.js');
const ruleManager = require('../js/ruleManager.js');
const Executor = require('../js/executor.js');
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const setPackager = require('../js/package.js');
const sharedData = require('../js/sharedData.js');
const themeManager = require('../js/themeManager.js');
const getDirectories = require('../auxfs.js').getDirectories;
const InfCreateClass = require('inferno-create-class');

const icon = require('../js/icon.js');

require('babel-core/register')({
    plugins: ['inferno'],
    extensions: ['.jsx']
});

var plugins = [];
var viewers = [];
var executors = [];

function makePackages() {
    return new Promise((resolve, reject) => {
        Logger.info('[Package] Manager init');

        checkDifRemove(Config.get('here_are_dragons.paths.packages'))
            .then(checkDifPackagesInstall)
            .then(() => {
                //internal_packages
                var internal_packages = Config.get('here_are_dragons.internal_packages') || [];
                internal_packages.map(pack => {
                    registerPlugin(pack, '../js/packages_internal/' + pack);
                });

                //testPackage
                var testPackage = Config.get('here_are_dragons.debug.testPackage');
                if (testPackage) {
                    registerPlugin(testPackage, '../js/packages_internal/' + testPackage);
                }

                //loadPackagesDev
                if (Config.get('here_are_dragons.loadPackagesDev')) {
                    registerFolderPlugins(Config.get('here_are_dragons.paths.packages_dev'), Config.get('ignoreThesePackages'));
                }

                //loadPackages
                if (Config.get('here_are_dragons.loadPackages')) {
                    registerFolderPlugins(Config.get('here_are_dragons.paths.packages'), Config.get('ignoreThesePackages'));
                }

                changeSettingsEvent();

                resolve();
            })
            .catch(e => {
                Logger.error(e);
                resolve();
            });
    });
}

function checkDifRemove(path) {
    return new Promise((resolve, reject) => {
        Logger.info('[Package] Manager, check user packages to remove');

        //no user config or no user packages
        if (!Config.get('packages') || !Config.get('here_are_dragons.deletePackages')) {
            resolve();
            return;
        }

        //<Get list of installed packages
        var packagesInstalled = [];

        if (fs.existsSync(path)) {
            packagesInstalled = getDirectories(path).map(pluginName => {
                if (!checkInList(pluginName, Config.get('ignoreThesePackages'))) {
                    return pluginName;
                }
            });
        } else {
            mkpath.sync(path);
        }

        Promise.all(packagesInstalled.map(checkAndRemove)).then(resolve).catch(reject);
    });
}

function checkAndRemove(packInstalled) {
    return new Promise((resolve, reject) => {
        var userPacks = Config.get('packages');
        var needDelete = !_.includes(userPacks, packInstalled);
        if (needDelete) {
            PackagesUtils.removePackage(packInstalled)
                .then(() => {
                    Logger.warn('[Package] removed OK:', packInstalled);
                    resolve();
                })
                .catch(e => {
                    Logger.error('[Package] removed fail:', packInstalled, e);
                    resolve();
                });
        } else {
            resolve();
        }
    });
}

function checkDifPackagesInstall() {
    return new Promise((resolve, reject) => {
        Logger.info('[Package] Manager, check user packages to install');

        var packList = Config.get('packages');

        //no user config or no user packages
        if (!packList || !Config.get('here_are_dragons.installPackages')) {
            resolve();
            return;
        }

        Promise.all(packList.map(checkAndInstall)).then(resolve).catch(reject);
    });
}

function checkAndInstall(pack) {
    return new Promise((resolve, reject) => {
        if (window && window.navigator && window.navigator.onLine && !fs.existsSync(Config.get('here_are_dragons.paths.packages') + pack)) {
            //install packacge if online
            PackagesUtils.installPackage(pack)
                .then(() => {
                    Logger.info('[Package] installed OK:', pack);
                    sharedData.toaster.notify('Package installed OK: ' + pack);
                    resolve();
                })
                .catch(() => {
                    Logger.error('[Package] install error:', pack);
                    resolve();
                });
        } else {
            resolve();
        }
    });
}

function registerPlugin(name, url, validate = false) {
    if (!name) {
        return;
    }

    if (name.includes('dummyPackage')) {
        return;
    }

    if (checkInList(name, Config.get('ignoreThesePackages'))) {
        Logger.info('[Package] Ignore this Package:', name);
        return;
    }

    //CHECK
    if (getPluginByName(name)) {
        onCatchErrorPackage(name, 'package ' + name + ' is already defined');
        return;
    }

    var packagejson;

    if (validate) {
        try {
            packagejson = require(url + '/package.json');
            var engine = _.result(packagejson, 'engines.fs');
        } catch (error) {
            onCatchErrorPackage(name, 'no valid package.json, need a engine.key', error);
            return;
        }
        if (!engine) {
            onCatchErrorPackage(name, 'no valid package.json, need a engine.key', validate);
            return;
        }
    }

    //If theme
    if (packagejson && packagejson.theme) {
        themeManager.add(name, url, packagejson);
        return;
    }

    if (validate) {
        Logger.info('[Package] try load external pak:', name);
    } else {
        Logger.info('[Package] try load internal pak:', name);
    }

    //CheckSintax
    if (packagejson && Config.get('here_are_dragons.checkPackagesSyntax')) {
        var main = _.result(packagejson, 'main');
        if (main) {
            var src = fs.readFileSync(url + '/' + main);
            if (src && main.indexOf('jsx') === -1) {
                var err = check(src, url);
                if (err) {
                    Logger.error(err);
                    return;
                }
            }
        }
    }

    //TRY LOAD
    try {
        var packReq = require(url);
    } catch (error) {
        onCatchErrorPackage(name, error);
        return;
    }

    //SET PACK
    var pack = setPackager(name, packReq, url);

    if (!pack) {
        return;
    }

    //ADD
    plugins.push({
        name: pack.name,
        plugin: pack
    });
}

function initPlugins() {
    plugins.map(obj => {
        let pack = obj.plugin;

        if (pack.init) {
            try {
                pack.init();
                Logger.info('[Package] loaded OK:', pack.name);
            } catch (error) {
                onCatchErrorPackage(pack.name, error);
                return null;
            }
        }

        //Register packagge executors
        if (pack.defineTypeExecutors) {
            try {
                registerExecutorsPack(pack.defineTypeExecutors(), pack.name);
            } catch (error) {
                onCatchErrorPackage(pack.name, error);
                return;
            }
        }

        //Register packagge viewers
        if (pack.defineTypeViewers) {
            try {
                registerViewersPack(pack.defineTypeViewers(), pack.name);
            } catch (error) {
                onCatchErrorPackage(pack.name, error);
                return;
            }
        }
    });
}

function onCatchErrorPackage(name, error) {
    Logger.error('[Package] Error: ', name, 'error:', error);
}

function registerFolderPlugins(packagesFolder, ignoreThesePackages) {
    if (fs.existsSync(packagesFolder)) {
        getDirectories(packagesFolder).map(pluginName => {
            if (checkInList(pluginName, ignoreThesePackages)) {
                Logger.info('[Package] Ignore this package:', pluginName);
            } else {
                registerPlugin(pluginName, packagesFolder + pluginName, true);
            }
        });
    } else {
        mkpath.sync(packagesFolder);
    }
}

function registerExecutorsPack(pack, name) {
    if (!pack || !name) {
        Logger.error('[Package] Error in registerExecutorsPack:', pack, name);
        return;
    }
    pack.map(packObj => {
        registerExecutors(packObj, name);
    });
}

function registerExecutors(executor, name) {
    try {
        var $executor = {};
        $executor.title = executor.title;
        $executor.type = executor.type;
        $executor.exectFunc = executor.exectFunc;
        $executor.enabled = executor.enabled;
        $executor.namePlugin = name;
        $executor.icon = icon.get(executor.icon);

        $executor.id = executor.id || String(name + '_' + executor.name).toLowerCase().replace(' ', '');

        if ($executor.title && $executor.type && $executor.exectFunc) {
            executors.push($executor);
        } else {
            Logger.error('[Package] Error in registerExecutors:', executor, name);
        }
    } catch (e) {
        Logger.error('[Package] Error in registerExecutors:', executor, name, e);
    }
}

function registerViewersPack(pack, name) {
    if (!pack || !name || !pack.length) {
        Logger.error('[Package] Error in registerViewerPack:', pack, name);
        return;
    }
    pack.map(packObj => {
        registerViewers(packObj, name);
    });
}

function registerViewers(viewer, name) {
    try {
        var $viewer = {};
        $viewer.title = viewer.title;
        $viewer.type = viewer.type;
        // $viewer.viewerComp = InfCreateClass(viewer.viewerComp)
        $viewer.viewerComp = viewer.viewerComp;
        $viewer.namePlugin = name;

        $viewer.id = viewer.id || String(name + '_' + viewer.name).toLowerCase().replace(' ', '');

        if ($viewer.title && $viewer.type && $viewer.viewerComp) {
            viewers.push($viewer);
        } else {
            Logger.error('[Package] Error in registerviewers:', viewer, name);
        }
    } catch (e) {
        Logger.error('[Package] Error in registerviewers:', viewer, name, e);
    }
}

function executeDefaultAction(actionObj) {
    var type = _.result(getExecutors(actionObj.rule), '[0][1].type');

    if (!type) {
        return;
    }

    var defaultExecutorForType = getDefaultExecutor(type);

    if (!defaultExecutorForType || !defaultExecutorForType.exectFunc) {
        Logger.warn('[Package] No executor', actionObj);
        return;
    }

    if (Config.get('here_are_dragons.debug.no_executorAction')) {
        Logger.warn('[Package] No executor: here_are_dragons.debug.no_executorAction');
        return;
    }

    try {
        defaultExecutorForType.exectFunc(actionObj);
    } catch (e) {
        Logger.error('[Package] Error in package:', defaultExecutorForType, actionObj, type, e);
    }
}

function getExecutors(rule) {
    if (!rule) {
        return [];
    }

    var types = _.result(rule, 'type');
    if (!types) {
        return [];
    }

    return getExecutorsByType(types).map((executor, i) => {
        executor.id = executor.id || 'executor_' + i;
        return [i, executor];
    });
}

function getExecutorById(id) {
    if (!executors) {
        return;
    }
    return executors.find(executor => {
        if (executor.id === id) {
            return executor;
        }
    });
}

function getViewerById(id) {
    if (!viewers) {
        return;
    }
    return viewers.find(viewer => {
        if (viewer.id === id) {
            return viewer;
        }
    });
}

/*Executors*/
function call_executors(RuleSelected) {
    return Immutable.Map(
        getExecutors(RuleSelected).filter(exec => {
            if (!exec[1]) return false;
            if (!exec[1].enabled) return true;
            if (exec[1].enabled) return Boolean(exec[1].enabled(RuleSelected));
        })
    );
}

/*Change packages sttings*/
function changeSettingsEvent() {
    Config.getChangeSettingsEvent().on('changeSettings', (path, dif) => {
        if (path == 'packages' && Config.get('here_are_dragons.reloadOnPackagesSteeingChange')) {
            sharedData.app_window_and_systray.refreshListWindow();
        }
    });
}

function addPackage2Settings(packName) {
    if (!packName) return false;

    let userPacks = Config.getUserSettings().packages || [];

    if (userPacks.includes(packName)) {
        Logger.info('[Package]', packName, 'was already installed');
        return false;
    }

    userPacks.push(packName);

    let paramObj = { packages: userPacks };

    if (sharedData.dataManager.setAndSaveSettings('userSettings', paramObj)) {
        return true;
    }

    return false;
}

function removePackage4Settings(packName) {
    if (!packName) return false;

    let userPacks = Config.getUserSettings().packages || [];

    if (!userPacks.includes(packName)) {
        Logger.info('[Package]', packName, 'not installed');
        return false;
    }

    userPacks.splice(userPacks.indexOf(packName), 1);

    let paramObj = { packages: userPacks };

    if (sharedData.dataManager.setAndSaveSettings('userSettings', paramObj)) {
        return true;
    }

    return false;
}

//_________________________________________
//AUX
//_________________________________________
function getPluginByName(name) {
    if (!plugins) {
        return;
    }
    return plugins.find(pluginObj => {
        if (pluginObj.name === name) {
            pluginObj.plugin.error = false;
            return pluginObj.plugin;
        }
    });
}

function getDefaultExecutor(type) {
    if (!executors) {
        return;
    }

    //If executor is defined in settings
    var defaultExecId = Config.get('here_are_dragons.defaultExecForTypes.' + type);
    if (defaultExecId) {
        var executor = getExecutorById(defaultExecId);
        if (executor) {
            return executor;
        }
    }

    //Else, first executor
    return executors.find(executor => executor.type === type);
}

function getDefaultViewer(type) {
    if (!viewers) {
        return;
    }

    return viewers.find(viewer => viewer.type === type);
}

function getViewersByType(types) {
    if (!viewers || !types || !_.isArray(types)) {
        return [];
    }
    var result = [];
    types.map(type => {
        viewers.map(viewer => {
            if (viewer.type === type) {
                result.push(viewer);
            }
        });
    });
    return result;
}

function getExecutorsByType(types) {
    if (!executors || !types || !_.isArray(types)) {
        return [];
    }
    var result = [];
    types.map(type => {
        executors.map(executor => {
            if (executor.type === type) {
                result.push(executor);
            }
        });
    });
    return result;
}

function checkInList(name, arrayIndex) {
    return arrayIndex.some(arr => {
        if (name.indexOf(arr) !== -1 && arr.length) {
            return true;
        }
    });
}

function getPluginsNames() {
    return plugins.map(function(plugin) {
        return plugin.name + ',';
    });
}

sharedData.app_window_and_systray.windowEvent.on('mainWindowReady', initPlugins);

//_________________________________________
//SET PUBLIC
//_________________________________________
module.exports.makePackages = makePackages;
module.exports.executeDefaultAction = executeDefaultAction;
module.exports.getPluginByName = getPluginByName;
module.exports.getPluginsNames = getPluginsNames;
module.exports.getExecutorById = getExecutorById;
module.exports.call_executors = call_executors;
module.exports.getDefaultViewer = getDefaultViewer;
module.exports.getViewersByType = getViewersByType;
module.exports.getViewerById = getViewerById;
module.exports.addPackage = addPackage2Settings;
module.exports.removePackage = removePackage4Settings;
