'use strict';

const app = require('electron').app;
const appName = app.getName();
const path = require('path');
const os = require('os');
const ostype = process.platform;
const appnamedir = 'typebox';

let __dirNameRoot = String(path.normalize(app.getAppPath()));

if (__dirNameRoot.includes('resources')) {
    __dirNameRoot = __dirNameRoot.slice(0, __dirNameRoot.indexOf('resources'));
}

if (__dirNameRoot.includes('node_modules')) {
    __dirNameRoot = __dirNameRoot.slice(0, __dirNameRoot.indexOf('node_modules'));
}

//PROD PATHS
//kTODO: app.getPath('userData')
if (!Boolean(require('electron-is-dev'))) {
    if (ostype === 'linux' || ostype === 'freebsd' || ostype === 'sunos') {
        __dirNameRoot = path.resolve(app.getPath('home'), '.config/' + appnamedir);
    }
    if (ostype === 'win32') {
        __dirNameRoot = path.resolve(app.getPath('home'), 'AppData/Roaming/' + appnamedir);
    }
    if (ostype === 'darwin') {
        __dirNameRoot = path.resolve(app.getPath('home'), 'Library/Application Support/' + appnamedir);
    }
}

// __dirNameRoot = "d:/tmp/"
__dirNameRoot = path.normalize(__dirNameRoot).replace(/\\/g, '/');

const __dirNameData = path.normalize(__dirNameRoot + '/_data/').replace(/\\/g, '/');

//KTODO: TEST 4 MAC / WIN/LNX OK
//KTODO: Cambiar el name de %TERMNAME% por %HOSTNAME%
let terminalName = String(os.hostname()).replace(/[^a-z0-9]/gi, '_').toLowerCase();

let settings = {
    mainShortcut: 'CmdOrCtrl+alt+space',
    animations: false,
    notifications: true,
    toolTips: true,
    ignoreThesePackages: [],
    ignoreTheseRules: [],
    packages: [],
    overwriteDefaultFileAssociations: [],
    defaultTerminalApp: ['cmd', '-/K'],
    width: 960,
    maxItemsVisible: 8,
    visibleInTaskBar: false,
    theme: {
        name: 'default',
        subTheme: '',
        cssOverWrite: ''
    },
    font: 'Roboto-Light',
    icons: true,
    here_are_dragons: {
        bindKeys: [
            { keys: ['esc'], action: 'ESCAPE', level: 'main' },
            { keys: ['enter', 'tab'], action: 'ENTER', level: 'main' },
            { keys: ['backspace'], action: 'BACKESCPACE', level: 'main' },
            { keys: ['mod+backspace', 'shift+backspace'], action: 'GOTO_ROOT', level: 'main' },
            { keys: ['mod+enter'], action: 'CONTEXT_MENU', level: 'main' },
            { keys: ['shift+esc', 'mod+esc'], action: 'CLOSE_WIN', level: 'main' },
            { keys: ['mod+c', 'mod+shift+c'], action: 'COPY_STRING', level: 'main' },
            { keys: ['mod+alt+shift+c'], action: 'DEV_COPY_RULE', level: 'main' },
            { keys: ['mod+v'], action: 'PASTE_TO_SEARCH', level: 'main' },
            { keys: ['alt+down'], action: 'HISTORY', level: 'main' },
            { keys: ['mod+shift+f'], action: 'FAVS', level: 'main' },
            { keys: ['mod+del'], action: 'RESET_SCORE', level: 'main' },
            { keys: ['mod+t'], action: 'OPEN_IN_TERMINAL', level: 'main' },
            { keys: ['mod+shift+h'], action: 'TOGGLE_HIDDEN', level: 'main' },
            { keys: ['mod+f'], action: 'TOGGLE_FAVORITE', level: 'main' }
        ],
        themeDefaultSubThemes: ['default', 'atom', 'cream', 'big', 'small'],
        os: null,
        idleTime: 30 * 1000,
        updateAllPackagesInterval: 6 * 60 * 60 * 1000,
        dateFormat: 'DD-MM-YY, hh:mm',
        disableKeysOnSearchBox: ['up', 'down', 'pageup', 'pagedown', 'home', 'end', 'mod+alt+shift+c'],
        verboseTimes: true,
        notificationsErrors: true,
        setKeyboardDelay: 15,
        setDefaultDelay: 5,
        initOffsetY: -100,
        delayBeforeQuit: 960,
        delay2show: 1200,
        minY: 100,
        chromiumConsole: true,
        chromiumConsoleOptions: { mode: 'detach' },
        systray: true,
        startOpen: true,
        initEmpty: false,
        launcherCache: true,
        deleteSearchOnFire: false,
        gotoRootOnExec: true,
        unpopAfterCopy: true,
        showRuleScore: false,
        gotoRootOnShow: false,
        rulesViewer: true,
        debounceTime_actionsKeys: 24,
        debounceTime_searchKeys: 80,
        debounceTime_viewer: 480,
        throttleTime_moveList: 0,
        debounceTime_resize_win: 240,
        throttleTime_pop_unpop: 240,
        loadPackages: true,
        loadPackagesDev: true,
        deletePackages: true,
        installPackages: true,
        reloadOnPackagesSteeingChange: true,
        packagesTryNewVersionOnNoValid: true,
        historyBackups: true,
        markNewRules: true,
        markNewRulesMaxItemsInPathToAvoid: 10000,
        markNewRulesTimeToSetPathOld: 10000,
        markNewRulesTimeOld: 60 * 60 * 1000,
        maxKeysInHistory: 10,
        maxItemsInHistory: 320,
        favBackups: true,
        lastBackups: true,
        launcherCacheBackups: false,
        maxFavsRules: 320,
        maxLastRules: 320,
        maxHiddenRules: 320,
        checkPackagesSyntax: true,
        delayToRemoveLoader: 560,
        packagesRepo: 'https://registry.npmjs.org/{{packname}}',
        setAndSaveSettings_enabled: true,
        internal_packages: [
            'internal_pack_internal',
            'internal_pack_aux_dev',
            'internal_pack_options',
            'internal_pack_commands',
            'internal_pack_package_manager',
            'internal_pack_favorites',
            'internal_pack_last_rules',
            'internal_pack_hidden_rules',
            'internal_pack_paths',
            'internal_pack_calc',
            'internal_pack_launcher'
        ],
        defaultExecForTypes: {
            string: 'internal_pack_place_string',
            string_copy: 'internal_pack_copy_text'
        },
        debug: {
            testPackage: 'internal_pack_test',
            no_executeAction: false,
            showRuleScore: true,
            makeDummyRules: 0,
            noUnpopWin: false
        },
        logger: { verboseForceFile: false, level: 'info', maxSize: 1024 * 1024 },
        addTermNametoPaths: true,
        terminalName: terminalName,
        paths: {
            //KTODO Que se creen los paths automaticamente
            //Hacer la sumatoria de paths en los JSs asi se puede dinamizar el valor de rootDataStored
            root: __dirNameRoot,
            rootDataStored: __dirNameData,
            //
            packages: __dirNameData + 'packages/',
            packages_dev: __dirNameData + 'packages_dev/',
            packages_updates: __dirNameData + 'packages_tmp_updates/',
            caches: __dirNameData + 'caches/',
            tmp: __dirNameData + 'tmp/',
            rules: __dirNameData + 'rules/',
            user: __dirNameData + 'user/',
            user_rules: __dirNameData + 'user_rules/',
            historypath: __dirNameData + 'history/',
            favpath: __dirNameData + 'favorites/',
            newspath: __dirNameData + 'news/',
            lastpath: __dirNameData + 'lastrules/',
            logpath: __dirNameData + 'log/',
            hidden_path: __dirNameData + 'hidden/',
            //
            user_packagesSettingsName: '_user_settings.json',
            userSettingsFile: 'user_settings.json',
            //
            hiddenRulesfile: 'hidden_rules.json',
            logfile: 'log%TERMNAME%.log',
            historyfile: 'history%TERMNAME%',
            favfile: 'favorites%TERMNAME%',
            newsfile: 'news%TERMNAME%',
            lastfile: 'lastrules%TERMNAME%',
            launcherCachefile: 'launcher%TERMNAME%'
        },
        language: {
            changeSettings: 'Refresh settings 1'
        },
        search_box_main_window: { hideOnBlur: true },
        realClockEnabled: true,
        realClockOptions: {
            host: 'pool.ntp.org',
            host: 'time.google.com',
            port: 123,
            resolveReference: true,
            timeout: 10000
        },
        electron_windows_list_options: {
            height: 140,
            frame: false,
            minimizable: false,
            maximizable: false,
            closable: true,
            fullscreen: false,
            fullscreenable: false,
            skipTaskbar: true,
            resizable: true,
            backgroundColor: '#293039',
            show: false,
            minWidth: 580,
            minHeight: 90
        },
        report: { appName: appName, __dirNameRoot: __dirNameRoot }
    }
};

//KTODO: Replacer especific settings for win.lnx

//KRC DEV OPTIONS
if (true && (terminalName === 'prystore2' || terminalName === 'der2')) {
    // settings.defaultTerminalApp = ['PowerShell', '-noexit', '-command'];
    settings.overwriteDefaultFileAssociations = [
        {
            app: '%KSUBLIME%',
            extensions: ['js', 'jsx', 'json', 'html', 'htm', 'php', 'css', 'styl', 'log', 'txt', 'config']
        }
    ];
    settings.here_are_dragons.realClockEnabled = true;
}

module.exports.settings = settings;
