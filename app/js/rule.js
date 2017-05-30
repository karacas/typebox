'use strict';
const _ = require('lodash');
const removeDiacritics = require('lodash').deburr;
const Logger = require('../js/logger.js');
const icon = require('../js/icon.js');
const Config = require('../js/config.js');
const sub = require('hash-sum');

var copyKey = null;
var enterKey = null;
var icons = Config.get('icons');

function getStringDescription(rule) {
    //Define enter key
    if (!enterKey) {
        enterKey = Config.get('here_are_dragons.bindKeys').find(o => {
            return o.action === 'ENTER';
        });
        enterKey = _.result(enterKey, 'keys[0]') || 'Enter11';
        enterKey = enterKey.toUpperCase();
    }

    //Define copy key
    if (!copyKey) {
        copyKey = Config.get('here_are_dragons.bindKeys').find(o => {
            return o.action === 'COPY_STRING';
        });
        copyKey = _.result(copyKey, 'keys[0]') || 'ctrl + c';
        copyKey = copyKey.toUpperCase();
    }

    return 'Press ' + enterKey + ' to expand text / ' + copyKey + ' to clipboard';
}

module.exports.getNewRule = ruleObj => {
    let rule = {};

    rule.isLoading = false;
    rule._internalAct = false;
    rule._noSelect = false;

    if (ruleObj && ruleObj.isLoading) {
        ruleObj.title = 'loading';
        ruleObj.icon = icon.getLoader();
        ruleObj.addInHistory = false;
        ruleObj.persistFuzzy = true;
        rule.isLoading = true;
        rule._internalAct = true;
        rule._noSelect = true;
    }

    if (!ruleObj || !ruleObj.title || !ruleObj.title.length) {
        Logger.warn('RULE: No title:', ruleObj);
        return null;
    }

    rule.title = ruleObj.title;

    rule.addInHistory = true;
    if (ruleObj.addInHistory === false) {
        rule.addInHistory = false;
    }

    rule.description = ruleObj.description;

    //Type
    if (ruleObj.type) {
        if (_.isArray(ruleObj.type)) {
            rule.type = ruleObj.type;
        }
        if (_.isString(ruleObj.type) && ruleObj.type !== 'object') {
            rule.type = [ruleObj.type];
        }
    } else {
        if (!_.has(ruleObj, 'ruleObj.changePath') && !rule._internalAct) {
            rule.type = ['string'];
            rule.description = rule.description || getStringDescription(rule);
        } else {
            rule.type = [];
        }
    }

    if (!_.includes(rule.type, 'object') && !_.includes(rule.type, 'null')) {
        rule.type.push('object');
    }

    if (ruleObj._noSelect === true) {
        rule._noSelect = true;
    }

    if (rule._noSelect || rule.isLoading) {
        rule.type = ['null'];
    }

    rule.initSort = ruleObj.initSort || 0;

    rule.order = ruleObj.order || ruleObj.title;

    rule.generateStaticRule = ruleObj.generateStaticRule || null;

    rule.component = ruleObj.component || null;

    rule.path = String(ruleObj.path || '/');

    rule.favorite = Boolean(ruleObj.favorite);

    //FAV & LAST
    rule.fav_permit = true;
    rule.last_permit = true;
    rule.hidden_permit = true;

    if (ruleObj.fav_permit === false || rule._internalAct || rule._noSelect || rule.isLoading) {
        rule.favorite = false;
        rule.fav_permit = false;
    }
    if (ruleObj.last_permit === false || rule._internalAct || rule._noSelect || rule.isLoading) {
        rule.last_permit = false;
    }
    if (ruleObj.hidden_permit === false || rule._internalAct || rule._noSelect || rule.isLoading || rule.favorite) {
        rule.hidden_permit = false;
    }

    rule.params = ruleObj.params || {};

    rule.isVirtual = Boolean(ruleObj.isVirtual);

    rule.searchField = ruleObj.searchField || rule.title;

    rule.searchField = removeDiacritics(rule.searchField.toLowerCase());

    rule.persistFuzzy = ruleObj.persistFuzzy || false;

    rule.viewer = true;
    if (ruleObj.viewer === false) {
        rule.viewer = false;
    }

    rule._points = 0;

    rule._points_current_key = 0;

    rule._distance_keys = 0;

    rule._score = 0;

    rule._score_p = 0;

    rule._distance_keys_cache = -1;

    rule.id = makeHash((ruleObj._id || rule.title) + rule.type[0] + rule.path);

    if (icons) {
        rule.icon = icon.get(ruleObj.icon);
    }

    return rule;
};

function makeHash(str) {
    // return str;
    return sub(str);
}

module.exports.makeRuleIdHash = makeHash;
