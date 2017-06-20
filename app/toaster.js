'use strict';

const _ = require('lodash');
const logger = require('./main_logger.js');
const fs = require('fs');
const path = require('path');
const notifier = require('node-notifier');

function toaster(obj) {
    //KTODO: Ver de hacer nativo
    //https://github.com/mikaelbr/node-notifier

    if (global && global.sharedObj.settings_manager && global.sharedObj.settings_manager.getSettings().notifications) {
        if (typeof obj === 'string' || obj instanceof String) {
            obj = { message: obj, sound: false };
        }

        obj.title = obj.title || 'typebox';

        //KTODO: Fix get icon in prod
        let iconToast = path.normalize(__dirname + '/assets/icons/color_128.png');

        if (process.platform !== 'darwin' && fs.existsSync(iconToast)) {
            obj.icon = iconToast;
        }

        logger.info('[TOASTER]', obj.message, iconToast);

        try {
            notifier.notify(obj);
        } catch (e) {
            logger.warn('[TOASTER] FAIL:', e);
        }
    }
}

module.exports.notify = _.throttle(toaster, 3200, { trailing: false });
