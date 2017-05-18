'use strict';

const _ = require('lodash');
const sharedData = require('../../sharedData.js');
const Config = require('../../config.js');
const Logger = require('../../logger.js');
const packagesManager = require('../../packagesManager.js');
const themeManager = require('../../themeManager.js');
const JSON5 = require('json5');
const window_and_systray = sharedData.app_window_and_systray;

/*
 * setUserSettings :{"theme":{"subTheme": "atom"}} !
 * setUserSettings :{"theme":{"subTheme": "cream"}} !
 * setSubTheme:cream !
 * setSubTheme:atom !
 * addPackage: dummyPackage-2 !
 * removePackage: dummyPackage-2 !
 * setNofifications: false !
*/

module.exports = {
    init() {
        this.app.on('changeQuery', txt => {
            if (!txt.match(/\!$/)) return;

            if (txt === 'q!' || txt === 'quit!') {
                this.app.quit();
            }
            if (txt === 'c!' || txt === 'console!') {
                this.app.openDevTools();
            }
            if (txt === 'log!') {
                let ConfigFile = Config.get('here_are_dragons.paths.logpath') + Config.get('here_are_dragons.paths.logfile');
                this.app.getDriveManager().openFile(ConfigFile);
            }
            if (txt === 'r!' || txt === 'refresh!') {
                this.app.reloadApp();
            }
            if (txt === 'o!' || txt === 'options!') {
                this.app.setPath('internal_pack_options');
            }
            if (txt === 'dc!' || txt === 'deleteCache!') {
                this.app.getDriveManager().deleteCaches();
            }
            if (txt === 'duc!' || txt === 'deleteUserData!') {
                this.app.getDriveManager().deleteUserData();
            }
            if (txt === 'rt!' || txt === 'reloadTehmes!') {
                themeManager.reloadThemes();
                this.app.setQuery('');
            }
            if (txt === 'center!') {
                window_and_systray.centerWin(true);
                this.app.setQuery('');
            }
            if (txt === 'dm!' || txt === 'devmode!') {
                this.app.devModeOn();
                this.app.reloadApp();
            }
        });

        this.app.on('changeCommand', obj => {
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
                    this.app.setQuery('');
                }
            }

            //SUBTHEME: setSubTheme
            if (obj.command === 'setSubTheme' || obj.command === 'sst') {
                if (themeManager.setSubTheme2Settings(obj.args)) {
                    this.app.setQuery('');
                }
            }

            //THEME: setTheme
            if (obj.command === 'setTheme' || obj.command === 'st') {
                if (themeManager.setTheme2Settings(obj.args)) {
                    this.app.setQuery('');
                }
            }

            //PACKAGE: addPackage
            if (obj.command === 'addPackage' || obj.command === 'ap') {
                packagesManager.addPackage(String(obj.args));
            }

            //REMOVE PACKAGE: removePackage
            if (obj.command === 'removePackage' || obj.command === 'rp') {
                packagesManager.removePackage(String(obj.args));
            }

            //FONT: setFont
            if (obj.command === 'setFont' || obj.command === 'sf') {
                if (themeManager.setFont2Settings(obj.args)) {
                    this.app.setQuery('');
                }
            }

            //NOTIFICATIONS: setNofifications
            if (obj.command === 'setNofifications' || obj.command === 'sn') {
                if (sharedData.dataManager.setAndSaveSettings('userSettings', { notifications: obj.args })) {
                    this.app.setQuery('');
                }
            }

            //TEST: test
            if (obj.command === 'test') {
                Logger.info('Test', obj.args);
            }
        });
    }
};
