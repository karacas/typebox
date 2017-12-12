'use strict';
const _ = require('lodash');
const Moment = require('moment');
const auxjs = require('../auxfs.js');
const Immutable = require('immutable');
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');
const favManager = require('../js/favManager.js');
const getTime = sharedData.realClock.getTime;
const resetScore = require('../js/historyManager.js').remove;

let hiddenItems = Immutable.OrderedMap();
let hiddenNeedSave = false;

const icon = {
    type: 'iconFont',
    iconClass: 'mdi-eye-outline-off palette-Amber-A200 text'
};

const path = {
    path: 'HIDDEN_RULES_PATH',
    avoidCache: true,
    avoidHistory: true,
    icon: icon
};

function push($hiddenItem) {
    let hiddenItem = _.cloneDeep($hiddenItem);

    let id = hiddenItem.id;

    if (!_.includes(hiddenItem.type, 'object')) {
        return;
    }

    if (id && hiddenItem.hidden_permit) {
        if (hiddenItem.favorite) {
            favManager.toggle(hiddenItem);
        }

        if (hiddenItems.get(id)) {
            hiddenItems = hiddenItems.delete(id);
        }

        resetScore(id);

        hiddenItem.component = null;
        hiddenItem.hidden_permit = false;
        hiddenItem.fav_permit = false;
        hiddenItem.favorite = false;
        hiddenItem.last_permit = false;
        hiddenItem.new_permit = false;
        hiddenItem.params.original_hidden_id = hiddenItem.id;
        hiddenItem.params.original_hidden_path = hiddenItem.path;
        hiddenItem.params.hiddentDate = getTime();

        hiddenItems = hiddenItems
            .set(id, hiddenItem)
            .sortBy(r => -r.params.hiddentDate)
            .slice(0, Config.get('here_are_dragons.maxHiddenRules'));
        hiddenNeedSave = true;
    }
}

function remove(hiddenItem) {
    let id = _.get(hiddenItem, 'params.original_hidden_id');
    if (id && hiddenItems.get(id)) {
        hiddenItems = hiddenItems.delete(id);
        resetScore(id);
        hiddenNeedSave = true;
    }

    id = hiddenItem.id;
    if (id && hiddenItems.get(id)) {
        hiddenItems = hiddenItems.delete(id);
        resetScore(id);
        hiddenNeedSave = true;
    }
}

const saveHiddenRules = _.throttle(
    () => {
        if (!hiddenNeedSave) {
            return;
        }

        if (!sharedData.dataManager) {
            return;
        }

        let obj2save = {
            hiddenItems: hiddenItems.toJS()
        };

        let resp = sharedData.dataManager.saveHiddenRules(obj2save);

        if (!resp) {
            Logger.error('[HiddenRules] Fail saveHiddenRules:', resp);
        } else {
            Logger.info('[HiddenRules] saveHiddenRules Saved ok:', resp);
            hiddenNeedSave = false;
        }
    },
    80,
    { trailing: false }
);

function loadHiddenRules() {
    if (hiddenItems === null) {
        return;
    }
    let hiddenItemsTmp = null;

    if (sharedData.dataManager.dataLoaded.hiddenRules) {
        hiddenItemsTmp = sharedData.dataManager.dataLoaded.hiddenRules.hiddenItems;
    } else {
        Logger.warn('[HiddenRules] load: no hidden file');
    }

    if (hiddenItemsTmp) {
        hiddenItems = Immutable.OrderedMap(_.cloneDeep(hiddenItemsTmp));
        Logger.info('[HiddenRules] hiddenItems length: ', hiddenItems.size);
    }
}

function toggle(hiddenItem) {
    let id = hiddenItem.id;

    if (id && hiddenItems.get(id)) {
        hiddenItems = hiddenItems.delete(id);
        hiddenNeedSave = true;
    }

    id = _.get(hiddenItem, 'params.original_hidden_id');
    if (id && hiddenItems.get(id)) {
        hiddenItems = hiddenItems.delete(id);
        hiddenNeedSave = true;
        return;
    }

    if (hiddenItem.hidden_permit === true) {
        push(hiddenItem);
        hiddenNeedSave = true;
        return;
    }
}

//Save events
sharedData.idleTime.getIdleEvent().on('idle', saveHiddenRules);
sharedData.app_window_and_systray.windowEvent.on('QUIT', saveHiddenRules);
sharedData.app_window_and_systray.windowEvent.on('REFRESH_WIN', saveHiddenRules);

//Public
module.exports.push = push;
module.exports.remove = remove;
module.exports.toggle = toggle;
module.exports.save = saveHiddenRules;
module.exports.loadHiddenRules = loadHiddenRules;
module.exports.gethiddenItemsIm = () => {
    return hiddenItems;
};
module.exports.gethiddenItems = () => {
    return hiddenItems.toSet().toArray();
};
module.exports.gethiddenItemsPath = path => {
    return hiddenItems
        .filter(v => v.params.original_hidden_path === path)
        .toSet()
        .toArray();
};
module.exports.isHide = id => {
    return Boolean(hiddenItems.get(id));
};
module.exports.getIcon = () => {
    return icon;
};
module.exports.getPath = () => {
    return path;
};
