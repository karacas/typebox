'use strict';
const { intersection, includes } = require('lodash');
const path = require('path');
const { existsSync, readFileSync } = require('fs');
const semver = require('semver');
const mkpath = require('@aux/aux_fs.js').mkpath;
const uniq = arr => [...new Set(arr)];
const isRunningInAsar = require('electron-util').is.usingAsar;
const { aux_getDirName, normalicePath, get, getDirectories, cloneDeep } = require('@aux/aux_global.js');
const PackagesUtils = require('@render/packages_utils.js');
const ruleManager = require('@render/rule_manager.js');
const Executor = require('@render/executor.js');
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const setPackager = require('@api/api_v1.js');
const sharedData = require('@render/shared_data.js');
const themeManager = require('@render/theme_manager.js');
const _aux_tests = require('@uitests/_aux_tests.js');
const EventEmitter = require('eventemitter3');
const icon = require('@render/icon.js');
const aux_packOnlyName = PackagesUtils.aux_packOnlyName;
const popWin = sharedData.app_window_and_systray.popWin;

let plugins = [];
let viewers = [];
let executors = [];
let pluginsInstalled = [];
let checkValidNewVersions = [];

let mouseTrapEventView = null;
let noAvaiableKeys = ['tab', 'down', 'down', 'up', 'page down', 'pageup', 'end', 'home', 'capslock', 'esc', 'space', 'enter', 'return', 'escape'];
let _bindKeys = Config.get('here_are_dragons.bindKeys') || [];

_bindKeys.forEach(entry => {
   noAvaiableKeys = noAvaiableKeys.concat(entry.keys);
});

noAvaiableKeys = noAvaiableKeys.map(normaliceMouseTrapKeys);
noAvaiableKeys = uniq(noAvaiableKeys);

let mouseTrapEventViewQueue = [];

const packagesEvents = new EventEmitter();

function normaliceMouseTrapKeys(key) {
   let _mod = Config.isMac ? 'command' : 'ctrl';
   return String(key)
      .replace(/\s/g, '')
      .toLowerCase()
      .replace(/option/g, 'alt')
      .replace(/meta/g, 'command')
      .replace(/mod/g, _mod)
      .replace(/escape/g, 'esc')
      .replace(/return/g, 'enter');
}

function makePackages() {
   return new Promise((resolve, reject) => {
      Logger.info('[Package] Manager init');

      sharedData.idleTime.onIdleTimeInterval(() => {
         if (Config.get('autoupdateAllPackages')) {
            Logger.info('[Package] autoupdateAllPackages');
            updateAllPackages(false, true);
         } else {
            Logger.info('[Package] autoupdateAllPackages is off');
         }
      }, Config.get('here_are_dragons.updateAllPackagesInterval'));

      checkDifRemove()
         .then(checkDifPackagesInstall)
         .then(() => {
            //internal_packages
            let internal_packages = Config.get('here_are_dragons.internal_packages') || [];
            internal_packages.map(pack => {
               registerPlugin(pack, `@packages_internal/${pack}`, false, true);
            });

            //testPackage
            let testPackage = Config.get('here_are_dragons.debug.testPackage');
            if (testPackage) {
               registerPlugin(testPackage, `@packages_internal/${testPackage}`, false, true);
            }

            //loadPackagesDev
            if (Config.get('here_are_dragons.loadPackagesDev')) {
               registerFolderPlugins(Config.get('here_are_dragons.paths.packages_dev'), Config.get('ignoreThesePackages'), false);
            }

            //loadPackages
            if (Config.get('here_are_dragons.loadPackages') && Config.getUserSettings().packages) {
               registerFolderPlugins(Config.get('here_are_dragons.paths.packages'), Config.get('ignoreThesePackages'), false);
            }

            initPlugins(true);

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
         .catch(e => {
            Logger.warn(e);
            initPlugins(true);
            changeSettingsEvent();
            resolve();
            return;
         })
         .then(() => {
            changeSettingsEvent();
            resolve();
         });
   });
}

function checkDifRemove(path) {
   return new Promise((resolve, reject) => {
      Logger.info('[Package] Manager, check user packages to remove');

      if (!Config.get('here_are_dragons.deletePackages')) {
         Logger.warn('deletePackages is disabled');
         resolve();
         return;
      }

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

   Logger.log('[getPackagesIsInDisk]', PATH);

   let packagesInstalled = [];

   if (existsSync(PATH)) {
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
   packInstalled = aux_packOnlyName(packInstalled);
   return new Promise((resolve, reject) => {
      let userPacks = getSettingsPackages();
      let needDelete = !includes(
         userPacks.map(pack => aux_packOnlyName(pack)),
         packInstalled
      );
      if (needDelete) {
         popWin();

         PackagesUtils.removePackage(packInstalled)
            .then(() => {
               Logger.info('[Package] removed OK:', packInstalled);
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

      if (!Config.get('here_are_dragons.installPackages')) {
         Logger.warn('installPackages is disabled');
         resolve();
         return;
      }

      let packList = getSettingsPackages();

      //no user config or no user packages
      if (!packList || !Config.getUserSettings().packages) {
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
      if (!Config.get('here_are_dragons.installPackages')) {
         Logger.warn('installPackages is disabled');
         resolve();
         return;
      }

      if (window && window.navigator && window.navigator.onLine && !existsSync(Config.get('here_are_dragons.paths.packages') + aux_packOnlyName(pack))) {
         popWin();

         //KTODO: install packacge if online
         PackagesUtils.installPackage(pack)
            .then(() => {
               Logger.info('[Package] installed OK:', pack);
               pluginsInstalled.push(pack);
               sharedData.toaster.notify(`Package installed OK: ${pack}`);
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

function registerPlugin(name, url, validate = false, $internal = false) {
   if (!name) {
      return;
   }

   if (name.includes('dummyPackage')) {
      return;
   }

   name = aux_packOnlyName(name);

   if (checkInList(name, Config.get('ignoreThesePackages'))) {
      Logger.info('[Package] Ignore this Package (by folder):', name, 'url:', url);
      return;
   }

   //CHECK
   if (getPluginByName(name)) {
      onCatchErrorPackage(name, `package ${name} is already defined`);
      return;
   }

   let packagejson;

   if (validate && url) {
      try {
         packagejson = require(path.normalize(`${url}/package.json`));
      } catch (error) {
         //KTODO: optional delete?
         if (Config.isDev) console.error(error);
         onCatchErrorPackage(name, 'no valid package.json | error: \n', error, `\n path: ${url}/package.json`);
         return;
      }

      if (!packagejson) return;

      if (packagejson.disabled == true || packagejson.enabled === false) {
         Logger.info('[Package] Ignore this Package (by disabled):', packagejson.name);
         return;
      }

      if (checkInList(packagejson.name, Config.get('ignoreThesePackages'))) {
         Logger.info('[Package] Ignore this Package (by Name):', packagejson.name);
         return;
      }

      let validateObj = PackagesUtils.validatePackage(packagejson);
      if (!validateObj || !validateObj.validate) {
         if (!validateObj) validateObj = {};
         if (!validateObj.error) validateObj.error = null;
         checkValidNewVersions.push(name);
         if (validateObj.onlyWarn) {
            Logger.warn('[Package] No validate:\n', validateObj.error, '\npack', packagejson);
            return;
         }
         Logger.error('[Package] No validate:\n', validateObj.error, '\npack', packagejson);
         return;
      }
   }

   //If theme
   if (packagejson && packagejson.theme) {
      themeManager.add(name, url, packagejson);
      return;
   }

   if (validate) {
      if (false) Logger.log('[Package] try load external pak:', name);
   } else {
      if (false) Logger.log('[Package] try load internal pak wout validate:', name);
   }

   //CheckSintax
   //KTODO: only in packages dev
   if (packagejson && Config.get('here_are_dragons.checkPackagesSyntax')) {
      let main = get(packagejson, 'main');
      if (main) {
         let src = readFileSync(`${url}/${main}`);
         if (src && main.indexOf('jsx') === -1) {
            let err = require('syntax-error')(src, url);
            if (err) {
               Logger.error('[Package] Syntax error:', name, err);
               return;
            }
         }
      }
   }

   //TRY LOAD
   let packReq;
   if ($internal) {
      packReq = require(url);
   } else {
      try {
         packReq = require(url);
      } catch (error) {
         Logger.error('[Package] require error:', name, error);
         return;
      }
   }

   //SET PACK

   const tmpDate = new Date();

   let PACK;
   if ($internal) {
      PACK = setPackager(name, packReq, url);
   } else {
      try {
         PACK = setPackager(name, packReq, url);
      } catch (error) {
         Logger.error('[Package] setPackager error:', name, error);
         return;
      }
   }

   if (!PACK) return;
   if (!isRunningInAsar) Logger.info('[registerPlugin ok]', name, 'ms:', new Date() - tmpDate);

   PACK.internal = $internal;
   PACK.packagejson = packagejson || {};
   PACK.version = get(packagejson || {}, 'version') || Config.get('here_are_dragons.report.version');

   // TESTS
   if (!$internal && packagejson) {
      let testFile = get(packagejson, 'typebox-tests');
      if (testFile) {
         _aux_tests.addPackageFileTest(normalicePath(`${url}/${testFile}`));
      }
   }

   //ADD
   plugins.push({
      name: PACK.name,
      plugin: PACK,
      internal: $internal,
   });
}

function initPlugins($internal = true) {
   Logger.logTime(`[Init Packages], internal: ${String(!!$internal)}`);
   plugins
      .filter(obj => obj.internal === $internal)
      .map(obj => {
         let pack = obj.plugin;

         if (pack.disabled === true) {
            setTimeout(() => {
               Logger.info('[Package] is disabled:', pack.name, pack.version, 'internal:', !!pack.internal);
            }, 0);
            return null;
         }

         if (pack.disabled !== null && typeof pack.disabled === 'function') {
            let _disabled = false;
            try {
               _disabled = pack.disabled();
            } catch (error) {
               onCatchErrorPackage(pack.name, error);
               return null;
            }
            if (_disabled) {
               setTimeout(() => {
                  Logger.info('[Package] is disabled() :', pack.name, pack.version, 'internal:', !!pack.internal);
               }, 0);
               return null;
            }
         }

         if (pluginsInstalled.includes(pack.name) && pack.afterInstall) {
            try {
               pack.afterInstall();
            } catch (error) {
               onCatchErrorPackage(pack.name, error);
            }
         }

         if (pack.init && !pack.initiated) {
            if ($internal) {
               pack.init();
               pack.initiated = true;
               setTimeout(() => {
                  Logger.info('[Package] loaded OK:', pack.name, pack.version, 'internal:', !!pack.internal);
               }, 0);
            } else {
               try {
                  pack.init();
               } catch (error) {
                  onCatchErrorPackage(pack.name, error);
                  return null;
               }
               pack.initiated = true;
               setTimeout(() => {
                  Logger.info('[Package] loaded OK:', pack.name, pack.version, 'internal:', !!pack.internal);
               }, 0);
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

   setTimeout(ruleManager.forceRefreshRules, 1);
}

function onCatchErrorPackage(...args) {
   Logger.error('[Package Error]', ...args);
}

function registerFolderPlugins(packagesFolder, ignoreThesePackages, $internal = false) {
   if (existsSync(packagesFolder)) {
      getDirectories(packagesFolder).map($pluginName => {
         let pluginName = aux_packOnlyName($pluginName);
         if (checkInList(pluginName, ignoreThesePackages)) {
            Logger.info('[Package] Ignore this package  (by Name):', pluginName);
         } else {
            registerPlugin(pluginName, packagesFolder + pluginName, true, $internal);
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
   if (!executor || !name) return;

   let $executor = {};

   $executor.title = executor.title;
   $executor.type = executor.type;
   $executor.description = executor.description;
   $executor.exectFunc = executor.exectFunc;
   $executor.enabled =
      executor.enabled ||
      function() {
         return true;
      };
   $executor.namePlugin = name;
   $executor.icon = icon.get(executor.icon);

   $executor.id =
      executor.id ||
      String(`${executor.namePlugin}_${executor.title}_${executor.type}`)
         .toLowerCase()
         .replace(' ', '');

   if ($executor.title && $executor.type && $executor.exectFunc) {
      executors.push($executor);
   } else {
      Logger.error('[Package] Error in registerExecutors:', executor, name);
   }
}

function registerViewersPack(pack, name) {
   if (!Config.get('here_are_dragons.rulesViewer')) return;
   if (!pack || !name) {
      Logger.error('[Package] Error in registerViewerPack:', pack, name);
      return;
   }
   if (!pack.length) {
      return;
   }
   pack.map(packObj => {
      registerViewers(packObj, name);
   });
}

function registerViewers(viewer, name) {
   if (!Config.get('here_are_dragons.rulesViewer')) return;

   if (!viewer) return;

   let $viewer = {};
   $viewer.title = viewer.title;
   $viewer.type = viewer.type;
   $viewer.useBlend = viewer.useBlend || false;
   $viewer.enabled =
      viewer.enabled ||
      function() {
         return true;
      };
   $viewer.viewerComp = viewer.viewerComp;
   $viewer.namePlugin = name;

   $viewer.id =
      viewer.id ||
      String(`${name}_${viewer.name}`)
         .toLowerCase()
         .replace(' ', '');

   if ($viewer.title && $viewer.type && $viewer.viewerComp) {
      viewers.push($viewer);
   } else {
      Logger.error('[Package] Error in registerviewers:', viewer, name);
   }
}

function executeDefaultAction(actionObj) {
   let deleteSearchOnFire = true;

   let type = get(getExecutors(actionObj.rule), '[0][1].type');

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
      deleteSearchOnFire = defaultExecutorForType.exectFunc(actionObj, actionObj.rule || null, actionObj.event || null);
   } catch (e) {
      Logger.error('[Package] Error in package:', defaultExecutorForType, actionObj, type, e);
   }

   Logger.log(
      '[defaultExecutorForType:]',
      '/',
      get(defaultExecutorForType, 'title'),
      '/',
      get(defaultExecutorForType, 'type'),
      '',
      get(defaultExecutorForType, 'description')
   );

   return deleteSearchOnFire;
}

function getExecutors(rule) {
   if (!rule) {
      return [];
   }

   let types = get(rule, 'type');
   if (!types) {
      return [];
   }

   return getExecutorsByType(types).map((executor, i) => {
      executor.id = executor.id || `executor_${i}`;
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
   return require('immutable').Map(
      getExecutors(RuleSelected).filter(exec => {
         if (!exec || !exec[1]) return false;
         if (!exec[1].enabled) return true;
         if (exec[1].enabled) {
            try {
               return Boolean(exec[1].enabled(RuleSelected));
            } catch (e) {
               Logger.error('[Package error executor enabled] ', e, exec[1], RuleSelected);
               return false;
            }
         }
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

            if (sharedData.setAndSaveSettings('userSettings', paramObj)) {
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

   Logger.info('[Package]', packName, 'try remove');

   let userPacks = Config.getUserSettings().packages || [];

   if (!userPacks.includes(packName)) {
      Logger.info('[Package]', packName, 'not in config');
      return false;
   }

   userPacks.splice(userPacks.indexOf(packName), 1);

   let paramObj = { packages: userPacks };

   if (sharedData.setAndSaveSettings('userSettings', paramObj)) {
      Logger.info('[Package]', packName, 'removed');
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
   let defaultExecId = Config.get(`here_are_dragons.defaultExecForTypes.${type}`);
   if (defaultExecId) {
      let executor = getExecutorById(defaultExecId);
      if (executor) {
         return executor;
      }
   }

   //Else, first executor
   let res = executors.find(executor => executor.type === type);

   return res;
}

function getDefaultViewer(type) {
   if (!viewers) {
      return;
   }

   return viewers.find(viewer => viewer.type === type);
}

function getViewersByType(types) {
   if (!viewers || !types || !Array.isArray(types)) {
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
   if (!executors || !types || !Array.isArray(types)) {
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
      let $name = name
         .toLowerCase()
         .replace(/_/g, '')
         .replace(/-/g, '')
         .replace(/\s/g, '');
      let $arr = arr
         .toLowerCase()
         .replace(/_/g, '')
         .replace(/-/g, '')
         .replace(/\s/g, '');
      if ($name.indexOf($arr) !== -1 && arr.length) {
         return true;
      }
   });
}

function getPluginsNames() {
   return plugins.map(function(plugin) {
      return `${plugin.name},`;
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
   if (!Array.isArray(packList)) {
      packList = [];
   }
   return packList;
}

function isInstalledOk(name) {
   return !!getPluginByName(name);
}

function getPackcageSettingsFile(pack, onlyName = false) {
   let packcageSettingsFile = path.normalize(Config.get('here_are_dragons.paths.user') + pack + Config.get('here_are_dragons.paths.user_packagesSettingsName'));
   if (onlyName) {
      return packcageSettingsFile;
   }
   if (existsSync(packcageSettingsFile)) {
      return packcageSettingsFile;
   }
   return null;
}

function makePackagesExternal() {
   initPlugins(false);
}

function updatePackage(name, notify = true, refresh = true) {
   return PackagesUtils.updatePackage(name)
      .then(obj => {
         if (obj.updated) {
            if (notify) sharedData.toaster.notify(`Package updated OK: ${name}`);
            if (refresh) sharedData.app_window_and_systray.refreshListWindow();
         } else {
            if (notify) sharedData.toaster.notify(`${name} is already updated`);
         }
      })
      .catch(err => {
         if (err.includes('already')) {
            if (notify) sharedData.toaster.notify(`${name} is already updated`);
         }
      });
}

function updateAllPackages(notify = true, refresh = true, $pack = null) {
   let packagesToUpdate = $pack || cloneDeep(getPackagesIsInDisk());

   packagesToUpdate = packagesToUpdate.filter(pack => !Config.get('ignoreThesePackages').includes(pack));

   Logger.log('[updateAllPackages]', cloneDeep(packagesToUpdate), cloneDeep($pack), cloneDeep(getPackagesIsInDisk()));

   return new Promise((resolve, reject) => {
      Logger.info('\n[UPDATE ALL PACKAGES]\n');

      if (!Config.get('here_are_dragons.updatePackages')) {
         Logger.warn('updatePackages is disabled');
         resolve([]);
         return;
      }

      Promise.all(packagesToUpdate.map(PackagesUtils.updatePackage).map(p => p.catch(() => null)))
         .then($values => {
            let values = $values.filter(elem => elem && elem.updated);
            if (values.length > 0) {
               if (notify) {
                  try {
                     sharedData.toaster.notify(`Packages updated OK: ${values.map(elem => elem.name).join(', ')}`);
                  } catch (e) {}
               }
               setTimeout(() => {
                  if (refresh) sharedData.app_window_and_systray.refreshListWindow();
               }, 10);
            } else {
               if (notify) sharedData.toaster.notify('No packages to update');
            }
            setTimeout(() => {
               resolve(values);
            });
         })
         .catch(values => {
            Logger.warn(values);
            setTimeout(() => {
               resolve([]);
            });
         });
   });
}

const getMousTrap = (...args) => {
   if (!args || !args[0] || !args[1]) {
      Logger.warn('invalid args');
      return;
   }

   let check = args[2] !== 'permit';

   let keys = args[0];

   if (typeof keys === 'string' || keys instanceof String) {
      keys = [keys];
   }

   if (!Array.isArray(keys)) {
      Logger.warn(keys, 'is not a valid shortcut (use string or array)');
      return;
   }

   keys.map(key => {
      if (!key.length) {
         Logger.warn(key, 'is not a valid shortcut, empty shortcut');
         return;
      }
      if (key.length === 1 && check) {
         let pattern = new RegExp('^[A-Za-z0-9 _]*[A-Za-z0-9][A-Za-z0-9 _]*$');
         if (pattern.test(key)) {
            Logger.warn(key, 'is not a valid shortcut, a single character is not allowed');
            return;
         }
      }
   });

   let interSec = intersection(keys.map(normaliceMouseTrapKeys), noAvaiableKeys.map(normaliceMouseTrapKeys));

   if (interSec.length && check) {
      Logger.warn(`${interSec.join(' /')} shortcut is already defined`);
      return;
   }

   noAvaiableKeys = noAvaiableKeys.concat(keys);

   if (mouseTrapEventView === null) {
      mouseTrapEventViewQueue.push(args);
      return;
   }
   return mouseTrapEventView(...args);
};

const getMousTrapInt = (...args) => {
   return getMousTrap(...args, 'permit');
};

const setMousTrap = mt => {
   if (!mt) {
      Logger.warn('invalid mouseTrap');
      return;
   }
   mouseTrapEventView = mt;
   mouseTrapEventViewQueue.forEach(obj => {
      if (Config.isDev || Config.get('here_are_dragons.logBindKeys')) {
         Logger.log('bindKeys', obj[0]);
      }
      return mouseTrapEventView(obj[0], obj[1]);
   });
   mouseTrapEventViewQueue = [];
};

const viewIsReady = () => {
   packagesEvents.emit('VIEW_IS_READY');
};

//_________________________________________
//SET PUBLIC
//_________________________________________
module.exports.makePackages = makePackages;
module.exports.makePackagesExternal = makePackagesExternal;
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
module.exports.setMousTrap = setMousTrap;
module.exports.getMousTrapInt = getMousTrapInt;
module.exports.getMousTrap = getMousTrap;
module.exports.viewIsReady = viewIsReady;
module.exports.packagesEvents = packagesEvents;
module.exports.getExecutors = getExecutors;
module.exports.normaliceMouseTrapKeys = normaliceMouseTrapKeys;
