'use strict';

const scoreKrc = require('./aux_score_krc.js');

const _ = require('lodash');
const removeDiacritics = require('diacritics').remove;
const moment = require('moment');
const Immutable = require('immutable');
const HistoryManager = require('../js/historyManager.js');
const hiddenRulesManager = require('../js/hiddenRulesManager.js');
const favManager = require('../js/favManager.js');
const newsManager = require('../js/newsManager.js');
const PackagesManager = require('../js/packagesManager.js');
const ListViewStore = require('../js/listViewStore.js');
const createRule = require('../js/rule.js').getNewRule;
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const makeRulePath = require('../js/path.js');
const sharedData = require('../js/sharedData.js');

const _initEmpty = !!Config.get('here_are_dragons.initEmpty');

let rules = Immutable.OrderedMap();
let cache_paths = Immutable.OrderedMap();
let rulesCacheFirstKey = Immutable.OrderedMap();
let virtaulrules = Immutable.OrderedMap();
let lastRulesCache = Immutable.OrderedMap();
let lastRulesQuery = null;
let filteredRules = Immutable.OrderedMap();

let logTimes = !!Config.get('here_are_dragons.verboseTimes');

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
    //KTODO: SEPARAR EN MAS FUNCIONES

    let optPath = makeRulePath.get($optPath);

    let path = String(optPath.path);
    let sort = optPath.sort;
    let keys = removeDiacritics($keys.toLowerCase());
    let haveKeys = keys.length > 0;
    let sortBy = optPath.sortBy;
    let avoidCache = !!optPath.avoidCache;
    let checkNews = !!optPath.checkNews;

    if (rules.size === 0 || (!haveKeys && _initEmpty && path === '/')) {
        return Immutable.OrderedMap();
    }

    sort = !!sortBy || !!sort;

    //CACHE LAST QUERY
    let actualRulesQuery = keys + '[/]' + path + '[/]' + sort + '[/]' + virtaulrules.size;
    if (actualRulesQuery === lastRulesQuery && lastRulesCache.size !== 0 && !avoidCache) {
        if (logTimes) {
            console.info('      >>>> USE CACHE');
        }
        return lastRulesCache;
    }

    logTimes = !!Config.get('here_are_dragons.verboseTimes');

    //TIME LOG
    if (logTimes) {
        console.group('________ Keys: ', keys, ' / path: ', path, ' / sort: ', sort);
    }
    let timeStart1 = new moment(new Date());

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
            console.info('      >>>> MAKE CACHE: ', new moment(new Date()).diff(timeStart1));
            console.info('      >>>> VRULES: ', new moment(new Date()).diff(timeStart1));
        }

        //Filter Hidden rules
        filteredRules = filteredRules.deleteAll(hiddenRulesManager.gethiddenItemsIm().map(r => r.params.original_hidden_id));
        if (logTimes) {
            console.info('      >>>> HIDDEN: ', new moment(new Date()).diff(timeStart1));
        }

        filteredRules = filteredRules.toSeq().cacheResult();

        //FAV
        if (filteredRules.size > 0) {
            favManager.getFavItemsIm().forEach(r => {
                let ruleFav = filteredRules.get(r.id);
                if (ruleFav) ruleFav.favorite = true;
            });
            if (logTimes) {
                console.info('      >>>> FAV: ', new moment(new Date()).diff(timeStart1));
            }
        }

        // MARK NEWS NEWS
        if (checkNews) {
            newsManager.checkNews(filteredRules, optPath);
            if (logTimes) {
                console.info('      >>>> NEWS: ', new moment(new Date()).diff(timeStart1));
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
            r._distance_keys_cache = tmpResultFuzzy;
            return tmpResultFuzzy > 0;
        });
    }

    if (logTimes) {
        console.info('      >>>> FUZZY: ', new moment(new Date()).diff(timeStart1));
        console.info(' > ', new moment(new Date()).diff(timeStart1), ' > 1: Caches & Fuzzy');
    }

    //SORT
    if (sort && filteredRules.size !== 0) {
        let _typeSort = 'noSort';
        let timeStarFiletadnSort = 0;
        let timSort = 0;

        if (logTimes) {
            timeStarFiletadnSort = new moment(new Date());
        }

        let filteredRulesObj = score_addMatchesRulesHistoryPoints(filteredRules, keys);
        let allNoHistory = filteredRulesObj.allNoHistory;
        let sizeFilteredRulesObj = filteredRulesObj.size;
        filteredRules = filteredRulesObj.filteredRules;

        if (logTimes) {
            console.info(' > ', new moment(new Date()).diff(timeStarFiletadnSort), ' > 2: TOTAL TIME in match & points');
            timSort = new moment(new Date());
        }

        if (sizeFilteredRulesObj > 1) {
            if (sortBy) {
                _typeSort = 'sortBy ' + sortBy;
                filteredRules = filteredRules.sortBy(r => r[sortBy]);
            } else if (!(!haveKeys && allNoHistory)) {
                if (!haveKeys) {
                    _typeSort = 'noKeys - largeSort';
                    filteredRules = filteredRules
                        .sortBy(r => r.order)
                        .sortBy(r => -r.initSort)
                        .sortBy(r => -r._score)
                        .sortBy(r => -Number(r.isNew))
                        .sortBy(r => -r.posFixed);
                } else {
                    _typeSort = 'by score';
                    filteredRules = filteredRules.sortBy(r => -r._score);
                }
            }
        }

        if (logTimes) {
            console.info(' > ', new moment(new Date()).diff(timSort), ' > 3: TIME in sort / Cant: ', sizeFilteredRulesObj, ' / typeSort:', _typeSort);
        }
    }

    filteredRules = filteredRules.cacheResult();
    lastRulesQuery = actualRulesQuery;
    lastRulesCache = filteredRules;

    if (logTimes) {
        console.info(' >>> TOTAL TIME:', new moment(new Date()).diff(timeStart1), ' / Cant: ', filteredRules.size);
        console.groupEnd();
    }

    return filteredRules;
}

function score_addMatchesRulesHistoryPoints($filteredRules, keys) {
    let haveKeys = keys.length > 0;
    let tmp_map_historyItemsMatchKeys = Immutable.OrderedMap();
    let tmp_historyItemsMatch = null;
    let tmp_historyItemsMatchK = null;
    let tmp_r_id = null;
    let tmp_r_hist = null;

    let $historyItems = HistoryManager.historyItems();
    let $historyItemsKeys = HistoryManager.historyItemsKeys();

    let allNoHistory = true;

    let timeStartH = logTimes ? new moment(new Date()) : 0;

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

    if (logTimes) {
        console.info(
            '   ',
            new moment(new Date()).diff(timeStartH),
            ' > Match Keys Hist / Cant: ',
            $historyItemsKeys.size,
            ' / Cant Filtered: ',
            tmp_map_historyItemsMatchKeys.size
        );
    }

    //ADD SCORE
    let timeStartH2 = logTimes ? new moment(new Date()) : 0;

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
                    r._points_current_key = tmp_historyItemsMatchK;
                }
            }
        }

        //CALC POINTS
        r._score = ~~(
            10000 *
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
        console.info('   ', new moment(new Date()).diff(timeStartH2), ' > Add Score / Cant: ', _sizeFilteredRules);
    }

    return { filteredRules: $filteredRules, allNoHistory: allNoHistory, size: _sizeFilteredRules };
}

/*
Push bulpack of rules (add Array)
*/
function pushRulePack(objAdd, data) {
    if (!objAdd || !objAdd.length > 0) {
        return;
    }

    let globalIcon = data && data.icon ? data.icon : null;

    rules = rules.merge(
        objAdd.map($obj => {
            if ($obj) {
                $obj.icon = $obj.icon || globalIcon;
                $obj = createRule($obj);
                if ($obj !== null && $obj.id) {
                    return [$obj.id, $obj];
                }
            }
        })
    );

    resetCaches();
}

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

function loadingAction(path, nameLoader = null) {
    return {
        path: path,
        isLoading: true,
        title: nameLoader
    };
}

function infoAction(path, nameLoader = null) {
    return {
        path: path,
        isInfo: true,
        title: nameLoader
    };
}

function addLoader(path, pluginId, replace, nameLoader) {
    if (path) {
        setVirtualRules([loadingAction(path, nameLoader)], pluginId, replace);
    }
}

function addInfo(path, pluginId, replace, nameLoader) {
    if (path) {
        setVirtualRules([infoAction(path, nameLoader)], pluginId, replace);
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

    let pack = objAdd.map($obj => {
        if ($obj) {
            $obj = createRule($obj);
            if (!$obj === null || !$obj.id) {
                Logger.warn('RULE: No obj:', $obj);
                return null;
            }
            $obj.isVirtual = true;
            return [$obj.id, $obj];
        }
    });

    if (replace) {
        virtaulrules = virtaulrules.set(pluginId, Immutable.OrderedMap(pack));
    } else {
        let virtualRulePack = Immutable.OrderedMap(pack);
        let virtualRulePlugin = virtaulrules.get(pluginId);
        if (virtualRulePlugin) {
            virtualRulePack = virtualRulePlugin.merge(virtualRulePack);
        }
        virtaulrules = virtaulrules.set(pluginId, virtualRulePack);
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

    let virtualRulePack = virtaulrules.get(pluginId).filter(v => {
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
//KTODO: Ver si hay que sacar
window.resetRulesCaches = resetCaches;
