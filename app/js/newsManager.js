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

const savenews = _.throttle(
    () => {
        if (!Config.get('here_are_dragons.markNewRules')) return;
        if (!newsNeedSave) return;

        if (!sharedData.dataManager) return;

        let obj2save = {
            newsItems: newsItems.toJS()
        };

        let resp = sharedData.dataManager.saveNewsRules(obj2save);

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
    if (!Config.get('here_are_dragons.markNewRules')) return;
    if (!$immutableRules || !$immutableRules.size || !$path) return;

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

    let news = [];

    if (!pathNews) {
        //EMPTY PAEH, ALL RULES ARE OLD
        let timeOffset = 1; /*MARK AS OLD*/

        let pack = $immutableRules.toArray().map(obj => {
            if (obj.new_permit) {
                return [obj.id, timeOffset];
            }
        });
        let pathPack = Immutable.OrderedMap(pack);
        newsItems = newsItems.set(pathVal, pathPack);

        newsNeedSave = true;

        arrayPathsEmptys[pathVal] = timeNow;
    } else {
        let pack = $immutableRules.map(obj => {
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
                let delta = timeNow - isInNewDate;
                if (delta < thotleTime) {
                    isNew = true;
                    if (Config.get('dev')) Logger.log(obj.title, 'delta:', delta, 'thotleTime:', thotleTime, 'timeNow:', timeNow);
                }
            } else {
                //PUSH
                let timeStamp = timeNow;
                if (pathIsRecentEmpty) timeStamp = 1;
                if (!pathIsRecentEmpty) isNew = true;
                pathNews = pathNews.set(obj.id, timeStamp);
            }

            if (isNew) {
                news.push(obj.id);
                newsNeedSave = true;
            }

            obj.isNew = isNew;
        });

        //UPDATE PATH
        newsItems = newsItems.set(pathVal, pathNews);
    }

    return news;
}

function loadnews() {
    if (newsItems.size) {
        return;
    }
    let load = null;
    let newsItemsTmp = null;

    if (sharedData.dataManager.dataLoaded.newsRules) {
        load = true;
        newsItemsTmp = sharedData.dataManager.dataLoaded.newsRules.newsItems;
    } else {
        load = false;
        Logger.warn('[NEWS] Loadnews: no news');
    }

    if (load) {
        newsItems = Immutable.OrderedMap(newsItemsTmp);
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
