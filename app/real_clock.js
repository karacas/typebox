'use strict';

const EventEmitter = require('events');
const Moment = require('moment');
const Sntp = require('sntp');

var options = {
    host: 'pool.ntp.org', // Defaults to pool.ntp.org
    port: 123, // Defaults to 123 (NTP)
    resolveReference: true, // Default to false (not resolving)
    timeout: 5000 // Defaults to zero (no timeout)
};

var haveOffset = false;
var offset = 0;

function updateOffset() {
    Sntp.time(options, function(err, time) {
        if (err || !time) {
            console.log('[RealClock] Failed: ' + err.message);
            setTimeout(updateOffset, 30 * 1000);
            return;
        }
        haveOffset = true;
        offset = time.t || 0;
        console.log('[RealClock] | local:', Moment(new Date()).valueOf(), '-', new Date(), ' / real:', getTime(), ' -', getNewDate(), ' / offset: ', time.t);
    });
}

function init($options, enabled) {
    if (!enabled || !$options) {
        haveOffset = true;
        return;
    }
    options = $options;
    updateOffset();
    setInterval(updateOffset, 6 * 60 * 60 * 1000);
}

function getTime() {
    return Math.round(Moment(new Date()).valueOf() + offset);
}

function getNewDate() {
    return new Date(Moment(new Date()).valueOf() + offset);
}

module.exports.init = init;
module.exports.getTime = getTime;
module.exports.getNewDate = getNewDate;
module.exports.haveOffset = () => {
    return Boolean(haveOffset);
};
