'use strict';

const { app, systemPreferences } = require('electron');
const { is } = require('electron-util');
const ms = require('ms');
const appName = 'typebox';
const path = require('path');
const fs = require('fs');
const os = require('os');
const ostype = process.platform;
const appnamedir = 'typebox';
const userHome = String(path.normalize(require('user-home'))).replace(/\\/g, '/');
const { aux_getDirName, normalicePath } = require('@aux/aux_global.js');
const isRunningInAsar = is.usingAsar;
const electronIsDev = is.development;

let __dirNameRoot = aux_getDirName(app.getAppPath());

const tmpDefaultTerminaltermGnome = ['gnome-terminal'];

//PROD PATHS
//kTODO: app.getPath('userData')
if (!electronIsDev) {
   if (ostype === 'linux' || ostype === 'freebsd' || ostype === 'sunos') {
      __dirNameRoot = path.resolve(app.getPath('home'), `.config/${appnamedir}`);
   }
   if (ostype === 'win32') {
      __dirNameRoot = path.resolve(app.getPath('home'), `AppData/Roaming/${appnamedir}`);
   }
   if (ostype === 'darwin') {
      __dirNameRoot = path.resolve(app.getPath('home'), `Library/Application Support/${appnamedir}`);
   }
}

// __dirNameRoot = "d:/tmp/"
__dirNameRoot = path.normalize(__dirNameRoot).replace(/\\/g, '/');

const __dirNameData = path.normalize(`${__dirNameRoot}/_data/`).replace(/\\/g, '/');

//KTODO: TEST 4 MAC / WIN/LNX OK
//KTODO: Cambiar el name de %TERMNAME% por %HOSTNAME%
//KTODO: PASAR A UN AUX
let terminalName = '_null';
try {
   terminalName = String(os.hostname())
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
} catch (e) {
   console.error('[default_config] no terminalName', e);
}

let settings = {
   mainShortcut: 'alt+space',
   mainShortcut_PopAndFav: 'super+alt+up',
   mainShortcut_PopAndLast: 'super+alt+down',
   mainShortcut_StopKeyListener: 'super+alt+ctrl+0',
   mainShortcut_StartKeyListener: 'super+alt+ctrl+1',
   animations: false,
   notifications: true,
   fixedTypeBoxOptions: true,
   toolTips: true,
   ignoreThesePackages: [],
   ignoreTheseRules: [],
   packages: [],
   overwriteDefaultFileAssociations: [],
   defaultTerminalApp: ['cmd', '-/K'],
   width: 960,
   maxItemsVisible: 8,
   visibleInTaskBar: false,
   autoupdateAllPackages: true,
   theme: {
      name: 'default',
      subTheme: '',
      cssOverWrite: '',
   },
   font: 'default' /*KTODO: Lo mismo para mono*/,
   icons: true,
   statusPersist: true,
   avoidResizeHeigth: false,
   tests: null,
   advancedContextuals: false,
   here_are_dragons: {
      bindKeys: [
         { keys: ['esc'], action: 'ESCAPE', level: 'main' },
         { keys: ['enter'], action: 'ENTER', level: 'main' },
         { keys: ['tab'], action: 'ENTER_LEVEL', level: 'main' },
         { keys: ['backspace'], action: 'BACKESCPACE', level: 'main' },
         { keys: ['mod+enter', 'alt+enter'], action: 'CONTEXT_MENU', level: 'main' },
         { keys: ['mod+alt+left', 'shift+esc', 'mod+esc', 'alt+esc'], action: 'CLOSE_WIN', level: 'main' },
         { keys: ['shift+mod+backspace'], action: 'GO_BACK', level: 'main' },
         { keys: ['mod+left', 'shift+backspace', 'alt+backspace', 'mod+backspace'], action: 'CLEAR_QUERY', level: 'main' },
         { keys: ['mod+shift+left'], action: 'GO_BACK_HIST', level: 'main' },
         { keys: ['mod+shift+right'], action: 'GO_FORWARD_HIST', level: 'main' },
         /**/
         { keys: ['mod+c', 'mod+shift+c'], action: 'COPY_STRING', level: 'main' },
         { keys: ['mod+v'], action: 'PASTE_TO_SEARCH', level: 'main' },
         { keys: ['mod+l'], action: 'REFOCUS__SEARCH', level: 'main' },
         /**/
         { keys: ['f2', 'alt+right'], action: 'RESET_SIZE', level: 'main' },
         { keys: ['alt+down'], action: 'HISTORY', level: 'main' },
         { keys: ['alt+up'], action: 'FAVS', level: 'main' },
         { keys: ['alt+left'], action: 'GOTO_ROOT', level: 'main' },
         /**/
         { keys: ['mod+shift+del'], action: 'RESET_SCORE', level: 'main' },
         { keys: ['mod+u'], action: 'SCORE_UP', level: 'main' },
         /**/
         { keys: ['mod+d'], action: 'FOLDER_FAVS', level: 'main' },
         { keys: ['mod+t'], action: 'OPEN_IN_TERMINAL', level: 'main' },
         { keys: ['mod+shift+h'], action: 'TOGGLE_HIDDEN', level: 'main' },
         { keys: ['mod+f'], action: 'TOGGLE_FAVORITE', level: 'main' },
         /**/
         { keys: ['shift+down'], action: 'SCROLL_DOWN_WEBVIEW', level: 'filter' },
         { keys: ['shift+up'], action: 'SCROLL_UP_WEBVIEW', level: 'filter' },
         { keys: ['shift+left'], action: 'SCROLL_LEFT_WEBVIEW', level: 'filter' },
         { keys: ['shift+right'], action: 'SCROLL_RIGHT_WEBVIEW', level: 'filter' },
         /**/
         { keys: ['mod+shift+j'], action: 'OPEN_DEV_TOOLS', level: 'commands' },
         { keys: ['mod+shift+s'], action: 'SAVE_ALL_DATA', level: 'commands' },
         { keys: ['mod+shift+q'], action: 'QUIT_APP', level: 'commands' },
         { keys: ['mod+shift+t'], action: 'TOGGLE_SCORE', level: 'commands' },
         { keys: ['f3'], action: 'TOGGLE_COLOR_MODE', level: 'commands' },
         { keys: ['f9'], action: 'TOGGLE_ALWAYS_ON_TOP', level: 'commands' },
         { keys: ['f10'], action: 'TOGGLE_MRDOOB_STATS', level: 'commands' },
         { keys: ['f11', 'mod+shift+f'], action: 'TOGGLE_FULL_SCREEN', level: 'commands' },
      ],
      logBindKeys: false,
      canChangeThemeDarkLight: true,
      canListenKeyboard: true,
      expander_autostart: true,
      expander_timeToCleanKeyBuffer: ms('5s'),
      expander_maxLengthAccelerator: 12,
      expander_minLengthAccelerator: 2,
      expander_keyCharEnd: '!',
      subpixelrender: true,
      alwaysOnTop: false,
      color_palette: [
         '#f0db4f',
         '#ffcd39',
         '#ff9547',
         '#ff6859',
         '#ff5a77',
         '#f06ac2',
         '#b46fff',
         '#6f77ff',
         '#4ec1f2',
         '#20efe7',
         '#48ea7b',
         '#34e8ae',
         '#49af96',
         '#eeffff',
         '#282c34',
         '#ffdb9e',
         '#dced6e',
         '#aaff92',
         '#92e5ff',
         '#e5b4ff',
      ],
      os: null,
      testConfig: {
         testsPath: '@uitests/',
         reportPath: `${__dirNameRoot}/_report/tests.json`,
         reportPathPass: `${__dirNameRoot}/_report/pass_test.log`,
         reportMaxOlds: 512,
         quitOnFinish: false,
         summarize: false,
         printJsonReport: false,
         saveJsonReport: true,
         printReport: true,
         canRunTests: true,
         openDevTools: false,
         autoRunTests: false,
         toastOnFinish: true,
         keyDelayRobot: 18,
         keyDelay: 24,
         pause: 100,
         isTestSuite: false,
      },
      lazyIcons: false,
      sudoTerminal: false,
      sudoOpenFile: false,
      disableExecCommand: false,
      disableOpenFile: false,
      disableOpenTerminal: false,
      timeToFireIdle: ms('10s'),
      minCpuFree2fireIdleEvent: 65,
      updateAllPackagesInterval: ms('6h'),
      dateFormat: 'DD-MM-YY hh:mm',
      disableKeysOnSearchBox: ['up', 'down', 'pageup', 'pagedown', 'home', 'end', 'mod+alt+shift+c'],
      verboseTimes: false /*Print times to filter rules*/,
      notificationsErrors: true,
      notificationsCliboards: true,
      notificationsCliboardsTime: 1500,
      notificationsMaxTime: ms('3.5s'),
      __robotjs_setKeyboardDelay: 10 /*robotjs*/,
      robotjs_setKeyboardDelay: 2 /*robotjs*/,
      robotjs_setMouseDelay: 10 /*robotjs*/,
      placeTextDelay: 2 /*placeText*/,
      placeTextInternal: 'clipboard' /*placeText*/,
      initOffsetY: -60,
      delayBeforeQuit: 1240,
      delay2show: 16,
      minY: 100,
      doubleClickTime: 320,
      chromiumConsole: false,
      chromiumConsoleOptions: { mode: 'detach' },
      systray: true,
      safe_secure_commands: true,
      startOpen: true,
      initEmpty: false,
      launcherCache: true,
      deleteSearchOnFire: false,
      gotoRootOnExec: true,
      unpopAfterCopy: true,
      deleteOriginalArrayDataRules: true,
      rulesViewer: true,
      debounceTime_actionsKeys: 16,
      debounceTime_searchKeys: 16,
      debounceTime_viewer: 256,
      throttleTime_moveList: 16,
      debounceTime_resize_win: 128 * 2,
      throttleTime_pop_unpop: 128,
      unpopWinAndbackRootTime: 64,
      loadPackages: true,
      updatePackages: true,
      loadPackagesDev: true,
      deletePackages: true,
      installPackages: true,
      reloadOnAppChanges: true,
      reloadOnAppChangesTime: ms('0.5s'),
      setDevPos: true,
      reloadOnPackagesSteeingChange: true,
      packagesTryNewVersionOnNoValid: true,
      canRestartElevated: false,
      historyBackups: true,
      markNewRules: true,
      markNewRulesMaxItemsInPathToAvoid: 2000,
      markNewRulesTimeToSetPathOld: ms('10s'),
      markNewRulesTimeOld: ms('12h'),
      maxKeysInHistory: 8,
      maxItemsInHistory: 2048,
      favBackups: true,
      lastBackups: true,
      maxFavsRules: 2048,
      maxHiddenRules: 2048,
      maxLastRules: 128,
      maxLastRules_ephemeral: 32,
      checkPackagesSyntax: false,
      delayToRemoveLoader: 16,
      packagesRepo: 'https://registry.npmjs.org/{{packname}}',
      setAndSaveSettings_enabled: true,
      tray_console: true,
      tray_reload: true,
      clearCachesInerval: ms('5m'),
      breakPointSmallViewer: 480,
      breakPointBigViewer: 980,
      internal_packages: [
         'internal_pack_theme_manager',
         'internal_pack_package_manager',
         'internal_pack_internal',
         'internal_pack_notes',
         'internal_pack_file_viewers',
         'internal_pack_options',
         'internal_pack_launcher',
         'internal_pack_commands',
         'internal_pack_favorites',
         'internal_pack_last_rules',
         'internal_pack_hidden_rules',
         'internal_pack_paths',
         'internal_pack_calc',
         'internal_pack_back',
         'internal_pack_test',
         'internal_pack_aux_dev',
      ],
      defaultExecForTypes: {
         string: 'internal_pack_place_string',
         string_copy: 'internal_pack_copy_text',
      },
      debug: {
         no_executeAction: false,
         makeDummyRules: 0,
         canListenKeyboard: false,
      },
      logger: { level: 'info', console_level: 'info', file_level: 'info', maxSize: 1024 * 1024, cliLogger: false },
      exposeLogger: true,
      exposeConfig: true,
      exposeRobotUi: false,
      logger_changeToChild: true,
      printFirstSettings: false,
      addTermNametoPaths: true,
      terminalName: terminalName,
      enable_copy_item_to_clipboard: true,
      paths: {
         //KTODO Que se creen los paths automaticamente
         //Hacer la sumatoria de paths en los JSs asi se puede dinamizar el valor de rootDataStored
         root: __dirNameRoot,
         rootDataStored: __dirNameData,
         //
         packages: `${__dirNameData}packages/`,
         packages_dev: `${__dirNameData}packages_dev/`,
         packages_updates: `${__dirNameData}packages_tmp_updates/`,
         caches: `${__dirNameData}caches/`,
         caches_icons: `${__dirNameData}caches_icons/`,
         tmp: `${__dirNameData}tmp/`,
         rules: `${__dirNameData}rules/`,
         user: `${__dirNameData}user/`,
         app_status: `${__dirNameData}app_status/`,
         user_rules: `${__dirNameData}user_rules/`,
         app_flags: `${__dirNameData}app_flags/`,
         historypath: `${__dirNameData}history/`,
         favpath: `${__dirNameData}favorites/`,
         newspath: `${__dirNameData}news/`,
         lastpath: `${__dirNameData}lastrules/`,
         logpath: `${__dirNameData}log/`,
         hidden_path: `${__dirNameData}hidden/`,
         //
         user_packagesSettingsName: '_user_settings.json',
         userSettingsFile: 'user_settings.json',
         statusFile: 'last_status.json',
         //
         logfile: 'log%TERMNAME%.log',
         hiddenRulesfile: 'hidden_rules%TERMNAME%',
         historyfile: 'history%TERMNAME%',
         favfile: 'favorites%TERMNAME%',
         newsfile: 'news%TERMNAME%',
         lastfile: 'lastrules%TERMNAME%',
         launcherCachefile: 'launcher%TERMNAME%',
         flagFreshInstall: 'flagFreshInstall%TERMNAME%',
         userHome: userHome,
      },
      language: {
         changeSettings: 'Refresh typebox settings',
      },
      hideOnBlur: true,
      realClockEnabled: true,
      realClockOptions: {
         host: 'pool.ntp.org', // Defaults to pool.ntp.org
         port: 123, // Defaults to 123 (NTP)
         resolveReference: true, // Default to false (not resolving)
         timeout: 5000, // Defaults to zero (no timeout)
      },
      electron_windows_list_options: {
         title: appnamedir,
         height: 140,
         minimizable: false,
         maximizable: true,
         closable: false,
         fullscreen: false,
         fullscreenable: false,
         skipTaskbar: true,
         resizable: true,
         minWidth: 580,
         minHeight: 90,
         enableRemoteModule: true,
         acceptFirstMouse: true,
         // disableAutoHideCursor: true,
         autoHideMenuBar: true,
         enableLargerThanScreen: false,
         offscreen: false,
         frame: false,
         transparent: true,
         backgroundColor: '#282c34',
         hasShadow: false,
         // vibrancy: 'light',
         titleBarStyle: 'hidden',
         center: true,
         // useContentSize: true,
         /*KTODO QUE SEA FORZADO*/
      },
      codeMirrorEditor: {
         autoCursor: true,
         autoScroll: true,
         dragDrop: false,
         lineWrapping: false,
         lineNumbers: false,
         spellcheck: false,
         autocorrect: false,
         autocapitalize: false,
         emmet: true,
         keyMap: 'sublime',
      },
      loadJSX: electronIsDev,
      report: { appName, __dirNameRoot, isRunningInAsar, electronIsDev, backgroundStartDate: new Date(), test: 1 },
   },
};

//PLATAFORM OVERWRITES
//KTODO: mover a otro módulo
//WIN OVERWRITES
if (ostype === 'win32') {
   //
}

//MAC OVERWRITES
if (ostype === 'darwin') {
   settings.mainShortcut = 'Ctrl+space';
   settings.here_are_dragons.electron_windows_list_options.transparent = false;
   settings.here_are_dragons.electron_windows_list_options.hasShadow = true;
   settings.here_are_dragons.electron_windows_list_options.maximizable = false;
   settings.here_are_dragons.electron_windows_list_options.fullscreenWindowTitle = false;
   settings.here_are_dragons.electron_windows_list_options.titleBarStyle = 'hidden';

   //Poor performance
   settings.avoidResizeHeigth = true;
   settings.defaultTerminalApp = require('get-term')() || 'Terminal';
}

//LINUX OVERWRITES
if (ostype === 'linux' || ostype === 'freebsd' || ostype === 'sunos') {
   settings.defaultTerminalApp = tmpDefaultTerminaltermGnome;
   settings.mainShortcut = 'Ctrl+space';
   settings.here_are_dragons.electron_windows_list_options.transparent = false;
   settings.avoidResizeHeigth = true;
}

//DEV OVERWRITES
//KTODO: mover a otro módulo
if (!isRunningInAsar && electronIsDev) {
   settings.mainShortcut = 'CmdOrCtrl+alt+space';
   settings.here_are_dragons.report.superdev = true;
   settings.statusPersist = false;
} else {
   settings.here_are_dragons.report.superdev = false;
   settings.here_are_dragons.testConfig.quitOnFinish = false;
   settings.here_are_dragons.testConfig.saveJsonReport = false;
   settings.here_are_dragons.testConfig.toastOnFinish = true;
}

// if (systemPreferences && systemPreferences.getColor) {
//    settings.here_are_dragons.report._os_windowBackColor = systemPreferences.getColor('window');
// }
// if (systemPreferences && systemPreferences.getAccentColor) {
//    settings.here_are_dragons.report._os_AccentColor = systemPreferences.getAccentColor();
// }

//KRC DEV OVERWRITES
//KTODO: mover a otro módulo
if (
   true &&
   (terminalName.includes('prystore') /*WIN*/ ||
   terminalName.includes('der2') /*WIN*/ ||
   terminalName.includes('alejandros_macbook') /*MAC*/ ||
      terminalName.includes('karacas_virtual_machine')) /*LNX*/
) {
   if (true) {
      //add TXT extension
      const textextensions = require('textextensions');
      textextensions.push('');

      // settings.defaultTerminalApp = ['PowerShell', '-noexit', '-command'];

      if (ostype === 'win32') {
         settings.overwriteDefaultFileAssociations = [
            {
               app: '%KSUBLIME%',
               extensions: textextensions,
            },
         ];
         settings.defaultTerminalApp = ['cmder', '/SINGLE'];
      }

      if (ostype === 'darwin') {
         settings.overwriteDefaultFileAssociations = [
            {
               app: '/Applications/Sublime Text.app',
               extensions: textextensions,
            },
         ];
      }
   }

   settings.here_are_dragons.realClockEnabled = true;
   settings.here_are_dragons.safe_secure_commands = false;
   settings.here_are_dragons.startOpen = false;
   settings.here_are_dragons.chromiumConsoleOptions.setDefaultsDevOptions = false;

   if (ostype === 'win32' && !settings.here_are_dragons.report.superdev) {
      settings.here_are_dragons.sudoTerminal = true;
      settings.here_are_dragons.sudoOpenFile = true;
   }

   if (terminalName.includes('der2') || terminalName.includes('prystore')) {
      //settings.here_are_dragons.chromiumConsoleOptions.setZoomFactor = 1.35;
      settings.here_are_dragons.testConfig.reportPath = normalicePath('%typebox%' + '/_report/tests.json');
      settings.here_are_dragons.testConfig.reportPathPass = null;
      settings.here_are_dragons.testConfig.saveJsonReport = true;
   }

   settings.here_are_dragons.timeToFireIdle = ms('10s');
   settings.userkaracas = true;
}

module.exports.settings = settings;
