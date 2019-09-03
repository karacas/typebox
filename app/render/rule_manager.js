'use strict';

const scoreKrc = require('@aux/aux_score_krc.js').score;

const { get, extendObj, cloneDeep, equal, removeDiacritics } = require('@aux/aux_global.js');
const { debounce } = require('lodash');
const { OrderedMap } = require('immutable');
const HistoryManager = require('@render/history_manager.js');
const hiddenRulesManager = require('@render/hidden_rules_manager.js');
const favManager = require('@render/fav_manager.js');
const newsManager = require('@render/news_manager.js');
const PackagesManager = require('@render/packages_manager.js');
const ListViewStore = require('@render/list_view_store.js');
const createRule = require('@render/rule.js').getNewRule;
const makeRuleIdHash = require('@render/rule.js').makeHash;
const icon_get = require('@render/icon.js').get;
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const makeRulePath = require('@render/path.js');
const sharedData = require('@render/shared_data.js');
const expanderManager = require('@render/expander_manager.js');

let _initEmpty = Config.get('here_are_dragons.initEmpty');
let logTimes = Config.get('here_are_dragons.verboseTimes');
let _dev = Config.isDev;
let timeStart1;

let rules = OrderedMap();
let cache_paths = OrderedMap();
let virtaulrules = OrderedMap();
let lastRulesCache = OrderedMap();
let lastRulesQuery = null;
let filteredRules = OrderedMap();

let _deleteOriginalArrayDataRules = !!Config.get('here_are_dragons.deleteOriginalArrayDataRules');

function resetCaches() {
   logTimes = Config.get('here_are_dragons.verboseTimes');
   cache_paths = OrderedMap();
   resetCacheslastRules();
}

function resetCacheslastRules() {
   lastRulesCache = OrderedMap();
   lastRulesQuery = null;
}

function _forceRefreshRules() {
   resetCaches();
   Logger.log('[forceRefreshRules]');
   ListViewStore.storeActions.updateFilterlist();
}

function _forceRefreshRulesLight() {
   resetCaches();
   if (sharedData.viewEvents && sharedData.viewEvents.emit) {
      Logger.log('[forceRefreshRules light]');
      sharedData.viewEvents.emit('MAIN_FORCE_UPDATE');
   } else {
      ListViewStore.storeActions.updateFilterlist();
   }
}

const forceRefreshRules = debounce(_forceRefreshRules, 1);
const forceRefreshRulesLight = debounce(_forceRefreshRulesLight, 1);

function getFilterRules($keys = '', $optPath) {
   //KTODO: SEPARAR EN MAS FUNCIONES

   let optPath = makeRulePath.get($optPath);

   let path = String(optPath.path);
   let pathIsFav = path === 'FAVS_PATH';
   let sort = optPath.sort;
   let keys = removeDiacritics($keys.toLowerCase()).replace(/_/g, '');
   let haveKeys = keys.length > 0;
   let sortBy = optPath.sortBy;
   let sortByNoRules = optPath.sortByNoRules;
   let sortReverse = !!optPath.sortReverse;
   let sortReverseNoRules = !!optPath.sortReverseNoRules;
   let avoidCache = !!optPath.avoidCache;
   let checkNews = !!optPath.checkNews;

   if (rules.size === 0 || (!haveKeys && _initEmpty && path === '/')) {
      return OrderedMap();
   }

   sort = !!sortBy || !!sort;

   //CACHE LAST QUERY
   let actualRulesQuery = `${keys}[/]${path}[/]${sort}[/]${virtaulrules.size}`;
   if (actualRulesQuery === lastRulesQuery && lastRulesCache.size !== 0 && !avoidCache) {
      if (logTimes) {
         console.info('      >>>> USE CACHE');
      }
      return lastRulesCache;
   }

   //TIME LOG
   if (logTimes) {
      console.group('________ Keys: ', keys, ' / path: ', path, ' / sort: ', sort);
   }
   timeStart1 = new Date();

   let lastKeys;
   let lastPath;
   let lastRulesQueryObj;

   if (lastRulesQuery && lastRulesCache) {
      lastRulesQueryObj = lastRulesQuery.split('[/]');
      if (lastRulesQueryObj && lastRulesQueryObj.length > 0) {
         lastKeys = lastRulesQueryObj[0];
         lastPath = lastRulesQueryObj[1];
      }
   }

   if (
      lastKeys &&
      lastPath &&
      lastRulesCache &&
      !avoidCache &&
      lastKeys.length > 0 &&
      keys.length > 0 &&
      lastPath === path &&
      keys.length >= lastKeys.length &&
      lastRulesCache.size >= 0 &&
      keys.indexOf(lastKeys) === 0
   ) {
      if (logTimes) {
         console.info('      >>>> CACHE LAST');
      }
      filteredRules = lastRulesCache.toSeq().cacheResult();
   } else {
      //CACHE pathS
      let cachePath = cache_paths.get(path);

      if (!cachePath) {
         cachePath = rules.filter(v => v.path === path);
         cache_paths = cache_paths.set(path, cachePath);
      }

      filteredRules = cachePath;

      //ADD VIRTUAL RULES
      filteredRules = filteredRules.merge(virtaulrules.toSeq().flatMap((obj, plugin) => obj.filter(v => v.path === path)));

      if (logTimes) {
         console.info('      >>>> MAKE CACHE: ', new Date() - timeStart1);
         console.info('      >>>> VRULES: ', new Date() - timeStart1);
      }

      //Filter Hidden rules
      filteredRules = filteredRules.deleteAll(hiddenRulesManager.gethiddenItemsIm().map(r => r.params.original_hidden_id));
      if (logTimes) {
         console.info('      >>>> HIDDEN: ', new Date() - timeStart1);
      }

      filteredRules = filteredRules.toSeq().cacheResult();

      //FAV
      if (filteredRules.size > 0) {
         favManager.getFavItemsIm().forEach(r => {
            let ruleFav = filteredRules.get(r.id);
            if (ruleFav) ruleFav.favorite = true;
         });
         if (logTimes) {
            console.info('      >>>> FAV: ', new Date() - timeStart1);
         }
      }

      // MARK NEWS NEWS
      if (checkNews) {
         newsManager.checkNews(filteredRules, optPath);
         if (logTimes) {
            console.info('      >>>> NEWS: ', new Date() - timeStart1);
         }
      }
   }

   //FUZZY FILTER
   if (haveKeys) {
      let tmpResultFuzzy;
      filteredRules = filteredRules.filter(r => {
         tmpResultFuzzy = scoreKrc(r.searchField, keys);
         if (tmpResultFuzzy === 0 && r.persistFuzzy) {
            tmpResultFuzzy = 0.01;
         }
         r._distance_keys_cache = ~~(tmpResultFuzzy * 100000) / 100000;
         return tmpResultFuzzy > 0;
      });
   }

   if (logTimes) {
      console.info('      >>>> FUZZY: ', new Date() - timeStart1);
      console.info(' > ', new Date() - timeStart1, ' > 1: Caches & Fuzzy');
   }

   //SORT
   if (sort && filteredRules.size !== 0) {
      let _typeSort = 'noSort';
      let timeStarFiletadnSort = 0;
      let timSort = 0;

      if (logTimes) {
         timeStarFiletadnSort = new Date();
      }

      let filteredRulesObj = score_addMatchesRulesHistoryPoints(filteredRules, keys, { path });
      let allNoHistory = filteredRulesObj.allNoHistory;
      let sizeFilteredRulesObj = filteredRulesObj.size;
      filteredRules = filteredRulesObj.filteredRules;

      if (logTimes) {
         console.info(' > ', new Date() - timeStarFiletadnSort, ' > 2: TOTAL TIME in match & points');
         timSort = new Date();
      }

      if (sizeFilteredRulesObj > 1) {
         if (sortBy) {
            const complexsortBy = sortBy.indexOf('.') !== -1;

            if (logTimes) _typeSort = `sortBy ${sortBy} ${complexsortBy}`;

            if (complexsortBy) {
               filteredRules = filteredRules.sortBy(r => {
                  return get(r, sortBy);
               });
            } else {
               filteredRules = filteredRules.sortBy(r => r[sortBy]);
            }

            if (sortReverse) filteredRules = filteredRules.reverse();
         } else if (!(!haveKeys && allNoHistory)) {
            if (!haveKeys) {
               if (logTimes) _typeSort = 'noKeys - largeSort';
               if (sortByNoRules) {
                  const complexsortBy = sortByNoRules.indexOf('.') !== -1;

                  if (complexsortBy) {
                     filteredRules = filteredRules.sortBy(r => {
                        return get(r, sortByNoRules);
                     });
                  } else {
                     filteredRules = filteredRules.sortBy(r => r[sortByNoRules]);
                  }

                  if (sortReverseNoRules) filteredRules = filteredRules.reverse();
               } else {
                  filteredRules = filteredRules
                     .sortBy(r => r.order)
                     .sortBy(r => -r.initSort)
                     .sortBy(r => -r._score)
                     .sortBy(r => -Number(r.isNew))
                     .sortBy(r => -r.posFixed);
               }
            } else {
               if (logTimes) _typeSort = 'by score';
               filteredRules = filteredRules.sortBy(r => -r._score);
            }
         }
      }

      if (logTimes) {
         console.info(' > ', new Date() - timSort, ' > 3: TIME in sort / Cant: ', sizeFilteredRulesObj, ' / typeSort:', _typeSort);
      }
   }

   filteredRules = filteredRules.cacheResult();
   lastRulesQuery = actualRulesQuery;
   lastRulesCache = filteredRules;

   if (logTimes) {
      console.info(' >> TOTAL TIME:', new Date() - timeStart1, ' Cant: ', filteredRules.size);
      console.groupEnd();
   } else if (_dev) {
      console.log('[filteredRules]', ' Cant:', filteredRules.size, ' Total:', rules.size, 'Time:', new Date() - timeStart1);
   }

   return filteredRules;
}

function score_addMatchesRulesHistoryPoints($filteredRules, keys, params) {
   const pathIsFav = params.path === 'FAVS_PATH';
   const haveKeys = keys.length > 0;
   const timeStartH = logTimes ? new Date() : 0;
   const $historyItems = HistoryManager.historyItems();
   const $historyItemsKeys = HistoryManager.historyItemsKeys();

   let tmp_map_historyItemsMatchKeys = OrderedMap();
   let tmp_historyItemsMatch = null;
   let tmp_historyItemsMatchK = null;
   let tmp_r_id = null;
   let tmp_r_hist = null;
   let allNoHistory = true;

   let scoreNoKeys = 1;
   let scoreDistanceKeys = 0;
   let scoreCurrentKey = 0;
   let scoreNew = 30;
   let scoreFav = 10;
   let _sizeFilteredRules = 0;

   if (haveKeys) {
      scoreNoKeys = 0.1;
      scoreDistanceKeys = 1;
      scoreCurrentKey = 10;
      scoreNew = 1.1;
      scoreFav = 1.5;

      //MATCH: historyItemsKeys con rules para _points_current_key
      let keysArrTpm = $historyItemsKeys.get(keys);
      if (keysArrTpm && Array.isArray(keysArrTpm)) {
         keysArrTpm.forEach(o => (tmp_map_historyItemsMatchKeys = tmp_map_historyItemsMatchKeys.set(o.id, o._points_current_key)));
      }
   }

   if (pathIsFav) scoreFav = 0;

   if (logTimes) {
      console.info(
         '   ',
         new Date() - timeStartH,
         ' > Match Keys Hist / Cant: ',
         $historyItemsKeys.size,
         ' / Cant Filtered: ',
         tmp_map_historyItemsMatchKeys.size
      );
   }

   //ADD SCORE
   let timeStartH2 = logTimes ? new Date() : 0;

   $filteredRules.forEach(r => {
      _sizeFilteredRules++;

      r._points = r._points_current_key = r._distance_keys = 0;
      tmp_r_id = r.id;
      tmp_r_hist = r.addInHistory;

      if (allNoHistory && tmp_r_hist) allNoHistory = false;

      //MATCH: Fuzzy
      if (haveKeys) {
         if (r._distance_keys_cache !== -1) {
            r._distance_keys = r._distance_keys_cache;
         } else {
            r._distance_keys = scoreKrc(r.searchField, keys);
         }
      }

      //KTODO: No se puede hacer por  fuera? como los favs?
      //MATCH: historyItems/rules >_points
      if (tmp_r_hist) {
         tmp_historyItemsMatch = $historyItems.get(tmp_r_id);
         if (undefined !== tmp_historyItemsMatch) {
            r._points = tmp_historyItemsMatch._points;
         }

         //MATCH: historyItemsKeys/rules >_points
         if (haveKeys) {
            tmp_historyItemsMatchK = tmp_map_historyItemsMatchKeys.get(tmp_r_id);
            if (undefined !== tmp_historyItemsMatchK) {
               r._points_current_key = ~~(tmp_historyItemsMatchK * 100000) / 100000;
            }
         }
      }

      //CALC POINTS
      r._score = ~~(
         100 *
         (r._distance_keys * scoreDistanceKeys +
            r._points * scoreNoKeys +
            r._points_current_key * scoreCurrentKey +
            r.favorite * scoreFav +
            r.isNew * scoreNew) *
         r.specialScoreMult
      );

      r._points_p = r._points;
      r._points_current_key_p = r._points_current_key;
      r._score_p = r._score;

      //RESET
      r._distance_keys_cache = -1;
   });

   if (logTimes) {
      console.info('   ', new Date() - timeStartH2, ' > Add Score / Cant: ', _sizeFilteredRules);
   }

   return { filteredRules: $filteredRules, allNoHistory: allNoHistory, size: _sizeFilteredRules };
}

const clean_array = _arr => {
   if (!_arr || !Array.isArray(_arr)) return;
   const cant = _arr.length || 0;
   for (let i = 0; i < cant; i++) {
      delete _arr[i];
   }
   _arr.length = 0;
};

/*
Push bulpack of rules (add Array)
*/
const pushRulePack = (objAdd, data, $pluginId) => {
   if (!objAdd || !objAdd.length > 0) {
      return;
   }

   const globalIcon = data && data.icon ? data.icon : null;

   rules = rules.merge(
      objAdd.map($obj => {
         if ($obj !== null && $obj !== undefined) {
            $obj.generate_by_plugin = $pluginId;
            $obj.icon = $obj.icon || globalIcon;
            $obj = createRule($obj);
            if ($obj !== null) {
               if ($obj.expander !== null) expanderManager.addExpander($obj);
               return [$obj.id, $obj];
            }
         }
      })
   );

   resetCaches();

   if (_deleteOriginalArrayDataRules) {
      clean_array(objAdd);
      objAdd.length = 0;
   }
};

function deleteVirtualRules(pluginId) {
   if (!pluginId) {
      return;
   }
   let rulesToDelete = virtaulrules.get(pluginId);
   if (rulesToDelete && rulesToDelete.size) {
      virtaulrules = virtaulrules.delete(pluginId);
      forceRefreshRules();
   }
}

const _searchAndReplaceRule = ($id, rule, newRule) => {
   if (!rule || !rule.id || !rule.title || !newRule) return null;

   const actualPath = get(ListViewStore.store.getState(), 'rulesPath.path');
   if (actualPath !== rule.path) return null;

   const int_id = rule.params && rule._internal_id ? rule._internal_id : null;
   const int_id_new = newRule.params && newRule._internal_id ? newRule._internal_id : null;

   if ($id === rule.id || (int_id && $id === int_id) || (int_id_new && int_id_new === int_id)) {
      const _originalRule = cloneDeep(rule);
      const _newRule = cloneDeep(newRule);
      const ruleExtBase = extendObj(cloneDeep(rule), cloneDeep(newRule));
      const ruleExt = createRule(cloneDeep(ruleExtBase));

      if (equal(_originalRule, ruleExt) || equal(_originalRule, ruleExtBase) || equal(_originalRule, _newRule)) return rule;

      const changed_rule = extendObj(rule, ruleExt);

      changed_rule.id = _originalRule.id;
      changed_rule.path = _originalRule.path;
      if (int_id) changed_rule._internal_id = int_id;

      if (_newRule.path !== _originalRule.path) {
         changed_rule.generateStaticRule = _originalRule.generateStaticRule;
         changed_rule.generate_by_getNewRule_func = _originalRule.generate_by_getNewRule_func;
         changed_rule.order = _originalRule.order;
         changed_rule.posFixed = _originalRule.posFixed;
         changed_rule.isNew = _originalRule.isNew;
         changed_rule.favorite = _originalRule.favorite;
         changed_rule.hidden_permit = _originalRule.hidden_permit;
         changed_rule.new_permit = _originalRule.new_permit;
         changed_rule.last_permit = _originalRule.last_permit;
         changed_rule.fav_permit = _originalRule.fav_permit;
      }

      if (actualPath === 'LAST_RULES_PATH') {
         changed_rule.isNew = false;
         changed_rule.favorite = false;
         changed_rule.fav_permit = false;
         changed_rule.hidden_permit = false;
         changed_rule.description = _originalRule.description;
      }

      if (Config.isDev)
         console.log('[updateVirtualRule] / found:', {
            _originalRule,
            newRule,
            changed_rule,
            actualPath,
            _originalRule: _originalRule.path,
            changed_rule: changed_rule.path,
            newRule: newRule.path,
         });

      rule = changed_rule;

      if (rule.expander) expanderManager.addExpander(rule);

      forceRefreshRulesLight();
      return rule;
   }

   return null;
};

function updateVirtualRule(_id, newRule, pluginId = null) {
   let $id = _id;
   let int_id = newRule._internal_id;

   if (!$id && newRule && newRule.id) {
      $id = newRule.id;
   }

   if (!$id || !newRule) {
      return null;
   }

   let find = null;

   if (pluginId) {
      let subRules = virtaulrules.get(pluginId);
      if (subRules && subRules.size) {
         subRules.forEach(rule => {
            if (find) return;
            find = _searchAndReplaceRule($id, rule, newRule);
         });
      }
   }

   if (!find) {
      virtaulrules.forEach(subRules => {
         subRules.forEach(rule => {
            if (find) return;
            find = _searchAndReplaceRule($id, rule, newRule);
         });
      });
   }

   if (!find && int_id && _id !== int_id) {
      if (Config.isDev) console.log('[updateVirtualRule] / not fund, try int_id');
      return updateVirtualRule(int_id, newRule, pluginId);
   }

   return find;
}

function loadingAction(path, nameLoader = null) {
   return {
      path: path,
      isLoading: true,
      title: nameLoader,
   };
}

function infoAction(path, nameInfo = null) {
   return {
      path: path,
      isInfo: true,
      title: nameInfo,
   };
}

function addLoader(path, pluginId, replace, nameLoader) {
   if (path) {
      setVirtualRules([loadingAction(path, nameLoader)], pluginId, replace);
   }
}

function addInfo(path, pluginId, replace, nameInfo, rule) {
   if (path) {
      let infoRule = infoAction(path, nameInfo);
      if (rule) {
         infoRule = Object.assign({}, rule, infoRule);
      }
      setVirtualRules([infoRule], pluginId, replace);
   }
}

function setVirtualRules(objAdd, pluginId, replace = false) {
   if (!pluginId) {
      return;
   }

   if (!PackagesManager.getPluginByName(pluginId)) {
      return;
   }

   if (!objAdd.length > 0) {
      if (replace) {
         deleteVirtualRules(pluginId);
      }
      return;
   }

   const $pluginId = String(pluginId) || 'null';

   if (objAdd === null) objAdd = [];

   let pack = objAdd.map($obj => {
      if ($obj) {
         $obj = createRule($obj);
         if (!$obj === null) {
            Logger.warn('RULE: No obj:', $obj);
            return null;
         }
         $obj.isVirtual = true;
         $obj.generate_by_plugin = $pluginId;

         if ($obj.expander !== null) expanderManager.addExpander($obj);
         return [$obj.id, $obj];
      }
   });

   if (replace) {
      virtaulrules = virtaulrules.set(pluginId, OrderedMap(pack));
   } else {
      let virtualRulePack = OrderedMap(pack);
      const virtualRulePlugin = virtaulrules.get(pluginId);
      if (virtualRulePlugin) {
         virtualRulePack = virtualRulePlugin.merge(virtualRulePack);
      }
      virtaulrules = virtaulrules.set(pluginId, virtualRulePack);
   }

   if (_deleteOriginalArrayDataRules) {
      clean_array(objAdd);
      clean_array(pack);
      objAdd.length = 0;
      pack.length = 0;
   }

   forceRefreshRules();
}

function removeLoader(path, pluginId) {
   if (!pluginId) {
      return;
   }

   if (!PackagesManager.getPluginByName(pluginId)) {
      return;
   }

   let virtualRulePack = virtaulrules.get(pluginId);
   if (!virtualRulePack) return;

   virtualRulePack = virtualRulePack.filter(v => {
      if (!path) {
         //REMOVE ALL
         return !v.isLoading;
      }
      return !(v.path === path && v.isLoading);
   });

   setVirtualRules(virtualRulePack.toSet().toArray(), pluginId, true);
}

function removeInfo(path, pluginId) {
   if (!pluginId) {
      return;
   }

   if (!PackagesManager.getPluginByName(pluginId)) {
      return;
   }

   let virtualRulePack = virtaulrules.get(pluginId).filter(v => {
      if (!path) {
         //REMOVE ALL
         return !v.isInfo;
      }
      return !(v.path === path && v.isInfo);
   });

   setVirtualRules(virtualRulePack.toSet().toArray(), pluginId, true);
}

function getRuleByID(id) {
   let res = rules.get(id);
   if (!res) res = virtaulrules.get(id);
   if (!res)
      virtaulrules.entrySeq().forEach(obj => {
         if (res) return;
         let val = obj[1].get(id);
         if (val) {
            res = val;
            return;
         }
      });
   return cloneDeep(res || null);
}

//_________________________________
//SET PUBLIC
//_________________________________
module.exports.addLoader = addLoader;
module.exports.addInfo = addInfo;
module.exports.clean_array = clean_array;
module.exports.removeLoader = removeLoader;
module.exports.pushRulePack = pushRulePack;
module.exports.setVirtualRules = setVirtualRules;
module.exports.deleteVirtualRules = deleteVirtualRules;
module.exports.getFilterRules = getFilterRules;
module.exports.updateVirtualRule = updateVirtualRule;
module.exports.resetCaches = resetCaches;
module.exports.resetCacheslastRules = resetCacheslastRules;
module.exports.getRuleByID = getRuleByID;
module.exports.forceRefreshRules = debounce(_forceRefreshRules, Config.get('here_are_dragons.debounceTime_actionsKeys') || 16);
module.exports.forceRefreshRulesLight = debounce(_forceRefreshRulesLight, Config.get('here_are_dragons.debounceTime_actionsKeys') || 16);

if (_dev) {
   window.resetRulesCaches = resetCaches;
   window.forceRefreshRules = forceRefreshRules;
   window.updateRule = updateVirtualRule;
}
