'use strict';

const { throttle, take } = require('lodash');
const { OrderedMap } = require('immutable');
const global_aux = require('@aux/aux_global.js');
const removeDiacritics = global_aux.removeDiacritics;
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const sharedData = require('@render/shared_data.js');
const getTime = sharedData.realClock.getTime;
const { loadGenericJson, saveGenericJson } = require('@aux/aux_fs.js');
const get = global_aux.get;

const fileNameHist = global_aux.normalicePath(`${Config.get('here_are_dragons.paths.historypath')}/${Config.get('here_are_dragons.paths.historyfile')}`, false);
const historyItems_max = Math.round(Config.get('here_are_dragons.maxItemsInHistory') || 512);
const maxCant = Config.get('here_are_dragons.maxKeysInHistory');

let historyItems = OrderedMap();
let historyItemsKeys = OrderedMap();
let historyNeedSave = false;

function remove(ruleHistory) {
   if (!ruleHistory) {
      Logger.info('[History] obj is null');
      return;
   }

   const id = get(ruleHistory, 'rule.id') || get(ruleHistory, 'id') || ruleHistory;

   const checkItem = historyItems.get(id);

   if (checkItem) {
      historyItems = historyItems.delete(id);
      try {
         purge(true);
      } catch (e) {
         Logger.warn('[History] purge error', e);
      }
   }
}

function push(ruleHistory) {
   if (!ruleHistory || !ruleHistory.rule || ruleHistory.keys === null || ruleHistory.path === null) {
      Logger.info('[History] obj is null');
      return;
   }

   if (!ruleHistory.rule.addInHistory) {
      Logger.info('[History] No rule.addInHistory');
      return;
   }

   if (ruleHistory.path && ruleHistory.path.ephemeral) {
      Logger.info('[History] No addInHistory: path.ephemeral ');
      return;
   }

   let keys = removeDiacritics(ruleHistory.keys.toLowerCase());
   if (keys.length > maxCant) {
      keys = take(keys, maxCant).join('');
   }

   const id = ruleHistory.rule.id;
   const date = getTime();

   //MAKE ITEMS
   const historyItem = {};
   historyItem.date = date;
   historyItem._points = 1;

   //[HISTORY by ID]
   const checkItem = historyItems.get(id);
   if (checkItem) {
      checkItem._points++;
      checkItem.date = date;
   } else {
      //Map of items
      historyItems = historyItems.set(id, historyItem);
   }

   //MAKE ITEMS-KEY
   [...keys].forEach((obj, i) => {
      if (i + 1 > 3 && i + 1 !== keys.length) return;

      const $keys = keys.slice(0, i + 1);

      const score = ~~((i + 1 === keys.length ? 1 : 0.25) * 100000) / 100000;

      const historyItemK = {};
      historyItemK.id = id;
      historyItemK.date = date;
      historyItemK._points_current_key = score;

      //[HISTORY by Keys
      if ($keys.length) {
         const keysArr = historyItemsKeys.get($keys);
         let checkItemK = null;

         if (keysArr) {
            checkItemK = keysArr.filter(obj => String(obj.id) === String(id));
         }

         if (checkItemK && Array.isArray(checkItemK) && checkItemK[0] && checkItemK[0]._points_current_key) {
            checkItemK[0]._points_current_key += score;
            checkItemK[0].date = date;
         } else {
            const arrayKeysTmp = historyItemsKeys.get($keys);
            let arrayKeys = [];
            if (Array.isArray(arrayKeysTmp)) {
               arrayKeys = arrayKeysTmp;
            }
            arrayKeys.push(historyItemK);
            historyItemsKeys = historyItemsKeys.set($keys, arrayKeys);
         }
      }
   });

   //PURGE
   try {
      purge();
   } catch (e) {
      Logger.warn('[History] purge error', e);
   }

   //Make big history
   if (false) {
      Array.from(new Array(1000), (x, i) => i).map(i => {
         historyItems = historyItems.set(String(ii), historyItem);
         historyItemsKeys = historyItemsKeys.set(`${String(ii)}100`, [historyItemK]);
      });
   }

   historyNeedSave = true;
}

function purge(force = false) {
   if (historyItems.size > historyItems_max * 1.25 || force) {
      Logger.log('[History] purge', 'historyItems.size', historyItems.size);

      //FILTER historyItems
      historyItems = historyItems.sortBy(r => -r.date).slice(0, Math.abs(historyItems_max * 1.1));
      historyItems = historyItems
         .sortBy(r => -r.date)
         .sortBy(r => -r._points)
         .slice(0, historyItems_max);

      //FILTER historyItemsKeys
      let historyItemsKeysNew = OrderedMap();
      historyItemsKeys.map((keys, id) => {
         let nKeys = keys.filter(key => {
            return historyItems.get(key.id);
         });
         if (nKeys.length) {
            historyItemsKeysNew = historyItemsKeysNew.set(id, nKeys);
         }
      });
      historyItemsKeys = historyItemsKeysNew;
      historyNeedSave = true;
   }
}

const saveHistory = throttle(
   () => {
      if (!historyNeedSave) {
         return;
      }

      let obj2save = {
         historyItems: historyItems.toJS(),
         historyItemsKeys: historyItemsKeys.toJS(),
      };

      let resp = saveGenericJson(obj2save, fileNameHist);

      if (!resp) {
         Logger.error('[History] Fail saveHistory:', resp);
      } else {
         Logger.info('[History] Saved ok:', resp);
         historyNeedSave = false;
      }
   },
   80,
   { trailing: false }
);

function loadHistory() {
   if (historyItems === null || !historyItemsKeys === null) {
      return;
   }

   let historyItemsTmp = null;
   let historyItemsKeysTmp = null;

   let historyTmp = loadGenericJson(fileNameHist, true);

   if (historyTmp) {
      historyItemsTmp = historyTmp.historyItems || null;
      historyItemsKeysTmp = historyTmp.historyItemsKeys || null;
   } else {
      Logger.info('[History] LoadHistory warn: no history');
   }

   if (historyItemsTmp) {
      historyItems = OrderedMap(global_aux.cloneDeep(historyItemsTmp));
      historyItemsKeys = OrderedMap(global_aux.cloneDeep(historyItemsKeysTmp));

      Logger.info('[History] Items length: ', historyItems.size);
      Logger.info('[History] ItemsKeys length: ', historyItemsKeys.size);
   }
}

//Save events
sharedData.idleTime.getIdleEvent().on('idle', saveHistory);
sharedData.app_window_and_systray.windowEvent.on('QUIT', saveHistory);
sharedData.app_window_and_systray.windowEvent.on('REFRESH_WIN', saveHistory);

//Public
module.exports.loadHistory = loadHistory;
module.exports.save = saveHistory;
module.exports.push = push;
module.exports.remove = remove;
module.exports.historyItems = () => {
   return historyItems;
};
module.exports.historyItemsKeys = () => {
   return historyItemsKeys;
};
