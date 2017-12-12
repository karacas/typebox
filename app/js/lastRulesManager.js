'use strict';
const _ = require('lodash');
const Moment = require('moment');
const auxjs = require('../auxfs.js');
const Immutable = require('immutable');
const hiddenRulesManager = require('../js/hiddenRulesManager.js');
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');
const getTime = sharedData.realClock.getTime;

let lastItems = Immutable.OrderedMap();
let lastNeedSave = false;

let ephemeralPaths = [];

const icon = {
    type: 'iconFont',
    iconClass: 'mdi-backup-restore palette-Amber-A200 text'
};

const path = {
    name: 'history',
    path: 'LAST_RULES_PATH',
    avoidCache: true,
    avoidHistory: true,
    icon: icon
};

const flatten = list => list.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), []);

function getItemsToDeleteByPath($path) {
    return lastItems
        .filter(v => v.params.original_last_path === $path)
        .sortBy(r => -r.params.lastDate)
        .slice(Config.get('here_are_dragons.maxLastRules_ephemeral'))
        .toArray()
        .map(r => r[0]);
}

function getItemsToDeleteByPaths($paths) {
    return flatten($paths.map(getItemsToDeleteByPath));
}

function purge() {
    let items2del = getItemsToDeleteByPaths(ephemeralPaths);
    lastItems = lastItems
        .deleteAll(items2del)
        .sortBy(r => -r.params.lastDate)
        .slice(0, Config.get('here_are_dragons.maxLastRules'));
}

function push(rulefavObj) {
    if (!rulefavObj) return;

    let rulelast = _.cloneDeep(rulefavObj);

    let id = rulelast.id;

    if (!id || !_.includes(rulelast.type, 'object')) {
        return;
    }

    if (rulelast.last_permit) {
        if (lastItems.get(id)) {
            lastItems = lastItems.delete(id);
        }

        rulelast.component = null;
        rulelast.fav_permit = false;
        rulelast.new_permit = false;
        rulelast.last_permit = false;
        rulelast.description = rulelast.description;
        rulelast.hidden_permit = false;
        rulelast.params.original_last_id = rulelast.id;
        rulelast.params.original_last_path = rulelast.path;
        rulelast.params.original_description = rulelast.description;
        rulelast.params.lastDate = getTime();

        lastItems = lastItems.set(id, rulelast);
        purge();

        lastNeedSave = true;
    }
}

function remove(rulelast) {
    let id = _.get(rulelast, 'params.original_last_id');
    if (id && lastItems.get(id)) {
        rulelast.last_permit = false;
        lastItems = lastItems.delete(id);
        lastNeedSave = true;
    }

    id = rulelast.id;
    if (id && lastItems.get(id)) {
        rulelast.last_permit = false;
        lastItems = lastItems.delete(id);
        lastNeedSave = true;
    }
}

const savelast = _.throttle(
    () => {
        if (!lastNeedSave) {
            return;
        }

        if (!sharedData.dataManager) {
            return;
        }

        let obj2save = {
            lastItems: lastItems.toJS()
        };

        let resp = sharedData.dataManager.savelast(obj2save);

        if (!resp) {
            Logger.error('[Lasts] Fail savelast:', resp);
        } else {
            Logger.info('[Lasts] last Saved ok:', resp);
            lastNeedSave = false;
        }
    },
    80,
    { trailing: false }
);

function loadlast() {
    if (lastItems === null) {
        return;
    }
    let lastItemsTmp = null;

    if (sharedData.dataManager.dataLoaded.last) {
        lastItemsTmp = sharedData.dataManager.dataLoaded.last.lastItems;
    } else {
        Logger.warn('[Lasts] load last: no last file');
    }

    if (lastItemsTmp) {
        lastItems = Immutable.OrderedMap(_.cloneDeep(lastItemsTmp)).sortBy(r => -r.params.lastDate);
        Logger.info('[Lasts] lastItems length: ', lastItems.size);
    }
}

//Save events
sharedData.idleTime.getIdleEvent().on('idle', savelast);
sharedData.app_window_and_systray.windowEvent.on('QUIT', savelast);
sharedData.app_window_and_systray.windowEvent.on('REFRESH_WIN', savelast);

//Public
module.exports.push = push;
module.exports.pushToephemeralPaths = $path => {
    if (!$path) return;
    ephemeralPaths = [...new Set(ephemeralPaths.concat([String($path)]))];
};
module.exports.save = savelast;
module.exports.remove = remove;
module.exports.loadlast = loadlast;
module.exports.getlastItems = (filterPaths = true) => {
    let result = lastItems;

    if (result) {
        let toDel = hiddenRulesManager.gethiddenItems().map(r => {
            if (r.params && r.params && r.params.original_hidden_id) {
                return r.id;
            }
        });
        if (toDel.length > 0) result = result.deleteAll(toDel);
    }

    if (filterPaths) {
        let toDel = result.map(r => {
            if (r.type.includes('path')) return r.id;
        });
        if (toDel.length > 0) result = result.deleteAll(toDel);
    }

    return result
        .toSet()
        .sortBy(r => -r.params.lastDate)
        .toArray();
};
module.exports.getAllLastItems = () => {
    return lastItems
        .toSet()
        .sortBy(r => -r.params.lastDate)
        .toArray();
};
module.exports.getlastItemsPath = path => {
    return lastItems
        .filter(v => v.params.original_last_path === path)
        .toSet()
        .sortBy(r => -r.params.lastDate)
        .toArray();
};
module.exports.getIcon = () => {
    return icon;
};
module.exports.getPath = () => {
    return path;
};
module.exports.getFolderLastsPath = () => {
    let fpath = _.cloneDeep(path);
    fpath.name = 'Last folders';
    fpath.path = 'LASTS_DRIVE';
    return fpath;
};
