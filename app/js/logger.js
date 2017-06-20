'use strict';

const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');
const mkpath = require('mkpath');
const path = require('path');
const electronlog = require('electron-log');

const NULL_FUNCT = () => null;

const LOGGER = {
    log: console.log,
    info: console.info,
    error: console.error,
    error: (...args) => {
        if (Config.get('here_are_dragons.notificationsErrors')) {
            //KTODO: 2LangModule
            sharedData.toaster.notify('An error had occured. Please see the log file.');
        }
        console.error(...args);
    },
    warn: console.warn,
    debug: console.debug,
    group: console.group,
    groupEnd: console.groupEnd
};

//PRODUCTION or FORCE
if (!Config.get('dev') || Config.get('here_are_dragons.LOGGER.verboseForceFile')) {
    if (electronlog.log) {
        LOGGER.log = electronlog.log;
    } else {
        LOGGER.log = NULL_FUNCT;
    }
    if (electronlog.info) LOGGER.info = electronlog.info;
    if (electronlog.warn) LOGGER.warn = electronlog.warn;

    LOGGER.error = (...args) => {
        if (Config.get('here_are_dragons.notificationsErrors')) {
            //KTODO: 2LangModule
            sharedData.toaster.notify('An error had occured. Please see the log file.');
        }
        if (electronlog.error) electronlog.error(...args);
    };

    LOGGER.debug = NULL_FUNCT;
    LOGGER.group = NULL_FUNCT;
    LOGGER.groupEnd = NULL_FUNCT;
}

LOGGER.info('[START APP RENDER], Settings:');

if (!Config.get('dev') || Config.get('here_are_dragons.LOGGER.verboseForceFile')) {
    LOGGER.info(JSON.stringify(Config.getAll(), null, 2));
} else {
    LOGGER.info(Config.getAll());
}

module.exports = LOGGER;
