'use strict';
require('string_score');
const _ = require('lodash');
const removeDiacritics = require('lodash').deburr;
const moment = require('moment');
const Immutable = require('immutable');
const HistoryManager = require('../js/historyManager.js');
const hiddenRulesManager = require('../js/hiddenRulesManager.js');
const favManager = require('../js/favManager.js');
const newsManager = require('../js/newsManager.js');
const PackagesManager = require('../js/packagesManager.js');
const ListViewStore = require('../js/listViewStore.js');
const createRule = require('../js/rule.js').getNewRule;
const makeRuleIdHash = require('../js/rule.js').makeRuleIdHash;
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const makeRulePath = require('../js/path.js');
const sharedData = require('../js/sharedData.js');

let rules = Immutable.OrderedMap();
let cache_paths = Immutable.OrderedMap();
let rulesCacheFirstKey = Immutable.OrderedMap();
let virtaulrules = Immutable.OrderedMap();
let lastRulesCache = Immutable.OrderedMap();
let lastRulesQuery = null;
let logTimes = Config.get('here_are_dragons.verboseTimes');
let filteredRules = Immutable.OrderedMap();

function resetCaches() {
    cache_paths = Immutable.OrderedMap();
    rulesCacheFirstKey = Immutable.OrderedMap();
    resetCacheslastRules();
}

function resetCacheslastRules() {
    lastRulesCache = Immutable.OrderedMap();
    lastRulesQuery = null;
}

function forceRefreshRules() {
    resetCaches();
    ListViewStore.storeActions.updateFilterlist();
}

function getFilterRules($keys = '', $optPath) {
    let optPath = makeRulePath.get($optPath);

    let path = String(optPath.path);
    let sort = optPath.sort;
    let keys = removeDiacritics($keys).toLowerCase();
    let haveKeys = keys.length !== 0;
    let sortBy = optPath.sortBy;
    let avoidCache = optPath.avoidCache;
    let checkNews = optPath.checkNews;

    if (sortBy) {
        sort = true;
    }

    if (!rules.size || (!haveKeys && Config.get('here_are_dragons.initEmpty') && path === '/')) {
        return Immutable.OrderedMap();
    }

    //CACHE LAST QUERY
    let actualRulesQuery = keys + path + sort + virtaulrules.size;
    if (actualRulesQuery === lastRulesQuery && lastRulesCache.size && avoidCache == false) {
        return lastRulesCache;
    }

    //TIME LOG
    if (logTimes) {
        Logger.group('________ Keys: ', keys, ' / path: ', path, ' / sort: ', sort);
    }
    let timeStart1 = new moment(new Date());

    //CACHE pathS
    if (!cache_paths.get(path)) {
        cache_paths = cache_paths.set(path, rules.filter(v => v.path === path));
    }
    filteredRules = cache_paths.get(path);

    //CACHE FIRST KEY
    let firstKeyCheck = false;
    if (haveKeys && path === '/') {
        let firstKey = keys[0];
        if (!rulesCacheFirstKey.get(firstKey)) {
            rulesCacheFirstKey = rulesCacheFirstKey.set(firstKey, filteredRules.filter(v => v.searchField.includes(firstKey)));
        }
        filteredRules = rulesCacheFirstKey.get(firstKey);
        firstKeyCheck = true;
    }

    //ADD VIRTUAL RULES
    if (virtaulrules.size > 0) {
        virtaulrules.forEach((obj, plugin) => {
            filteredRules = filteredRules.concat(obj.filter(v => v.path === path));
        });
    }

    //Filter Hidden rules
    if (filteredRules.size) {
        hiddenRulesManager.gethiddenItems().map(r => {
            let idHidden = _.result(r, 'params.original_hidden_id');
            if (idHidden) {
                filteredRules = filteredRules.delete(r.id);
            }
        });
    }

    //FAV
    if (filteredRules.size) {
        favManager.getFavItems().map(r => {
            let ruleFav = filteredRules.get(r.id);
            if (ruleFav) ruleFav.favorite = true;
        });
    }

    // MARK NEWS NEWS
    if (checkNews) {
        newsManager.checkNews(filteredRules, optPath);
    }

    //FUZZY
    let tmpResultFuzzy;
    //KTODO: Revisar bien esto
    // if (haveKeys && (keys.length > 1 || !firstKeyCheck)) {
    if (haveKeys && (keys.length > 0 || !firstKeyCheck)) {
        filteredRules = filteredRules.filter(r => {
            tmpResultFuzzy = r.searchField.score(keys);
            if (r.persistFuzzy && tmpResultFuzzy === 0) {
                tmpResultFuzzy = 0.01;
            }
            if (sort) {
                r._distance_keys_cache = tmpResultFuzzy;
            }
            return tmpResultFuzzy > 0;
        });
    }

    if (logTimes) {
        Logger.info(' > ', new moment(new Date()).diff(timeStart1), ' > 1: Caches & Fuzzy');
    }

    //SORT
    if (sort) {
        let timeStarFiletadnSort = 0;
        let timSort = 0;

        if (logTimes) {
            timeStarFiletadnSort = new moment(new Date());
        }

        let filteredRulesObj = score_addMatchesRulesHistoryPoints(filteredRules, keys);
        let allNoHistory = filteredRulesObj.allNoHistory;
        filteredRules = filteredRulesObj.filteredRules;

        if (logTimes) {
            Logger.info(' > ', new moment(new Date()).diff(timeStarFiletadnSort), ' > 2: TOTAL TIME in match & points');
        }
        if (logTimes) {
            timSort = new moment(new Date());
        }

        if (!sortBy) {
            if (!(!haveKeys && allNoHistory)) {
                if (!haveKeys) {
                    filteredRules = filteredRules
                        .toSeq()
                        .sortBy(r => r.order)
                        .sortBy(r => -r.initSort)
                        .sortBy(r => -r._score)
                        .sortBy(r => -r.posFixed)
                        .sortBy(r => -Number(r.isNew));
                } else {
                    // filteredRules = filteredRules.toSeq().sortBy(r => r.order).sortBy(r => -r.initSort).sortBy(r => -r._score);
                    filteredRules = filteredRules.sortBy(r => -r._score);
                }
            }
        } else {
            filteredRules = filteredRules.sortBy(r => r[sortBy]);
        }

        if (logTimes) {
            Logger.info(' > ', new moment(new Date()).diff(timSort), ' > 3: TIME in sort / Cant: ', filteredRules.size);
        }
    }

    if (logTimes) {
        Logger.info(' >>> ', new moment(new Date()).diff(timeStart1), 'TOTAL TIME: timeStart1 / Cant: ', filteredRules.size);
    }
    if (logTimes) {
        Logger.groupEnd();
    }

    filteredRules = filteredRules.toSeq();
    lastRulesQuery = actualRulesQuery;
    lastRulesCache = filteredRules;

    return filteredRules;
}

function score_addMatchesRulesHistoryPoints($filteredRules, keys) {
    if (!rules.size) {
        return Immutable.OrderedMap();
    }

    let haveKeys = keys.length !== 0;
    let tmp_map_historyItemsMatchKeys = Immutable.OrderedMap();
    let tmp_historyItemsMatch = null;
    let tmp_historyItemsMatchK = null;
    let tmp_r_id = null;
    let tmp_r_hist = null;
    let $historyItems = HistoryManager.historyItems();
    let $historyItemsKeys = HistoryManager.historyItemsKeys();
    let allNoHistory = true;

    let timeStartH = new moment(new Date());

    let scoreNoKeys = 1;
    let scoreDistanceKeys = 0;
    let scoreCurrentKey = 0;
    let scoreNew = 30;
    let scoreFav = 10;

    if (haveKeys) {
        scoreNoKeys = 0.1;
        scoreDistanceKeys = 1;
        scoreCurrentKey = 10;
        scoreNew = 1;
        scoreFav = 2.5;
        //MATCH: historyItemsKeys con rules para _points_current_key
        let keysArrTpm = $historyItemsKeys.get(keys);
        if (keysArrTpm && _.isArray(keysArrTpm)) {
            keysArrTpm.forEach(o => (tmp_map_historyItemsMatchKeys = tmp_map_historyItemsMatchKeys.set(o.id, o._points_current_key)));
        }
    }

    if (logTimes) {
        Logger.info(
            '   ',
            new moment(new Date()).diff(timeStartH),
            ' > Match Keys Hist / Cant: ',
            $historyItemsKeys.size,
            ' / Cant Filtered: ',
            tmp_map_historyItemsMatchKeys.size
        );
    }

    //ADD SCORE
    let timeStartH2 = new moment(new Date());

    $filteredRules.map(r => {
        r._points = r._points_current_key = r._distance_keys = 0;
        tmp_r_id = r.id;
        tmp_r_hist = r.addInHistory;

        if (tmp_r_hist) allNoHistory = false;

        //MATCH: Fuzzy
        if (haveKeys) {
            if (r._distance_keys_cache !== -1) {
                r._distance_keys = r._distance_keys_cache;
            } else {
                r._distance_keys = r.searchField.score(keys);
            }
        }

        //KTODO: No se puede hacer por  fuera? como los favs?
        //MATCH: historyItems/rules >_points
        if (tmp_r_hist) {
            tmp_historyItemsMatch = $historyItems.get(tmp_r_id);
            if (undefined !== tmp_historyItemsMatch) {
                r._points = tmp_historyItemsMatch._points;
            }
        }

        //MATCH: historyItemsKeys/rules >_points
        if (tmp_r_hist && haveKeys) {
            tmp_historyItemsMatchK = tmp_map_historyItemsMatchKeys.get(tmp_r_id);
            if (undefined !== tmp_historyItemsMatchK) {
                r._points_current_key = tmp_historyItemsMatchK;
            }
        }

        //CALC POINTS
        r._score = ~~(
            10000 *
            (r._distance_keys * r._distance_keys * scoreDistanceKeys +
                r._points * scoreNoKeys +
                r._points_current_key * scoreCurrentKey +
                Number(r.favorite) * scoreFav +
                Number(r.isNew) * scoreNew) *
            r.specialScoreMult
        );
        r._points_p = r._points;
        r._points_current_key_p = r._points_current_key;
        r._score_p = r._score;

        //RESET
        r._distance_keys_cache = -1;
    });

    if (logTimes) {
        Logger.info('   ', new moment(new Date()).diff(timeStartH2), ' > Add Score / Cant: ', $filteredRules.size);
    }

    return { filteredRules: $filteredRules, allNoHistory: allNoHistory };
}

/*
Push bulpack of rules (add Array)
*/
function pushRulePack(objAdd) {
    if (!objAdd || !objAdd.length) {
        return;
    }

    let pack = objAdd.map($obj => {
        let obj = createRule($obj);
        if (obj !== null) {
            return [obj.id, obj];
        }
    });

    rules = rules.concat(Immutable.OrderedMap(pack));
    resetCaches();
}

function deleteVirtualRules(pluginId) {
    if (!pluginId) {
        return;
    }
    let rulesToDelete = virtaulrules.get(pluginId);
    if (rulesToDelete !== undefined && rulesToDelete.size) {
        virtaulrules = virtaulrules.delete(pluginId);
        forceRefreshRules();
    }
}

function loadingAction(path, nameLoader = null) {
    return {
        path: path,
        isLoading: true,
        title: nameLoader
    };
}

function addLoader(path, pluginId, replace, nameLoader) {
    if (path) {
        setVirtualRules([loadingAction(path, nameLoader)], pluginId, replace);
    }
}

function setVirtualRules(objAdd, pluginId, replace = false) {
    if (!pluginId) {
        return;
    }

    if (!PackagesManager.getPluginByName(pluginId)) {
        return;
    }

    if (!objAdd.length) {
        if (replace) {
            deleteVirtualRules(pluginId);
        }
        return;
    }

    let pack = objAdd.map($obj => {
        let obj = createRule($obj);
        if (!obj || !obj.id) {
            Logger.warn('RULE: No obj:', obj);
            return null;
        }
        obj.isVirtual = true;
        return [obj.id, obj];
    });

    let virtualRulePack = Immutable.OrderedMap(pack);

    if (!replace && virtaulrules.get(pluginId)) {
        virtualRulePack = virtaulrules.get(pluginId).concat(virtualRulePack);
    }

    virtaulrules = virtaulrules.set(pluginId, virtualRulePack);

    forceRefreshRules();
}

function removeLoader(path, pluginId) {
    if (!pluginId) {
        return;
    }

    if (!PackagesManager.getPluginByName(pluginId)) {
        return;
    }

    let virtualRulePack = virtaulrules.get(pluginId).filter(v => {
        if (!path) {
            //REMOVE ALL
            return !v.isLoading;
        }
        return !(v.path === path && v.isLoading);
    });

    setVirtualRules(virtualRulePack.toArray(), pluginId, true);
}

//_________________________________
//SET PUBLIC
//_________________________________
module.exports.addLoader = addLoader;
module.exports.removeLoader = removeLoader;
module.exports.pushRulePack = pushRulePack;
module.exports.setVirtualRules = setVirtualRules;
module.exports.deleteVirtualRules = deleteVirtualRules;
module.exports.getFilterRules = getFilterRules;
module.exports.resetCaches = resetCaches;
module.exports.resetCacheslastRules = resetCacheslastRules;
module.exports.forceRefreshRules = forceRefreshRules;
window.resetRulesCaches = resetCaches;
