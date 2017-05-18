'use strict';

const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');
const mkpath = require('mkpath');
const path = require('path');
const electronlog = require('electron-log');

const NULL_FUNCT = () => null;

var logger = {
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
if (!Config.get('dev') || Config.get('here_are_dragons.logger.verboseForceFile')) {
    if (electronlog.log) {
        logger.log = electronlog.log;
    } else {
        logger.log = NULL_FUNCT;
    }
    if (electronlog.info) logger.info = electronlog.info;
    if (electronlog.warn) logger.warn = electronlog.warn;

    logger.error = (...args) => {
        if (Config.get('here_are_dragons.notificationsErrors')) {
            //KTODO: 2LangModule
            sharedData.toaster.notify('An error had occured. Please see the log file.');
        }
        if (electronlog.error) electronlog.error(...args);
    };

    logger.debug = NULL_FUNCT;
    logger.group = NULL_FUNCT;
    logger.groupEnd = NULL_FUNCT;

    logger.info('\r\n\r\n________________________________________________________________________________\r\n\r\n');
}

logger.info('[START APP], Settings:');

if (!Config.get('dev') || Config.get('here_are_dragons.logger.verboseForceFile')) {
    logger.info(JSON.stringify(Config.getAll(), null, 2));
} else {
    logger.info(Config.getAll());
}

module.exports = logger;
