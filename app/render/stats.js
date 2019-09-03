'use strict';

const EventEmitter = require('eventemitter3');
const global_aux = require('@aux/aux_global.js');
const sharedData = require('@render/shared_data.js');
const status = sharedData.status;
const initStatus = status.get();
const Logger = require('@render/logger.js');
let initiated = false;

//KTODO:
//Add Mem
//Add CPU
//Add active-win
//Add OnLine: https://github.com/sindresorhus/is-online

const STATS = {
   test: 1,
   timeToStart: null,
   upTime: null,
   reloads: initStatus.reloads,
   starts: initStatus.starts,
   initTime: initStatus.initTime,
   totalSessionsTime: initStatus.totalSessionsTime,
};

const getEvents = () => {
   if (sharedData.viewEvents) {
      sharedData.viewEvents.once('APP_IS_USABLE', e => {
         if (STATS.timeToStart === null) STATS.timeToStart = Logger.getUptime();
         sharedData._timeToStart = STATS.timeToStart;
         refresh();
      });
   }
};

const refresh = () => {
   if (!initiated) return;
   STATS.upTime = Logger.getUptime();
};

const init = () => {
   if (initiated) return;
   initiated = true;
   getEvents();
   setInterval(refresh, 1000);
};

const getStats = obj => global_aux.cloneDeep(global_aux.get(STATS, obj));

const objExport = {
   init,
   getStats,
};

Object.defineProperty(objExport, 'get', { get: () => STATS });

module.exports = objExport;
