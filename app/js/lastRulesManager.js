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

function push(rulefavObj) {
    let rulelast = _.cloneDeep(rulefavObj);

    let id = rulelast.id;

    if (!_.includes(rulelast.type, 'object')) {
        return;
    }

    if (id && rulelast.last_permit) {
        if (lastItems.get(id)) {
            lastItems = lastItems.delete(id);
        }

        rulelast.component = null;
        rulelast.fav_permit = false;
        rulelast.new_permit = false;
        rulelast.last_permit = false;
        rulelast.description = '(' + Moment(getTime()).format(Config.get('here_are_dragons.dateFormat')) + ') ' + (rulelast.description || '');
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
    if (lastItems.size) {
        return;
    }
    let load = null;
    let lastItemsTmp = null;

    if (sharedData.dataManager.dataLoaded.last) {
        load = true;
        lastItemsTmp = sharedData.dataManager.dataLoaded.last.lastItems;
    } else {
        load = false;
        Logger.warn('[Lasts] load last: no last file');
    }

    if (load) {
        lastItems = Immutable.OrderedMap(lastItemsTmp).sortBy(r => -r.params.lastDate);
        Logger.info('[Lasts] lastItems length: ', lastItems.size);
    }
}

//Save events
sharedData.idleTime.getIdleEvent().on('idle', savelast);
sharedData.app_window_and_systray.windowEvent.on('QUIT', savelast);
sharedData.app_window_and_systray.windowEvent.on('REFRESH_WIN', savelast);

//Public
module.exports.push = push;
module.exports.remove = remove;
module.exports.loadlast = loadlast;
module.exports.getlastItems = () => {
    let result = lastItems;

    //FILTER HIDDEN
    if (result.size) {
        hiddenRulesManager.gethiddenItems().map(r => {
            let idHidden = _.result(r, 'params.original_hidden_id');
            if (idHidden) {
                result = result.delete(r.id);
            }
        });
    }

    //FITER PATH-DRIVE
    result.map(r => {
        if (r.type.includes('path')) {
            result = result.delete(r.id);
        }
    });

    return result.sortBy(r => -r.params.lastDate).toArray();
};
module.exports.getAllLastItems = () => {
    return lastItems.sortBy(r => -r.params.lastDate).toArray();
};
module.exports.getlastItemsPath = path => {
    return lastItems.filter(v => v.params.original_last_path === path).sortBy(r => -r.params.lastDate).toArray();
};
module.exports.getIcon = () => {
    return icon;
};
module.exports.getPath = () => {
    return path;
};
