'use strict';

const JSON5 = require('json5');
const fs = require('fs');
const path = require('path');
const sharedData = require('@render/shared_data.js');
const Config = require('@render/config.js');
const Logger = require('@render/logger.js');
const packagesManager = require('@render/packages_manager.js');
const hiddenRulesManager = require('@render/hidden_rules_manager.js');
const favManager = require('@render/fav_manager.js');
const ListViewStore = require('@render/list_view_store.js');
const themeManager = require('@render/theme_manager.js');
const newsManager = require('@render/news_manager.js');
const copyToClipboard = require('@render/place_text.js').copyToClipboard;
const executeRule = require('@render/executor.js').executeRule;
const window_and_systray = sharedData.app_window_and_systray;
const clipboard = require('electron').clipboard;
const { debounce } = require('lodash');

const status = sharedData.status;
const getStatus = status.get;
const setStatus = status.set;
const viewEvents = sharedData.viewEvents;

/*
  cconf! / copy_config!

  cclog! / copy_log!

  setUserSettings :{"theme":{"subTheme": "atom"}} !

  setUserSettings :{"theme":{"subTheme": "cream"}} !

  setUserSettings :{"icons":false} !

  setUserSettings :{"visibleInTaskBar":false} !

  setSubTheme:cream !

  setSubTheme:atom !

  addPackage: dummyPackage-2 !

  removePackage: dummyPackage-2 !

  setNofifications: false !

  setUserSettings :{"here_are_dragons":{"showRuleScore": true}} !

  executeRule: {"type": ["command", "object"], "params": {"command": "start cmd.exe /K ping 8.8.4.4 -t"} } !

  executeRule: {
        type: ['command', 'object'],
        params: {
            command: 'start cmd.exe /K ping 8.8.4.4 -t'
        }
    }!

    */

module.exports = context => {
   const mapKeys = (keys, callBack) => {
      if (!keys || !callBack || typeof callBack !== 'function') return;

      if (typeof keys === 'string') keys = typeof keys.indexOf(',') !== -1 ? keys.split(',') : [keys];

      if (!Array.isArray(keys) || !keys.length) return;

      keys.forEach(key => context.keyboard_bind(key, callBack));
   };

   return {
      init() {
         const debounce_maximized = debounce(() => status.switch('maximized'), 64);

         mapKeys(context.getAllKeysFromConfig(context.getSetting('here_are_dragons.bindKeys'), 'TOGGLE_SCORE'), () => status.switch('show_rule_score'));

         mapKeys(context.getAllKeysFromConfig(context.getSetting('here_are_dragons.bindKeys'), 'TOGGLE_MRDOOB_STATS'), () => status.switch('mrdoob_stats'));

         mapKeys(context.getAllKeysFromConfig(context.getSetting('here_are_dragons.bindKeys'), 'TOGGLE_ALWAYS_ON_TOP'), () => status.switch('always_on_top'));

         mapKeys(context.getAllKeysFromConfig(context.getSetting('here_are_dragons.bindKeys'), 'TOGGLE_COLOR_MODE'), () => themeManager.toggleColorMode());

         mapKeys(context.getAllKeysFromConfig(context.getSetting('here_are_dragons.bindKeys'), 'TOGGLE_FULL_SCREEN'), () => debounce_maximized());

         mapKeys(context.getAllKeysFromConfig(context.getSetting('here_are_dragons.bindKeys'), 'OPEN_DEV_TOOLS'), () => context.openDevTools());

         mapKeys(context.getAllKeysFromConfig(context.getSetting('here_are_dragons.bindKeys'), 'QUIT_APP'), () => context.quit());

         context.on('changeQuery', txt => {
            if (txt.length > 256) return;

            if (!txt.match(/\!$/)) return;

            if (txt === 'quit!') {
               context.quit();
               return;
            }

            if (txt.toLowerCase() === 'q!') {
               if (Config.isDev) {
                  context.quit();
               } else {
                  context.closeDevTools();
                  context.setQuery('');
                  context.setPath('/');
                  context.hide();
               }
               return;
            }

            if (txt === 'clear!' || txt === 'clearDev!') {
               context.setQuery('');
               context.clearDevTools();
               return;
            }

            if (txt === 'dt!' || txt === 'con!') {
               context.setQuery('');
               context.openDevTools();
               return;
            }

            if (txt === 'n!' || txt === 'notes!') {
               context.setQuery('');
               context.setPath('INTERNAL_PACK_NOTES');
               return;
            }

            if (txt === 'log!') {
               context.setQuery('');
               let ConfigFile = Config.get('here_are_dragons.paths.logpath') + Config.get('here_are_dragons.paths.logfile');
               setTimeout(() => {
                  context.getDriveManager().openFile(ConfigFile);
               });
               return;
            }

            if (txt === 'cconf!' || txt === 'copy_config!') {
               context.setQuery('');
               copyToClipboard(JSON5.stringify(Config.getAll(), null, 2));
               return;
            }

            if (txt === 'ccondef!' || txt === 'copy_config_default!') {
               context.setQuery('');
               copyToClipboard(JSON5.stringify(Config.getDefaultSettings(), null, 2));
               return;
            }

            if (txt === 'el!' || txt === 'elevated!') {
               let fileExe = path.normalize(Config.get('here_are_dragons.report.__dir_appexe'));
               let fileExeOrig = fileExe;

               if (Config.isDev) Logger.log('fileExeOriginalReport: ', fileExe);

               if (!fs.existsSync(fileExe) || !fileExe.includes('.exe')) {
                  fileExe = '%AppData%\\..\\Local\\typebox\\typebox.exe';
                  fileExe = fileExe.replace(/%([^%]+)%/g, (_, n) => {
                     return process.env[n];
                  });
                  fileExe = path.normalize(fileExe);
               }

               if (!Config.isWin) {
                  context.setQuery('');
                  Logger.error('Only for windows', fileExe, fileExeOrig);
                  return;
               }

               if (fileExe.includes('electron.exe')) {
                  context.setQuery('');
                  Logger.warn('Typebox exe is electron', fileExe, fileExeOrig);
                  return;
               }

               if (Config.get('here_are_dragons.report.isElevated') && !Config.get('here_are_dragons.canRestartElevated')) {
                  context.setQuery('');
                  Logger.warn('Typebox is already Elevated', fileExe, fileExeOrig);
                  return;
               }

               if (!fs.existsSync(fileExe)) {
                  context.setQuery('');
                  Logger.error('fileExe not exist:', fileExe, fileExeOrig);
                  return;
               }

               if (Config.isDev) Logger.log('Open Typebox:', fileExe);

               let sudo = require('sudo-prompt');
               let options = { name: 'Typebox' };

               setTimeout(function() {
                  sudo.exec(`start ${fileExe}`, options, (error, stdout, stderr) => {
                     if (error) {
                        Logger.warn(error, '[Open Typebox]');
                        return;
                     }
                     context.setQuery('');
                     Logger.log(`sudo-prompt ok: ${stdout}`);
                  });
               }, 1);

               return;
            }

            if (txt === 'clog!' || txt === 'copy_log!') {
               let $ConfigFile = Config.get('here_are_dragons.paths.logpath') + Config.get('here_are_dragons.paths.logfile');
               $ConfigFile = path.normalize($ConfigFile);

               if (Config.isDev) Logger.log('\n\n', '$ConfigFile:', $ConfigFile, '\n\n');

               try {
                  if (!fs.existsSync($ConfigFile)) {
                     Logger.warn($ConfigFile, 'no exist');
                     return;
                  } else {
                     let $str = String(fs.readFileSync($ConfigFile, 'utf8'));
                     if ($str && typeof $str === 'string') {
                        copyToClipboard($str);
                        context.setQuery('');
                     } else {
                        Logger.warn($ConfigFile, $str);
                     }
                  }
               } catch (e) {
                  Logger.warn(e, $ConfigFile);
               }
               return;
            }

            if (txt === 'r!' || txt === 'refresh!') {
               context.reloadApp();
               return;
            }

            if (txt === 'rl!' || txt === 'relaunch!') {
               context.relaunch();
               return;
            }

            if (txt === 'rn!' || txt === 'resetNews!') {
               context.setQuery('');
               context.setPath('/');
               setTimeout(newsManager.resetnews, 10);
               return;
            }

            if (txt === 'o!' || txt === 'options!') {
               context.setQuery('');
               context.setPath('internal_pack_options');
               return;
            }

            if (txt === 'dc!' || txt === 'deleteCache!') {
               context.setQuery('');
               context.getDriveManager().deleteCaches();
               return;
            }

            if (txt === 'dud!' || txt === 'deleteUserData!') {
               context.setQuery('');
               context.getDriveManager().deleteUserData();
               return;
            }

            if (txt === 'rt!' || txt === 'reloadTehmes!') {
               context.setQuery('');
               themeManager.reloadThemes();
               return;
            }

            if (txt === 'rz!' || txt === 'resetSize!') {
               context.setQuery('');
               viewEvents.emit('RESET_SIZE');
            }

            if (txt === 'f!' || txt === 'favs!') {
               context.setQuery('');
               context.setPath(favManager.getPath());
               return;
            }

            if (txt === 'h!' || txt === 'hiddenItems!') {
               context.setQuery('');
               context.setPath(hiddenRulesManager.getPath());
               return;
            }

            if (txt === 'center!') {
               context.setQuery('');
               window_and_systray.centerWin(true);
               return;
            }

            if (txt === 'us!' || txt === 'userSettings!') {
               let ConfigFile = Config.get('here_are_dragons.paths.user') + Config.get('here_are_dragons.paths.userSettingsFile');
               context.getDriveManager().openFile(ConfigFile);
               return;
            }

            if (txt === 'ts!' || txt === 'toglescore!') {
               context.setQuery('');
               toggleScore();
               return;
            }

            if (txt === 'dm!' || txt === 'devmode!') {
               context.devModeOn();
               context.reloadApp();
               return;
            }
         });

         context.on('changeCommand', obj => {
            if (obj.args === null || obj.args === undefined) return;

            //ALL SETTINGS: setUserSettings
            if (obj.command === 'setUserSettings') {
               let commandOpt = String(obj.args);
               let commandOptValid = null;

               try {
                  commandOptValid = JSON5.parse(commandOpt);
               } catch (e) {}

               if (!commandOptValid) {
                  Logger.warn('UserConfig: param is no valid', commandOpt);
                  return;
               }

               if (sharedData.setAndSaveSettings('userSettings', commandOptValid)) {
                  context.setQuery('');
               }
            }

            //SUBTHEME: setSubTheme
            if (obj.command === 'setSubTheme' || obj.command === 'sst') {
               if (themeManager.setSubTheme2Settings(obj.args)) {
                  context.setQuery('');
               }
            }

            //EXECUTE MANUAL RULE: executeRule
            if (obj.command === 'executeRule' || obj.command === 'exe') {
               if (Config.isDev || Config.get('here_are_dragons.safe_secure_commands') === false) {
                  Logger.info('\n\n', 'executeRule!');
                  if (obj.args) {
                     try {
                        let $str = String(obj.args)
                           .replace(/\n/g, ' ')
                           .replace(/\s\s+/g, ' ');
                        let $objParam = JSON5.parse($str);
                        if (Config.isDev) Logger.info('executeRuleManual:', $objParam, '\n\n');
                        context.setQuery('');
                        executeRule($objParam);
                     } catch (e) {
                        Logger.warn(e, obj.args, '<ARGS', 'executeRule', '\n\n');
                        return null;
                     }
                  }
               }
            }

            //THEME: setTheme
            if (obj.command === 'setTheme' || obj.command === 'st') {
               if (themeManager.setTheme2Settings(obj.args)) {
                  context.setQuery('');
               }
            }

            //PACKAGE: addPackage
            if (obj.command === 'addPackage' || obj.command === 'ap') {
               let name = String(obj.args);
               context.setQuery('');

               context.setPath('load');
               context.putLoader('load');
               packagesManager
                  .addPackage(name)
                  .then(() => {})
                  .catch(() => {
                     context.removeLoader('load');
                     ListViewStore.storeActions.backRulesPath();
                  });
            }

            //REMOVE PACKAGE: removePackage
            if (obj.command === 'removePackage' || obj.command === 'rp') {
               context.setQuery('');
               let name = String(obj.args);
               context.setQuery('');
               if (packagesManager.removePackage(name)) {
                  context.setPath('load');
                  context.putLoader('load');
               }
            }

            //FONT: setFont
            if (obj.command === 'setFont' || obj.command === 'sf') {
               if (themeManager.setFont2Settings(obj.args)) {
                  context.setQuery('');
               }
            }

            //NOTIFICATIONS: setNofifications
            if (obj.command === 'setNofifications' || obj.command === 'sn') {
               if (sharedData.setAndSaveSettings('userSettings', { notifications: obj.args })) {
                  context.setQuery('');
               }
            }

            //TEST: test
            if (obj.command === 'test') {
               Logger.info('Test command', obj.args);
               context.setQuery('');
            }
         });
      },
   };
};
