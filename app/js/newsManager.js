'use strict';
const _ = require('lodash');
const Immutable = require('immutable');
const Moment = require('moment');
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');
const getTime = sharedData.realClock.getTime;

let newsItems = Immutable.OrderedMap();
let newsNeedSave = false;
let arrayPathsEmptys = {};

const ISDEV = Config.get('dev');

const savenews = _.throttle(
    () => {
        if (!Config.get('here_are_dragons.markNewRules')) return;
        if (!newsNeedSave) return;

        if (!sharedData.dataManager) return;

        let obj2save = {
            newsItems: newsItems.toJS()
        };

        let resp = sharedData.dataManager.saveNewsRules(_.cloneDeep(obj2save));

        if (!resp) {
            Logger.error('[NEWS] Fail saveNews:', resp);
        } else {
            Logger.info('[NEWS] news Saved ok:', resp);
            newsNeedSave = false;
        }
    },
    80,
    { trailing: false }
);

function checkNews($immutableRules, $path) {
    if (!$path || !$path.checkNews || !$immutableRules || !$immutableRules.size === 0 || !Config.get('here_are_dragons.markNewRules')) {
        return;
    }

    //KTODO: Ver si es posible hacer un cache
    let pathVal = $path.path;
    let maxItemsToAbort = Config.get('here_are_dragons.markNewRulesMaxItemsInPathToAvoid');

    if ($immutableRules.size > maxItemsToAbort) {
        Logger.warn('[NEWS] path:', pathVal, 'exceeds markNewRulesMaxItemsInPathToAvoid', $immutableRules.size, '>', maxItemsToAbort);
        return;
    }

    let pathNews = newsItems.get(pathVal);
    if (pathNews) pathNews = Immutable.OrderedMap(pathNews);
    let timeNow = getTime();

    let thotleTime = Config.get('here_are_dragons.markNewRulesTimeOld') || 5 * 60 * 1000;
    let thotleTimeToSetPathOld = Config.get('here_are_dragons.markNewRulesTimeToSetPathOld') || 10000;

    if (!pathNews) {
        //EMPTY PATH, ALL RULES ARE OLD
        let timeOffset = 1; /*MARK AS OLD*/

        newsItems = newsItems.set(
            pathVal,
            $immutableRules.map(r => {
                let obj = r[1];
                if (obj && obj.new_permit) {
                    return [obj.id, timeOffset];
                }
            })
        );

        newsNeedSave = true;
        arrayPathsEmptys[pathVal] = timeNow;
    } else {
        $immutableRules.forEach(obj => {
            if (!obj || !obj.new_permit) return;

            let pathIsRecentEmpty = false;
            let lastCheck = arrayPathsEmptys[pathVal] || 1;
            let deltaCheck = timeNow - lastCheck;

            if (deltaCheck < thotleTimeToSetPathOld) {
                pathIsRecentEmpty = true;
            }

            let isInNewDate = pathNews.get(obj.id);
            let isNew = false;

            if (isInNewDate) {
                //ESTA, compara
                if (timeNow - isInNewDate < thotleTime) {
                    isNew = true;
                    //if (ISDEV) Logger.log(obj.title, 'delta:', timeNow - isInNewDate, 'thotleTime:', thotleTime, 'timeNow:', timeNow);
                }
            } else {
                //PUSH
                if (!pathIsRecentEmpty) isNew = true;
                pathNews = pathNews.set(obj.id, pathIsRecentEmpty ? 1 : timeNow);
            }

            if (isNew) {
                newsNeedSave = true;
            }

            obj.isNew = isNew;
        });

        //UPDATE PATH
        newsItems = newsItems.set(pathVal, pathNews);
    }
}

function loadnews() {
    if (newsItems === null) {
        return;
    }

    let newsItemsTmp = null;

    if (sharedData.dataManager.dataLoaded.newsRules) {
        newsItemsTmp = sharedData.dataManager.dataLoaded.newsRules.newsItems;
    } else {
        Logger.warn('[NEWS] Loadnews: no news');
    }

    if (newsItemsTmp) {
        newsItems = Immutable.OrderedMap(_.cloneDeep(newsItemsTmp));
        Logger.info('[NEWS] newsItems length: ', newsItems.size);
    }
}

//Save events
sharedData.idleTime.getIdleEvent().on('idle', savenews);
sharedData.app_window_and_systray.windowEvent.on('QUIT', savenews);
sharedData.app_window_and_systray.windowEvent.on('REFRESH_WIN', savenews);

//Public
module.exports.loadnews = loadnews;
module.exports.checkNews = checkNews;
