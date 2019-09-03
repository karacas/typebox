'use strict';

const path = require('path');
const JSON5 = require('json5');

const { saveGenericJson, loadGenericJson, getFile, setFile, _isValidAndSecurePath } = require('@aux/aux_fs.js');
const { replaceJSX } = require('@aux/aux_babel.js');
const global_aux = require('@aux/aux_global.js');
const { requireCompo } = require('@components/get_compo.js');
const ruleManager = require('@render/rule_manager.js');
const { makeHash, getStringOfRule } = require('@render/rule.js');
const Executor = require('@render/executor.js');
const ListViewStore = require('@render/list_view_store.js');
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const sharedData = require('@render/shared_data.js');
const driveManager = require('@render/aux_drive_manager.js');
const rulesMaker = require('@render/rules_maker.js');
const favManager = require('@render/fav_manager.js');
const lastRulesManager = require('@render/last_rules_manager.js');
const aux_webManager = require('@render/aux_web_manager.js');
const aux_viewer = require('@render/aux_viewer.js');
const aux_viewer_test = require('@render/aux_viewer_test.js');
const packagesManager = require('@render/packages_manager.js');
const highlight = require('@render/aux_highlight.js');
const _aux_packages_utils = require('@render/aux_packages_utils.js');
const { gotoRootOnExec, unpopWin, backRootAndHide, backRoot } = require('@render/aux_executor.js');

const commandCheckerRegExOld = /^\s?(.*?)\s?\((.*?)\)\s?\!$/g;
const commandCheckerRegEx = /^\s?(.*?)\s?\:\s?(.*?)\s?\!$/g;

// const htm = require('htm');
// const React = require('react');
// const html = htm.bind(React.createElement);

module.exports = (name, pack) => {
   const $context = {
      writeString: Executor.auxPlaceString,
      copyToClipboard: Executor.auxCopyToClipboard,
      placeExecutors: Executor.auxCallExecutors,
      isDev: !!Config.isDev,
      isWin: !!Config.isWin,
      isMac: !!Config.isMac,
      isLinux: !!Config.isLinux,
      replaceJSX: replaceJSX,
      logger: Logger,
      cloneDeep: global_aux.cloneDeep,
      timeOut: global_aux.$timeout,
      getStringOfRule: getStringOfRule,
      getDir: _aux_packages_utils.aux_getDirName,
      config: Config,
      aux_webManager: aux_webManager,
      makeHash: makeHash,
      requireCompo: requireCompo,
      createViewerHtml: aux_viewer.createViewerHtml,
      createViewerWebView: aux_viewer.createViewerWebView,
      createComponentFromHtml: aux_viewer.createComponentFromHtml,
      createComponentFromMarkDown: aux_viewer.createComponentFromMarkDown,
      createComponentFromMarkDownElement: aux_viewer.createComponentFromMarkDownElement,
      sanitizeHTMLReact: aux_viewer.sanitizeHTMLReact,
      sanitizeSVGReact: aux_viewer.sanitizeSVGReact,
      sanitizeHTML: aux_viewer.sanitizeHTML,
      aux_viewer: aux_viewer,
      aux_viewer_test: aux_viewer_test,
      gotoRootOnExec: gotoRootOnExec,
      onIdleTimeInterval: sharedData.idleTime.onIdleTimeInterval,
      highlight: highlight,
      packsUtils: _aux_packages_utils,
      getKeyFromConfig: global_aux.getKeyFromConfig,
      getAllKeysFromConfig: global_aux.getAllKeysFromConfig,
      normaliceMouseTrapKeys: packagesManager.normaliceMouseTrapKeys,
      normaliceBindKeys: packagesManager.normaliceMouseTrapKeys,
      normalicePath: global_aux.normalicePath,
      getExecutorById: packagesManager.getExecutorById /*KTODO: VER SEGURIDAD*/,
      global_aux: global_aux,
      viewEvents: sharedData.viewEvents,
      listenKeyboardStop: sharedData.keyStop,
      listenKeyboardStart: sharedData.keyRestart,
      listenKeyboarIsActive: sharedData.keyIsActive,
      _isValidAndSecurePath: _isValidAndSecurePath,
      clean_array: ruleManager.clean_array,
      status: sharedData.status,
      add2fav: favManager.push,
      toggle: favManager.toggle,
      forceRefreshRules: ruleManager.forceRefreshRules,
      reloadApp: sharedData.app_window_and_systray.refreshListWindow,
      printSettings: sharedData.app_window_and_systray.printSettings,
      openDevTools: sharedData.app_window_and_systray.openDevTools,
      closeDevTools: sharedData.app_window_and_systray.closeDevTools,
      clearDevTools: sharedData.app_window_and_systray.clearDevTools,
      quit: sharedData.app_window_and_systray.quit,
      relaunch: sharedData.app_window_and_systray.relaunch,
      hide: sharedData.app_window_and_systray.unpopWin,
      backRootAndHide: backRootAndHide,
      backRoot: backRoot,
      show: sharedData.app_window_and_systray.popWinHard,
      getRealClock: sharedData.realClock,
      getRealTime: sharedData.realClock.getTime,
      getTime: sharedData.realClock.getTime,
      addTapeTest: sharedData.testUImanager.addTest,
      addTapeTests: sharedData.testUImanager.addTests,
      resetTapeTests: sharedData.testUImanager.resetTests,
      allSetting: Config.getAll(),
      keyboard_bind: name.startsWith('internal_') ? packagesManager.getMousTrapInt : packagesManager.getMousTrap,
      openFile: name.startsWith('internal_') ? driveManager.openFile : global_aux.NULL_FUNCT,
      get: global_aux.get,
      setFile: setFile,
      require: mod => {
         return require(mod);
      },
      getFile: (...args) => {
         let data = null;

         try {
            data = global_aux.cloneDeep(getFile(...args));
         } catch (e) {
            Logger.warn('[package] getFile:', ...args, e);
            return null;
         }

         return data;
      },
      packageEnabledByName: packId => !!packagesManager.getPluginByName(packId),
      devModeOn: () => sharedData.app_window_and_systray.setDevMode(true),
      getDriveManager: () => driveManager,
      getSetting: setting => Config.get(setting),
      getQuery: () => ListViewStore.store.getState().search_text,
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
      getPath: () => ListViewStore.store.getState().rulesPath,
      setPath: (changePathObj, noAnims = false) => {
         sharedData.app_window_and_systray.windowEvent.emit('GO_TO_PATH', changePathObj, noAnims);
      },
      pushRulesFromFileExternal: file => {
         return rulesMaker.pushRulesFromFileExternal(name, file);
      },
      addRules: rules => {
         if (!rules) return;
         if (typeof rules === 'object' && rules.title) rules = [rules];
         if (!Array.isArray(rules) || !rules.length) {
            Logger.warn('[addRules] is not array or empty', rules);
            return;
         }
         return ruleManager.setVirtualRules(rules, name, false);
      },
      setRules: rules => {
         if (!rules) return;
         if (typeof rules === 'object' && rules.title) rules = [rules];
         if (!Array.isArray(rules)) {
            Logger.warn('[addRules] is not array', rules);
            return;
         }
         return ruleManager.setVirtualRules(rules, name, true);
      },
      deleteRules: () => {
         return ruleManager.deleteVirtualRules(name);
      },
      addPermanentRules: rules => {
         if (!rules) return;
         if (typeof rules === 'object' && rules.title) rules = [rules];
         return ruleManager.pushRulePack(rules, null, String(name || 'noNamePlugin'));
      },
      _addLoader: (path, nameLoader) => {
         return ruleManager.addLoader(path, name, false, nameLoader);
      },
      putLoader: (path, nameLoader) => {
         return ruleManager.addLoader(path, name, true, nameLoader);
      },
      _addInfo: (path, nameLoader, ruleExtend) => {
         return ruleManager.addInfo(path, name, false, nameLoader, ruleExtend);
      },
      putInfo: (path, nameLoader, ruleExtend) => {
         return ruleManager.addInfo(path, name, true, nameLoader, ruleExtend);
      },
      updateRule: newRule => {
         return ruleManager.updateVirtualRule(null, newRule, String(name || 'noNamePlugin'));
      },
      updateRuleById: (id, newRule) => {
         return ruleManager.updateVirtualRule(id, newRule, String(name || 'noNamePlugin'));
      },
      removeLoader: path => {
         return ruleManager.removeLoader(path, name);
      },
      removeInfo: path => {
         return ruleManager.removeInfo(path, name);
      },
      getLastRuleSelected: () => {
         let $lastRuleSelected = global_aux.cloneDeep(ListViewStore.store.getState().lastRuleSelected);
         return $lastRuleSelected || null;
      },
      getlastItemsPath: lastRulesManager.getlastItemsPath,
      on: (textEvent, callback, test) => {
         if (!callback || !global_aux.isFunction(callback)) {
            return;
         }
         if (textEvent === 'ON_CTRL_C') {
            sharedData.viewEvents.on('ON_CTRL_C', e => {
               callback(e);
            });
         }
         if (textEvent === 'changeQuery') {
            ListViewStore.storeEvents.on('CHANGE_SEARCH_TEXT', obj => {
               callback(obj);
            });
         }
         if (textEvent === 'viewIsReady') {
            packagesManager.packagesEvents.on('VIEW_IS_READY', () => {
               callback();
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

               Logger.info('[!Command] : ', command, args);
               callback({ command, args });
            });
         }
         if (textEvent === 'avoidCache') {
            ListViewStore.storeEvents.on('AVOID_CACHE', obj => {
               callback(obj);
            });
         }
         if (textEvent === 'changePath') {
            ListViewStore.storeEvents.on('CHANGE_PATH', obj => {
               callback(obj.path, obj);
            });
         }

         if (textEvent === 'changePathOrQuery') {
            ListViewStore.storeEvents.on('CHANGE_PATH', obj => {
               callback();
            });
            ListViewStore.storeEvents.on('CHANGE_SEARCH_TEXT', obj => {
               callback();
            });
         }
         if (textEvent === 'show') {
            sharedData.app_window_and_systray.windowEvent.on('SHOW', () => {
               callback();
            });
         }
         if (textEvent === 'hide') {
            sharedData.app_window_and_systray.windowEvent.on('HIDE', () => {
               callback();
            });
         }
         if (textEvent === 'resize') {
            sharedData.app_window_and_systray.windowEvent.on('RESIZE', (...args) => {
               callback(...args);
            });
         }
         if (textEvent === 'quit') {
            sharedData.app_window_and_systray.windowEvent.on('QUIT', () => {
               callback();
            });
         }
         if (textEvent === 'changeSettings') {
            Config.getChangeSettingsEvent().on('changeSettings', (path, dif) => {
               callback(path, dif);
            });
         }
         if (textEvent === 'idle') {
            sharedData.idleTime.getIdleEvent().on('idle', () => {
               callback();
            });
         }
         if (textEvent === 'goBackHist') {
            ListViewStore.storeEvents.on('GO_BACK_HIST', () => {
               callback();
            });
         }
         if (textEvent === 'goForwardHist') {
            ListViewStore.storeEvents.on('GO_FORWARD_HIST', () => {
               callback();
            });
         }
      },
   };

   class PRuleFetcher extends _aux_packages_utils.RuleFetcher {
      constructor(opt) {
         super(opt);
         this._context = $context;
      }
   }

   $context.RuleFetcher = PRuleFetcher;

   //Check
   if (global_aux.isFunction(pack)) {
      pack = pack($context);
   } else {
      onCatchErrorPackage(name, 'no export function');
   }

   if (!name) {
      onCatchErrorPackage(name, 'no name');
      return null;
   }

   if (pack.name) {
      onCatchErrorPackage(name, `invalid pack: package already have a name: ${pack.name}`);
      return null;
   }

   if (pack !== null && typeof pack !== 'object') {
      onCatchErrorPackage(name, 'is not an object');
      return null;
   }

   //Set package config id:bNw9gXFST
   if (pack.config && pack.config.constructor === Object && Object.entries(pack.config).length !== 0) {
      let settingsPackUserUrl = packagesManager.getPackcageSettingsFile(name, true);
      let settingsPackUser = getFile(settingsPackUserUrl, 'JSON5', false);

      if (!settingsPackUser) {
         let packConfigUser = JSON.stringify(pack.config, null, 4);
         let packConfigUserCommented = `/*${packConfigUser.replace(/\*/g, '#')}*/` + `\r\n{\r\n\r\n}`;
         setFile(settingsPackUserUrl, packConfigUserCommented, 'TXT');
      } else {
         pack.config = global_aux.mergeObj(pack.config, settingsPackUser);
      }
   }

   pack.name = name;

   return pack;
};

function onCatchErrorPackage(name, error) {
   Logger.error('PackageCatch: ', name, '/ error:', error);
}
