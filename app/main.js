'use strict';

const setupEvents = require('./setupEvents.js');
const electron = require('electron');
const app = electron.app;
const __dirnameRoot = app.getAppPath();
const data_io = require('./data_io.js');
const window_and_systray = require('./window_and_systray.js');
const Menu = electron.Menu;
const Tray = electron.Tray;
const argv = require('yargs').argv;
const Moment = require('moment');
const logger = require('./main_logger.js');

let initiated = false;

function init() {
    if (setupEvents.handleSquirrelEvent() || initiated || !app) {
        return;
    }

    try {
        //KTODO: Ver esto en mac
        if (app.dock) {
            app.dock.hide();
        }

        data_io.init(argv);

        logger.log('\r\n');
        logger.log('[MAIN] Start Background App:', Moment(new Date()).format('HH:mm:ss.SSS'));
        logger.log('[MAIN] argv:', argv);
        logger.log('[MAIN] process.args:', process.argv);

        //KTODO: Hacer shareObj acá también
        //KTODO: Hecer refactor de inits con promesas

        window_and_systray.init();
        initiated = true;
    } catch (e) {
        logger.error('[MAIN] Start error', e);
    }

    global.sharedObj.settings_manager.getSettings().here_are_dragons.report.backgroundStartDate = new Date();
}

app.on('ready', init);
app.on('activate', init);
