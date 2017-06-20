'use strict';
const _ = require('lodash');
const Immutable = require('immutable');
const Moment = require('moment');
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const createRule = require('../js/rule.js').getNewRule;
const sharedData = require('../js/sharedData.js');
const getTime = sharedData.realClock.getTime;

let favItems = Immutable.OrderedMap();
let favNeedSave = false;

const icon = {
    type: 'iconFont',
    iconClass: 'mdi-star palette-Amber-A200 text'
};

const path = {
    path: 'FAVS_PATH',
    name: 'favorites',
    avoidCache: true,
    avoidHistory: true,
    icon: icon
};

function push($rulefavObj) {
    let rulefav = _.cloneDeep($rulefavObj);

    if (rulefav.generateStaticRule) rulefav = createRule(rulefav.generateStaticRule($rulefavObj));

    let id = rulefav.id;

    if (id && rulefav.fav_permit) {
        if (!_.includes(rulefav.type, 'object')) {
            return;
        }

        if (favItems.get(id)) {
            favItems = favItems.delete(id);
        }

        rulefav.hidden_permit = false;
        rulefav.new_permit = false;
        rulefav.params.original_fav_id = id;
        rulefav.params.original_fav_path = rulefav.path;
        rulefav.params.lastDate = getTime();

        favItems = favItems.set(id, rulefav).sortBy(r => -r.params.lastDate).slice(0, Config.get('here_are_dragons.maxFavsRules'));
        favNeedSave = true;
    }
}

function toggle(rulefav) {
    let deleted = false;

    let id = rulefav.id;
    if (id && favItems.get(id)) {
        favItems = favItems.delete(id);
        deleted = true;
        favNeedSave = true;
    }

    id = _.result(rulefav, 'params.original_fav_id');
    if (id && favItems.get(id) && !deleted) {
        favItems = favItems.delete(id);
        deleted = true;
        favNeedSave = true;
    }

    if (rulefav.fav_permit === true && !deleted) {
        push(rulefav);
        favNeedSave = true;
    }
}

const savefav = _.throttle(
    () => {
        if (!favNeedSave) return;

        if (!sharedData.dataManager) return;

        let obj2save = {
            favItems: favItems.toJS()
        };

        let resp = sharedData.dataManager.savefav(obj2save);

        if (!resp) {
            Logger.error('[Favs] Fail savefav:', resp);
        } else {
            Logger.info('[Favs] fav Saved ok:', resp);
            favNeedSave = false;
        }
    },
    80,
    { trailing: false }
);

function loadfav() {
    if (favItems.size) {
        return;
    }
    let load = null;
    let favItemsTmp = null;

    if (sharedData.dataManager.dataLoaded.fav) {
        load = true;
        favItemsTmp = sharedData.dataManager.dataLoaded.fav.favItems;
    } else {
        load = false;
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
sharedData.app_window_and_systray.windowEvent.on('REFRESH_WIN', savefav);

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
