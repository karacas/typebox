'use strict';

const _ = require('lodash');
const path = require('path');
const notifier = require('node-notifier');

function toaster(obj) {
    //https://github.com/mikaelbr/node-notifier

    if (global && global.sharedObj.settings_manager && global.sharedObj.settings_manager.getSettings().notifications) {
        if (typeof obj === 'string' || obj instanceof String) {
            obj = { message: obj, sound: false };
        }

        obj.title = obj.title || 'typebox';
        obj.sound = obj.sound;
        obj.icon = path.normalize(__dirname + '/assets/icons/color_128.png');

        console.info('[TOASTER]', obj.message, obj.icon);

        try {
            notifier.notify(obj);
        } catch (e) {
            console.warn('[TOASTER] FAIL:', e);
        }
    }
}

module.exports.notify = _.debounce(toaster, 1200);
