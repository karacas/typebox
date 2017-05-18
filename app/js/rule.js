'use strict';
const _ = require('lodash');
const removeDiacritics = require('lodash').deburr;
const Logger = require('../js/logger.js');
const icon = require('../js/icon.js');
const Config = require('../js/config.js');
const sub = require('hash-sum');

var copyKey = null;
var enterKey = null;

function getStringDescription() {
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

module.exports.getNewRule = params => {
    let rule = {};

    rule.isLoading = false;
    rule._internalAct = false;
    rule._noSelect = false;

    if (params && params.isLoading) {
        params.title = 'loading';
        params.icon = icon.getLoader();
        params.addInHistory = false;
        params.persistFuzzy = true;
        rule.isLoading = true;
        rule._internalAct = true;
        rule._noSelect = true;
    }

    if (!params || !params.title || !params.title.length) {
        Logger.warn('RULE: No title:', params);
        return null;
    }

    rule.title = params.title;

    rule.addInHistory = true;
    if (params.addInHistory === false) {
        rule.addInHistory = false;
    }

    rule.description = params.description;

    //Type
    if (params.type) {
        if (_.isArray(params.type)) {
            rule.type = params.type;
        }
        if (_.isString(params.type) && params.type !== 'object') {
            rule.type = [params.type];
        }
    } else {
        if (!_.has(params, 'params.changePath') && !rule._internalAct) {
            rule.type = ['string'];
            rule.description = rule.description || getStringDescription(rule);
        } else {
            rule.type = [];
        }
    }

    if (!_.includes(rule.type, 'object') && !_.includes(rule.type, 'null')) {
        rule.type.push('object');
    }

    if (params._noSelect === true) {
        rule._noSelect = true;
    }

    if (rule._noSelect || rule.isLoading) {
        rule.type = ['null'];
    }

    rule.initSort = params.initSort || 0;

    rule.order = params.order || params.title;

    rule.generateStaticRule = params.generateStaticRule || null;

    rule.component = params.component || null;

    rule.path = String(params.path || '/');

    rule.favorite = Boolean(params.favorite);

    //FAV & LAST
    rule.fav_permit = true;
    rule.last_permit = true;
    if (params.fav_permit === false || rule._internalAct || rule._noSelect || rule.isLoading) {
        rule.favorite = false;
        rule.fav_permit = false;
    }
    if (params.last_permit === false || rule._internalAct || rule._noSelect || rule.isLoading) {
        rule.last_permit = false;
    }

    rule.params = params.params || {};

    rule.isVirtual = Boolean(params.isVirtual);

    rule.searchField = params.searchField || rule.title;

    rule.searchField = removeDiacritics(rule.searchField.toLowerCase());

    rule.persistFuzzy = params.persistFuzzy || false;

    rule.viewer = true;
    if (params.viewer === false) {
        rule.viewer = false;
    }

    rule._points = 0;

    rule._points_current_key = 0;

    rule._distance_keys = 0;

    rule._score = 0;

    rule._score_p = 0;

    rule._distance_keys_cache = -1;

    rule.id = makeHash((params._id || rule.title) + rule.type[0] + rule.path);

    //KTODO: ver de poner en config que no haya iconos ID21-04-17_02-07-43
    rule.icon = icon.get(params.icon);

    return rule;
};

function makeHash(str) {
    // return str;
    return sub(str);
}

module.exports.makeRuleIdHash = makeHash;
