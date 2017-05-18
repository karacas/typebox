'use strict';
const _ = require('lodash');
const Redux = require('redux');
const ruleManager = require('../js/ruleManager.js');
const makeRulePath = require('../js/path.js');
const Moment = require('moment');
const Reduxobservers = require('redux-observers');
const EventEmitter = require('events');

const rootPathInitialState = makeRulePath.get();

const storeInitialState = {
    search_text: '',
    search_text_is_empty: true,
    filteredRules: null,
    rulesPathHist: [rootPathInitialState],
    rulesPath: rootPathInitialState,
    lastRuleSelected: null,
    statusBar_actual: 0,
    statusBar_actual_before_executors: null,
    statusBar_totalTime: 0,
    executors: null,
    lastExcutorSelected: null
};

//AUX CHANGE RULES
function change_rules(text = storeInitialState.search_text, pathObj = rootPathInitialState) {
    var timeStart1 = new Moment(new Date());

    var rules = ruleManager.getFilterRules(text, pathObj);

    var time = new Moment(new Date()).diff(timeStart1);
    if (time < 3) {
        time = store.getState().statusBar_totalTime;
    }

    return { rules: rules, time: time };
}

//REDUCERS
function storeList(state = storeInitialState, action) {
    switch (action.type) {
        case 'CHANGE_SEARCH':
            var text = action.text || '';
            var obj = change_rules(text, state.rulesPath);
            var newState = {
                search_text: text,
                search_text_is_empty: !text.length,
                statusBar_actual: 0,
                filteredRules: obj.rules,
                statusBar_totalTime: obj.time
            };
            return Object.assign({}, state, newState);

        case 'DELETE_SEARCH':
            var obj = change_rules('', state.rulesPath);
            var newState = {
                search_text: '',
                search_text_is_empty: true,
                statusBar_actual: 0,
                filteredRules: obj.rules,
                statusBar_totalTime: obj.time
            };
            return Object.assign({}, state, newState);

        case 'UPDATE_LIST':
            var obj = change_rules(state.search_text, state.rulesPath);
            var newState = { filteredRules: obj.rules, statusBar_totalTime: obj.time };
            return Object.assign({}, state, newState);

        case 'CHANGE_RULES_PATH':
            var objPath = action.obj;
            var path = objPath.path || rootPathInitialState.path;
            var name = objPath.name || rootPathInitialState.name;
            var sort = objPath.sort || rootPathInitialState.sort;
            var icon = objPath.icon || rootPathInitialState.icon;
            var avoidCache = objPath.avoidCache || rootPathInitialState.avoidCache;
            var avoidHystory = objPath.avoidHystory || rootPathInitialState.avoidHystory;

            var sortBy = objPath.sortBy;
            var keepQueryValue = objPath.keepQueryValue || rootPathInitialState.keepQueryValue;

            var rulesPathHist = state.rulesPathHist;

            if (path === state.rulesPath.path) {
                return state;
            }

            var pathObj = {
                path: path,
                name: name,
                sort: sort,
                sortBy: sortBy,
                icon: icon,
                avoidCache: avoidCache,
                avoidHystory: avoidHystory
            };

            if (path !== rootPathInitialState.path) {
                if (path !== _.takeRight(rulesPathHist)[0].path && !pathObj.avoidHystory) {
                    rulesPathHist.push(pathObj);
                }
            } else {
                rulesPathHist = [rootPathInitialState];
            }

            var obj = {};

            if (objPath.keepQueryValue) {
                obj = change_rules(state.search_text, pathObj);
            } else {
                obj = change_rules('', pathObj);
            }

            var newState = {
                rulesPath: pathObj,
                rulesPathHist: rulesPathHist,
                filteredRules: obj.rules,
                statusBar_actual: 0,
                statusBar_totalTime: obj.time
            };

            if (!objPath.keepQueryValue) {
                newState.search_text = '';
                newState.search_text_is_empty = true;
            }

            return Object.assign({}, state, newState);

        case 'BACK_RULES_PATH':
            var rulesPathHist = _.clone(state.rulesPathHist);

            if (rulesPathHist.length > 1) {
                rulesPathHist = _.dropRight(rulesPathHist, 1);
            } else {
                rulesPathHist = [rootPathInitialState];
            }

            var rulesPath = _.takeRight(rulesPathHist)[0];
            var obj = change_rules(state.search_text, rulesPath);

            return Object.assign({}, state, {
                search_text: '',
                search_text_is_empty: true,
                rulesPath: rulesPath,
                rulesPathHist: rulesPathHist,
                filteredRules: obj.rules,
                lastExcutorSelected: null,
                statusBar_actual: 0,
                statusBar_totalTime: obj.time
            });

        case 'BACK_ROOT_RULES_PATH':
            var obj = change_rules('', rootPathInitialState);
            return Object.assign({}, state, {
                search_text: '',
                search_text_is_empty: true,
                rulesPath: rootPathInitialState,
                rulesPathHist: [rootPathInitialState],
                executors: null,
                lastExcutorSelected: null,
                statusBar_actual: null,
                filteredRules: obj.rules,
                statusBar_actual: 0,
                statusBar_totalTime: obj.time
            });

        case 'CHANGE_LAST_RULE_SELECTED':
            return Object.assign({}, state, { lastRuleSelected: action.obj, statusBar_actual: action.index });

        case 'CHANGE_LAST_EXECUTORS_SELECTED':
            return Object.assign({}, state, { lastExcutorSelected: action.obj, statusBar_actual: action.index });

        case 'PLACE_SUBEXECUTORS':
            var newState = { executors: action.execs };
            if (action.execs == null) {
                newState.lastExcutorSelected = null;
                newState.lastRuleSelected = state.lastRuleSelected;
                newState.statusBar_actual = state.statusBar_actual_before_executors || 0;
                newState.statusBar_actual_before_executors = null;
            } else {
                newState.statusBar_totalTime = 0;
                newState.statusBar_actual_before_executors = state.statusBar_actual || 0;
                newState.statusBar_actual = 0;
            }
            let result = Object.assign({}, state, newState);
            return result;
    }

    return state;
}

//ACTIONS
module.exports.changeQuery = (text = '') => {
    if (store && text === store.getState().search_text) {
        return {};
    }
    return { type: 'CHANGE_SEARCH', text: text };
};

module.exports.deleteSearchBox = () => {
    return { type: 'DELETE_SEARCH' };
};

module.exports.updateFilterlist = () => {
    if (store.getState().rulesPath.avoidCache) {
        setTimeout(() => {
            storeEvents.emit('AVOID_CACHE');
        });
    }
    return { type: 'UPDATE_LIST' };
};

module.exports.changeLastRuleSelected = (obj, index) => {
    return { type: 'CHANGE_LAST_RULE_SELECTED', obj: obj, index: index };
};

module.exports.changeRulesPath = obj => {
    if (!obj) {
        return;
    }
    if (_.isString(obj)) {
        obj = { path: obj };
    }
    return { type: 'CHANGE_RULES_PATH', obj: obj };
};

module.exports.backRootRulesPath = () => {
    return { type: 'BACK_ROOT_RULES_PATH' };
};

module.exports.backRulesPath = () => {
    return { type: 'BACK_RULES_PATH' };
};

module.exports.placeSubExecutors = (execs = null) => {
    return { type: 'PLACE_SUBEXECUTORS', execs: execs };
};

module.exports.removeSubExecutors = () => {
    return { type: 'PLACE_SUBEXECUTORS', execs: null };
};

module.exports.changeLastExcutorSelected = (obj, index) => {
    return { type: 'CHANGE_LAST_EXECUTORS_SELECTED', obj: obj, index: index };
};

//CREATE
const store = Redux.createStore(storeList);
module.exports.store = store;

//API 4 PLUGINS EVENT EMITTERS
const storeEvents = new EventEmitter().setMaxListeners(100);

module.exports.storeEvents = storeEvents;

const change_search_text = Reduxobservers.observer(
    state => state.search_text,
    (dispatch, current, previous) => {
        storeEvents.emit('CHANGE_SEARCH_TEXT', String(current || ''));
    }
);
const change_rules_path = Reduxobservers.observer(
    state => state.rulesPath,
    (dispatch, current, previous) => {
        storeEvents.emit('CHANGE_PATH', current);
    }
);

Reduxobservers.observe(store, [change_search_text, change_rules_path]);

//SAFE ACTIONS
module.exports.storeActions = {
    changeQuery: text => {
        store.dispatch(module.exports.changeQuery(text));
    },
    deleteSearchBox: () => {
        store.dispatch(module.exports.deleteSearchBox());
    },
    updateFilterlist: () => {
        store.dispatch(module.exports.updateFilterlist());
    },
    changeRulesPath: obj => {
        store.dispatch(module.exports.changeRulesPath(obj));
    },
    backRulesPath: () => {
        store.dispatch(module.exports.backRulesPath());
    },
    backRootRulesPath: () => {
        store.dispatch(module.exports.backRootRulesPath());
    },
    removeSubExecutors: () => {
        store.dispatch(module.exports.removeSubExecutors());
    },
    placeSubExecutors: execs => {
        store.dispatch(module.exports.placeSubExecutors(execs));
    }
};
