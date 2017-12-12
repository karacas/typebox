'use strict';

const _ = require('lodash');
const logger = require('./main_logger.js');
const fs = require('fs');
const path = require('path');
const Notification = require('electron').Notification;
const aux_getDirName = require('./auxfs.js').aux_getDirName;

function toaster(obj) {
    if (obj && global && global.sharedObj && global.sharedObj.settings_manager && global.sharedObj.settings_manager.getSettings().notifications) {
        if (typeof obj === 'string' || obj instanceof String) {
            obj = { message: obj, sound: false, hasReply: false, silent: true };
        }

        obj.title = obj.title || 'typebox';
        obj.body = obj.message || '';

        let iconToast = path.normalize(path.join(aux_getDirName(__dirname), '/assets/icons/color_128.png'));

        if (fs.existsSync(iconToast)) {
            obj.icon = iconToast;
        }

        logger.info('[TOASTER]', obj.message);

        try {
            new Notification(obj).show();
        } catch (e) {
            logger.warn('[TOASTER] FAIL:', e);
        }
    }
}

module.exports.notify = _.throttle(toaster, 3200, { trailing: false });
