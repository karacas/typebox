'use strict';

const _ = require('lodash');
const electron = require('electron');
const { BrowserWindow, globalShortcut } = require('electron');
const app = electron.app;
const Menu = electron.Menu;
const Tray = electron.Tray;
const __dirnameRoot = app.getAppPath();
const logger = require('./main_logger.js');
const EventEmitter = require('events');
const idleTime = require('./idletime.js');
const realClock = require('./real_clock.js');
const data_io = require('./data_io.js');
const isElevated = require('is-elevated');

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
let currentShortcut = null;
let oldWin = null;
let shouldQuit;

const size_threshold = 4;
let delay2show = 1200;
let elevated = null;
let pop_unpopThrottle = () => {};
let closeOnQuit = true;

function init() {
    if (initiated || !app) {
        return;
    }

    if (!global.sharedObj) {
        logger.log('No global.sharedObj', global.sharedObj);
        return;
    }

    settings = global.sharedObj.settings_manager.getSettings();
    delay2show = settings.here_are_dragons.delay2show;

    pop_unpopThrottle = _.throttle(pop_unpop, _.result(settings, 'here_are_dragons.throttleTime_pop_unpop') || 240, { trailing: false });

    setShares();
    realClock.init(_.result(settings, 'here_are_dragons.realClockOptions'), _.result(settings, 'here_are_dragons.realClockEnabled'));
    registerSystray();
    registerWindow();
    singleInstance();

    app.on('before-quit', beforequit);

    if (app.dock && !settings.visibleInTaskBar) {
        app.dock.hide();
    }

    initiated = true;

    isElevated().then(ele => {
        elevated = ele;
        if (settings && settings.here_are_dragons && settings.here_are_dragons.report) {
            settings.here_are_dragons.report.isElevated = elevated;
        }
    });

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
    let $global = global.sharedObj;
    $global.electron_app = app;
    $global.app_window_and_systray.unpopWin = unpopWin;
    $global.app_window_and_systray.popWin = popWin;
    $global.app_window_and_systray.setWindowSize = setWindowSize;
    $global.app_window_and_systray.setMaxSize = setMaxSize;
    $global.app_window_and_systray.openDevTools = openDevTools;
    $global.app_window_and_systray.refreshListWindow = refreshListWindow;
    $global.app_window_and_systray.quit = forceQuit;
    $global.app_window_and_systray.centerWin = centerWin;
    $global.app_window_and_systray.isElevated = () => {
        return elevated;
    };
    $global.idleTime = idleTime;
    $global.realClock = realClock;
    idleTime.init(windowEvent);

    //KTODO: No es mejor que los files tomen los settings de acá?
    $global.settings = settings;
    $global.app_window_and_systray.windowEvent = windowEvent;
}

function registerWindow() {
    if (settings.here_are_dragons.startOpen || _.result(settings, 'here_are_dragons.debug.noUnpopWin')) {
        settings.here_are_dragons.electron_windows_list_options.show = true;
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
        settings.here_are_dragons.delay2show = 160;
    }

    if (settings.verbose) {
        logger.log('Win list created');
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

    windowEvent.emit('REFRESH_WIN');
    closeOnQuit = false;

    unpopWin();
    mainWindow.closeDevTools();
    oldWin = mainWindow;

    win_user_X = -1;
    win_user_Y = -1;
    firstPos = false;

    setTimeout(() => {
        settings = global.sharedObj.settings_manager.getSettings();

        if (settings.here_are_dragons.startOpen || _.result(settings, 'here_are_dragons.debug.noUnpopWin')) {
            settings.here_are_dragons.electron_windows_list_options.show = true;
        }

        mainWindow = new BrowserWindow(settings.here_are_dragons.electron_windows_list_options);
        windowEvent = new EventEmitter();
        idleTime.init(windowEvent);
        mainWindow.webContents.loadURL('file://' + __dirname + '/list_view.html');

        setShares();
        handleWindow();

        if (oldWin && oldWin.close) oldWin.close();
        if (settings.dev && settings.here_are_dragons.chromiumConsole) openDevTools();

        setTimeout(registerMainShortcut);

        if (settings.here_are_dragons.startOpen || _.result(settings, 'here_are_dragons.debug.noUnpopWin')) {
            setTimeout(popWin, delay2show);
        }

        closeOnQuit = true;
    }, 100);
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
        globalShortcut.register(currentShortcut, () => {
            popWin();
        });
    }
}

function handleWindow() {
    if (!mainWindow) {
        return;
    }

    if (settings.here_are_dragons.search_box_main_window.hideOnBlur) {
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

    mainWindow.on('close', (path, dif) => {
        if (!closeOnQuit) return;
        forceQuit();
    });

    registerMainShortcut();
}

function registerSystray() {
    if (!settings.here_are_dragons.systray) {
        return;
    }

    let trayIconFile = '/assets/icons/systray.png';

    if (settings.dev) {
        trayIconFile = '/assets/icons/systray_dev.png';
    }

    if (process.platform === 'darwin') {
        trayIconFile = '/assets/icons/systray_pleno_18_white.png';
    }

    if (process.platform === 'linux' || process.platform === 'freebsd' || process.platform === 'sunos') {
        trayIconFile = '/assets/icons/systray_pleno_16_black.png';
    }

    trayIcon = new Tray(__dirname + trayIconFile);

    let contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open [' + settings.mainShortcut + ']',
            click: () => {
                popWin();
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'About',
            click: () => {}
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

    trayIcon.setToolTip('typebox' + ' v' + app.getVersion());
    trayIcon.setContextMenu(contextMenu);
    trayIcon.on('click', togleWin);

    if (settings.verbose) {
        logger.log('Systray created');
    }
}

function popWin() {
    pop_unpopThrottle(true);
}

function unpopWin() {
    pop_unpopThrottle(false);
}

function togleWin() {
    if (mainWindow.isVisible()) {
        unpopWin();
    } else {
        popWin();
    }
}

function pop_unpop(pop) {
    if (!mainWindow || !app) return;

    if (pop) {
        //OPEN
        if (!mainWindow.isVisible() || !mainWindow.isFocused() || mainWindow.isMinimized()) {
            setTimeout(() => {
                windowEvent.emit('SHOW');
            }, 0);
        }

        if (!settings.visibleInTaskBar) {
            if (app && app.show) app.show();
        }

        if (mainWindow.isMinimized() && mainWindow.restore) mainWindow.restore();

        mainWindow.show();

        if (!mainWindow.isFocused()) {
            mainWindow.focus();
        }
    } else {
        //CLOSE
        if (_.result(settings, 'here_are_dragons.debug.noUnpopWin')) return;

        if (mainWindow.isVisible() || mainWindow.isFocused() || !mainWindow.isMinimized()) {
            setTimeout(() => {
                windowEvent.emit('HIDE');
            }, 0);
        }

        if (mainWindow.isFocused()) {
            mainWindow.blur();
        }

        if (!settings.visibleInTaskBar) {
            mainWindow.hide();
            if (app && app.hide) app.hide();
        } else {
            mainWindow.minimize();
        }
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
        return { w, h };
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

let handleResize_lastW = 0;
let handleResize_lastH = 0;

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
        logger.error(e);
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
    try {
        shouldQuit = app.makeSingleInstance((commandLine, workingDirectory) => {
            if (mainWindow) {
                if (commandLine.join(' ').includes('electron') && !settings.dev) {
                    return;
                }
                if (settings.verbose) {
                    logger.log('Another instance create, i quit.', commandLine, workingDirectory);
                }
                forceQuit();
            }
        });
        if (shouldQuit) {
            if (settings.verbose) {
                logger.log('Another instance create, i pop.');
            }
            setTimeout(() => {
                popWin();
                registerMainShortcut();
            }, settings.here_are_dragons.delayBeforeQuit * 2);
            return;
        }
    } catch (e) {
        logger.warn(e);
    }
}

function closeWindowAndSystray() {
    if (trayIcon && trayIcon.destroy) {
        try {
            trayIcon.destroy();
        } catch (e) {}
    }
    if (mainWindow && mainWindow.close) {
        try {
            mainWindow.close();
        } catch (e) {}
    }
}

function forceQuit() {
    if (trayIcon && trayIcon.destroy) {
        try {
            trayIcon.destroy();
        } catch (e) {}
    }
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
                logger.log('Exit');
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
