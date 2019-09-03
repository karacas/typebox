'use strict';
const { throttle } = require('lodash');
const { OrderedMap } = require('immutable');
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const sharedData = require('@render/shared_data.js');
const ruleManager = require('@render/rule_manager.js');
const getTime = sharedData.realClock.getTime;
const { loadGenericJson, saveGenericJson } = require('@aux/aux_fs.js');
const global_aux = require('@aux/aux_global.js');
const makeRulePath = require('@render/path.js');

const fileNameNews = global_aux.normalicePath(`${Config.get('here_are_dragons.paths.newspath')}/${Config.get('here_are_dragons.paths.newsfile')}`, false);

let newsItems = OrderedMap();
let newsNeedSave = false;
let newEmptyPath = {};

const ISDEV = Config.isDev;
const markNewRules = Config.get('here_are_dragons.markNewRules');
const markNewRulesMaxItemsInPathToAvoid = Config.get('here_are_dragons.markNewRulesMaxItemsInPathToAvoid');
const thotleTime = Config.get('here_are_dragons.markNewRulesTimeOld') || 5 * 60 * 1000;
const thotleTimeToSetPathOld = Config.get('here_are_dragons.markNewRulesTimeToSetPathOld') || 10000;

const savenews = throttle(
   () => {
      if (!markNewRules || !newsNeedSave) return;

      let obj2save = { newsItems: newsItems.toJS() };

      let resp = saveGenericJson(obj2save, fileNameNews);

      if (!resp) {
         Logger.error('[NEWS] Fail saveNews:', resp);
      } else {
         Logger.info('[NEWS] news Saved ok:', resp);
         newsNeedSave = false;
      }
   },
   512,
   { trailing: false }
);

function checkNews($immutableRules, $path) {
   if (!markNewRules || !$path || !$path.path || !newsItems || !$path.checkNews || !$immutableRules || !$immutableRules.size === 0) return;

   if ($immutableRules.size > markNewRulesMaxItemsInPathToAvoid) {
      Logger.info('[NEWS] path:', pathVal, 'exceeds markNewRulesMaxItemsInPathToAvoid', $immutableRules.size, '>', markNewRulesMaxItemsInPathToAvoid);
      return;
   }

   const pathVal = $path.path;
   let pathNews = newsItems.get(pathVal);
   if (pathNews) pathNews = OrderedMap(pathNews);

   let timeNow = getTime();
   let sizeNew = 0;

   if (!pathNews) {
      //NEW PATH, ALL RULES ARE OLD
      newsItems = newsItems.set(
         pathVal,
         $immutableRules.map(r => {
            let obj = r[1];
            if (obj && obj.new_permit) {
               return [obj._internal_id || obj.id]; /*MARK AS OLD*/
            }
         })
      );

      newsNeedSave = true;
      newEmptyPath[pathVal] = timeNow;
   } else {
      $immutableRules.forEach(obj => {
         if (!obj || !obj.new_permit) return;

         const lastCheck = newEmptyPath[pathVal] || 2;
         const deltaCheck = timeNow - lastCheck;
         const $id = obj._internal_id || obj.id;
         let pathIsRecentEmpty = false;

         if (deltaCheck < thotleTimeToSetPathOld) pathIsRecentEmpty = true;

         const isInNewDate = pathNews.get($id);
         let isNew = false;

         if (isInNewDate) {
            //ESTA, compara
            if (thotleTime > timeNow - isInNewDate) {
               isNew = true;
               sizeNew++;
               //if (ISDEV) Logger.log(obj.title, 'delta:', timeNow - isInNewDate, 'thotleTime:', thotleTime, 'timeNow:', timeNow);
            }
         } else {
            //PUSH
            if (!pathIsRecentEmpty) {
               isNew = true;
               sizeNew++;
            }
            pathNews = pathNews.set($id, pathIsRecentEmpty ? 3 : timeNow);
         }

         obj.isNew = isNew;
      });

      if (sizeNew && $immutableRules.size > 8 && sizeNew / $immutableRules.size > 0.25) {
         //MAX RATIO / NO NEWS
         $immutableRules.forEach(obj => {
            obj.isNew = false;
         });
         pathNews = OrderedMap(pathNews.map(obj => 4));
      }

      //UPDATE PATH
      newsItems = newsItems.set(pathVal, pathNews);
      newsNeedSave = true;
   }
}

function loadnews() {
   if (newsItems === null) {
      return;
   }

   let newsItemsTmp = loadGenericJson(fileNameNews);

   if (newsItemsTmp && newsItemsTmp.newsItems) {
      newsItemsTmp = newsItemsTmp.newsItems;
   } else {
      newsItemsTmp = null;
      Logger.info('[NEWS] Loadnews: no news');
   }

   if (newsItemsTmp) {
      newsItems = OrderedMap(global_aux.cloneDeep(newsItemsTmp));
      Logger.info('[NEWS] newsItems length: ', newsItems.size);
   }
}

function resetnews($optPath) {
   resetnewsPath($optPath || makeRulePath.get());
}

function resetnewsPath($path) {
   if (!$path || !$path.checkNews || !$path.path || !newsItems || !newsItems.size === 0 || !markNewRules) return;

   const pathNews = newsItems.get ? newsItems.get($path.path) : null;
   if (!pathNews || !pathNews.size) return;

   Logger.info('[NEWS] RESET newsItems length:', $path.path, pathNews.size);
   newsItems = newsItems.set($path.path, OrderedMap(pathNews.map(obj => 5)));

   setTimeout(ruleManager.forceRefreshRules, 1);
   newsNeedSave = true;

   return;
}

function resetItemById($rule) {
   if (!$rule) return;
   let $id = $rule._internal_id || $rule.id || $rule;
   if (!$id || !newsItems || !newsItems.size === 0 || !markNewRules) return;

   Logger.info('[NEWS] RESET newItems:', $id);

   newsItems.forEach((path, pathId) => {
      if (!path.get) return;
      if (path.get($id)) newsItems = newsItems.set(pathId, path.set($id, 6));
   });

   setTimeout(ruleManager.forceRefreshRules, 1);
   newsNeedSave = true;

   return;
}

//Save events
sharedData.idleTime.getIdleEvent().on('idle', savenews);
sharedData.app_window_and_systray.windowEvent.on('QUIT', savenews);
sharedData.app_window_and_systray.windowEvent.on('REFRESH_WIN', savenews);

//Public
module.exports.loadnews = loadnews;
module.exports.checkNews = checkNews;
module.exports.resetnews = resetnews;
module.exports.resetItemById = resetItemById;

if (window && ISDEV) {
   window.resetnews = resetnews;
   window.printnews = () => {};
   window.printnewsString = () => {};
}
