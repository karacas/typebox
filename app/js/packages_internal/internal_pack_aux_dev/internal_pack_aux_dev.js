'use strict';

const _ = require('lodash');
const path = require('path');
const sharedData = require('../../sharedData.js');
const Config = require('../../config.js');
const Logger = require('../../logger.js');
const packagesManager = require('../../packagesManager.js');
const themeManager = require('../../themeManager.js');

var getRules = level => [
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
    }
];

module.exports = {
    init() {
        this.app.addPermanentRules(getRules(this.name));

        this.app.on('changeQuery', txt => {
            if (txt === 'd!' || txt === 'dev!') {
                this.app.setPath(this.name);
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
                exectFunc: obj => {
                    var action = obj.rule.params.action;
                    if (action === 'openDevTools') {
                        this.app.openDevTools();
                    }
                    if (action === 'refresh') {
                        this.app.reloadApp();
                    }
                    if (action === 'setDevMode') {
                        this.app.devModeOn();
                        setTimeout(this.app.reloadApp, 100);
                    }
                    if (action === 'printSettings') {
                        this.app.logger.info('[Settings:]', this.app.allSetting);
                        this.app.printSettings();
                    }
                    if (action === 'quit') {
                        this.app.quit();
                    }
                    if (action === 'open_settings') {
                        let ConfigFile = Config.get('here_are_dragons.paths.user') + Config.get('here_are_dragons.paths.userSettingsFile');
                        this.app.getDriveManager().openFile(ConfigFile);
                    }
                    if (action === 'open_log') {
                        let ConfigFile = Config.get('here_are_dragons.paths.logpath') + Config.get('here_are_dragons.paths.logfile');
                        this.app.getDriveManager().openFile(ConfigFile);
                    }
                    if (action === 'launch_toast') {
                        sharedData.toaster.notify('launch_toast OK');
                    }
                    if (action === 'reloadThemes') {
                        themeManager.reloadThemes();
                    }
                    if (action === 'delete_caches') {
                        this.app.getDriveManager().deleteCaches();
                    }
                    if (action === 'delete_user_data') {
                        this.app.getDriveManager().deleteUserData();
                    }
                    if (action === 'oepn_data_path') {
                        this.app.getDriveManager().openFile(Config.get('here_are_dragons.paths.rootDataStored'));
                    }
                    if (action === 'send_error') {
                        this.app.logger.warn('Error Test, Everything is fine', 1);
                        this.app.logger.error('Error Test, Everything is fine', 1);
                        this.app.logger.debug('Error Test, Everything is fine', 1);
                    }
                }
            }
        ];
    }
};
