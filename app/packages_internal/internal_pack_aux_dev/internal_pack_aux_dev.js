'use strict';

const path = require('path');
const sharedData = require('@render/shared_data.js');
const Config = require('@render/config.js');
const Logger = require('@render/logger.js');
const remote = require('electron').remote;
const packagesManager = require('@render/packages_manager.js');
const newsManager = require('@render/news_manager.js');
const themeManager = require('@render/theme_manager.js');
const rimraf = require('rimraf');
const JSON5 = require('json5');
const { cloneDeep } = require('@aux/aux_global.js');

const hiddenRulesManager = require('@render/hidden_rules_manager.js');
const favManager = require('@render/fav_manager.js');
const lastRulesManager = require('@render/last_rules_manager.js');
const historyManager = require('@render/history_manager.js');
const status = sharedData.status;
const viewEvents = sharedData.viewEvents;

const parentWindow = remote.getCurrentWindow();

let optionsDialog = {
   buttons: !Config.isWin ? ['Cancel', 'Delete'] : ['&Cancel', '&Delete'],
   message: 'Are you sure you want to delete this note',
   title: 'Typebox Confirmation',
   type: 'question',
   noLink: true,
};

let dialog = null;

let getRules = level => [
   {
      title: 'Quit',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'quit',
      },
   },
   {
      title: 'Developer Mode',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'setDevMode',
      },
   },
   {
      title: 'Open Dev Tools',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'openDevTools',
      },
   },
   {
      title: 'Refresh App',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'refresh',
      },
   },
   {
      title: 'Print Settings',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'printSettings',
      },
   },
   {
      title: 'Edit Settings',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'open_settings',
      },
   },
   {
      title: 'Open Log',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'open_log',
      },
   },
   {
      title: 'Launch Toast Test',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'launch_toast',
      },
   },
   {
      title: 'Open Data Path',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'oepn_data_path',
      },
   },
   {
      title: 'Reload Themes',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'reloadThemes',
      },
   },
   {
      title: 'Send Error Test & Warn Test',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'send_error',
      },
   },
   {
      title: 'Delete Caches',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'delete_caches',
      },
   },
   {
      title: 'Delete User Data Folder',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'delete_user_data',
      },
   },
   {
      title: 'Reset last/fav/hist/hidden',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'delete_rules_flasg_data',
      },
   },
   {
      title: 'Save last/fav/hist/hidden',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'save_rules_flasg_data',
      },
   },
   {
      title: 'Toggle items score',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'toggle_items_score',
      },
   },
   {
      title: 'Toggle verbose time',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'toggle_verbose_time',
      },
   },
   {
      title: 'Copy Settings to clipboard',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'copy_config',
      },
   },
   {
      title: 'Copy Default Settings to clipboard',
      path: level,
      type: ['internal', 'null'],
      icon: {
         iconClass: 'fe-chevron-right text',
      },
      params: {
         action: 'copy_def_config',
      },
   },
];

const toggleScore = () => {
   let newVal = !Config.get('here_are_dragons.showRuleScore');
   sharedData.setAndSaveSettings('userSettings', { here_are_dragons: { showRuleScore: newVal } });
};

const toggleVerboseTime = () => {
   let newVal = !Config.get('here_are_dragons.verboseTimes');
   sharedData.setAndSaveSettings('userSettings', { here_are_dragons: { verboseTimes: newVal } });
};

module.exports = context => {
   return {
      init() {
         this.savealldata = () => {
            hiddenRulesManager.save();
            favManager.save();
            lastRulesManager.save();
            historyManager.save();
            context.logger.info('[save internaldata]');
            sharedData.toaster.notify({ message: 'data saved OK', maxTime: 1500 });
         };

         context.addPermanentRules(getRules(this.name));

         context.on('changeQuery', txt => {
            if (txt === 'd!' || txt === 'dev!') {
               context.setPath(this.name);
            }
         });

         const SAVE_ALL_DATA = context.getKeyFromConfig(context.getSetting('here_are_dragons.bindKeys'), 'SAVE_ALL_DATA');
         SAVE_ALL_DATA &&
            context.keyboard_bind(SAVE_ALL_DATA, () => {
               this.savealldata();
            });

         if (Config.isDev) {
            let test = 'TEST!';
            context.keyboard_bind('ctrl+1', () => {
               Logger.log(test);
            });
         }
      },
      defineTypeExecutors() {
         return [
            {
               title: 'Internal',
               type: 'internal',
               icon: {
                  iconClass: 'fe-chevron-right text',
               },
               enabled: obj => {
                  return false;
               },
               exectFunc: obj => {
                  let action = obj.rule.params.action;

                  if (action === 'openDevTools') {
                     context.openDevTools();
                  }

                  if (action === 'refresh') {
                     context.reloadApp();
                  }

                  if (action === 'setDevMode') {
                     context.devModeOn();
                     setTimeout(context.reloadApp, 100);
                  }

                  if (action === 'printSettings') {
                     context.logger.info('[Settings:]', context.allSetting);
                     context.printSettings();
                     sharedData.toaster.notify({ message: 'Print settings ok', maxTime: 1500 });
                  }

                  if (action === 'quit') {
                     context.quit();
                  }

                  if (action === 'open_settings') {
                     let ConfigFile = Config.get('here_are_dragons.paths.user') + Config.get('here_are_dragons.paths.userSettingsFile');
                     context.getDriveManager().openFile(ConfigFile);
                  }

                  if (action === 'open_log') {
                     let ConfigFile = Config.get('here_are_dragons.paths.logpath') + Config.get('here_are_dragons.paths.logfile');
                     context.getDriveManager().openFile(ConfigFile);
                  }

                  if (action === 'reset_news') {
                     let _optionsDialog = cloneDeep(optionsDialog);
                     _optionsDialog.message = 'Are you sure you want to reset news?';
                     dialog = dialog || remote.dialog;
                     dialog.showMessageBox(parentWindow, _optionsDialog, (res, checked) => {
                        if (res === 1) {
                           context.setPath('/');
                           setTimeout(newsManager.resetnews, 10);
                           sharedData.toaster.notify({ message: 'reset news OK', maxTime: 1500 });
                        }
                        context.show();
                     });
                  }

                  if (action === 'launch_toast') {
                     sharedData.toaster.notify({ message: 'launch_toast OK', maxTime: 1500 });
                  }

                  if (action === 'reloadThemes') {
                     themeManager.reloadThemes();
                  }

                  if (action === 'delete_caches') {
                     let _optionsDialog = cloneDeep(optionsDialog);
                     _optionsDialog.message = 'Are you sure you want to delete caches?';
                     dialog = dialog || remote.dialog;
                     dialog.showMessageBox(parentWindow, _optionsDialog, (res, checked) => {
                        if (res === 1) {
                           context.getDriveManager().deleteCaches();
                           sharedData.toaster.notify({ message: 'delete caches OK', maxTime: 1500 });
                        }
                        context.show();
                     });
                  }

                  if (action === 'delete_user_data') {
                     let _optionsDialog = cloneDeep(optionsDialog);
                     _optionsDialog.message = 'Are you sure you want to delete all user data?';
                     dialog = dialog || remote.dialog;
                     dialog.showMessageBox(parentWindow, _optionsDialog, (res, checked) => {
                        if (res === 1) {
                           context.getDriveManager().deleteUserData();
                           sharedData.toaster.notify({ message: 'delete user data OK', maxTime: 1500 });
                        }
                        context.show();
                     });
                  }

                  if (action === 'copy_config') {
                     context.copyToClipboard(JSON5.stringify(Config.getAll(), null, 2));
                  }

                  if (action === 'copy_def_config') {
                     context.copyToClipboard(JSON5.stringify(Config.getDefaultSettings(), null, 2));
                  }

                  if (action === 'save_rules_flasg_data') {
                     this.savealldata();
                  }

                  if (action === 'delete_rules_flasg_data') {
                     let _optionsDialog = cloneDeep(optionsDialog);
                     _optionsDialog.message = 'Are you sure you want to delete flag data?';
                     dialog = dialog || remote.dialog;
                     dialog.showMessageBox(parentWindow, _optionsDialog, (res, checked) => {
                        if (res === 1) {
                           lastRulesManager.save({ lastItems: [] });

                           setTimeout(() => {
                              hiddenRulesManager.loadHiddenRules();
                              favManager.loadfav();
                              lastRulesManager.loadlast();
                              historyManager.loadHistory();
                              context.setPath('/');
                              sharedData.toaster.notify({ message: 'delete flag data OK', maxTime: 1500 });
                           }, 0);
                        }
                        context.show();
                     });
                  }

                  if (action === 'oepn_data_path') {
                     let $rule = context.normalicePath(Config.get('here_are_dragons.paths.rootDataStored'), true);
                     let executor = context.getExecutorById('fspaths_explorepath');
                     if (executor && executor.exectFunc && executor.enabled($rule)) {
                        executor.exectFunc($rule);
                        return;
                     }
                     context.getDriveManager().openFile($rule);
                  }

                  if (action === 'toggle_items_score') {
                     toggleScore();
                  }

                  if (action === 'toggleAlwaysOnTop') {
                     status.switch('always_on_top');
                  }

                  if (action === 'resetWindowSize') {
                     viewEvents.emit('RESET_SIZE');
                  }

                  if (action === 'toggleColorMode') {
                     themeManager.toggleColorMode();
                  }

                  if (action === 'toggle_verbose_time') {
                     toggleVerboseTime();
                  }

                  if (action === 'send_error') {
                     context.logger.log('Log Test, Everything is fine', {});
                     context.logger.info('Info Test, Everything is fine', {});
                     context.logger.warn('Warn Test, Everything is fine', {});
                     context.logger.error('Error Test, Everything is fine', {});
                     context.logger.debug('Debug Test, Everything is fine', {});
                  }
               },
            },
         ];
      },
   };
};
