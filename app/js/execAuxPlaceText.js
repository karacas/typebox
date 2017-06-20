'use strict';

const _ = require('lodash');
const Q = require('q');
const clipboard = require('electron').clipboard;
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');

let robot = null;
let setDefaultDelay = Config.get('here_are_dragons.setDefaultDelay');
const storeClpboard = { type: null, value: null };

sharedData.app_window_and_systray.windowEvent.on('mainWindowReady', loadRobotJS);

function loadRobotJS() {
    try {
        robot = require('robotjs');
        setUpRobotJS();
        Logger.info('ROBOTJS OK');
    } catch (e) {
        Logger.error('NO ROBOTJS', e);
    }
}

function setUpRobotJS() {
    if (Config.get('here_are_dragons.setKeyboardDelay')) {
        if (robot !== null) {
            robot.setKeyboardDelay(Config.get('here_are_dragons.setKeyboardDelay'));
        }
    }
}

function placeText_internal(str) {
    if (!_.isString(str)) {
        Logger.error(str, 'is not an string');
        return;
    }

    if (!str.length) {
        Logger.error(str, 'empty string');
        return;
    }

    if (robot === null) {
        Logger.info('No robot, copy to clipboard');
        copyToClipboard_internal(str);
        sharedData.app_window_and_systray.unpopWin();
        return;
    }

    //KTODO: Volar Q
    Q.fcall(function() {
        //KTODO: FIX: Mac no hace foco
        sharedData.app_window_and_systray.unpopWin();
        saveClipboard();
        clipboard.writeText(str);
        Logger.info('WriteText: ', str);
    })
        .then(function() {
            if (!/^darwin/.test(process.platform)) {
                if (robot !== null) {
                    robot.keyTap('v', 'control');
                }
            } else {
                if (robot !== null) {
                    robot.keyTap('v', 'command');
                }
            }
        })
        .delay(setDefaultDelay)
        .then(() => {
            restoreClipboard();
        });
}

function saveClipboard() {
    let formats = clipboard.availableFormats();
    let format = formats[formats.length - 1];
    storeClpboard.type = format;
    storeClpboard.value = null;

    if (format === 'text/plain') {
        storeClpboard.value = clipboard.readText();
    }
    if (format === 'text/rtf') {
        storeClpboard.value = clipboard.readRtf();
    }
    if (format === 'text/html') {
        storeClpboard.value = clipboard.readHtml();
    }
    if (format === 'image/png' || format === 'image/jpeg' || format === 'image/jpg') {
        storeClpboard.value = clipboard.readImage();
    }

    return true;
}

function restoreClipboard() {
    if (storeClpboard.value === null) {
        clipboard.writeText('');
        return;
    }

    let format = storeClpboard.type;

    if (format === 'text/plain') {
        clipboard.writeText(storeClpboard.value);
    }
    if (format === 'text/rtf') {
        clipboard.writeRtf(storeClpboard.value);
    }
    if (format === 'text/html') {
        clipboard.writeHtml(storeClpboard.value);
    }
    if (format === 'image/png' || format === 'image/jpeg' || format === 'image/jpg') {
        clipboard.writeImage(storeClpboard.value);
    }
}

function copyToClipboard_internal(str, permitClose = true) {
    if (!_.isString(str)) {
        Logger.error(str, 'is not an string');
        return;
    }
    if (!str.length) {
        Logger.error(str, 'empty string');
        return;
    }

    clipboard.writeText(str);

    if (Config.get('here_are_dragons.unpopAfterCopy') && permitClose) {
        sharedData.app_window_and_systray.unpopWin();
    }
}

module.exports.placeString = placeText_internal;
module.exports.copyToClipboard = copyToClipboard_internal;
