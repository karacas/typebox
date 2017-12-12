'use strict';

const _ = require('lodash');
const path = require('path');
const sharedData = require('../../sharedData.js');
const Config = require('../../config.js');
const Logger = require('../../logger.js');
const packagesManager = require('../../packagesManager.js');
const themeManager = require('../../themeManager.js');
const rimraf = require('rimraf');

const hiddenRulesManager = require('../../hiddenRulesManager.js');
const favManager = require('../../favManager.js');
const lastRulesManager = require('../../lastRulesManager.js');
const historyManager = require('../../historyManager.js');

let getRules = level => [
    {
        title: 'Quit',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'quit'
        }
    },
    {
        title: 'Developer Mode',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'setDevMode'
        }
    },
    {
        title: 'Open Dev Tools',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'openDevTools'
        }
    },
    {
        title: 'Refresh App',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'refresh'
        }
    },
    {
        title: 'Print Settings',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'printSettings'
        }
    },
    {
        title: 'Edit Settings',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'open_settings'
        }
    },
    {
        title: 'Open Log',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'open_log'
        }
    },
    {
        title: 'Launch Toast Test',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'launch_toast'
        }
    },
    {
        title: 'Open Data Path',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'oepn_data_path'
        }
    },
    {
        title: 'Reload Themes',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'reloadThemes'
        }
    },
    {
        title: 'Send Error Test & Warn Test',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'send_error'
        }
    },
    {
        title: 'Delete Caches',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'delete_caches'
        }
    },
    {
        title: 'Delete User Data Folder',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'delete_user_data'
        }
    },
    {
        title: 'Reset last/fav/hist/hidden',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'delete_rules_flasg_data'
        }
    },
    {
        title: 'Save last/fav/hist/hidden',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'save_rules_flasg_data'
        }
    },
    {
        title: 'Toggle items score',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'toggle_items_score'
        }
    },
    {
        title: 'Toggle verbose time',
        path: level,
        type: ['internal', 'null'],
        icon: {
            iconClass: 'mdi-chevron-right text'
        },
        params: {
            action: 'toggle_verbose_time'
        }
    }
];

const toggleScore = () => {
    let newVal = !Config.get('here_are_dragons.showRuleScore');
    sharedData.dataManager.setAndSaveSettings('userSettings', { here_are_dragons: { showRuleScore: newVal } });
};

const toggleVerboseTime = () => {
    let newVal = !Config.get('here_are_dragons.verboseTimes');
    sharedData.dataManager.setAndSaveSettings('userSettings', { here_are_dragons: { verboseTimes: newVal } });
};

module.exports = context => {
    return {
        init() {
            this.savealldata = () => {
                hiddenRulesManager.save();
                favManager.save();
                lastRulesManager.save();
                historyManager.save();
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

            if (Config.get('dev')) {
                let test = 'TEST!';
                context.keyboard_bind('ctrl+k', () => {
                    console.log(test);
                });
            }
        },
        defineTypeExecutors() {
            return [
                {
                    title: 'Internal',
                    type: 'internal',
                    icon: {
                        iconClass: 'mdi-chevron-right text'
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
                        if (action === 'launch_toast') {
                            sharedData.toaster.notify('launch_toast OK');
                        }
                        if (action === 'reloadThemes') {
                            themeManager.reloadThemes();
                        }
                        if (action === 'delete_caches') {
                            context.getDriveManager().deleteCaches();
                        }
                        if (action === 'delete_user_data') {
                            context.getDriveManager().deleteUserData();
                        }
                        if (action === 'save_rules_flasg_data') {
                            this.savealldata();
                        }
                        if (action === 'delete_rules_flasg_data') {
                            //KTODO: HACER LOS RESETS POR SEPARADO EN CADA MANAGER
                            //KTODO: pasar el  this.savealldata() hotkey a pack_commands
                            sharedData.dataManager.saveHiddenRules({ hiddenItems: [] });
                            sharedData.dataManager.savefav({ favItems: [] });
                            sharedData.dataManager.savelast({ lastItems: [] });
                            sharedData.dataManager.saveHistory({
                                historyItems: [],
                                historyItemsKeys: []
                            });
                            setTimeout(() => {
                                hiddenRulesManager.loadHiddenRules();
                                favManager.loadfav();
                                lastRulesManager.loadlast();
                                historyManager.loadHistory();
                                context.setPath('/');
                            }, 0);
                        }
                        if (action === 'oepn_data_path') {
                            context.getDriveManager().openFile(Config.get('here_are_dragons.paths.rootDataStored'));
                        }
                        if (action === 'toggle_items_score') {
                            toggleScore();
                        }
                        if (action === 'toggle_verbose_time') {
                            toggleVerboseTime();
                        }
                        if (action === 'send_error') {
                            context.logger.warn('Error Test, Everything is fine', 1);
                            context.logger.error('Error Test, Everything is fine', 1);
                            context.logger.debug('Error Test, Everything is fine', 1);
                        }
                    }
                }
            ];
        }
    };
};
