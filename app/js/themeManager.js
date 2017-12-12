'use strict';

const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');
const watch = require('node-watch');
const tinycolor = require('tinycolor2');
const EventEmitter = require('events');

let body = null;
let document = null;
let themeBaseTag = null;
let themeBaseOriginalHref = null;
let themeExtendTag = null;
let fontThemeTag = null;
let cssOverWriteTag = null;
let themes = [];
let currentTheme = null;
let currentFont = 'default';
let availableSubThemes = [];

const themeEvents = new EventEmitter().setMaxListeners(100);

function handleThemes() {
    if (!body || !document || !window) return;

    //LOAD MAIN THEME
    if (themeBaseTag) themeBaseTag.setAttribute('href', themeBaseOriginalHref);
    if (themeExtendTag) themeExtendTag.setAttribute('href', '');
    currentTheme = { name: 'default' };
    availableSubThemes = [].concat(Config.get('here_are_dragons.themeDefaultSubThemes'));

    if (Config.get('theme.name') !== 'default') {
        let theme = getTheme(Config.get('theme.name'));
        if (theme && _.get(theme, 'packagejson.theme') === 'ui') {
            let cssPath = path.normalize(path.join(theme.url, theme.packagejson.main));
            if (fs.existsSync(cssPath)) {
                currentTheme = theme;
                if (themeExtendTag) themeExtendTag.setAttribute('href', cssPath);
                if (_.isArray(_.get(theme, 'packagejson.subThemes'))) {
                    availableSubThemes = [].concat(_.get(theme, 'packagejson.subThemes'));
                }
                if (_.get(theme, 'packagejson.overwriteBaseTheme')) {
                    if (themeBaseTag) themeBaseTag.setAttribute('href', '');
                } else {
                    availableSubThemes = availableSubThemes.concat(Config.get('here_are_dragons.themeDefaultSubThemes'));
                }
            } else {
                Logger.warn('[Theme]', Config.get('theme.name'), ' / Path:', cssPath, 'no exist.');
            }
        } else {
            if (!theme) Logger.warn('[Theme] No theme found:', Config.get('theme.name'));
        }
    }

    //SUBTHEME
    let isLoading = body.className.includes('bodyloader');
    body.className = '';
    if (isLoading) body.className += ' ' + 'bodyloader';

    let subTheme = Config.get('theme.subTheme');
    availableSubThemes = _.uniq(_.flattenDeep(availableSubThemes));

    if (subTheme && subTheme.length) {
        let arrSubTheme = _.uniq(_.flattenDeep(subTheme.split(' ')));
        arrSubTheme.forEach(classTheme => {
            if (availableSubThemes.includes(classTheme)) {
                body.className += ' ' + classTheme;
            } else {
                Logger.warn('[Theme] This theme:', Config.get('theme.name'), ', dont support this subtheme:', classTheme);
            }
        });
    }

    handleCssOverWrite();

    handleFont();

    Logger.info(
        '[Font]',
        'Avaiable fonts:',
        themes
            .filter(theme => _.get(theme, 'packagejson.theme') === 'font')
            .map(theme => theme.name)
            .join(', ')
    );
    Logger.info(
        '[Theme]',
        'Avaiable themes:',
        themes
            .filter(theme => _.get(theme, 'packagejson.theme') === 'ui')
            .map(theme => theme.name)
            .join(', ')
    );
    Logger.info('[Theme]', 'CurrentTheme:', currentTheme.name, '/ AvailableSubThemes:', availableSubThemes.join(', '), '/ currentFont:', currentFont);

    if (window) {
        let backColor = window.getComputedStyle(document.querySelector('body')).getPropertyValue('--backColor');

        // ADD CLASS TO BODY: isLight / isDark
        let backColorValue = tinycolor(backColor);
        document.querySelector('body').className = document
            .querySelector('body')
            .className.replace('isLight', '')
            .replace('isDark', '');
        if (backColorValue.isLight()) {
            document.querySelector('body').className += ' ' + 'isLight';
        } else {
            document.querySelector('body').className += ' ' + 'isDark';
        }

        setTimeout(() => {
            if (backColor) document.querySelector('html').style.setProperty('background', backColor);
        }, 1);
    }

    themeEvents.emit('CHANGE_THEME');
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

function handleFont() {
    if (!body || !document || !window) return;

    //FONTSTHEMES
    if (fontThemeTag) fontThemeTag.setAttribute('href', '');

    let userFontPackage = Config.get('font');

    if (userFontPackage && userFontPackage !== 'default') {
        let fontPackage = getTheme(userFontPackage);
        if (fontPackage && _.get(fontPackage, 'packagejson.theme') === 'font') {
            let fontCssPath = path.normalize(path.join(fontPackage.url, fontPackage.packagejson.main));
            if (fontCssPath && fs.existsSync(fontCssPath)) {
                currentFont = userFontPackage;
                if (fontThemeTag) fontThemeTag.setAttribute('href', fontCssPath);
            } else {
                Logger.warn('[Font]:', Config.get('theme.name'), ' / Path:', cssPath, 'no exist.');
            }
        } else {
            if (userFontPackage && _.isString(userFontPackage)) {
                try {
                    if (window) {
                        let fontString = window.getComputedStyle(document.querySelector('body')).getPropertyValue('--mainFont');
                        let newFontVal = userFontPackage + ', ' + fontString;
                        document.querySelector('body').style.setProperty('--mainFont', newFontVal);
                        return;
                    }
                } catch (e) {}
            }
            if (!fontPackage) Logger.warn('[Font]: No font found:', Config.get('theme.name'));
        }
    }
}

function add(name, url, packagejson) {
    if (name && url && packagejson) {
        if (getTheme(name)) return;
        themes.push({ name, url, packagejson });
        if (_.get(packagejson, 'theme') !== 'font') {
            Logger.info('[Theme]', name, 'theme load ok:');
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
        body.className = body.className.replace('bodyloader', '');
    }, Config.get('here_are_dragons.delayToRemoveLoader') || 0);
}

function reloadThemeBase() {
    if (!themeBaseTag || !themeBaseOriginalHref) return;
    if (document.getElementById('style_base').getAttribute('href') === themeBaseOriginalHref) {
        Logger.warn('[Theme] Reload theme base');
        themeBaseTag.setAttribute('href', '');
        themeBaseTag.setAttribute('href', themeBaseOriginalHref);
    }
}

function init(docEl) {
    if (docEl && docEl.getElementsByTagName('body') && docEl.getElementsByTagName('body')[0]) {
        document = docEl;
        body = document.getElementsByTagName('body')[0];
        themeBaseTag = document.getElementById('style_base');
        themeExtendTag = document.getElementById('style_theme');
        cssOverWriteTag = document.getElementById('cssOverWriteTag');
        fontThemeTag = document.getElementById('style_font_theme');
        themeBaseOriginalHref = document.getElementById('style_base').getAttribute('href');
        handleThemes();

        //ON CHAGEN THEME
        Config.getChangeSettingsEvent().on('changeSettings', (path, dif) => {
            if (path === 'theme') {
                handleThemes();
            }
            if (path === 'font') {
                handleFont();
            }
        });

        if (Config.get('dev')) {
            let mainCss = path.normalize('app/css/style.css');
            if (!fs.existsSync(mainCss)) {
                Logger.warn('[Theme] File: app/css/style.css not exist');
                return;
            }
            watch(mainCss, (evt, name) => {
                reloadThemeBase();
            });
        }
    }
}

function setTheme2Settings(themeName) {
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
            name: String(themeName)
        }
    };
    if (sharedData.dataManager.setAndSaveSettings('userSettings', paramObj)) {
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
            subTheme: String(subThemes2add)
        }
    };
    if (sharedData.dataManager.setAndSaveSettings('userSettings', paramObj)) {
        return true;
    }
}

//tb-font-source-sans-pro
function setFont2Settings(fontName) {
    let paramObj = {
        font: String(fontName)
    };
    if (sharedData.dataManager.setAndSaveSettings('userSettings', paramObj)) {
        return true;
    }
}

module.exports.init = init;
module.exports.add = add;
module.exports.reloadThemes = reloadThemes;
module.exports.removeLoader = removeLoader;
module.exports.currentTheme = _.cloneDeep(currentTheme);
module.exports.currentFont = _.cloneDeep(currentFont);
module.exports.setTheme2Settings = setTheme2Settings;
module.exports.setSubTheme2Settings = setSubTheme2Settings;
module.exports.setFont2Settings = setFont2Settings;
module.exports.themeEvents = themeEvents;
module.exports.getAvaiableThemes = () => {
    return _.cloneDeep(themes);
};
module.exports.getAvaiableSubThemes = () => {
    return _.cloneDeep(availableSubThemes);
};
