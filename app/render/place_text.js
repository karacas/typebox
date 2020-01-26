'use strict';

const { clipboard } = require('electron').remote;
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const sharedData = require('@render/shared_data.js');
const ListViewStore = require('@render/list_view_store.js');
const { normaliceString, cloneDeep, isString } = require('@aux/aux_global.js');
const { gotoRootOnExec, unpopWin } = require('@render/aux_executor.js');
const _timeout = ms => new Promise(resolve => setTimeout(resolve, ms, true));
const status = sharedData.status;

let robot = null;
let robotIsLoad = false;
let robotFail = false;
let storeClpboard = { type: null, value: null };
let isDev = Config.isDev;

const placeTextDelay = Number(Config.get('here_are_dragons.placeTextDelay') || 4);
const placeTextInternal = Config.get('here_are_dragons.placeTextInternal');
const throttleTime_pop_unpop = 1 + Number(Config.get('here_are_dragons.throttleTime_pop_unpop')) || 128;
const robotjs_setKeyboardDelay = Config.get('here_are_dragons.robotjs_setKeyboardDelay') || 10;
const unpopAfterCopy = !!Config.get('here_are_dragons.unpopAfterCopy');
const IsGoToRootOnExec = !!Config.get('here_are_dragons.gotoRootOnExec');
const notificationsCliboardsTime = Number(Config.get('here_are_dragons.notificationsCliboardsTime') || 128);

function setUpRobotJS() {
   if (robot) return;
   robot = require('robotjs');
   if (robot !== null) {
      robot.setKeyboardDelay(robotjs_setKeyboardDelay);
      robotIsLoad = true;
   }
}

function loadRobotJS() {
   if (robotIsLoad || robotFail) return;
   try {
      setUpRobotJS();
   } catch (e) {
      robotIsLoad = false;
      robotFail = true;
      Logger.error('NO ROBOTJS', e);
   }
}

async function _internal_place_text_clipboard($str, $keyUps = false, deletes = 0) {
   if (!robotIsLoad) loadRobotJS();
   if (!clipboard || !robotIsLoad) return false;

   await keyUps();
   if (deletes) deleteStrokes(deletes);

   await _timeout(placeTextDelay);

   clipboard.writeText($str);
   robot.keyTap('v', Config.isMac ? 'command' : 'control');

   await _timeout(placeTextDelay);
   return true;
}

async function keyUps() {
   if (!robotIsLoad) loadRobotJS();
   if (!robotIsLoad) return false;
   robot.keyToggle('1', 'up', ['alt', 'control', 'command', 'shift']);
   return true;
}

async function deleteStrokes(deletes = 0, $keyUps = false) {
   if (!robotIsLoad) loadRobotJS();
   if (!robotIsLoad) return false;

   if ($keyUps) await keyUps();

   if (deletes) {
      for (var i = 0; i < deletes; i++) {
         robot.keyTap('backspace');
      }
   }

   return true;
}

async function _internal_place_text_typed($str) {
   if (!robotIsLoad) loadRobotJS();
   if (!robotIsLoad) return false;

   robot.typeString($str);

   await _timeout(placeTextDelay);
   return true;
}

async function waitForBlur() {
   let send = false;
   return new Promise((resolve, reject) => {
      if (!status.get('focused')) {
         resolve(true);
         return;
      }
      status.once('blur', () => {
         if (send) return;
         send = true;
         resolve(true);
      });
      setTimeout(() => {
         if (send) return;
         send = true;
         resolve(true);
      }, throttleTime_pop_unpop * 2);
   });
}

async function waitForFocus() {
   let send = false;
   return new Promise((resolve, reject) => {
      if (status.get('focused')) {
         resolve(true);
         return;
      }
      status.once('focus', () => {
         if (send) return;
         send = true;
         resolve(true);
      });
      setTimeout(() => {
         if (send) return;
         send = true;
         resolve(true);
      }, throttleTime_pop_unpop * 2);
   });
}

const placeText_internal_clipboard = async (str, replaces = true, goToRoot = true, permitClose = true, placeFunc = _internal_place_text_clipboard) => {
   if (!isString(str)) {
      Logger.error(str, 'is not an string');
      return;
   }

   if (!robotIsLoad) loadRobotJS();
   if (!robotIsLoad) {
      Logger.info('No robot, copy to clipboard');
      await copyToClipboard_internal(str);
      if (unpopAfterCopy && permitClose) unpopWin(true);
      return;
   }

   if (replaces) str = normaliceString(str);
   let okPlace = false;

   saveClipboard();

   if (permitClose && status.get('focused')) {
      unpopWin(true);
      await waitForBlur();
   }

   if (permitClose && status.get('focused')) {
      Logger.warn('app is already focus');
   } else {
      okPlace = await placeFunc(str);
   }

   Logger.log('[placeText_internal] type this: ', '\n', {
      str: str,
      delays: [placeTextDelay, robotjs_setKeyboardDelay],
      replaces: replaces,
      goToRoot: goToRoot,
      permitClose: permitClose,
      okPlace: okPlace,
   });

   if (goToRoot && IsGoToRootOnExec) ListViewStore.storeActions.backRootRulesPath();

   restoreClipboard();

   return;
};

const placeText_internal_typed = async (str, replaces = true, goToRoot = true, permitClose = true) => {
   return await placeText_internal_clipboard(str, replaces, goToRoot, permitClose, (placeFunc = _internal_place_text_typed));
};

function saveClipboard() {
   if (!clipboard) {
      Logger.error(e, 'saveClipboard Fail', 'no clipboard:');
      storeClpboard.type = null;
      storeClpboard.value = null;
      return;
   }

   const formats = clipboard.availableFormats();
   const format = formats[formats.length - 1];

   storeClpboard.type = format;
   storeClpboard.value = null;

   if (format === 'text/plain' && clipboard && clipboard.readText) {
      storeClpboard.value = clipboard.readText();
   } else if (format === 'text/rtf' && clipboard && clipboard.readRtf) {
      storeClpboard.value = clipboard.readRtf();
   } else if (format === 'text/html' && clipboard && clipboard.readHtml) {
      storeClpboard.value = clipboard.readHtml();
   } else if (format === 'image/png' || format === 'image/jpeg' || format === 'image/jpg') {
      if (clipboard && clipboard.readImage) storeClpboard.value = clipboard.readImage();
   }

   return;
}

async function restoreClipboard() {
   if (!storeClpboard) {
      Logger.error(e, 'restoreClipboard Fail', 'no storeClpboard:');
      return;
   }

   await _timeout(throttleTime_pop_unpop * 2);

   if (storeClpboard.value === null || storeClpboard.type === null) {
      clipboard.writeText('');
      return;
   } else {
      let format = storeClpboard.type;
      try {
         if (format === 'text/plain') {
            clipboard.writeText(String(storeClpboard.value));
         } else if (format === 'text/rtf') {
            clipboard.writeRtf(String(storeClpboard.value));
         } else if (format === 'text/html') {
            clipboard.writeHtml(String(storeClpboard.value));
         } else if (format === 'image/png' || format === 'image/jpeg' || format === 'image/jpg') {
            clipboard.writeImage(storeClpboard.value);
         }
         return;
      } catch (e) {
         clipboard.writeText('');
         Logger.error(e, 'saveClipboard Fail', 'format:', format, 'storeClpboard:', storeClpboard);
         return;
      }
   }
}

async function copyToClipboard_internal(str, permitClose = true, replaces = true, toaster = true, event) {
   Logger.log('[copyToClipboard_internal] copy this: ', { str, permitClose, replaces, toaster, event: isDev && event ? cloneDeep(event) : !!event });

   if (!isString(str)) {
      Logger.error(str, 'is not an string');
      return;
   }

   if (replaces) str = normaliceString(str);

   clipboard.writeText(str);
   if (event && event.preventDefault) event.preventDefault();

   if (toaster && Config.get('here_are_dragons.notificationsCliboards') && notificationsCliboardsTime) {
      sharedData.toaster.notify({
         message: 'Text has been copied to clipboard',
         maxTime: notificationsCliboardsTime,
      });
   }

   if (permitClose) await gotoRootOnExec();
   await _timeout(placeTextDelay);
   return;
}

//KTODO: que sea confi
const placeText_internal = placeTextInternal === 'clipboard' ? placeText_internal_clipboard : placeText_internal_typed;

module.exports.placeString = placeText_internal;
module.exports.copyToClipboard = copyToClipboard_internal;
module.exports.deleteStrokes = deleteStrokes;
module.exports.keyUps = keyUps;
module.exports.waitForBlur = waitForBlur;
module.exports.waitForFocus = waitForFocus;
