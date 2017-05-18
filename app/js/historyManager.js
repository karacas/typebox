'use strict';
const Moment = require('moment');
const _ = require('lodash');
const auxjs = require('../auxfs.js');
const Immutable = require('immutable');
const removeDiacritics = require('lodash').deburr;
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');

var historyItems = Immutable.Map();
var historyItemsKeys = Immutable.Map();
var historyNeedSave = false;

function push(ruleHistory) {
    if (!ruleHistory.rule.addInHistory || !keys === null) {
        Logger.warn('[History] No historyManager');
        return;
    }

    var keys = removeDiacritics(ruleHistory.keys.toLowerCase());
    var id = ruleHistory.rule.id;
    var date = Moment(new Date()).unix();

    var maxCant = Config.get('here_are_dragons.maxKeysInHistory');
    if (keys.length > maxCant) {
        keys = _.take(keys, maxCant).join('');
    }

    //MAKE ITEMS
    var historyItem = {};
    historyItem.date = date;
    historyItem._points = 1;

    //MAKE ITEMS-KEY
    var historyItemK = {};
    historyItemK.id = id;
    historyItemK.date = date;
    historyItemK._points_current_key = 1;

    //[HYSTORY by ID]
    var checkItem = historyItems.get(id);
    if (checkItem) {
        checkItem._points++;
    } else {
        //Map of items
        historyItems = historyItems.set(id, historyItem);
    }

    //[HYSTORY by Keys]
    if (keys.length) {
        var keysArr = historyItemsKeys.get(keys);
        var checkItemK = null;

        if (keysArr) {
            checkItemK = _.filter(keysArr, {
                id: id
            });
        }

        if (checkItemK && _.isArray(checkItemK) && checkItemK[0] && checkItemK[0]._points_current_key) {
            checkItemK[0]._points_current_key++;
        } else {
            var arrayKeys = [];
            var arrayKeysTmp = historyItemsKeys.get(keys);
            if (_.isArray(arrayKeysTmp)) {
                arrayKeys = arrayKeysTmp;
            }
            arrayKeys.push(historyItemK);
            historyItemsKeys = historyItemsKeys.set(keys, arrayKeys);
        }
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

function saveHistory() {
    //KTODO: depurador

    if (!historyNeedSave) {
        return;
    }

    if ((!historyItems.size && !historyItemsKeys.size) || !sharedData.dataManager) {
        return;
    }

    var obj2save = {
        historyItems: historyItems.toJS(),
        historyItemsKeys: historyItemsKeys.toJS()
    };

    // Logger.info(auxjs.cloneDeep(obj2save), "<<<<<<<<<<<");
    var resp = sharedData.dataManager.saveHistory(obj2save);

    if (!resp) {
        Logger.error('[History] Fail saveHistory:', resp);
    } else {
        Logger.info('[History] Saved ok:', resp);
        historyNeedSave = false;
    }
}

function loadHistory() {
    if (historyItems.size || historyItemsKeys.size) {
        return;
    }
    var load = null;

    if (sharedData.dataManager.dataLoaded.history) {
        var load = true;
        var historyItemsTmp = sharedData.dataManager.dataLoaded.history.historyItems;
        var historyItemsKeysTmp = sharedData.dataManager.dataLoaded.history.historyItemsKeys;
    } else {
        var load = false;
        Logger.warn('[History] LoadHistory error: no history');
    }

    if (load) {
        historyItems = Immutable.Map(historyItemsTmp);
        historyItemsKeys = Immutable.Map(historyItemsKeysTmp);

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

//Public
module.exports.loadHistory = loadHistory;
module.exports.push = push;
module.exports.historyItems = () => {
    return historyItems;
};
module.exports.historyItemsKeys = () => {
    return historyItemsKeys;
};
