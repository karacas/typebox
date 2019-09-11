'use strict';

const INIT_TIME = new Date();

require('module-alias/register');

const { app } = require('electron');
const argv = require('yargs').argv;
const dayjs = require('dayjs');
const EventEmitter = require('eventemitter3');

const setupEvents = require('@main/setup_events.js');
const idleTime = require('@main/idletime.js');
const logger = require('@main/main_logger.js');
const config_maker = require('@main/config_maker.js');
const window_and_systray = require('@main/window_and_systray.js');
const robotUI = require('@main/robot_ui_manager.js');
const testUImanager = require('@main/ui_test_manager.js');
const status = require('@main/status_store.js');
const realClock = require('@main/real_clock.js');
const toaster = require('@main/toaster.js');
const { get, cloneDeep, normalicePath, $timeout } = require('@aux/aux_global.js');
const { saveFileSync, fileExists, fileDelete } = require('@aux/aux_fs.js');

let initiated = false;
let settings = null;

app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('enable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-pinch');
app.commandLine.appendSwitch('disable-features', 'ColorCorrectRendering');

async function init() {
   config_maker.init(argv);
   settings = config_maker.settings.getSettings() || {};
   const flagFreshInstall = normalicePath(`${get(settings, 'here_are_dragons.paths.app_flags')}/${get(settings, 'here_are_dragons.paths.flagFreshInstall')}`);

   logger.log('[MAIN] Start:', dayjs(new Date()).format('HH:mm:ss.SSS'), '\n', 'argvs:', argv, '\n');

   const installCallBack = () => !fileExists(flagFreshInstall) && saveFileSync(flagFreshInstall, true);

   if (setupEvents.handleSquirrelEvent(installCallBack) || initiated || !app) {
      return;
   }

   //KTODO: Ver esto en mac
   if (app.dock && app.dock.hide) app.dock.hide();

   global.sharedObj.INIT_TIME = INIT_TIME;
   global.sharedObj.robotUI = robotUI;
   global.sharedObj.status = status;
   global.sharedObj.realClock = realClock;
   global.sharedObj.testUImanager = testUImanager;
   global.sharedObj.viewEvents = new EventEmitter();
   global.sharedObj._timeToStart = 0;
   global.sharedObj.setAndSaveSettings = config_maker.settings.setAndSaveSettings;
   global.sharedObj.settings = settings;
   global.sharedObj.idleTime = idleTime;
   global.sharedObj.toaster = toaster;

   global.sharedObj.acceleratorKey = { on: null, off: null };
   global.sharedObj.keyIsActive = () => false;
   global.sharedObj.keyStop = () => {};
   global.sharedObj.keyRestart = () => {};

   status.init();
   await $timeout();

   if (flagFreshInstall && status && fileExists(flagFreshInstall)) {
      fileDelete(flagFreshInstall, () => {}, () => {});
      logger.info('Typebox installed Ok');
      await status.set({ freshInstall: true });
      await $timeout(1);
   }

   robotUI.init();
   realClock.init(get(settings, 'here_are_dragons.realClockOptions'), get(settings, 'here_are_dragons.realClockEnabled'));
   idleTime.init();
   window_and_systray.init();
   testUImanager.init();

   if (get(settings, 'here_are_dragons.exposeRobotUi')) global.sharedObj.robotUI = robotUI;

   if (settings.here_are_dragons.canListenKeyboard) {
      let keyboard_manager = require('@main/keyboard_manager.js');
      keyboard_manager.init();
      global.sharedObj.acceleratorKey.on = keyboard_manager.on;
      global.sharedObj.acceleratorKey.off = keyboard_manager.off;
      global.sharedObj.keyStop = keyboard_manager.keyStop;
      global.sharedObj.keyRestart = keyboard_manager.keyRestart;
      global.sharedObj.keyIsActive = keyboard_manager.keyIsActive;
   }

   initiated = true;
}

app.on('ready', init);
app.on('activate', init);
