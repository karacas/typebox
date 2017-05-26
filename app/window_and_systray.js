'use strict';

const _ = require('lodash');
const electron = require('electron');
const { BrowserWindow, globalShortcut } = require('electron');
const app = electron.app;
const Menu = electron.Menu;
const Tray = electron.Tray;
const __dirnameRoot = app.getAppPath();
const EventEmitter = require('events');
const idleTime = require('./idletime.js');
const realClock = require('./real_clock.js');
const data_io = require('./data_io.js');

var initiated = false;
var settings = null;
var mainWindow = null;
var trayIcon = null;
var win_user_X = -1;
var win_user_Y = -1;
var win_max_size = -1;
var firstPos = false;
var windowEvent = new EventEmitter();
var lastShortcut = null;
var currentShortcut = null;
var oldWin = null;
var shouldQuit;

const size_threshold = 4;
var delay2show = 1200;

function init() {
    if (initiated || !app) {
        return;
    }

    if (!global.sharedObj) {
        console.log('No global.sharedObj', global.sharedObj);
        return;
    }

    settings = global.sharedObj.settings_manager.getSettings();
    delay2show = settings.here_are_dragons.delay2show;

    setShares();
    realClock.init(_.result(settings, 'here_are_dragons.realClockOptions'), _.result(settings, 'here_are_dragons.realClockEnabled'));
    registerSystray();
    registerWindow();
    singleInstance();

    app.on('before-quit', beforequit);

    if (app.dock) {
        app.dock.hide();
    }

    initiated = true;

    //ON CHANGE SETTINGS
    global.sharedObj.settings_manager.getChangeSettingsEvent().on('change', (path, dif) => {
        settings = global.sharedObj.settings_manager.getSettings();

        let refreshIn_here_are_dragons = true;
        let emit = true;
        let toast = true;

        if (
            path === 'here_are_dragons' ||
            path === 'here_are_dragons.electron_windows_list_options' ||
            path === 'here_are_dragons.electron_windows_list_options.width'
        ) {
            return;
        }

        if (path == 'mainShortcut') {
            refreshIn_here_are_dragons = false;
            registerMainShortcut();
        }

        if (path.includes('maxItemsVisible') || path === 'width') {
            refreshIn_here_are_dragons = false;
            toast = false;
        }

        if (path === 'icons') {
            refreshListWindow();
        }

        if (path.includes('here_are_dragons.') && refreshIn_here_are_dragons) {
            refreshListWindow();
        }

        //KTODO:Hacer un modulo que maneje lang
        if (toast) global.sharedObj.toaster.notify('TEST:' + settings.here_are_dragons.language.changeSettings);

        if (emit) windowEvent.emit('changeSettings', path, dif);
    });
}

function setShares() {
    //KTODO: Hacer módulo aparte
    var $global = global.sharedObj;
    $global.electron_app = app;
    $global.app_window_and_systray.unpopWin = unpopWin;
    $global.app_window_and_systray.popWin = popWin;
    $global.app_window_and_systray.setWindowSize = setWindowSize;
    $global.app_window_and_systray.setMaxSize = setMaxSize;
    $global.app_window_and_systray.openDevTools = openDevTools;
    $global.app_window_and_systray.refreshListWindow = refreshListWindow;
    $global.app_window_and_systray.quit = forceQuit;
    $global.app_window_and_systray.centerWin = centerWin;
    $global.idleTime = idleTime;
    $global.realClock = realClock;
    idleTime.init(windowEvent);

    //KTODO: No es mejor que los files tomen los settings de acá?
    $global.settings = settings;
    $global.app_window_and_systray.windowEvent = windowEvent;
}

function registerWindow() {
    if (settings.here_are_dragons.startOpen || _.result(settings, 'here_are_dragons.debug.noUnpopWin')) {
        // settings.here_are_dragons.electron_windows_list_options.show = true
    }

    mainWindow = new BrowserWindow(settings.here_are_dragons.electron_windows_list_options);
    mainWindow.loadURL('file://' + __dirname + '/list_view.html');

    if (!settings.dev) {
        mainWindow.setMenu(null);
        mainWindow.setMenuBarVisibility(false);
        mainWindow.setAutoHideMenuBar(true);
    }

    if (settings.dev && settings.here_are_dragons.chromiumConsole) {
        openDevTools();
    } else {
        settings.here_are_dragons.delay2show = 100;
    }

    if (settings.verbose) {
        console.log('Win list created');
    }
    handleWindow();

    setTimeout(() => {
        if (settings.here_are_dragons.startOpen || _.result(settings, 'here_are_dragons.debug.noUnpopWin')) {
            popWin();
        }
    }, delay2show);
}

function openDevTools() {
    if (!mainWindow) {
        return;
    }
    mainWindow.webContents.openDevTools(_.result(settings, 'here_are_dragons.chromiumConsoleOptions'));
}

function refreshListWindow() {
    //KTODO: Vet si se puede usar: registerWindow

    if (!mainWindow) {
        return;
    }

    oldWin = mainWindow;

    mainWindow.closeDevTools();
    unpopWin();

    setTimeout(() => {
        win_user_X = -1;
        win_user_Y = -1;
        firstPos = false;

        settings = global.sharedObj.settings_manager.getSettings();

        if (settings.here_are_dragons.startOpen || _.result(settings, 'here_are_dragons.debug.noUnpopWin')) {
            // settings.here_are_dragons.electron_windows_list_options.show = true
        }

        //KTODO: percent width
        mainWindow = new BrowserWindow(settings.here_are_dragons.electron_windows_list_options);
        windowEvent = new EventEmitter();
        idleTime.init(windowEvent);

        setShares();
        handleWindow();

        mainWindow.webContents.loadURL('file://' + __dirname + '/list_view.html');

        if (settings.dev && settings.here_are_dragons.chromiumConsole) {
            openDevTools();
        }

        setTimeout(registerMainShortcut);

        if (oldWin && oldWin.close) {
            oldWin.close();
        }

        setTimeout(() => {
            if (settings.here_are_dragons.startOpen || _.result(settings, 'here_are_dragons.debug.noUnpopWin')) {
                popWin();
            }
        }, delay2show + 10);
    }, 10);
}

function registerMainShortcut() {
    //KTODO: Check if valid mainShortcut
    currentShortcut = settings.mainShortcut;

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

function handleWindow() {
    if (!mainWindow) {
        return;
    }

    if (settings.dev || settings.here_are_dragons.search_box_main_window.hideOnBlur) {
        mainWindow.on('blur', unpopWin);
    }

    mainWindow.on('move', userMove);

    let handleResizeDeb = _.debounce(handleResize, settings.here_are_dragons.debounceTime_resize_win || 500);
    mainWindow.on('resize', handleResizeDeb);

    windowEvent.on('changeSettings', (path, dif) => {
        if (path.includes('width')) {
            let actualWidth = Math.round(mainWindow.getSize()[0]);
            let widthInFile = Math.round(Number(_.result(settings, 'width')));
            if (Math.abs(actualWidth - widthInFile) > size_threshold) {
                setWindowSize(widthInFile, null);
            }
        }
    });

    registerMainShortcut();
}

function registerSystray() {
    if (!settings.here_are_dragons.systray) {
        return;
    }

    let trayIconFile = '/assets/icons/systray.png';

    if (process.platform === 'darwin') {
        trayIconFile = '/assets/icons/systray_pleno_18_white.png';
    }

    if (process.platform === 'linux' || process.platform === 'freebsd' || process.platform === 'sunos') {
        trayIconFile = '/assets/icons/systray_pleno_16_black.png';
    }

    trayIcon = new Tray(__dirname + trayIconFile);

    var contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open [' + settings.mainShortcut + ']',
            click: popWin
        },
        {
            type: 'separator'
        },
        {
            label: 'About',
            click: function() {}
        },
        {
            label: 'Refresh Rules',
            click: function() {
                refreshListWindow();
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Quit',
            click: function() {
                forceQuit();
            }
        }
    ]);

    trayIcon.setToolTip('Typebox');
    trayIcon.setContextMenu(contextMenu);
    trayIcon.on('click', togleWin);

    if (settings.verbose) {
        console.log('Systray created');
    }
}

function popWin(upKeys) {
    if (!mainWindow) {
        return;
    }

    let isvisible = true;

    if (!mainWindow.isVisible()) {
        isvisible = false;
        if (app && app.show) {
            app.show();
        }
        mainWindow.show();
    }

    if (mainWindow.isMinimized()) {
        isvisible = false;
        if (mainWindow.restore) {
            mainWindow.restore();
        }
    }

    if (!mainWindow.isFocused()) {
        isvisible = false;
        mainWindow.focus();
    }

    if (!isvisible) {
        windowEvent.emit('SHOW');
    }
}

function unpopWin() {
    //KTODO: Si sale con esc que no haga focus en la app anterior
    if (!mainWindow || _.result(settings, 'here_are_dragons.debug.noUnpopWin')) {
        return;
    }

    let isvisible = false;

    if (mainWindow.isFocused()) {
        isvisible = true;
        mainWindow.blur();
    }

    if (mainWindow.isVisible()) {
        isvisible = true;
        if (app && app.hide) {
            app.hide();
        }
        mainWindow.hide();
    }

    if (isvisible) {
        windowEvent.emit('HIDE');
    }
}

function togleWin() {
    if (!mainWindow) {
        return;
    }
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
        unpopWin();
    } else {
        popWin();
    }
}

function centerWin(force = false) {
    if (!mainWindow) {
        return;
    }

    if (win_user_X !== -1 && win_user_Y !== -1 && !force) {
        mainWindow.setPosition(Math.round(win_user_X), Math.round(win_user_Y));
        return;
    }

    mainWindow.center();

    setTimeout(() => {
        let setY = mainWindow.getPosition()[1];

        let deltaHeight = Math.round((win_max_size - Math.round(mainWindow.getSize()[1])) * 0.5);
        if (deltaHeight < size_threshold) deltaHeight = 0;
        setY -= deltaHeight;

        if (!settings.here_are_dragons.startOpen) {
            setY += settings.here_are_dragons.initOffsetY;
        }

        if (setY < settings.here_are_dragons.minY) {
            setY = settings.here_are_dragons.minY;
        }

        if (Math.abs(setY - mainWindow.getPosition()[1]) > size_threshold) {
            mainWindow.setPosition(Math.round(mainWindow.getPosition()[0]), Math.round(setY));
        }
    }, 1);

    firstPos = true;
}

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
}

function getValidSizes(w, h) {
    if (!mainWindow || !electron.screen) {
        return {
            w,
            h
        };
    }
    try {
        let maxW = electron.screen.getPrimaryDisplay().workAreaSize.width;
        let maxH = electron.screen.getPrimaryDisplay().workAreaSize.height;

        let minW = settings.here_are_dragons.electron_windows_list_options.minWidth;
        let minH = settings.here_are_dragons.electron_windows_list_options.minHeight;

        let newW = w;
        let newH = h;

        minW = Math.round(Math.max(minW, maxW * 0.285));
        mainWindow.setMinimumSize(minW, minH);

        if (newW < minW) newW = minW;
        if (newH < minH) newH = minH;

        return {
            w: newW,
            h: newH
        };
    } catch (e) {
        return {
            w,
            h
        };
    }
}

var handleResize_lastW = 0;
var handleResize_lastH = 0;

function handleResize(e) {
    if (!mainWindow) return null;
    try {
        let w = Math.round(mainWindow.getSize()[0]);
        let h = Math.round(mainWindow.getSize()[1]);

        let validSizes = getValidSizes(w, h);

        let newW = Math.round(validSizes.w);
        let newH = Math.round(validSizes.h);

        if (Math.abs(newW - handleResize_lastW) > size_threshold || Math.abs(newH - handleResize_lastH) > size_threshold) {
            windowEvent.emit('RESIZE', {
                width: newW,
                height: newH
            });
        } else {
            return;
        }

        let widthInFile = Math.round(Number(_.result(settings, 'width')));
        if (Math.abs(newW - widthInFile) > size_threshold) {
            data_io.dataManager.setAndSaveSettings('userSettings', {
                width: newW
            });
        }

        setWindowSize(newW, newH);
    } catch (e) {
        return null;
    }
}

function setWindowSize(width, height) {
    if (!mainWindow) {
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

        if (newW === w && newH === h) return;

        handleResize_lastW = newW;
        handleResize_lastH = newH;

        mainWindow.setSize(newW, newH);
    } catch (e) {
        console.error(e);
    }
}

function winIsVisible() {
    return mainWindow.isVisible;
}

//_________________________________________
// EXIT & QUIT
//_________________________________________

function singleInstance() {
    //ANOTHER ISNTANCE
    shouldQuit = app.makeSingleInstance((commandLine, workingDirectory) => {
        if (mainWindow) {
            if (settings.verbose) {
                console.log('Another instance create, i quit');
            }
            forceQuit();
        }
    });
    if (shouldQuit) {
        if (settings.verbose) {
            console.log('Another instance create, i pop');
        }
        setTimeout(() => {
            popWin();
            singleInstance();
            registerMainShortcut();
        }, settings.here_are_dragons.delayBeforeQuit * 2);
        return;
    }
}

function closeWindowAndSystray() {
    if (mainWindow && mainWindow.close) {
        try {
            mainWindow.close();
        } catch (e) {}
    }
    if (trayIcon && trayIcon.destroy) {
        try {
            trayIcon.destroy();
        } catch (e) {}
    }
}

function forceQuit() {
    if (app && app.quit) {
        try {
            app.quit();
        } catch (e) {}
    }
    setTimeout(closeWindowAndSystray, settings.here_are_dragons.delayBeforeQuit / 10);
}

function beforequit(event) {
    event.preventDefault();
    if (windowEvent && windowEvent.emit) {
        windowEvent.emit('QUIT');
    }
    setTimeout(() => {
        if (app && app.exit) {
            if (settings.verbose) {
                console.log('Exit');
            }
            app.exit(0);
        }
    }, settings.here_are_dragons.delayBeforeQuit);
}

//_________________________________________
//SET PUBLIC
//_________________________________________

module.exports.init = init;
module.exports.popWin = popWin;
module.exports.unpopWin = unpopWin;
module.exports.togleWin = togleWin;
module.exports.centerWin = centerWin;
module.exports.winIsVisible = winIsVisible;
module.exports.openDevTools = openDevTools;
module.exports.refreshListWindow = refreshListWindow;
