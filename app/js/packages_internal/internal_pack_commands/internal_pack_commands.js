'use strict';

const _ = require('lodash');
const JSON5 = require('json5');
const sharedData = require('../../sharedData.js');
const Config = require('../../config.js');
const Logger = require('../../logger.js');
const packagesManager = require('../../packagesManager.js');
const hiddenRulesManager = require('../../hiddenRulesManager.js');
const favManager = require('../../favManager.js');
const ListViewStore = require('../../listViewStore.js');
const themeManager = require('../../themeManager.js');
const window_and_systray = sharedData.app_window_and_systray;

/*
 * setUserSettings :{"theme":{"subTheme": "atom"}} !
 * setUserSettings :{"theme":{"subTheme": "cream"}} !
 * setUserSettings :{"icons":false} !
 * setUserSettings :{"visibleInTaskBar":false} !
 * setSubTheme:cream !
 * setSubTheme:atom !
 * addPackage: dummyPackage-2 !
 * removePackage: dummyPackage-2 !
 * setNofifications: false !
 * setUserSettings :{"here_are_dragons":{"showRuleScore": true}} !
 */

const toggleScore = () => {
    let newVal = !Config.get('here_are_dragons.showRuleScore');
    sharedData.dataManager.setAndSaveSettings('userSettings', { here_are_dragons: { showRuleScore: newVal } });
};

//KTODO: CAMBIAR ONS POR SWITCH

module.exports = context => {
    return {
        init() {
            const TOGGLE_SCORE = context.getKeyFromConfig(context.getSetting('here_are_dragons.bindKeys'), 'TOGGLE_SCORE');
            TOGGLE_SCORE &&
                context.keyboard_bind(TOGGLE_SCORE, () => {
                    toggleScore();
                });

            const OPEN_DEV_TOOLS = context.getKeyFromConfig(context.getSetting('here_are_dragons.bindKeys'), 'OPEN_DEV_TOOLS');
            OPEN_DEV_TOOLS &&
                context.keyboard_bind(OPEN_DEV_TOOLS, () => {
                    context.openDevTools();
                });

            const QUIT_APP = context.getKeyFromConfig(context.getSetting('here_are_dragons.bindKeys'), 'QUIT_APP');
            QUIT_APP &&
                context.keyboard_bind(QUIT_APP, () => {
                    context.quit();
                });

            context.on('changeQuery', txt => {
                if (!txt.match(/\!$/)) return;

                if (txt === 'quit!') {
                    context.quit();
                }
                if (txt.toLowerCase() === 'q!') {
                    if (Config.get('dev')) {
                        context.quit();
                    } else {
                        context.setQuery('');
                        context.setPath('/');
                        context.hide();
                    }
                }
                if (txt === 'con!' || txt === 'console!') {
                    context.setQuery('');
                    context.openDevTools();
                }
                if (txt === 'log!') {
                    context.setQuery('');
                    let ConfigFile = Config.get('here_are_dragons.paths.logpath') + Config.get('here_are_dragons.paths.logfile');
                    setTimeout(() => {
                        context.getDriveManager().openFile(ConfigFile);
                    });
                }
                if (txt === 'r!' || txt === 'refresh!') {
                    context.reloadApp();
                }
                if (txt === 'o!' || txt === 'options!') {
                    context.setQuery('');
                    context.setPath('internal_pack_options');
                }
                if (txt === 'dc!' || txt === 'deleteCache!') {
                    context.setQuery('');
                    context.getDriveManager().deleteCaches();
                }
                if (txt === 'dud!' || txt === 'deleteUserData!') {
                    context.setQuery('');
                    context.getDriveManager().deleteUserData();
                }
                if (txt === 'rt!' || txt === 'reloadTehmes!') {
                    context.setQuery('');
                    themeManager.reloadThemes();
                }
                if (txt === 'rz!' || txt === 'resetSize!') {
                    context.setQuery('');
                    sharedData.dataManager.setAndSaveSettings('userSettings', {
                        maxItemsVisible: Config.getDeafult('maxItemsVisible'),
                        width: Config.getDeafult('width')
                    });
                    setTimeout(() => {
                        window_and_systray.setWindowSize(Config.getDeafult('width'), null);
                        window_and_systray.centerWin(true);
                    }, 340);
                }
                if (txt === 'f!' || txt === 'favs!') {
                    context.setQuery('');
                    context.setPath(favManager.getPath());
                }
                if (txt === 'h!' || txt === 'hiddenItems!') {
                    context.setQuery('');
                    context.setPath(hiddenRulesManager.getPath());
                }
                if (txt === 'center!') {
                    context.setQuery('');
                    window_and_systray.centerWin(true);
                }
                if (txt === 'us!' || txt === 'userSettings!') {
                    let ConfigFile = Config.get('here_are_dragons.paths.user') + Config.get('here_are_dragons.paths.userSettingsFile');
                    context.getDriveManager().openFile(ConfigFile);
                }
                if (txt === 'ts!' || txt === 'toglescore!') {
                    context.setQuery('');
                    toggleScore();
                }
                if (txt === 'dm!' || txt === 'devmode!') {
                    context.devModeOn();
                    context.reloadApp();
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

                    if (sharedData.dataManager.setAndSaveSettings('userSettings', commandOptValid)) {
                        context.setQuery('');
                    }
                }

                //SUBTHEME: setSubTheme
                if (obj.command === 'setSubTheme' || obj.command === 'sst') {
                    if (themeManager.setSubTheme2Settings(obj.args)) {
                        context.setQuery('');
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
                    if (sharedData.dataManager.setAndSaveSettings('userSettings', { notifications: obj.args })) {
                        context.setQuery('');
                    }
                }

                //TEST: test
                if (obj.command === 'test') {
                    Logger.info('Test', obj.args);
                    context.setQuery('');
                }
            });
        }
    };
};
