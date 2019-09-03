'use strict';
const EventEmitter = require('eventemitter3');
const dayjs = require('dayjs');
const Logger = require('@main/main_logger.js');
const global_aux = require('@aux/aux_global.js');
const window_and_systray = require('@main/window_and_systray.js');
const isFunction = global_aux.isFunction;
const { get, has, cloneDeep } = require('@aux/aux_global.js');
const ms = require('ms');
const os = require('os');

//KTODO: Ver si no sirve: https://electronjs.org/docs/api/structures/cpu-usage
let sicurrentLoad = null;

//KTODO: ver https://github.com/LinusU/inactivity-timer

let idleEvent = new EventEmitter();
let now = new Date();
let lastFireIdle = new Date();

let idle = false;
let idleTime = 0;
let isHide = null;

let minCpuFree2fireIdleEvent = 65;
let timeToIdle = ms('1m');
let intervalCheck = ms('10s');
let offsetTime = ms('30s');

let offsetTimeCounter = 0;
let currentLoad = 0;
let initiated = false;
let status = null;

const getCurrentLoad = () => {
   if (!currentLoad) return 100;
   return Math.round(currentLoad.currentload || 0);
};

function init() {
   idle = idle;

   if (global.sharedObj.settings_manager) {
      timeToIdle = global.sharedObj.settings_manager.getSettings().here_are_dragons.timeToFireIdle;
      minCpuFree2fireIdleEvent = global.sharedObj.settings_manager.getSettings().here_are_dragons.minCpuFree2fireIdleEvent;
      lastFireIdle = new Date();
      intervalCheck = timeToIdle / 10;
   }

   status = global.sharedObj.status;

   if (!status) {
      Logger.warn('[idle]', 'no status');
      return;
   }

   isHide = !status.get('focused');

   const onShow = () => {
      if (isHide === false) return;
      isHide = false;
      idle = false;
   };

   const onHide = () => {
      if (isHide === true) return;
      isHide = true;
      lastFireIdle = new Date();
   };

   status.on('change', objPath => {
      if (has(objPath, 'focused')) {
         if (get(objPath, 'focused')) {
            onShow();
         } else {
            onHide();
         }
      }
   });

   setInterval(() => {
      sicurrentLoad = sicurrentLoad || require('systeminformation').currentLoad;
      sicurrentLoad(data => {
         currentLoad = data;
      });

      now = new Date();

      if (isHide && now - lastFireIdle > timeToIdle) {
         lastFireIdle = new Date();
         if (getCurrentLoad() <= minCpuFree2fireIdleEvent) {
            idleEvent.emit('idle');
         }
         Logger.log('[idle]', dayjs(new Date()).format('HH:mm:ss.SSS'), idleTime, 'CPU', getCurrentLoad(), 'Min', minCpuFree2fireIdleEvent);
         idle = true;
      }

      if (idle) {
         idleTime += intervalCheck;
      } else {
         idleTime = 0;
      }
   }, intervalCheck);

   initiated = true;
}

const getIdleTime = () => idleTime;

const onIdleTimeInterval = function(callback, time) {
   if (!callback || !isFunction(callback) || !time) return;
   time = Number(time);
   offsetTimeCounter++;
   let totalTime = time / 1 + (offsetTime / 1) * offsetTimeCounter;
   let interval = setInterval(function() {
      //KTODO: Tambien ver CPU
      if (idle && getIdleTime() >= totalTime) {
         if (callback && isFunction(callback)) {
            try {
               if (getCurrentLoad() <= minCpuFree2fireIdleEvent) {
                  if (interval) callback(idle, getIdleTime());
               }
            } catch (e) {}
         } else {
            try {
               if (interval) {
                  clearInterval(interval);
                  interval = null;
               }
            } catch (e) {}
         }
      }
   }, totalTime);
};

module.exports.init = init;
module.exports.idle = idle;
module.exports.getIdleTime = getIdleTime;
module.exports.onIdleTimeInterval = onIdleTimeInterval;
module.exports.getIdleEvent = val => {
   return idleEvent;
};
