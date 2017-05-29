'use strict';
const _ = require('lodash');
const Moment = require('moment');
const auxjs = require('../auxfs.js');
const Immutable = require('immutable');
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');
const getTime = sharedData.realClock.getTime;

var lastItems = Immutable.OrderedMap();
var lastNeedSave = false;

var icon = {
    type: 'iconFont',
    iconClass: 'mdi-backup-restore palette-Amber-A200 text'
};

var path = {
    path: 'LAST_RULES_PATH',
    avoidCache: true,
    avoidHystory: true,
    icon: icon
};

function push(rulelast) {
    var id = rulelast.id;

    if (!_.includes(rulelast.type, 'object')) {
        return;
    }

    if (id && rulelast.last_permit) {
        if (lastItems.get(id)) {
            lastItems = lastItems.delete(id);
        }

        rulelast = _.clone(rulelast);
        rulelast.favorite = false;
        rulelast.component = null;
        rulelast.fav_permit = false;
        rulelast.last_permit = false;
        rulelast.hidden_permit = false;
        rulelast.params.original_last_id = rulelast.id;
        rulelast.params.original_last_path = rulelast.path;
        rulelast.params.lastDate = getTime();

        lastItems = lastItems.set(id, rulelast).sortBy(r => -r.params.lastDate).slice(0, Config.get('here_are_dragons.maxLastRules'));
        lastNeedSave = true;
    }
}

function remove(rulelast) {
    let id = _.result(rulelast, 'params.original_last_id');
    if (id && lastItems.get(id)) {
        rulelast.last_permit = false;
        lastItems = lastItems.delete(id);
        lastNeedSave = true;
        return;
    }

    id = rulelast.id;
    if (id && lastItems.get(id)) {
        rulelast.last_permit = false;
        lastItems = lastItems.delete(id);
        lastNeedSave = true;
        return;
    }
}

function savelast() {
    if (!lastNeedSave) {
        return;
    }

    if (!sharedData.dataManager) {
        return;
    }

    var obj2save = {
        lastItems: lastItems.toJS()
    };

    var resp = sharedData.dataManager.savelast(obj2save);

    if (!resp) {
        Logger.error('[Lasts] Fail savelast:', resp);
    } else {
        Logger.info('[Lasts] last Saved ok:', resp);
        lastNeedSave = false;
    }
}

function loadlast() {
    if (lastItems.size) {
        return;
    }
    var load = null;

    if (sharedData.dataManager.dataLoaded.last) {
        var load = true;
        var lastItemsTmp = sharedData.dataManager.dataLoaded.last.lastItems;
    } else {
        var load = false;
        Logger.warn('[Lasts] load last error: no last');
    }

    if (load) {
        lastItems = Immutable.OrderedMap(lastItemsTmp);
        Logger.info('[Lasts] lastItems length: ', lastItems.size);
    }
}

//Save events
sharedData.idleTime.getIdleEvent().on('idle', savelast);
sharedData.app_window_and_systray.windowEvent.on('QUIT', savelast);

//Public
module.exports.push = push;
module.exports.remove = remove;
module.exports.loadlast = loadlast;
module.exports.getlastItems = () => {
    return lastItems.toArray();
};
module.exports.getlastItemsPath = path => {
    return lastItems.filter(v => v.params.original_last_path === path).toArray();
};
module.exports.getIcon = () => {
    return icon;
};
module.exports.getPath = () => {
    return path;
};
