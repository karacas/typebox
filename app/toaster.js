'use strict';

const _ = require('lodash');
const notifier = require('node-notifier');

function toaster(obj) {
    if (global && global.sharedObj.settings_manager && global.sharedObj.settings_manager.getSettings().notifications) {
        if (typeof obj === 'string' || obj instanceof String) {
            obj = { message: obj, sound: false };
        }

        obj.title = obj.title || 'Typebox';

        console.log('[TOASTER]', obj.message);

        try {
            notifier.notify(obj);
        } catch (e) {
            console.log('[TOASTER] FAIL:', e);
        }
    }
}

module.exports.notify = _.debounce(toaster, 3500);

//https://github.com/mikaelbr/node-notifier
// notifier.notify({
//   title: 'My awesome title',
//   message: 'Hello from node, Mr. User!',
//   icon: path.join(__dirname, 'coulson.jpg'), // Absolute path (doesn't work on balloons)
//   sound: true, // Only Notification Center or Windows Toasters
//   wait: true // Wait with callback, until user action is taken against notification
// }, function (err, response) {
//   // Response is response from notification
// });

// notifier.on('click', function (notifierObject, options) {
//   // Triggers if `wait: true` and user clicks notification
// });

// notifier.on('timeout', function (notifierObject, options) {
//   // Triggers if `wait: true` and notification closes
// });
