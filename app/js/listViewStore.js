'use strict';
const _ = require('lodash');
const Redux = require('redux');
const ruleManager = require('../js/ruleManager.js');
const lastRulesManager = require('../js/lastRulesManager.js');
const makeRulePath = require('../js/path.js');
const Moment = require('moment');
const Reduxobservers = require('redux-observers');
const EventEmitter = require('events');
const Logger = require('../js/logger.js');

const rootPathInitialState = makeRulePath.get();

const storeInitialState = {
    search_text: '',
    result_text: '',
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
    let timeStart1 = new Moment(new Date());

    let rules = ruleManager.getFilterRules(text, pathObj);

    let time = new Moment(new Date()).diff(timeStart1);

    return { rules: rules, time: time };
}

//REDUCERS
function storeList(state = storeInitialState, action) {
    let obj, newState, text, rulesPathHist;
    if (!action || !action.type) {
        Logger.warn('[storeList] No action or action.type');
        return;
    }
    switch (action.type) {
        case 'CHANGE_SEARCH':
            text = action.text || '';
            obj = change_rules(text, state.rulesPath);
            newState = {
                search_text: text,
                search_text_is_empty: !text.length,
                statusBar_actual: 0,
                filteredRules: obj.rules,
                statusBar_totalTime: obj.time
            };
            return Object.assign({}, state, newState);

        case 'DELETE_SEARCH':
            obj = change_rules('', state.rulesPath);
            newState = {
                search_text: '',
                result_text: '',
                search_text_is_empty: true,
                statusBar_actual: 0,
                filteredRules: obj.rules,
                statusBar_totalTime: obj.time
            };
            return Object.assign({}, state, newState);

        case 'CHANGE_RESULT':
            let result_text = action.result_text || '';
            newState = {
                result_text: result_text
            };
            return Object.assign({}, state, newState);

        case 'UPDATE_LIST':
            obj = change_rules(state.search_text, state.rulesPath);
            newState = { filteredRules: obj.rules, statusBar_totalTime: obj.time };
            return Object.assign({}, state, newState);
        case 'UPDATE_LIST':

        case 'UPDATE_LIST_FORCE':
            let rulePath = _.cloneDeep(state.rulesPath);
            rulePath.avoidCache = true;
            obj = change_rules(state.search_text, rulePath);
            newState = { filteredRules: obj.rules, statusBar_totalTime: obj.time, statusBar_actual: 0 };
            return Object.assign({}, state, newState);

        case 'CHANGE_RULES_PATH':
            let objPath = action.obj;
            let path = objPath.path || rootPathInitialState.path;
            let name = objPath.name || rootPathInitialState.name;
            let sort = objPath.sort || rootPathInitialState.sort;
            let icon = objPath.icon || rootPathInitialState.icon;
            let checkNews = Boolean(objPath.checkNews);
            let avoidCache = objPath.avoidCache || rootPathInitialState.avoidCache;
            let avoidHistory = objPath.avoidHistory || rootPathInitialState.avoidHistory;

            let sortBy = objPath.sortBy;
            let keepQueryValue = objPath.keepQueryValue || rootPathInitialState.keepQueryValue;
            let ephemeral = objPath.ephemeral || rootPathInitialState.ephemeral;

            rulesPathHist = state.rulesPathHist;

            if (path === state.rulesPath.path) {
                return state;
            }

            let pathObj = {
                path: path,
                name: name,
                sort: sort,
                sortBy: sortBy,
                icon: icon,
                checkNews: checkNews,
                avoidCache: avoidCache,
                avoidHistory: avoidHistory,
                ephemeral: ephemeral
            };

            if (path !== rootPathInitialState.path) {
                if (path !== _.takeRight(rulesPathHist)[0].path && !pathObj.avoidHistory) {
                    rulesPathHist.push(pathObj);
                }
            } else {
                rulesPathHist = [rootPathInitialState];
            }

            obj = {};

            if (objPath.keepQueryValue) {
                obj = change_rules(state.search_text, pathObj);
            } else {
                obj = change_rules('', pathObj);
            }

            if (objPath.ephemeral) {
                lastRulesManager.pushToephemeralPaths(pathObj.path);
            }

            newState = {
                rulesPath: pathObj,
                rulesPathHist: rulesPathHist,
                filteredRules: obj.rules,
                statusBar_actual: 0,
                statusBar_totalTime: obj.time
            };

            if (!objPath.keepQueryValue) {
                newState.search_text = '';
                newState.result_text = '';
                newState.search_text_is_empty = true;
            }

            return Object.assign({}, state, newState);

        case 'BACK_RULES_PATH':
            rulesPathHist = _.cloneDeep(state.rulesPathHist);

            if (rulesPathHist.length > 1) {
                rulesPathHist = _.dropRight(rulesPathHist, 1);
            } else {
                rulesPathHist = [rootPathInitialState];
            }

            let rulesPath = _.takeRight(rulesPathHist)[0];
            obj = change_rules(state.search_text, rulesPath);

            return Object.assign({}, state, {
                search_text: '',
                search_text_is_empty: true,
                result_text: '',
                rulesPath: rulesPath,
                rulesPathHist: rulesPathHist,
                filteredRules: obj.rules,
                lastExcutorSelected: null,
                statusBar_actual: 0,
                statusBar_totalTime: obj.time
            });

        case 'BACK_ROOT_RULES_PATH':
            obj = change_rules('', rootPathInitialState);
            return Object.assign({}, state, {
                search_text: '',
                search_text_is_empty: true,
                result_text: '',
                rulesPath: rootPathInitialState,
                rulesPathHist: [rootPathInitialState],
                executors: null,
                lastExcutorSelected: null,
                filteredRules: obj.rules,
                statusBar_actual: 0,
                statusBar_totalTime: obj.time
            });

        case 'CHANGE_LAST_RULE_SELECTED':
            return Object.assign({}, state, { lastRuleSelected: action.obj, statusBar_actual: action.index });

        case 'CHANGE_LAST_EXECUTORS_SELECTED':
            return Object.assign({}, state, { lastExcutorSelected: action.obj, statusBar_actual: action.index });

        case 'PLACE_SUBEXECUTORS':
            newState = { executors: action.execs };
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
        // return {};
    }
    return { type: 'CHANGE_SEARCH', text: text };
};

module.exports.deleteSearchBox = () => {
    return { type: 'DELETE_SEARCH' };
};

//ACTIONS
module.exports.changeResult = (result_text = '') => {
    return { type: 'CHANGE_RESULT', result_text: result_text };
};

module.exports.updateFilterlist = (force = false) => {
    if (store.getState().rulesPath.avoidCache || force === true) {
        setTimeout(() => {
            storeEvents.emit('AVOID_CACHE');
        });
    }
    if (force) {
        return { type: 'UPDATE_LIST_FORCE' };
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
    changeResult: result_text => {
        store.dispatch(module.exports.changeResult(result_text));
    },
    updateFilterlist: force => {
        store.dispatch(module.exports.updateFilterlist(force));
    },
    changeRulesPath: obj => {
        if (obj === null) return;
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

window.changeResult = module.exports.storeActions.changeResult;
