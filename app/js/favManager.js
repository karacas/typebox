'use strict';
const _ = require('lodash');
const auxjs = require('../auxfs.js');
const Immutable = require('immutable');
const Moment = require('moment');
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const createRule = require('../js/rule.js').getNewRule;
const sharedData = require('../js/sharedData.js');
const getTime = sharedData.realClock.getTime;

var favItems = Immutable.OrderedMap();
var favNeedSave = false;

var icon = {
    type: 'iconFont',
    iconClass: 'mdi-star palette-Amber-A200 text'
};

var path = {
    path: 'FAVS_PATH',
    avoidCache: true,
    avoidHystory: true,
    icon: icon
};

function push(rulefav) {
    if (rulefav.generateStaticRule) rulefav = createRule(rulefav.generateStaticRule(rulefav));

    var id = rulefav.id;

    if (id && rulefav.fav_permit) {
        if (!_.includes(rulefav.type, 'object')) {
            return;
        }

        if (favItems.get(id)) {
            favItems = favItems.delete(id);
        }

        rulefav = _.clone(rulefav);
        rulefav.favorite = true;
        rulefav.hidden_permit = false;
        rulefav.params.original_fav_id = id;
        rulefav.params.original_fav_path = rulefav.path;
        rulefav.params.lastDate = getTime();

        favItems = favItems.set(id, rulefav).sortBy(r => -r.params.lastDate).slice(0, Config.get('here_are_dragons.maxFavsRules'));
        favNeedSave = true;
    }
}

function toggle(rulefav) {
    let id = rulefav.id;

    if (id && favItems.get(id)) {
        favItems = favItems.delete(id);
        favNeedSave = true;
        return;
    }

    id = _.result(rulefav, 'params.original_fav_id');
    if (id && favItems.get(id)) {
        favItems = favItems.delete(id);
        favNeedSave = true;
        return;
    }

    if (rulefav.fav_permit === false) return;

    push(rulefav);
    favNeedSave = true;
}

function savefav() {
    if (!favNeedSave) {
        return;
    }

    if (!sharedData.dataManager) {
        return;
    }

    var obj2save = {
        favItems: favItems.toJS()
    };

    var resp = sharedData.dataManager.savefav(obj2save);

    if (!resp) {
        Logger.error('[Favs] Fail savefav:', resp);
    } else {
        Logger.info('[Favs] fav Saved ok:', resp);
        favNeedSave = false;
    }
}

function loadfav() {
    if (favItems.size) {
        return;
    }
    var load = null;

    if (sharedData.dataManager.dataLoaded.fav) {
        var load = true;
        var favItemsTmp = sharedData.dataManager.dataLoaded.fav.favItems;
    } else {
        var load = false;
        Logger.warn('[Favs] Loadfav: no fav');
    }

    if (load) {
        favItems = Immutable.OrderedMap(favItemsTmp);
        Logger.info('[Favs] favItems length: ', favItems.size);
    }
}

//Save events
sharedData.idleTime.getIdleEvent().on('idle', savefav);
sharedData.app_window_and_systray.windowEvent.on('QUIT', savefav);

//Public
module.exports.push = push;
module.exports.toggle = toggle;
module.exports.loadfav = loadfav;
module.exports.getFavItems = () => {
    return favItems.toArray();
};
module.exports.ifFav = id => {
    return Boolean(favItems.get(id) && favItems.get(id).fav_permit);
};
module.exports.getIcon = () => {
    return icon;
};
module.exports.getPath = () => {
    return path;
};
