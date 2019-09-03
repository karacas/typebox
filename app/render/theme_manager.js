'use strict';

//KTODO: use: css-global-variables
//KTODO: si --iconSize es cero deshabilitar íconos

const path = require('path');
const fs = require('fs');
const { flattenDeep, isString } = require('lodash');
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const sharedData = require('@render/shared_data.js');
const { watch } = require('chokidar');
const tinycolor = require('tinycolor2');
const EventEmitter = require('eventemitter3');
const global_aux = require('@aux/aux_global.js');
const get = global_aux.get;
const $timeout = global_aux.$timeout;
const uniq = arr => [...new Set(arr)];

let body = null;
let document = null;
let themeBaseTag = null;
let themeBaseOriginalHref = null;
let themeExtendTag = null;
let fontThemeTag = null;
let cssOverWriteTag = null;
let styleCodemirrorTCss = null;
let styleCodemirrorThemeCss = null;
let themeDefaultSubThemes = [];
let defaultThemes = [];
let themes = [];
let currentTheme = null;
let currentFont = 'default';
let availableSubThemes = [];
let availableUserThemes = [];

let temeIsDark = true;
let defaultColor = '#cccccc';
let lastTheme = null;

let userDefaultThemeDark = ['default', 'default'];
let userDefaultThemeLight = ['default', 'default'];

const themeEvents = new EventEmitter();

function handleThemes() {
   if (!body || !document || !window) return;

   //LOAD MAIN THEME
   if (themeBaseTag && themeBaseOriginalHref && document.getElementById('style_base').getAttribute('href') !== themeBaseOriginalHref) {
      themeBaseTag.setAttribute('href', themeBaseOriginalHref);
   }

   if (themeExtendTag) themeExtendTag.setAttribute('href', '');

   currentTheme = { name: 'default' };
   availableSubThemes = [].concat(themeDefaultSubThemes);

   if (Config.get('theme.name') !== 'default') {
      let theme = getTheme(Config.get('theme.name'));
      if (theme && get(theme, 'packagejson.theme') === 'ui') {
         let cssPath = path.normalize(path.join(theme.url, theme.packagejson.main));
         if (fs.existsSync(cssPath)) {
            currentTheme = theme;
            if (themeExtendTag) themeExtendTag.setAttribute('href', cssPath);
            if (Array.isArray(get(theme, 'packagejson.subThemes'))) {
               availableSubThemes = [].concat(get(theme, 'packagejson.subThemes'));
            }
            if (get(theme, 'packagejson.overwriteBaseTheme')) {
               if (themeBaseTag) themeBaseTag.setAttribute('href', '');
            } else {
               availableSubThemes = availableSubThemes.concat(themeDefaultSubThemes);
            }
         } else {
            Logger.warn('[Theme]', Config.get('theme.name'), ' / Path:', cssPath, 'no exist.');
         }
      } else {
         if (!theme) Logger.warn('[Theme] No theme found:', Config.get('theme.name'));
      }
   }

   //SUBTHEME
   const isLoading = body.classList.contains('bodyloader');
   body.className = '';
   if (isLoading) body.classList.add('bodyloader');

   const subTheme = Config.get('theme.subTheme');
   availableSubThemes = uniq(flattenDeep(availableSubThemes));

   if (subTheme && subTheme.length) {
      let arrSubTheme = uniq(flattenDeep(subTheme.split(' ')));
      arrSubTheme.forEach(classTheme => {
         if (availableSubThemes.includes(classTheme)) {
            body.classList.add(classTheme);
            currentTheme.subTheme = classTheme;
         } else {
            Logger.warn('[Theme] This theme:', Config.get('theme.name'), ', dont support this subtheme:', classTheme);
         }
      });
   }

   handleCssOverWrite();
   handleFont();

   Logger.info(
      '[Font]',
      'Available fonts:',
      themes
         .filter(theme => get(theme, 'packagejson.theme') === 'font')
         .map(theme => theme.name)
         .join(', ')
   );
   Logger.info(
      '[Theme]',
      'Available themes:',
      themes
         .filter(theme => get(theme, 'packagejson.theme') === 'ui')
         .map(theme => theme.name)
         .join(', ')
   );
   Logger.info('[Theme]', 'CurrentTheme:', currentTheme.name, '/ AvailableSubThemes:', availableSubThemes.join(', '), '/ currentFont:', currentFont);

   //KTODO: JSvar2CssVar y CSSvar2JSvar // getPropertyValue
   const backColor = window.getComputedStyle(body).getPropertyValue('--backColor');

   const backColorValueisLight = tinycolor(backColor).isLight();

   if (backColorValueisLight) {
      temeIsDark = false;
      body.classList.add('isLight');
      body.classList.remove('isDark');
   } else {
      temeIsDark = true;
      body.classList.add('isDark');
      body.classList.remove('isLight');
   }

   if (Config.isMac) {
      body.classList.add('isMac');
   }
   if (Config.isLinux) {
      body.classList.add('isLinux');
   }
   if (Config.isWindows) {
      body.classList.add('isWindows');
   }

   if (Config.isDev) {
      body.classList.add('isDev');
      body.classList.remove('isProd');
   } else {
      body.classList.add('isProd');
      body.classList.remove('isDev');
   }

   if (Config.get('here_are_dragons.subpixelrender') === false) {
      body.classList.add('noSubPixel');
   } else {
      body.classList.remove('noSubPixel');
   }

   if (Config.get('here_are_dragons.electron_windows_list_options.transparent') === true) {
      body.classList.add('mainwin_transparent');
      setWindowColor('transparent');
   } else {
      body.classList.remove('mainwin_transparent');
      setWindowColor(backColor);
   }

   defaultColor = window.getComputedStyle(body).getPropertyValue('--accentColor');

   themeEvents.emit('CHANGE_THEME');

   availableUserThemes = [...defaultThemes, ...global_aux.cloneDeep(themes)].filter(theme => get(theme, 'packagejson.theme') === 'ui').map(theme => theme);
}

function setWindowColor(color) {
   setTimeout(() => {
      if (color && document) document.querySelector('html').style.setProperty('background', color);
   }, 1);
}

function handleCssOverWrite() {
   if (!body || !document || !window) return;

   let cssOverWrite = Config.get('theme.cssOverWrite');

   if (cssOverWrite && cssOverWrite.length) {
      if (cssOverWriteTag) cssOverWriteTag.innerHTML = cssOverWrite;
   } else {
      if (cssOverWriteTag) cssOverWriteTag.innerHTML = '';
   }
}

function loadCodemirrorTheme(theme) {
   if (!body || !document || !window) return;
   if (theme && theme.length) {
      styleCodemirrorThemeCss.setAttribute('href', theme);
   }
}

function loadCodemirrorCss(theme) {
   if (!body || !document || !window) return;
   if (theme && theme.length) {
      styleCodemirrorTCss.setAttribute('href', theme);
   }
}

function handleFont() {
   if (!body || !document || !window) return;

   //FONTSTHEMES
   if (fontThemeTag) fontThemeTag.setAttribute('href', '');

   let userFontPackage = Config.get('font');

   if (userFontPackage && userFontPackage !== 'default') {
      let fontPackage = getTheme(userFontPackage);
      if (fontPackage && get(fontPackage, 'packagejson.theme') === 'font') {
         let fontCssPath = path.normalize(path.join(fontPackage.url, fontPackage.packagejson.main));
         if (fontCssPath && fs.existsSync(fontCssPath)) {
            currentFont = userFontPackage;
            if (fontThemeTag) fontThemeTag.setAttribute('href', fontCssPath);
         } else {
            Logger.warn('[Font]:', Config.get('theme.name'), ' / Path:', cssPath, 'no exist.');
         }
      } else {
         if (userFontPackage && isString(userFontPackage)) {
            try {
               let fontString = window.getComputedStyle(document.querySelector('body')).getPropertyValue('--mainFont');
               let newFontVal = `${userFontPackage}, ${fontString}`;
               document.querySelector('body').style.setProperty('--mainFont', newFontVal);
               return;
            } catch (e) {
               Logger.warn('[Font]:', e);
            }
         }
         if (!fontPackage) Logger.warn('[Font]: No font found:', Config.get('theme.name'));
      }
   }
}

function add(name, url, packagejson) {
   if (name && url && packagejson) {
      if (getTheme(name)) return;
      themes.push({ name, url, packagejson });
      if (get(packagejson, 'theme') !== 'font') {
         Logger.info('[Theme]', name, 'theme load ok');
      } else {
         Logger.info('[Theme]', name, 'theme load ok');
      }
   } else {
      Logger.warn('[Theme] Fail loading theme:', name);
   }
}

function getTheme(name) {
   return themes.find(t => {
      return t.name === name;
   });
}

function reloadThemes() {
   Logger.info('ReloadThemes');
   handleThemes();
}

function removeLoader() {
   //TURN OFF LOADER
   setTimeout(() => {
      document.querySelector('html').style.setProperty('background', 'transparent');
      body.classList.remove('bodyloader');
   }, Config.get('here_are_dragons.delayToRemoveLoader') || 0);
}

function reloadThemeBase() {
   if (!themeBaseTag || !themeBaseOriginalHref) return;
   if (document.getElementById('style_base').getAttribute('href') === themeBaseOriginalHref) {
      themeBaseTag.setAttribute('href', '');
      setTimeout(function() {
         Logger.warn('[Theme] Reload theme base');
         themeBaseTag.setAttribute('href', themeBaseOriginalHref);
      }, 64);
   }
}

function init(docEl) {
   if (docEl && docEl.getElementsByTagName('body') && docEl.getElementsByTagName('body')[0]) {
      document = docEl;
      body = document.getElementsByTagName('body')[0];
      themeBaseTag = document.getElementById('style_base');
      themeExtendTag = document.getElementById('style_theme');
      cssOverWriteTag = document.getElementById('css_overwrite');
      fontThemeTag = document.getElementById('style_font_theme');
      styleCodemirrorTCss = document.getElementById('style_codemirror_css');
      styleCodemirrorThemeCss = document.getElementById('style_codemirror_theme_css');
      themeBaseOriginalHref = document.getElementById('style_base').getAttribute('href');
      handleThemes();

      //ON CHAGEN THEME
      Config.getChangeSettingsEvent().on('changeSettings', (path, dif) => {
         setTimeout(() => {
            if (path === 'theme') handleThemes();
            if (path === 'font') handleFont();
         }, 1);
      });

      window.addEventListener('resize', handleResize);
      handleResize();
      setTheme2Settings();

      if (Config.isDev) {
         let mainCss = path.normalize('app/css/style.css');
         let chokidarOptions = { ignoreInitial: true, followSymlinks: true, useFsEvents: false };
         if (!fs.existsSync(mainCss)) {
            Logger.warn('[Theme] File: app/css/style.css not exist');
            return;
         }

         watch(mainCss, chokidarOptions).on('change', (evt, name) => {
            setTimeout(reloadThemeBase, 10);
         });
      }
   }
}

function handleResize() {
   if (window && body) {
      if (body && body.classList) {
         window.innerWidth < 850 ? body.classList.add('smallWindow') : body.classList.remove('smallWindow');
         window.innerWidth > 1200 ? body.classList.add('bigWindow') : body.classList.remove('bigWindow');
      }
   }
}

function setTheme2Settings(themeName) {
   if (!themeName) return;

   if (currentTheme.name === themeName) {
      Logger.warn('[Theme]', themeName, 'is already set');
      return false;
   }
   if (!themes.includes(String(themeName))) {
      Logger.warn('[Theme]', themeName, 'is not installed');
      return false;
   }
   let paramObj = {
      theme: {
         name: String(themeName),
      },
   };
   if (sharedData.setAndSaveSettings('userSettings', paramObj)) {
      return true;
   }
}

function setSubTheme2Settings(subThemeName) {
   let subThemeNameArr = subThemeName.replace(/\s/g, ' ').split(' ');
   let subThemes2add = [];

   subThemeNameArr.map(theme => {
      if (!availableSubThemes.includes(String(theme))) {
         Logger.warn('[Subtheme]', theme, 'is not available');
      } else {
         subThemes2add.push(theme);
      }
   });

   subThemes2add = subThemes2add.join(' ');

   let paramObj = {
      theme: {
         subTheme: String(subThemes2add),
      },
   };
   if (sharedData.setAndSaveSettings('userSettings', paramObj)) {
      return true;
   }
}

//tb-font-source-sans-pro
function setFont2Settings(fontName) {
   let paramObj = {
      font: String(fontName),
   };
   if (sharedData.setAndSaveSettings('userSettings', paramObj)) {
      return true;
   }
}

function setThemeAndSubTheme(themeName = 'default', subThemeName = 'default') {
   let paramObj = {
      theme: {
         name: String(themeName),
         subTheme: String(subThemeName),
      },
   };

   if (sharedData.setAndSaveSettings('userSettings', paramObj)) {
      return true;
   }
}

module.exports.init = init;
module.exports.add = add;
module.exports.reloadThemes = reloadThemes;
module.exports.removeLoader = removeLoader;
module.exports.currentTheme = global_aux.cloneDeep(currentTheme);
module.exports.currentFont = global_aux.cloneDeep(currentFont);
module.exports.setTheme2Settings = setTheme2Settings;
module.exports.setTheme = setTheme2Settings;
module.exports.setSubTheme2Settings = setSubTheme2Settings;
module.exports.setSubTheme = setSubTheme2Settings;
module.exports.setFont2Settings = setFont2Settings;
module.exports.setFont = setFont2Settings;
module.exports.setThemeAndSubTheme = setThemeAndSubTheme;
module.exports.themeEvents = themeEvents;
module.exports.loadCodemirrorTheme = loadCodemirrorTheme;
module.exports.loadCodemirrorCss = loadCodemirrorCss;

module.exports.getdefaultColor = () => {
   return defaultColor;
};

module.exports.isDark = () => temeIsDark;

module.exports.getAvailableFonts = () => {
   return global_aux.cloneDeep(themes.filter(theme => get(theme, 'packagejson.theme') === 'font').map(theme => theme.name));
};

module.exports.getAvailableThemes = () => {
   return global_aux.cloneDeep(themes.filter(theme => get(theme, 'packagejson.theme') === 'ui').map(theme => theme.name));
};

module.exports.getAvailableSubThemes = () => {
   return global_aux.cloneDeep(availableSubThemes);
};

module.exports.getAvailableUserThemes = () => {
   return global_aux.cloneDeep(availableUserThemes);
};

module.exports.getRootVar = val => {
   if (!body || !window || !window.getComputedStyle) return null;
   return window.getComputedStyle(body).getPropertyValue(`--${val}`);
};

module.exports.getCurrentTheme = () => {
   return cloneDeep(currentTheme);
};

module.exports.setDefaultThemes = (themes, subThemes) => {
   defaultThemes = themes;
   themeDefaultSubThemes = subThemes;
};

module.exports.setUserDefaultThemes = (dark = ['default', 'default'], light = ['default', 'default']) => {
   userDefaultThemeDark = dark;
   userDefaultThemeLight = light;
};

module.exports.isDarkTheme = () => {
   return body && body.classList.contains('isDark');
};

module.exports.setThemeDark = () => {
   const tmpLastTheme = global_aux.cloneDeep(lastTheme);
   lastTheme = { theme: currentTheme, isDark: body && body.classList.contains('isDark') };
   if (tmpLastTheme && tmpLastTheme.theme && tmpLastTheme.isDark) {
      return setThemeAndSubTheme(tmpLastTheme.theme.name, tmpLastTheme.theme.subTheme);
   }
   return userDefaultThemeDark && setThemeAndSubTheme(userDefaultThemeDark[0], userDefaultThemeDark[1]);
};

module.exports.setThemeLight = () => {
   const tmpLastTheme = global_aux.cloneDeep(lastTheme);
   lastTheme = { theme: currentTheme, isDark: body && body.classList.contains('isDark') };
   if (tmpLastTheme && tmpLastTheme.theme && !tmpLastTheme.isDark) {
      return setThemeAndSubTheme(tmpLastTheme.theme.name, tmpLastTheme.theme.subTheme);
   }
   return userDefaultThemeLight && setThemeAndSubTheme(userDefaultThemeLight[0], userDefaultThemeLight[1]);
};

module.exports.toggleColorMode = () => {
   if (module.exports.isDarkTheme()) {
      module.exports.setThemeLight();
   } else {
      module.exports.setThemeDark();
   }
};
