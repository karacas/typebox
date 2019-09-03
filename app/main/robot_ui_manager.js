'use strict';

/*
	http://robotjs.io/docs/syntax
*/

const Logger = require('@main/main_logger.js');
const global_aux = require('@aux/aux_global.js');
const { $timeout, $pause, keyDelay, keyDelayRobot, setKeyDelay, setKeyDelayRobot, setPause } = require('@uitests/_aux_tests.js');

let robot = null;
let robotFail = false;
let settings = null;
let testConfig = null;
let initiated = false;
let sharedObj = null;

function setUpRobotJS($keyDelayRobot = 18) {
   if (!initiated || robotFail) return;
   if (robot) {
      robot.setKeyboardDelay($keyDelayRobot);
      return;
   }
   try {
      robot = require('robotjs');
      robot.setKeyboardDelay($keyDelayRobot);
   } catch (e) {
      robotFail = true;
      Logger.error('NO ROBOTJS', e);
   }
}

const acceleratorToRobotJS = key => {
   //KTODO make o deprecate
   return key;
};

const keyNormalice = key => {
   if (!typeof content === 'string') return '';

   if (key === '!') return ['1', ['shift']];
   if (key === '+') return ['=', ['shift']];
   if (key === '*') return ['8', ['shift']];

   if (key.toLowerCase() === 'coma') key = ',';
   if (key.toLowerCase() === 'esc') key = 'escape';
   if (key.toLowerCase() === 'del') key = 'delete';
   if (key.toLowerCase() === 'up') key = 'up';
   if (key.toLowerCase() === 'down') key = 'down';
   if (key.toLowerCase() === 'right') key = 'right';
   if (key.toLowerCase() === 'left') key = 'left';
   if (key.toLowerCase() === 'back') key = 'backspace';
   if (key.toLowerCase() === 'enter') key = 'enter';
   if (key.toLowerCase() === 'super') key = 'super';
   if (key === ' ') key = 'space';

   return key;
};

const init = () => {
   if (initiated) return;
   initiated = true;
   sharedObj = global.sharedObj;
   settings = sharedObj.settings_manager.getSettings();
   testConfig = global_aux.get(settings, 'here_are_dragons.testConfig') || {};

   setKeyDelay(testConfig.keyDelay);
   setPause(testConfig.pause);
   setKeyDelayRobot(testConfig.keyDelayRobot);

   setTimeout(() => {
      if (initiated && sharedObj && sharedObj.app_window_and_systray) sharedObj.app_window_and_systray.windowEvent.on('QUIT', endRobot);
   }, 128);
};

const _initiated = () => {
   return initiated;
};

const endRobot = () => {
   initiated = false;
};

const keyString2array = str => {
   return str.split(',');
};

const keyTapHard = key => {
   setUpRobotJS(keyDelayRobot);
   if (!initiated || !robot) return;
   if (Array.isArray(key)) {
      return robot.keyTap(key[0], key[1]);
   }
   return robot.keyTap(key);
};

const keyTapClassic = (...args) => {
   setUpRobotJS(keyDelayRobot);
   if (!initiated || !robot) return;
   return robot.keyTap(...args);
};

const keyTap = key => {
   return new Promise((resolve, reject) => {
      if (!initiated) return;

      setTimeout(() => {
         key = keyNormalice(key);

         try {
            keyTapHard(key);
         } catch (e) {
            reject();
            return;
         }

         setTimeout(resolve, keyDelay);
      }, 1);
   });
};

const keySequence = async (keys, timeRandom) => {
   setUpRobotJS(keyDelayRobot);
   if (!initiated || !robot) return;
   const result = [];
   for (const key of keys) {
      let tmpRes = await keyTap(key);
      if (timeRandom) await $timeout(Math.random() * keyDelay * timeRandom + keyDelay);
      result.push({ key });
   }
   return result;
};

const goBack = async () => {
   setUpRobotJS(keyDelayRobot);
   if (!initiated || !robot) return;
   try {
      robot.keyTap('left', ['alt']);
   } catch (e) {
      await $timeout(keyDelay);
      return false;
   }
   await $pause();
   return true;
};

module.exports.init = init;
module.exports.keyTap = keyTap;
module.exports.keyTapHard = keyTapHard;
module.exports.keyTapClassic = keyTapClassic;
module.exports.keySequence = keySequence;
module.exports.keyNormalice = keyNormalice;
module.exports.acceleratorToRobotJS = acceleratorToRobotJS;
module.exports.keyString2array = keyString2array;
module.exports.goBack = goBack;
