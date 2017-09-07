'use strict';
const _ = require('lodash');
const path = require('path');
const electron = require('electron');
const app = electron.app;
const fs = require('fs');
const semver = require('semver');
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

let plugins = [];
let viewers = [];
let executors = [];
let pluginsInstalled = [];
let checkValidNewVersions = [];

function makePackages() {
    return new Promise((resolve, reject) => {
        Logger.info('[Package] Manager init');

        sharedData.idleTime.onIdleTimeInterval(() => {
            updateAllPackages(false, true);
        }, Config.get('here_are_dragons.updateAllPackagesInterval'));

        checkDifRemove()
            .then(checkDifPackagesInstall)
            .then(() => {
                //internal_packages
                let internal_packages = Config.get('here_are_dragons.internal_packages') || [];
                internal_packages.map(pack => {
                    registerPlugin(pack, '../js/packages_internal/' + pack);
                });

                //testPackage
                let testPackage = Config.get('here_are_dragons.debug.testPackage');
                if (testPackage) {
                    registerPlugin(testPackage, '../js/packages_internal/' + testPackage);
                }

                //loadPackagesDev
                if (Config.get('here_are_dragons.loadPackagesDev')) {
                    registerFolderPlugins(Config.get('here_are_dragons.paths.packages_dev'), Config.get('ignoreThesePackages'));
                }

                //loadPackages
                if (Config.get('here_are_dragons.loadPackages') && Config.getUserSettings().packages) {
                    registerFolderPlugins(Config.get('here_are_dragons.paths.packages'), Config.get('ignoreThesePackages'));
                }

                if (Config.get('here_are_dragons.packagesTryNewVersionOnNoValid') && checkValidNewVersions.length > 0) {
                    Logger.info('[Package] trying to get new versions');
                    updateAllPackages(false, true, checkValidNewVersions)
                        .then(res => {
                            if (!res || !res.length > 0) {
                                Logger.info('[Package] no new versions');
                                resolve();
                            } else {
                                Logger.info('[Package] get new version ok:', values.map(elem => elem.name).join(', '));
                            }
                        })
                        .catch(resolve);
                } else {
                    resolve();
                }
            })
            .then(() => {
                changeSettingsEvent();
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
        if (!Config.getUserSettings().packages || !Config.get('here_are_dragons.deletePackages')) {
            resolve();
            return;
        }

        Promise.all(getPackagesIsInDisk().map(checkAndRemove))
            .then(resolve)
            .catch(reject);
    });
}

function getPackagesIsInDisk() {
    const PATH = Config.get('here_are_dragons.paths.packages');
    let packagesInstalled = [];

    if (fs.existsSync(PATH)) {
        packagesInstalled = getDirectories(PATH).map(pluginName => {
            if (!checkInList(pluginName, Config.get('ignoreThesePackages'))) {
                return pluginName;
            }
        });
    } else {
        mkpath.sync(PATH);
    }
    return packagesInstalled;
}

function checkAndRemove(packInstalled) {
    return new Promise((resolve, reject) => {
        let userPacks = getSettingsPackages();
        let needDelete = !_.includes(userPacks, packInstalled);
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

        let packList = getSettingsPackages();

        //no user config or no user packages
        if (!packList || !Config.getUserSettings().packages || !Config.get('here_are_dragons.installPackages')) {
            resolve();
            return;
        }

        Promise.all(packList.map(checkAndInstall))
            .then(resolve)
            .catch(reject);
    });
}

function checkAndInstall(pack) {
    return new Promise((resolve, reject) => {
        if (window && window.navigator && window.navigator.onLine && !fs.existsSync(Config.get('here_are_dragons.paths.packages') + pack)) {
            //install packacge if online
            PackagesUtils.installPackage(pack)
                .then(() => {
                    Logger.info('[Package] installed OK:', pack);
                    pluginsInstalled.push(pack);
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

    let packagejson;

    if (validate) {
        try {
            packagejson = require(url + '/package.json');
            let validateObj = PackagesUtils.validatePackage(packagejson);
            if (!validateObj || !validateObj.validate) {
                if (!validateObj) validateObj = {};
                if (!validateObj.error) validateObj.error = null;
                checkValidNewVersions.push(name);
                Logger.error('[Package] No validate, error:', validateObj.error, 'pack', packagejson);
                return;
            }
        } catch (error) {
            onCatchErrorPackage(name, 'no valid package.json / error:', error, '/ path:', url + '/package.json');
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
        let main = _.result(packagejson, 'main');
        if (main) {
            let src = fs.readFileSync(url + '/' + main);
            if (src && main.indexOf('jsx') === -1) {
                let err = check(src, url);
                if (err) {
                    Logger.error('[Package] Syntax error:', name, err);
                    return;
                }
            }
        }
    }

    //TRY LOAD
    let packReq;
    try {
        packReq = require(url);
    } catch (error) {
        onCatchErrorPackage(name, error);
        return;
    }

    //SET PACK
    const PACK = setPackager(name, packReq, url);

    if (!PACK) {
        return;
    }

    //ADD
    plugins.push({
        name: PACK.name,
        plugin: PACK
    });
}

function initPlugins() {
    plugins.map(obj => {
        let pack = obj.plugin;

        if (pluginsInstalled.includes(pack.name) && pack.afterInstall) {
            try {
                pack.afterInstall();
            } catch (error) {
                onCatchErrorPackage(pack.name, error);
            }
        }

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
        let $executor = {};
        $executor.title = executor.title;
        $executor.type = executor.type;
        $executor.description = executor.description;
        $executor.exectFunc = executor.exectFunc;
        $executor.enabled = executor.enabled;
        $executor.namePlugin = name;
        $executor.icon = icon.get(executor.icon);

        $executor.id =
            executor.id ||
            String(executor.namePlugin + '_' + executor.title + '_' + executor.type)
                .toLowerCase()
                .replace(' ', '');

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
    if (!Config.get('here_are_dragons.rulesViewer')) return;
    if (!pack || !name || !pack.length) {
        Logger.error('[Package] Error in registerViewerPack:', pack, name);
        return;
    }
    pack.map(packObj => {
        registerViewers(packObj, name);
    });
}

function registerViewers(viewer, name) {
    if (!Config.get('here_are_dragons.rulesViewer')) return;
    try {
        let $viewer = {};
        $viewer.title = viewer.title;
        $viewer.type = viewer.type;
        $viewer.useBlend = viewer.useBlend || false;
        // $viewer.viewerComp = InfCreateClass(viewer.viewerComp)
        $viewer.enabled = viewer.enabled;
        $viewer.viewerComp = viewer.viewerComp;
        $viewer.namePlugin = name;

        $viewer.id =
            viewer.id ||
            String(name + '_' + viewer.name)
                .toLowerCase()
                .replace(' ', '');

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
    let deleteSearchOnFire = true;

    let type = _.result(getExecutors(actionObj.rule), '[0][1].type');

    if (!type) {
        return;
    }

    let defaultExecutorForType = getDefaultExecutor(type);

    if (!defaultExecutorForType || !defaultExecutorForType.exectFunc) {
        Logger.warn('[Package] No executor', actionObj);
        return;
    }

    if (Config.get('here_are_dragons.debug.no_executorAction')) {
        Logger.warn('[Package] No executor: here_are_dragons.debug.no_executorAction');
        return;
    }

    try {
        deleteSearchOnFire = defaultExecutorForType.exectFunc(actionObj);
    } catch (e) {
        Logger.error('[Package] Error in package:', defaultExecutorForType, actionObj, type, e);
    }

    return deleteSearchOnFire;
}

function getExecutors(rule) {
    if (!rule) {
        return [];
    }

    let types = _.result(rule, 'type');
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
    return new Promise((resolve, reject) => {
        if (!packName) {
            reject();
            return;
        }

        let userPacks = Config.getUserSettings().packages || [];

        if (userPacks.includes(packName)) {
            Logger.info('[Package]', packName, 'was already added');
            reject();
            return;
        }

        PackagesUtils.validateRemotePackage(packName)
            .then(() => {
                userPacks.push(packName);

                let paramObj = { packages: userPacks };

                if (sharedData.dataManager.setAndSaveSettings('userSettings', paramObj)) {
                    resolve();
                } else {
                    reject();
                }
            })
            .catch(reject);
    });
}

function removePackage4Settings(packName) {
    if (!packName) return false;

    let userPacks = Config.getUserSettings().packages || [];

    if (!userPacks.includes(packName)) {
        Logger.info('[Package]', packName, 'not in config');
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
    let defaultExecId = Config.get('here_are_dragons.defaultExecForTypes.' + type);
    if (defaultExecId) {
        let executor = getExecutorById(defaultExecId);
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
    let result = [];
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
    let result = [];
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

function isInstalledInDisk(name) {
    return getPackagesIsInDisk().find(pluginObj => {
        return pluginObj === name;
    });
}

function isInUserSettingPackages(name) {
    return getSettingsPackages().find(pluginObj => {
        return pluginObj === name;
    });
}

function getSettingsPackages() {
    let packList = Config.get('packages');
    if (!_.isArray(packList)) {
        packList = [];
    }
    return packList;
}

function isInstalledOk(name) {
    return !!getPluginByName(name);
}

function getPackcageSettingsFile(pack, onlyName = false) {
    let packcageSettingsFile = path.normalize(
        Config.get('here_are_dragons.paths.user') + pack + Config.get('here_are_dragons.paths.user_packagesSettingsName')
    );
    if (onlyName) {
        return packcageSettingsFile;
    }
    if (fs.existsSync(packcageSettingsFile)) {
        return packcageSettingsFile;
    }
    return null;
}

sharedData.app_window_and_systray.windowEvent.on('mainWindowReady', initPlugins);

function updatePackage(name, notify = true, refresh = true) {
    return PackagesUtils.updatePackage(name)
        .then(obj => {
            if (obj.updated) {
                if (notify) sharedData.toaster.notify('Package updated OK: ' + name);
                if (refresh) sharedData.app_window_and_systray.refreshListWindow();
            } else {
                if (notify) sharedData.toaster.notify(name + ' is already updated');
            }
        })
        .catch(err => {
            if (err.includes('already')) {
                if (notify) sharedData.toaster.notify(name + ' is already updated');
            }
        });
}

function updateAllPackages(notify = true, refresh = true, pack = null) {
    let packagesToUpdate = pack || getPackagesIsInDisk();

    packagesToUpdate = packagesToUpdate.filter(pack => !Config.get('ignoreThesePackages').includes(pack));

    return new Promise((resolve, reject) => {
        Logger.info('[UPDATE ALL PACKAGES]');
        Promise.all(packagesToUpdate.map(PackagesUtils.updatePackage).map(p => p.catch(() => null)))
            .then($values => {
                let values = $values.filter(elem => elem && elem.updated);
                if (values.length > 0) {
                    try {
                        if (notify) sharedData.toaster.notify('Packages updated OK: ' + values.map(elem => elem.name).join(', '));
                    } catch (e) {}
                    setTimeout(() => {
                        if (refresh) sharedData.app_window_and_systray.refreshListWindow();
                    }, 10);
                } else {
                    if (notify) sharedData.toaster.notify('No packages to update');
                }
                resolve(values);
            })
            .catch(values => {
                Logger.warn(values);
                reject();
            });
    });
}

window.updatePackage = updatePackage;

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
module.exports.updatePackage = updatePackage;
module.exports.updateAllPackages = updateAllPackages;
module.exports.removePackage = removePackage4Settings;
module.exports.isInstalledInDisk = isInstalledInDisk;
module.exports.isInUserSettingPackages = isInUserSettingPackages;
module.exports.isInstalledOk = isInstalledOk;
module.exports.getSettingsPackages = getSettingsPackages;
module.exports.getPackcageSettingsFile = getPackcageSettingsFile;
module.exports.requierePackageJson = PackagesUtils.requierePackageJson;
module.exports.validateRemotePackage = PackagesUtils.validateRemotePackage;
module.exports.validatePackage = PackagesUtils.validatePackage;
