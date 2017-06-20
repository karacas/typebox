'use strict';

const Moment = require('moment');
const _ = require('lodash');
const auxjs = require('../auxfs.js');
const Immutable = require('immutable');
const removeDiacritics = require('lodash').deburr;
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');
const getTime = sharedData.realClock.getTime;

let historyItems = Immutable.OrderedMap();
let historyItemsKeys = Immutable.OrderedMap();
let historyNeedSave = false;

function remove(ruleHistory) {
    let id = _.result(ruleHistory, 'rule.id') || ruleHistory;

    let checkItem = historyItems.get(id);
    if (checkItem) {
        historyItems = historyItems.delete(id);
        try {
            depure(true);
        } catch (e) {
            Logger.warn('[History] depure error', e);
        }
    }
}

function push(ruleHistory) {
    let keys = removeDiacritics(ruleHistory.keys.toLowerCase());

    if (!ruleHistory.rule.addInHistory || !keys === null) {
        Logger.info('[History] No addInHistory');
        return;
    }

    let id = ruleHistory.rule.id;
    let date = getTime();

    let maxCant = Config.get('here_are_dragons.maxKeysInHistory');
    if (keys.length > maxCant) {
        keys = _.take(keys, maxCant).join('');
    }

    //MAKE ITEMS
    let historyItem = {};
    historyItem.date = date;
    historyItem._points = 1;

    //MAKE ITEMS-KEY
    let historyItemK = {};
    historyItemK.id = id;
    historyItemK.date = date;
    historyItemK._points_current_key = 1;

    //[HISTORY by ID]
    let checkItem = historyItems.get(id);
    if (checkItem) {
        checkItem._points++;
        checkItem.date = date;
    } else {
        //Map of items
        historyItems = historyItems.set(id, historyItem);
    }

    //[HISTORY by Keys
    if (keys.length) {
        let keysArr = historyItemsKeys.get(keys);
        let checkItemK = null;

        if (keysArr) {
            checkItemK = _.filter(keysArr, {
                id: id
            });
        }

        if (checkItemK && _.isArray(checkItemK) && checkItemK[0] && checkItemK[0]._points_current_key) {
            checkItemK[0]._points_current_key++;
            checkItemK[0].date = date;
        } else {
            let arrayKeys = [];
            let arrayKeysTmp = historyItemsKeys.get(keys);
            if (_.isArray(arrayKeysTmp)) {
                arrayKeys = arrayKeysTmp;
            }
            arrayKeys.push(historyItemK);
            historyItemsKeys = historyItemsKeys.set(keys, arrayKeys);
        }
    }

    //PURGE
    try {
        depure();
    } catch (e) {
        Logger.warn('[History] depure error', e);
    }

    //MAke Big History
    if (false) {
        Array.from(new Array(1000), (x, i) => i).map(i => {
            historyItems = historyItems.set(String(ii), historyItem);
            historyItemsKeys = historyItemsKeys.set(String(ii) + '100', [historyItemK]);
        });
    }

    historyNeedSave = true;
}

function depure(force = false) {
    let historyItems_max = Math.round(Config.get('here_are_dragons.maxItemsInHistory') || 320);

    if (historyItems.size > historyItems_max * 1.25 || force) {
        Logger.info('[History] depure', 'historyItems.size', historyItems.size);

        //FILTER historyItems
        historyItems = historyItems.sortBy(r => -r.date).slice(0, Math.abs(historyItems_max * 1.1));
        historyItems = historyItems.sortBy(r => -r.date).sortBy(r => -r._points).slice(0, historyItems_max);

        //FILTER historyItemsKeys
        let historyItemsKeysNew = Immutable.OrderedMap();
        historyItemsKeys.map((keys, id) => {
            let nKeys = keys.filter(key => {
                return Boolean(historyItems.get(key.id));
            });
            if (nKeys.length) {
                historyItemsKeysNew = historyItemsKeysNew.set(id, nKeys);
            }
        });
        historyItemsKeys = historyItemsKeysNew;
        historyNeedSave = true;
    }
}

const saveHistory = _.throttle(
    () => {
        if (!historyNeedSave) {
            return;
        }

        if ((!historyItems.size && !historyItemsKeys.size) || !sharedData.dataManager) {
            return;
        }

        let obj2save = {
            historyItems: historyItems.toJS(),
            historyItemsKeys: historyItemsKeys.toJS()
        };

        // Logger.info(auxjs.cloneDeep(obj2save), "<<<<<<<<<<<");
        let resp = sharedData.dataManager.saveHistory(obj2save);

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
    if (historyItems.size || historyItemsKeys.size) {
        return;
    }

    let load = null;
    let historyItemsTmp;
    let historyItemsKeysTmp;

    if (sharedData.dataManager.dataLoaded.history) {
        load = true;
        historyItemsTmp = sharedData.dataManager.dataLoaded.history.historyItems;
        historyItemsKeysTmp = sharedData.dataManager.dataLoaded.history.historyItemsKeys;
    } else {
        load = false;
        Logger.warn('[History] LoadHistory warn: no history');
    }

    if (load) {
        historyItems = Immutable.OrderedMap(historyItemsTmp);
        historyItemsKeys = Immutable.OrderedMap(historyItemsKeysTmp);

        if (!true) {
            /*dev*/ //PRINT HISTORY
            Logger.info(auxjs.cloneDeep(historyItemsTmp));
            Logger.info(auxjs.cloneDeep(historyItemsKeysTmp));
        }

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
module.exports.push = push;
module.exports.remove = remove;
module.exports.historyItems = () => {
    return historyItems;
};
module.exports.historyItemsKeys = () => {
    return historyItemsKeys;
};
