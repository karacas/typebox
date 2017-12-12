'use strict';

const _ = require('lodash');
const mkpath = require('mkpath');
const path = require('path');
const electronlog = require('electron-log');

const NULL_FUNCT = () => null;

let settings = {};
let globals = {};

const onError = error => {
    console.error(error, 'reset!');
};

let logger = {
    log: console.log,
    info: console.info,
    error: console.error,
    error: (...args) => {
        onError();
        if (_.get(settings, 'here_are_dragons.logger.notificationsErrors')) {
            // KTODO: 2LangModule
            if (globals.toaster) globals.toaster.notify('An error had occured. Please see the log file.');
        }
        console.error(...args);
    },
    warn: console.warn,
    debug: console.debug,
    group: console.group,
    groupEnd: console.groupEnd
};

logger.init = ($settings, $globals) => {
    settings = $settings || {};
    globals = $globals || {};

    //PRODUCTION or FORCE
    if (!settings.dev || _.get(settings, 'here_are_dragons.logger.verboseForceFile')) {
        if (electronlog.log) {
            logger.log = electronlog.log;
        } else {
            logger.log = NULL_FUNCT;
        }

        if (electronlog.info) logger.info = electronlog.info;
        if (electronlog.warn) logger.warn = electronlog.warn;

        logger.error = (...args) => {
            onError();
            if (_.get(settings, 'here_are_dragons.logger.notificationsErrors')) {
                // KTODO: 2LangModule
                if (globals.toaster) globals.toaster.notify('An error had occured. Please see the log file.');
            }
            if (electronlog.error) electronlog.error(...args);
        };

        logger.debug = NULL_FUNCT;
        logger.group = NULL_FUNCT;
        logger.groupEnd = NULL_FUNCT;
    }
};

module.exports = logger;
