'use strict';

const _ = require('lodash');
const result = require('lodash').result;
const sharedData = require('../js/sharedData.js');

const getSettings = sharedData.settings_manager.getSettings;
const getChangeSettingsEvent = sharedData.app_window_and_systray.windowEvent;
const config = {};

var cacheSettings = _.cloneDeep(getSettings());

config.getUserSettings = sharedData.settings_manager.getUserSettings;

getChangeSettingsEvent.on('changeSettings', (path, dif) => {
    cacheSettings = _.cloneDeep(getSettings());
});

config.getAll = () => cacheSettings;

config.get = obj => result(cacheSettings, obj);

config.getChangeSettingsEvent = () => getChangeSettingsEvent;

module.exports = config;
