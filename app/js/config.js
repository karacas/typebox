'use strict';

const _ = require('lodash');
const result = require('lodash').result;
const get = require('lodash').get;
const EventEmitter = require('events');
let windowEvent = new EventEmitter();

const sharedData = require('../js/sharedData.js');
const NULL_FUNCT = function() {
    return {};
};

let getSettings = NULL_FUNCT;
if (result(sharedData, 'settings_manager', 'getSettings')) {
    getSettings = sharedData.settings_manager.getSettings;
}

const getDefaultSettings = result(sharedData, 'settings_manager.getDefaultSettings()') || {};
const getChangeSettingsEvent = result(sharedData, 'app_window_and_systray.windowEvent') || windowEvent;
const config = {};

let cacheSettings = _.cloneDeep(getSettings());

config.getUserSettings = NULL_FUNCT;
if (get(sharedData, 'settings_manager', 'getUserSettings')) {
    config.getUserSettings = sharedData.settings_manager.getUserSettings;
}

getChangeSettingsEvent.on('changeSettings', (path, dif) => {
    cacheSettings = _.cloneDeep(getSettings());
});

config.get = obj => get(cacheSettings, obj);

config.getDeafult = obj => get(getDefaultSettings, obj);

config.getAll = () => cacheSettings;

config.getChangeSettingsEvent = () => {
    return getChangeSettingsEvent;
};

module.exports = config;
