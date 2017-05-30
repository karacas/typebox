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

var hiddenItems = Immutable.OrderedMap();
var hiddenNeedSave = false;

var icon = {
    type: 'iconFont',
    iconClass: 'mdi-eye-outline-off palette-Amber-A200 text'
};

var path = {
    path: 'HIDDEN_RULES_PATH',
    avoidCache: true,
    avoidHystory: true,
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

        hiddenItem.component = null;
        hiddenItem.fav_permit = false;
        hiddenItem.last_permit = false;
        hiddenItem.params.original_hidden_id = hiddenItem.id;
        hiddenItem.params.original_hidden_path = hiddenItem.path;
        hiddenItem.params.hiddentDate = getTime();

        hiddenItems = hiddenItems.set(id, hiddenItem).sortBy(r => -r.params.hiddentDate).slice(0, Config.get('here_are_dragons.maxHiddenRules'));
        hiddenNeedSave = true;
    }
}

function remove(hiddenItem) {
    let id = _.result(hiddenItem, 'params.original_hidden_id');
    if (id && hiddenItems.get(id)) {
        hiddenItems = hiddenItems.delete(id);
        hiddenNeedSave = true;
    }

    id = hiddenItem.id;
    if (id && hiddenItems.get(id)) {
        hiddenItems = hiddenItems.delete(id);
        hiddenNeedSave = true;
    }
}

function saveHiddenRules() {
    if (!hiddenNeedSave) {
        return;
    }

    if (!sharedData.dataManager) {
        return;
    }

    var obj2save = {
        hiddenItems: hiddenItems.toJS()
    };

    var resp = sharedData.dataManager.saveHiddenRules(obj2save);

    if (!resp) {
        Logger.error('[HiddenRules] Fail saveHiddenRules:', resp);
    } else {
        Logger.info('[HiddenRules] saveHiddenRules Saved ok:', resp);
        hiddenNeedSave = false;
    }
}

function loadHiddenRules() {
    if (hiddenItems.size) {
        return;
    }
    var load = null;

    if (sharedData.dataManager.dataLoaded.hiddenRules) {
        var load = true;
        var hiddenItemsTmp = sharedData.dataManager.dataLoaded.hiddenRules.hiddenItems;
    } else {
        var load = false;
        Logger.warn('[HiddenRules] load: no hidden file');
    }

    if (load) {
        hiddenItems = Immutable.OrderedMap(hiddenItemsTmp);
        Logger.info('[HiddenRules] hiddenItems length: ', hiddenItems.size);
    }
}

//Save events
sharedData.idleTime.getIdleEvent().on('idle', saveHiddenRules);
sharedData.app_window_and_systray.windowEvent.on('QUIT', saveHiddenRules);

//Public
module.exports.push = push;
module.exports.remove = remove;
module.exports.loadHiddenRules = loadHiddenRules;
module.exports.gethiddenItems = () => {
    return hiddenItems.toArray();
};
module.exports.gethiddenItemsPath = path => {
    return hiddenItems.filter(v => v.params.original_hidden_path === path).toArray();
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
