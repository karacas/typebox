'use strict';

const { throttle } = require('lodash');
const logger = require('@main/main_logger.js');
const fs = require('fs');
const path = require('path');
const { aux_getDirName, normalicePath, get } = require('@aux/aux_global.js');

let Notification = null;
let iconToast = null;

function toaster(obj) {
   if (obj && global && get(global, 'sharedObj.settings_manager') && global.sharedObj.settings_manager.getSettings().notifications) {
      let $settings = global.sharedObj.settings_manager.getSettings();
      let maxTimeNotif = get($settings, 'here_are_dragons.notificationsMaxTime') || 0;
      maxTimeNotif = Number(maxTimeNotif);

      if (typeof obj === 'string') obj = { message: obj, sound: false, hasReply: false, silent: true };

      obj.title = obj.title || 'typebox';
      obj.body = obj.body || obj.message || '';
      obj.sound = obj.sound || false;
      obj.hasReply = obj.hasReply || false;
      obj.silent = obj.silent === false || true;

      if (obj.maxTime) {
         maxTimeNotif = Number(obj.maxTime);
      }

      if (!iconToast) {
         iconToast = normalicePath(path.join(aux_getDirName(__dirname), '/assets/icons/color_128.png'));
         if (!fs.existsSync(iconToast)) {
            iconToast = null;
         }
      }

      if (!obj.icon && iconToast) {
         obj.icon = iconToast;
      }
      if ($settings.dev) {
         logger.info(
            '[TOASTER]',
            obj.message,
            ', time:',
            obj.maxTime,
            ', silent:',
            obj.silent,
            ', sound:',
            obj.sound,
            ', icon:',
            !!obj.icon,
            ', maxTimeNotif:',
            `${maxTimeNotif} / ${get($settings, 'here_are_dragons.notificationsMaxTime')}`
         );
      }

      Notification = Notification || require('electron').Notification;

      try {
         let $notification = new Notification(obj);
         $notification.show();
         if (maxTimeNotif && maxTimeNotif > 0) {
            setTimeout(() => {
               if ($notification && $notification.close) $notification.close();
            }, maxTimeNotif);
         }
      } catch (e) {
         logger.warn('[TOASTER] FAIL:', e, obj, obj.message);
      }
   }
}

module.exports.notify = throttle(toaster, 3500, { trailing: false });
