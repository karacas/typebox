'use strict';

const _ = require('lodash');
const result = require('lodash').result;
const sharedData = require('../js/sharedData.js');

const getSettings = sharedData.settings_manager.getSettings;
const getDefaultSettings = sharedData.settings_manager.getDefaultSettings();
const getChangeSettingsEvent = sharedData.app_window_and_systray.windowEvent;
const config = {};

let cacheSettings = _.cloneDeep(getSettings());

config.getUserSettings = sharedData.settings_manager.getUserSettings;

getChangeSettingsEvent.on('changeSettings', (path, dif) => {
    cacheSettings = _.cloneDeep(getSettings());
});

config.get = obj => result(cacheSettings, obj);

config.getDeafult = obj => result(getDefaultSettings, obj);

config.getAll = () => cacheSettings;

config.getChangeSettingsEvent = () => getChangeSettingsEvent;

module.exports = config;
