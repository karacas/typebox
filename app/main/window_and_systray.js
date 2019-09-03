'use strict';

const { debounce, throttle } = require('lodash');
const { uptime } = require('os');
const { BrowserWindow, globalShortcut, Menu, Tray, app, session } = require('electron');
const { darkMode, debugInfo } = require('electron-util');
const { get, has, cloneDeep, normalicePath, $timeout } = require('@aux/aux_global.js');
const { loadFileSync, saveFileSync, _isValidAndSecurePath } = require('@aux/aux_fs.js');
const { keyTapHard, keyTapClassic } = require('@main/robot_ui_manager.js');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('eventemitter3');
const unhandled = require('electron-unhandled');
const Logger = require('@main/main_logger.js');
const ms = require('ms');
const $settings = require('@main/config_maker.js');
const __dirnameRoot = app.getAppPath();
const activeWin = require('active-win');
const process_pid = process.pid;

const delayDevOptions = 640;
const timeIntervalFocus = 128;
const appVersion = app.getVersion();
const size_threshold = 4;

let status = null;
let getStatus = null;
let setStatus = null;
let inQuitProcess = false;

let screen = null;
let initiated = false;
let settings = null;
let mainWindow = null;
let trayIcon = null;
let win_user_X = -1;
let win_user_Y = -1;
let win_max_size = -1;
let firstPos = false;
let windowEvent = new EventEmitter();
let lastShortcut = null;
let lastShortcut_PopAndFav = null;
let lastShortcut_PopAndLast = null;
let currentShortcut = null;
let currentShortcut_PopAndFav = null;
let currentShortcut_PopAndLast = null;
let shouldQuit;
let delay2show = 0;
let pop_unpopThrottle = () => {};
let closeOnQuit = true;
let lastFocus = null;
let startOpen = false;
let throttleTime_pop_unpop = false;
let status_set_debounce = () => {};
let reloads = -1;

//KTODO: Hacer otra version dev que sea inseura ('unsafe-eval')
let _getIndex_html_file = `file://${__dirname}/../render/index.html`;

function init() {
   if (initiated || !app) {
      return;
   }

   if (!global.sharedObj) {
      Logger.log('No global.sharedObj', global.sharedObj);
      return;
   }

   settings = global.sharedObj.settings_manager.getSettings();
   status = sharedObj.status;
   setDefaultsDevOptions();

   delay2show = get(settings, 'here_are_dragons.delay2show');

   throttleTime_pop_unpop = get(settings, 'here_are_dragons.throttleTime_pop_unpop') || 240;

   startOpen = get(settings, 'here_are_dragons.startOpen');
   if (uptime() * 1000 < ms('2m')) startOpen = false;
   if (settings.dev || status.get('freshInstall') || status.get('always_on_top') || get(settings, 'here_are_dragons.debug.noUnpopWin')) {
      startOpen = true;
   }

   pop_unpopThrottle = throttle(pop_unpop, throttleTime_pop_unpop, { trailing: false });
   status.on('change', onChangeStatus);

   setShares();
   registerSystray();
   registerWindow();

   app.on('before-quit', beforequit);
   app.on('will-quit', willquit);

   if (app.dock && !settings.visibleInTaskBar) {
      app.dock.hide();
   }

   if (get(settings, 'here_are_dragons.alwaysOnTop') === true) {
      setAlwaysOnTop(true);
   }

   status_set_debounce = debounce(status.set, 128);

   initiated = true;

   if (get(global, 'sharedObj.settings_manager.getChangeSettingsEvent')) {
      global.sharedObj.settings_manager.getChangeSettingsEvent().on('change', (path, dif) => {
         if (!dif.path) return;

         settings = global.sharedObj.settings_manager.getSettings();

         let refreshIn_here_are_dragons = true;
         let emit = true;
         let toast = true;
         let avoidReturn = false;

         if (dif.path.includes('here_are_dragons') && (dif.path.includes('showRuleScore') || dif.path.includes('verboseTimes'))) {
            refreshIn_here_are_dragons = false;
            avoidReturn = true;
            toast = false;
         }

         if (dif.path.includes('theme')) {
            toast = false;
         }

         if (
            path === 'here_are_dragons' ||
            path === 'here_are_dragons.electron_windows_list_options' ||
            path === 'here_are_dragons.electron_windows_list_options.width'
         ) {
            if (avoidReturn === false) return;
         }

         if (
            path == 'mainShortcut' ||
            path == 'mainShortcut_PopAndFav' ||
            path == 'mainShortcut_PopAndLast' ||
            path == 'mainShortcut_StopKeyListener' ||
            path == 'mainShortcut_StartKetListener'
         ) {
            refreshIn_here_are_dragons = false;
            registerMainShortcuts();
         }

         if (path.includes('here_are_dragons.') && refreshIn_here_are_dragons) {
            refreshListWindow();
         }

         //KTODO:Hacer un modulo que maneje lang
         if (toast) global.sharedObj.toaster.notify(get(settings, 'here_are_dragons.language.changeSettings'));

         if (emit) {
            Logger.log('[windowEvent changeSettings emited]', { path, dif });
            windowEvent.emit('changeSettings', path, dif);
         }
      });
   }

   //ON CHANGE SETTINGS
   //KTODO: Aprolijar rules
   global.sharedObj.settings_manager.getChangeSettingsEvent().on('changeApp', (evt, name) => {
      if (!settings || !settings.dev || !settings.here_are_dragons.reloadOnAppChanges) return;
      refreshListWindow();
   });

   global.sharedObj.settings_manager.getChangeSettingsEvent().on('relaunchApp', (evt, name) => {
      if (!settings || !settings.dev || !settings.here_are_dragons.reloadOnAppChanges) return;
      relaunch();
   });

   if (false && settings.dev) onRemotes();
}

function onChangeStatus(objPath) {
   if (has(objPath, 'always_on_top')) {
      let _always_on_top = get(objPath, 'always_on_top');
      if (_always_on_top !== isAlwaysOnTop()) {
         setAlwaysOnTop(!!_always_on_top);
      }
   }
   if (has(objPath, 'width')) {
      let actualWidth = Math.round(mainWindow.getSize()[0]);
      let widthInStatus = Math.round(Number(get(objPath, 'width')));
      if (Math.abs(actualWidth - widthInStatus) > size_threshold) {
         setWindowSize(widthInStatus, null);
      }
   }
   if (has(objPath, 'maximized')) {
      let _maximized = get(objPath, 'maximized');
      setMaximized(!!_maximized);
   }
}

function onUnresponsiveMainWin(e) {
   if (Logger) Logger.error('\n\n Crash Win\n', e);
   console.error('\n\n Crash Win\n', e);

   setTimeout(refreshListWindow, 2000);

   //ALERT
   unhandled.logError(e);

   //SAVE ERROR
   try {
      let errorPath = path.join(get(settings, 'here_are_dragons.paths.logpath'), `unresponsiveMainWin_${new Date().getTime()}_.txt`);
      let errorData = `\`\`\`\n${e.stack}\n\`\`\`\n\n---\n\n${debugInfo()}`;
      saveFileSync(errorPath, errorData, (type = 'plain'));
   } catch (e) {}
}

function setShares() {
   // #2345624_B
   //KTODO: Hacer módulo aparte
   let $global = global.sharedObj;

   $global.app_window_and_systray.windowEvent = windowEvent;
   $global.app_window_and_systray.unpopWin = unpopWin;
   $global.app_window_and_systray.popWin = popWin;
   $global.app_window_and_systray.popWinHard = popWinHard;
   $global.app_window_and_systray.setWindowSize = setWindowSize;
   $global.app_window_and_systray.setMaxSize = setMaxSize;
   $global.app_window_and_systray.openDevTools = openDevTools;
   $global.app_window_and_systray.refreshListWindow = refreshListWindow;
   $global.app_window_and_systray.closeDevTools = closeDevTools;
   $global.app_window_and_systray.clearDevTools = clearDevTools;
   $global.app_window_and_systray.focus = focus;
   $global.app_window_and_systray.isFocused = isFocused;
   $global.app_window_and_systray.isMaximized = isMaximized;
   $global.app_window_and_systray.setAlwaysOnTop = setAlwaysOnTop;
   $global.app_window_and_systray.relaunch = relaunch;
   $global.app_window_and_systray.centerWin = centerWin;
   $global.app_window_and_systray.quit = (val = null) => forceQuit(`setShares Quit: ${val}`);

   //MOVER A STATUS
   $global.lastviewEvent = {};
   $global.getLastviewEvent = () => cloneDeep($global.lastviewEvent);
}

async function registerWindow() {
   settings.here_are_dragons.electron_windows_list_options.show = startOpen;

   let winsettings = get(settings, 'here_are_dragons.electron_windows_list_options') || {};

   winsettings.transparent = winsettings.transparent === true;
   if (winsettings.transparent) delete winsettings.backgroundColor;
   if (winsettings.transparent) delete winsettings.hasShadow;

   winsettings.webPreferences = {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      sandbox: false,
      enableRemoteModule: true,
      zoomFactor: 1,
      webSecurity: false,
      textAreasAreResizable: false,
      plugins: false,
      scrollBounce: false,
      backgroundThrottling: false,
      webviewTag: true,
      safeDialogs: true,
      enableBlinkFeatures: '',
      disableBlinkFeatures: 'OverlayScrollbars',
      partition: 'persist:mainWindow',
   };

   mainWindow = new BrowserWindow(winsettings);

   //CHECK ERRORS
   if (mainWindow.webContents) mainWindow.webContents.once('crashed', onUnresponsiveMainWin);
   mainWindow.once('unresponsive', onUnresponsiveMainWin);
   process.on('uncaughtException', onUnresponsiveMainWin);

   mainWindow.once('ready-to-show', () => {
      Logger.log('ready-to-show');
   });
   mainWindow.once('did-finish-load', () => {
      Logger.log('did-finish-load');
   });

   if (mainWindow.webContents) {
      mainWindow.webContents.session.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (d, c) => {
         if (d.responseHeaders['x-frame-options'] || d.responseHeaders['X-Frame-Options']) {
            Logger.log('[onHeadersReceived]', { d: d });
            delete d.responseHeaders['x-frame-options'];
            delete d.responseHeaders['X-Frame-Options'];
         }
         c({ cancel: false, responseHeaders: d.responseHeaders });
      });
   }

   mainWindow.loadURL(_getIndex_html_file);

   if (!settings.dev) {
      mainWindow.setMenu(null);
      mainWindow.setMenuBarVisibility(false);
      mainWindow.setAutoHideMenuBar(true);
   }

   if (get(settings, 'here_are_dragons.chromiumConsole')) {
      openDevTools();
   }

   if (!startOpen) unpopWin();

   onMainWindowReady();

   handleWindow();
}

function onMainWindowReady() {
   setDefaultPos();

   windowEvent.on('VIEW_IS_USABLE', async () => {
      await $timeout(get(settings, 'here_are_dragons.chromiumConsole') ? 32 : 0);

      reloads++;
      status.set({ reloads });

      if (reloads === 0) {
         setInterval(checkRealFocus, timeIntervalFocus);
      }

      if (startOpen && reloads === 0) {
         popWin();
         await $timeout(throttleTime_pop_unpop + 16);
         focus();
      }
   });
}

//KTODO: Vet si se puede usar: registerWindow
function refreshListWindow() {
   if (!mainWindow) return;
   windowEvent.emit('REFRESH_WIN');
   mainWindow.reload();
}

function setUserPos(x, y) {
   if (!mainWindow || !x || !y) return;
   win_user_X = x;
   win_user_Y = y;
   if (mainWindow && mainWindow.setPosition) mainWindow.setPosition(win_user_X, win_user_Y);
}

function setDefaultPos() {
   if (!mainWindow || firstPos) return;

   const { win_user_X: x, win_user_Y: y, width: w } = status.initDefaultStatus();

   if (x && y) {
      setUserPos(x, y);
   }

   if (w) {
      setWindowSize(w, null);
   }

   firstPos = true;
}

function isAlwaysOnTop() {
   if (mainWindow && mainWindow.isAlwaysOnTop) {
      return mainWindow.isAlwaysOnTop();
   }
   return false;
}

function setAlwaysOnTop(val) {
   if (mainWindow && mainWindow.setAlwaysOnTop) {
      if (val) {
         if (!isAlwaysOnTop()) {
            popWinHard(true);
            mainWindow.setAlwaysOnTop(true);
         }
         checkRefocusOnAlwaysOnTop();
      } else {
         mainWindow.setAlwaysOnTop(false);
         status.switch('always_on_top', false);
      }
   }
}

function checkRefocusOnAlwaysOnTop() {
   if (mainWindow) {
      if (isAlwaysOnTop()) {
         if (status.get('in_test')) focus();
         if (windowEvent && windowEvent.emit) status.switch('always_on_top', true);
         return true;
      }
      status.switch('always_on_top', false);
      return false;
   }
}

function getMainWindow() {
   if (mainWindow) {
      return mainWindow;
   }
}

function focus() {
   if (mainWindow && mainWindow.moveTop) mainWindow.moveTop();
   if (mainWindow) mainWindow.focus();
}

function show() {
   if (mainWindow && mainWindow.show) {
      mainWindow.show();
      focus();
   }
}

function isFocused() {
   if (mainWindow && mainWindow.isFocused && BrowserWindow && BrowserWindow.getFocusedWindow) {
      return !!BrowserWindow.getFocusedWindow() && mainWindow.isFocused();
   }
   return false;
}

function isMaximized() {
   if (!mainWindow || !screen || !mainWindow.getBounds || !screen.getPrimaryDisplay) return false;

   let threshold = 10;

   const pm = screen.getPrimaryDisplay();
   const gb = mainWindow.getBounds();

   const ww = gb.width;
   const sw = pm.workAreaSize.width;

   const wh = gb.height;
   const sh = pm.workAreaSize.height;

   let res = sh - wh < threshold && sw - ww < threshold;

   if (status) status.switch('maximized', res);

   return res;
}

function setMaximized(val) {
   if (val === isMaximized()) return;

   if (val) {
      mainWindow.maximize();
      if (!isFocused()) pop_unpop(true);
      status.switch('maximized', true);
   } else {
      mainWindow.unmaximize();
      status.switch('maximized', false);
   }
}

function _focusDevTools() {
   if (process.platform === 'win32' && mainWindow && mainWindow.devToolsWebContents && mainWindow.devToolsWebContents.focus) {
      if (mainWindow.focus && !isFocused()) {
         show();
         focus();
      }
      mainWindow.devToolsWebContents.focus();
   }
}
const focusDevTools = debounce(_focusDevTools, 64, { leading: true, trailing: false });

function _openDevTools() {
   if (!mainWindow || !mainWindow.webContents) {
      Logger.error('no mainWindow');
      console.error('no mainWindow');
      return;
   }

   try {
      if (mainWindow.webContents.openDevTools && !mainWindow.webContents.isDevToolsOpened()) {
         if (settings.dev) console.log('[openDevTools]');
         mainWindow.webContents.openDevTools(get(settings, 'here_are_dragons.chromiumConsoleOptions'));
      }
   } catch (e) {
      Logger.error(e);
   }

   try {
      if (process.platform === 'win32' && mainWindow.webContents && mainWindow.webContents.on) {
         mainWindow.webContents.on('devtools-focused', () => {
            setTimeout(focusDevTools, 0);
         });
      }
   } catch (e) {
      Logger.error(e);
   }

   if (Logger.resetConsole) Logger.resetConsole();

   setTimeout(() => {
      if (
         (get(settings, 'here_are_dragons.chromiumConsoleOptions.setZoomFactor') || 1) !== 1 &&
         mainWindow.devToolsWebContents &&
         mainWindow.devToolsWebContents.setZoomFactor
      ) {
         mainWindow.devToolsWebContents.setZoomFactor(get(settings, 'here_are_dragons.chromiumConsoleOptions.setZoomFactor'));
      }
   }, delayDevOptions);
}
const openDevTools = debounce(_openDevTools, 1024, { leading: true, trailing: false });

function _setDefaultsDevOptions() {
   if (!get(settings, 'here_are_dragons.chromiumConsoleOptions.setDefaultsDevOptions')) return;

   let canSet = false;
   let jsonDevFile = null;
   let jsonDev = null;

   if (settings.userkaracas) {
      jsonDevFile = path.normalize(`${__dirnameRoot}/app/assets/devToolsPref/Preferences` + `__${get(settings, 'here_are_dragons.terminalName')}`);
   } else {
      jsonDevFile = path.normalize(`${__dirnameRoot}/app/assets/devToolsPref/Preferences`);
   }

   const jsonDevFileSet = path.normalize(`${get(settings, 'here_are_dragons.report.__dir__userData')}/Preferences`);

   if (!fs.existsSync(jsonDevFileSet)) return;
   if (!fs.existsSync(jsonDevFile)) return;

   jsonDev = loadFileSync(jsonDevFile, 'plain');

   if (jsonDev) {
      if (jsonDevFileSet && _isValidAndSecurePath(jsonDevFileSet)) {
         canSet = saveFileSync(jsonDevFileSet, jsonDev);
      }
   }

   if (get(settings, 'here_are_dragons.report.electronIsDev')) {
      if (settings.dev) console.log('[setDefaultsDevOptions]', jsonDevFile, canSet);
   }
}
const setDefaultsDevOptions = debounce(_setDefaultsDevOptions, 512, { leading: true, trailing: false });

function registerMainShortcuts() {
   //KTODO: Check if valid mainShortcut
   currentShortcut = settings.mainShortcut;
   currentShortcut_PopAndFav = settings.mainShortcut_PopAndFav;
   currentShortcut_PopAndLast = settings.mainShortcut_PopAndLast;

   registerMainShortcut();
   registerOpenAndFav();
   registerOpenAndLast();
}

function registerMainShortcut() {
   if (lastShortcut && globalShortcut.isRegistered(lastShortcut)) {
      globalShortcut.unregister(lastShortcut);
   }

   lastShortcut = currentShortcut;

   if (globalShortcut.isRegistered(currentShortcut)) {
      globalShortcut.unregister(currentShortcut);
   }
   if (!globalShortcut.isRegistered(currentShortcut)) {
      globalShortcut.register(currentShortcut, popWin);
   }
}

const registerOpenAndFav = () => {
   if (lastShortcut_PopAndFav && currentShortcut_PopAndFav.length > 0 && globalShortcut.isRegistered(lastShortcut_PopAndFav)) {
      globalShortcut.unregister(lastShortcut_PopAndFav);
   }

   lastShortcut_PopAndFav = currentShortcut_PopAndFav;

   if (currentShortcut_PopAndFav && currentShortcut_PopAndFav.length > 0 && globalShortcut.isRegistered(currentShortcut_PopAndFav)) {
      globalShortcut.unregister(currentShortcut_PopAndFav);
   }
   if (currentShortcut_PopAndFav && currentShortcut_PopAndFav.length > 0 && !globalShortcut.isRegistered(currentShortcut_PopAndFav)) {
      globalShortcut.register(currentShortcut_PopAndFav, () => {
         popWin();
         windowEvent.emit('GO_TO_FAVS', true);
      });
   }
};

const registerOpenAndLast = () => {
   if (lastShortcut_PopAndLast && currentShortcut_PopAndLast.length > 0 && globalShortcut.isRegistered(lastShortcut_PopAndLast)) {
      globalShortcut.unregister(lastShortcut_PopAndLast);
   }

   lastShortcut_PopAndLast = currentShortcut_PopAndLast;

   if (currentShortcut_PopAndLast && currentShortcut_PopAndLast.length > 0 && globalShortcut.isRegistered(currentShortcut_PopAndLast)) {
      globalShortcut.unregister(currentShortcut_PopAndLast);
   }
   if (currentShortcut_PopAndLast && currentShortcut_PopAndLast.length > 0 && !globalShortcut.isRegistered(currentShortcut_PopAndLast)) {
      globalShortcut.register(currentShortcut_PopAndLast, () => {
         popWin();
         windowEvent.emit('GO_TO_LAST', true);
      });
   }
};

async function checkRealFocus() {
   if (!mainWindow || !status) return;
   let focus = false;
   let actWin = await activeWin();
   if (mainWindow && mainWindow.isVisible()) {
      actWin ? (focus = get(actWin, 'title') === 'typebox') /*|| get(actWin, 'owner.processId') === process_pid*/ : null;
   }
   await status.set({ focused: focus });
   if (false && lastFocus !== focus) Logger.info('focus', focus, get(actWin, 'title'), get(actWin, 'owner.processId'), get(actWin, 'title'), process.pid);
   lastFocus = focus;
}

function handleWindow() {
   if (!mainWindow) {
      return;
   }

   mainWindow.on('blur', () => {
      if (checkRefocusOnAlwaysOnTop()) return;
      setTimeout(async () => {
         if (
            mainWindow.webContents &&
            mainWindow.webContents.openDevTools &&
            !mainWindow.webContents.isDevToolsOpened() &&
            get(settings, 'here_are_dragons.hideOnBlur') &&
            BrowserWindow &&
            BrowserWindow.getAllWindows &&
            BrowserWindow.getAllWindows().length == 1
         ) {
            try {
               let actWin = await activeWin();
               if (get(actWin, 'owner.processId') === process.pid) return;
               if (get(actWin, 'title') === 'typebox') return;
            } catch (e) {
               console.warn(e);
            }
            unpopWin();
         }
      }, 1);
   });

   let handleResizeDeb = debounce(handleResize, get(settings, 'here_are_dragons.debounceTime_resize_win') || 128);

   mainWindow.on('resize', handleResizeDeb);
   mainWindow.on('maximize', handleMaximized);
   mainWindow.on('unmaximize', handleUnMaximized);
   mainWindow.on('move', userMove);

   mainWindow.on('close', (path, dif) => {
      if (!closeOnQuit) return;
      forceQuit('mainWindow.on.close');
   });

   //Replace a href target="_blank"
   mainWindow.webContents.on('new-window', function(e, url) {
      if (settings.dev) console.log('on new-window / url:', url);
      e.preventDefault();
      require('electron').shell.openExternal(url);
   });

   mainWindow.webContents.on('will-navigate', function(e, url) {
      if (settings.dev) console.log('on will-navigate / url:', url);
      e.preventDefault();
      require('electron').shell.openExternal(url);
   });

   registerMainShortcuts();
   singleInstance();
}

function registerSystray() {
   if (!get(settings, 'here_are_dragons.systray')) {
      return;
   }

   //KTODO: Make icons from SVG: https://www.npmjs.com/package/svg2img

   //WIN
   let trayIconFile = '/../assets/icons/systray_pleno_32_black.png';

   if (!darkMode.isEnabled) {
      //KTODO: no anda ni en win ni en lnx, poner un flag en settigs para light mode
      //trayIconFile = '/../assets/icons/systray_pleno_32_white.png'
   }

   if (settings.dev) {
      trayIconFile = '/../assets/icons/systray_dev_32.png';
   }

   if (process.platform === 'darwin') {
      // trayIconFile = '/../assets/icons/systray_pleno_18_black.png'
      trayIconFile = '/../assets/icons/systray_pleno_18_black.png';
      if (!darkMode.isEnabled) {
         // trayIconFile = '/../assets/icons/systray_pleno_18_white.png'
         trayIconFile = '/../assets/icons/systray_pleno_18_white.png';
      }
   }

   if (process.platform === 'linux' || process.platform === 'freebsd' || process.platform === 'sunos') {
      trayIconFile = '/../assets/icons/systray_pleno_32_black.png';
      // if (!darkMode.isEnabled) {
      //    trayIconFile = '/../assets/icons/systray_pleno_16_white.png'
      // }
   }

   trayIconFile = path.normalize(path.join(__dirname, trayIconFile));
   const normalized_trayIconFile = normalicePath(trayIconFile);

   try {
      trayIcon = new Tray(normalized_trayIconFile);
   } catch (e) {
      Logger.error('Systray not created', e, trayIconFile, normalized_trayIconFile);
      return;
   }

   let contextMenuTemplale = [
      {
         label: `Open [${settings.mainShortcut}]`,
         click: () => {
            popWin();
         },
      },
      {
         type: 'separator',
      },
      {
         label: 'About',
         click: () => {},
      },
   ];

   if (get(settings, 'here_are_dragons.tray_console')) {
      contextMenuTemplale.push({
         label: 'Open Dev Tools',
         click: openDevTools,
      });
   }

   if (get(settings, 'here_are_dragons.tray_reload')) {
      contextMenuTemplale.push({
         label: 'Reload App',
         click: refreshListWindow,
      });
   }

   contextMenuTemplale.push({
      type: 'separator',
   });

   contextMenuTemplale.push({
      label: 'Quit',
      click: function() {
         forceQuit('contextMenuTemplale');
      },
   });

   let contextMenu = Menu.buildFromTemplate(contextMenuTemplale);

   if (trayIcon) {
      trayIcon.setToolTip(`${'typebox' + ' v'}${appVersion}`);
      trayIcon.setContextMenu(contextMenu);
      trayIcon.on('click', togleWin);
   }

   if (settings && settings.verbose) {
      Logger.log('[Systray]');
   }
}

function togleWin() {
   if (!mainWindow || !app) return;
   if (mainWindow.isVisible()) {
      return unpopWin();
   } else {
      return popWin();
   }
}

function popWin() {
   return pop_unpopThrottle(true);
}

function simulateKey() {
   keyTapHard('shift');
}

function popWinHard() {
   simulateKey();
   return pop_unpopThrottle(true);
}

function unpopWin() {
   if (checkRefocusOnAlwaysOnTop()) return;
   return pop_unpopThrottle(false);
}

function pop_unpop(pop) {
   if (!mainWindow || !app) return;

   if (pop) {
      if (process.platform === 'win32') focusDevTools();

      //OPEN
      if (!winIsActive()) {
         setTimeout(() => {
            //VER 'browser-window-blur' / https://electronjs.org/docs/api/app
            windowEvent.emit('SHOW');
         });
      }

      if (!settings.visibleInTaskBar) {
         if (app && app.show) app.show();
         if (app && app.focus) app.focus();
      }

      if (mainWindow.isMinimized() && mainWindow.restore) mainWindow.restore();

      return show();
   } else {
      //CLOSE
      if (get(settings, 'here_are_dragons.debug.noUnpopWin')) return;

      if (checkRefocusOnAlwaysOnTop()) return;

      if (winIsActive()) {
         windowEvent.emit('BEFORE_HIDE', true);
         setTimeout(() => {
            //VER 'browser-window-blur' / https://electronjs.org/docs/api/app
            windowEvent.emit('HIDE');
         }, 0);
      }

      if (isFocused()) {
         mainWindow.blur();
      }

      if (!settings.visibleInTaskBar) {
         mainWindow.hide();
         if (app.hide) app.hide(); // MAC LOST FOCUS
      } else {
         return mainWindow.minimize();
      }

      return true;
   }
}

async function _centerWin(force = false) {
   if (!mainWindow) {
      return;
   }

   if (win_user_X !== -1 && win_user_Y !== -1 && !force) {
      mainWindow.setPosition(Math.round(win_user_X), Math.round(win_user_Y));
      return;
   }

   mainWindow.center();

   let setY = mainWindow.getPosition()[1];

   let deltaHeight = Math.round((win_max_size - Math.round(mainWindow.getSize()[1])) * 0.5);
   if (deltaHeight < size_threshold) deltaHeight = 0;

   setY -= deltaHeight;

   setY += settings.here_are_dragons.initOffsetY || 0;

   if (setY < settings.here_are_dragons.minY || 0) {
      setY = settings.here_are_dragons.minY || 0;
   }

   setY = Math.round(setY);

   if (Math.abs(setY - mainWindow.getPosition()[1]) > size_threshold) {
      mainWindow.setPosition(mainWindow.getPosition()[0], setY);
   }

   firstPos = true;
   return true;
}
const centerWin = debounce(_centerWin, 64);

function setMaxSize(height) {
   if (!mainWindow) {
      return;
   }
   if (height && height > 0) {
      win_max_size = height;
   }
}

function userMove() {
   if (!firstPos) {
      return;
   }

   let x = mainWindow.getPosition()[0];
   let y = mainWindow.getPosition()[1];

   if (x < 0) {
      x = 0;
   }
   if (y < 0) {
      y = 0;
   }

   //KTODO: validate bounds
   win_user_X = Math.round(x);
   win_user_Y = Math.round(y);

   if (!isMaximized()) {
      status_set_debounce({ win_user_X, win_user_Y });
   }
}

function getValidSizes(w, h) {
   screen = screen || require('electron').screen;
   if (!mainWindow || !screen) {
      return { w, h };
   }
   try {
      let maxW = screen.getPrimaryDisplay().workAreaSize.width;
      let maxH = screen.getPrimaryDisplay().workAreaSize.height;

      let minW = get(settings, 'here_are_dragons.electron_windows_list_options.minWidth');
      let minH = get(settings, 'here_are_dragons.electron_windows_list_options.minHeight');

      let newW = w;
      let newH = h;

      minW = Math.round(Math.max(minW, maxW * 0.285));
      mainWindow.setMinimumSize(minW, minH);

      if (newW < minW) newW = minW;
      if (newH < minH) newH = minH;

      return {
         w: newW,
         h: newH,
      };
   } catch (e) {
      Logger.error(e);
      return {
         w,
         h,
      };
   }
}

let handleResize_lastW = 0;
let handleResize_lastH = 0;

function handleMaximized(e) {
   setMaximized(true);
}

function handleUnMaximized(e) {
   setMaximized(false);
}

function handleResize(e) {
   if (!mainWindow || isMaximized()) return null;

   try {
      let w = Math.round(mainWindow.getSize()[0]);
      let h = Math.round(mainWindow.getSize()[1]);

      let validSizes = getValidSizes(w, h);

      let newW = Math.round(validSizes.w);
      let newH = Math.round(validSizes.h);

      try {
         if (Math.abs(newW - handleResize_lastW) > size_threshold || Math.abs(newH - handleResize_lastH) > size_threshold) {
            if (windowEvent && windowEvent.emit) windowEvent.emit('RESIZE', { width: newW, height: newH });
         } else {
            return;
         }
      } catch (e) {
         return null;
      }

      let widthInStatus = Math.round(Number(status.get('width')));

      status.set({ width: newW });
      setWindowSize(newW, newH);
   } catch (e) {
      return null;
   }
}

function setWindowSize(width, height) {
   if (!mainWindow || isMaximized()) {
      return;
   }
   try {
      if (width === null) width = mainWindow.getSize()[0];
      if (height === null) height = mainWindow.getSize()[1];

      let validSizes = getValidSizes(width, height);

      let w = Math.round(mainWindow.getSize()[0]);
      let h = Math.round(mainWindow.getSize()[1]);
      let newW = Math.round(validSizes.w);
      let newH = Math.round(validSizes.h);

      handleResize_lastW = newW;
      handleResize_lastH = newH;

      mainWindow.setSize(newW, newH);
      status.set({ width: newW });
      if (!true && settings.dev) Logger.log(' ...[RESET_SIZE] ok', { newW, newH, w, h, width, height, validSizes });
   } catch (e) {
      Logger.error(e);
   }
}

function winIsVisible() {
   if (!mainWindow || !mainWindow.isVisible) return;
   return mainWindow.isVisible();
}

function winIsActive() {
   if (!mainWindow || !mainWindow.isVisible) return false;
   return mainWindow.isVisible() && isFocused() && !mainWindow.isMinimized();
}

function closeDevTools(setDefault = true) {
   if (mainWindow && mainWindow.closeDevTools) {
      mainWindow.closeDevTools();
      if (setDefault) {
         setTimeout(() => {
            setDefaultsDevOptions();
         }, 128);
      }
   }
}

function clearDevTools() {
   if (!mainWindow || !mainWindow.webContents) return;

   if (mainWindow.webContents.executeJavaScript) {
      try {
         mainWindow.webContents.executeJavaScript('console.clear()', result => {});
      } catch (e) {
         console.warn(e);
      }
   }
}

function onRemotes() {
   if (!mainWindow || !app) return;

   app.on('remote-require', function(event, webContents, requestedModuleName) {
      if (settings.dev) console.log('remote-require', requestedModuleName);
   });
   mainWindow.webContents.on('remote-require', function(event, requestedModuleName) {
      if (settings.dev) console.log('remote-require', requestedModuleName);
   });
   app.on('remote-get-global', function(event, webContents, requrestedGlobalName) {
      if (settings.dev) console.log('remote-get-global', requrestedGlobalName);
   });
   mainWindow.webContents.on('remote-get-global', function(event, requestedGlobalName) {
      if (settings.dev) console.log('remote-get-global', requestedGlobalName);
   });
}

//_________________________________________
// EXIT & QUIT
//_________________________________________

function relaunch() {
   if (app && app.relaunch && app.quit) {
      Logger.log('relaunch!');
      mainWindow = null;
      app.relaunch();
      app.quit();
   }
}

function singleInstance() {
   //ANOTHER ISNTANCE
   try {
      const gotTheLock = app.requestSingleInstanceLock();

      if (!gotTheLock) {
         if (settings && settings.verbose) {
            Logger.log('Another instance create, i pop.');
         }
         setTimeout(() => {
            if (startOpen) {
               popWin();
            } else {
               unpopWin();
            }
            registerMainShortcuts();
         }, get(settings, 'here_are_dragons.delayBeforeQuit') * 1.5);
         return;
      } else {
         app.on('second-instance', (commandLine, workingDirectory) => {
            if (mainWindow) {
               let newAppDir = Array.isArray(workingDirectory) ? workingDirectory.join('') : workingDirectory;
               let newAppDirIsElectron = newAppDir.includes('electron');
               let superdev = get(settings, 'here_are_dragons.report.superdev');

               //KTODO: Definir bien en algún lado se es electron o produccion y hacer la comparación con eso

               if (newAppDirIsElectron && !superdev) return;

               Logger.info(
                  'Another instance create, i quit.',
                  'workingDirectory:',
                  workingDirectory,
                  'newAppDir:',
                  newAppDir,
                  'newAppDirIsElectron:',
                  newAppDirIsElectron,
                  'ThisIssuperdev:',
                  superdev
               );

               forceQuit('singleInstance');
            }
         });
      }
   } catch (e) {
      Logger.warn(e);
   }
}

function forceQuit($log) {
   if (inQuitProcess) return;
   closeDevTools(false);
   setAlwaysOnTop(false);
   unpopWin();
   if (app && app.quit) {
      try {
         inQuitProcess = true;
         if (Logger && Logger.info) Logger.info('[forceQuit] by', $log);
         if (settings.dev) console.log('[forceQuit] by', $log);
         app.quit();
      } catch (e) {
         Logger.error('[forceQuit] error', e);
      }
      return;
   }
   Logger.error('[forceQuit] error: no app:', app);
}

function beforequit(event) {
   event.preventDefault();
   closeDevTools(false);
   if (settings.dev) console.log('[beforequit] start');

   if (windowEvent && windowEvent.emit) {
      windowEvent.emit('QUIT');
      if (windowEvent.removeAllListeners) windowEvent.removeAllListeners();
   }

   setTimeout(() => {
      if (settings.dev) console.log('[beforequit] timeOut');
      //KTODO: Que sea con promesas, no con timeout
      setDefaultsDevOptions();
      setTimeout(() => {
         if (app && app.quit) {
            if (settings && settings.verbose) {
               if (Logger && Logger.log) Logger.log('bye!');
               if (settings.dev) console.log('[beforequit] bye!');
            }
            mainWindow = null;
            app.exit(0);
            return;
         } else {
            if (Logger) Logger.error('[beforequit] error: no app:', app);
         }
      }, 100);
   }, get(settings, 'here_are_dragons.delayBeforeQuit'));
}

function willquit(event) {
   beforequit(event);
}

if (process.on) {
   process.on('SIGINT', event => {
      beforequit(event);
   });
}

//_________________________________________
//SET PUBLIC
//_________________________________________

module.exports.init = init;
module.exports.popWin = popWin;
module.exports.popWinHard = popWinHard;
module.exports.unpopWin = unpopWin;
module.exports.togleWin = togleWin;
module.exports.centerWin = centerWin;
module.exports.winIsVisible = winIsVisible;
module.exports.winIsActive = winIsActive;
module.exports.openDevTools = openDevTools;
module.exports.refreshListWindow = refreshListWindow;
module.exports.closeDevTools = closeDevTools;
module.exports.clearDevTools = clearDevTools;
module.exports.relaunch = relaunch;
module.exports.focus = focus;
module.exports.isFocused = isFocused;
module.exports.isMaximized = isMaximized;
module.exports.setMaximized = setMaximized;
module.exports.setAlwaysOnTop = setAlwaysOnTop;
module.exports.isAlwaysOnTop = isAlwaysOnTop;
module.exports.quit = forceQuit;
