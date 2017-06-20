'use strict';

const _ = require('lodash');
const path = require('path');
const sharedData = require('../../sharedData.js');
const Config = require('../../config.js');
const Logger = require('../../logger.js');
const packagesManager = require('../../packagesManager.js');
const themeManager = require('../../themeManager.js');
const rimraf = require('rimraf');

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
    }
];

module.exports = context => {
    return {
        init() {
            context.addPermanentRules(getRules(this.name));

            context.on('changeQuery', txt => {
                if (txt === 'd!' || txt === 'dev!') {
                    context.setPath(this.name);
                }
            });
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
                        if (action === 'delete_rules_flasg_data') {
                            sharedData.dataManager.saveHiddenRules({});
                            sharedData.dataManager.saveHistory({});
                            sharedData.dataManager.savefav({});
                            sharedData.dataManager.savelast({});
                            setTimeout(() => {
                                context.reloadApp();
                            }, 0);
                        }
                        if (action === 'oepn_data_path') {
                            context.getDriveManager().openFile(Config.get('here_are_dragons.paths.rootDataStored'));
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
