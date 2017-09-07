'use strict';

const _ = require('lodash');
const logger = require('./main_logger.js');
const fs = require('fs');
const path = require('path');
const Notification = require('electron').Notification;
// https://github.com/electron/electron/pull/9269
// const notifier = require('node-notifier');

function toaster(obj) {
    //KTODO: Ver de hacer nativo
    //https://github.com/mikaelbr/node-notifier

    if (obj && global && global.sharedObj && global.sharedObj.settings_manager && global.sharedObj.settings_manager.getSettings().notifications) {
        if (typeof obj === 'string' || obj instanceof String) {
            obj = { message: obj, sound: false, hasReply: false, silent: true };
        }

        obj.title = obj.title || 'typebox';
        obj.body = obj.message || '';

        //KTODO: Fix get icon in prod
        let iconToast = path.normalize(__dirname + '/assets/icons/color_128.png');

        if (fs.existsSync(iconToast) && false) {
            obj.icon = iconToast;
        }

        logger.info('[TOASTER]', obj.message, iconToast);

        try {
            // notifier.notify(obj);
            new Notification(obj).show();
        } catch (e) {
            logger.warn('[TOASTER] FAIL:', e);
        }
    }
}

module.exports.notify = _.throttle(toaster, 3200, { trailing: false });
