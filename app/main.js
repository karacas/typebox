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

var initiated = false;

function init() {
    if (setupEvents.handleSquirrelEvent()) {
        // squirrel event handled and app will exit in 1000ms, so don't do anything else
        return;
    }

    if (initiated || !app) {
        return;
    }

    try {
        if (app.dock) {
            app.dock.hide();
        }

        data_io.init(argv);

        console.log('argv:', argv);
        console.log('args:', process.argv);

        //KTODO: Hacer logger & shareObj acá también
        //KTODO: Hecer refactor de inits con promesas

        window_and_systray.init();
        initiated = true;
    } catch (e) {
        console.error('Init error', e);
    }

    console.log('\r\n________________________________________\r\n');
    console.log(Moment(new Date()).format('HH:mm:ss.SSS'));

    global.sharedObj.settings_manager.getSettings().here_are_dragons.report.backgroundStartDate = new Date();
}

app.on('ready', init);
app.on('activate', init);
