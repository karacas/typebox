'use strict';

const { has, get, cloneDeep } = require('@aux/aux_global.js');
const EventEmitter = require('eventemitter3');
const Sntp = require('sntp');
const logger = require('@main/main_logger.js');
const ms = require('ms');

let options = {
   host: 'pool.ntp.org', // Defaults to pool.ntp.org
   port: 123, // Defaults to 123 (NTP)
   resolveReference: true, // Default to false (not resolving)
   timeout: 5000, // Defaults to zero (no timeout)
};

let haveOffset = false;
let offset = 0;
let initiated = false;
let settings = null;
let _dev = null;

const updateOffset = async function() {
   if (!initiated) return;

   let __time = null;
   let __error = null;

   try {
      __time = await Sntp.time(options);
   } catch (err) {
      __time = null;
      __error = err;
   }

   if (!initiated) return;

   if (__time && __time.t) {
      haveOffset = true;
      offset = __time.t || 0;
      if (logger && logger.log) logger.log('[RealClock] Local:', +new Date(), '-', new Date(), '/ real:', getTime(), '-', getNewDate(), '/ offset:', __time.t);
   } else {
      if (_dev && __error) logger.warn(`[RealClock] Failed: ${__error.message}`);
      setTimeout(updateOffset, ms('1m'));
   }
};

function init($options, enabled) {
   if (initiated) return;
   if (!enabled || !$options) {
      haveOffset = true;
      return;
   }
   options = $options;
   sharedObj = global.sharedObj;
   settings = sharedObj.settings_manager.getSettings();
   _dev = !!get(settings, 'dev');
   if (_dev) options.timeout = 1000;
   initiated = true;

   updateOffset();
   setInterval(updateOffset, ms('6h'));

   setTimeout(() => {
      if (initiated && sharedObj && sharedObj.app_window_and_systray) sharedObj.app_window_and_systray.windowEvent.on('QUIT', endClock);
   }, 128);
}

const endClock = () => {
   initiated = false;
};

function getTime() {
   return Math.round(+new Date() + offset);
}

function getNewDate() {
   return new Date(getTime());
}

module.exports.init = init;
module.exports.getTime = getTime;
module.exports.getNewDate = getNewDate;
module.exports.getTimeOffset = () => Number(offset);
module.exports.haveOffset = () => Boolean(haveOffset);
