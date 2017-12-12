'use strict';

const kebabCase = require('lodash').kebabCase;
const removeDiacritics = require('diacritics').remove;
const Logger = require('../js/logger.js');
const icon = require('../js/icon.js');
const { bindKet2actualOs, getKeyFromConfig } = require('../auxfs.js');
const Config = require('../js/config.js');
const URLSafeBase64 = require('urlsafe-base64');

const BINDKEYS = Config.get('here_are_dragons.bindKeys');
const ENTERKEY = getKeyFromConfig(BINDKEYS, 'ENTER');
const COPYKEY = getKeyFromConfig(BINDKEYS, 'COPY_STRING');
const ICONLOADER = icon.getLoader();
const ICONINFO = icon.getInfo();

const getStringDescription = rule => 'Press ' + ENTERKEY + ' to expand text / ' + COPYKEY + ' to clipboard';

const getNewRule = (ruleObj, generated = false) => {
    if (!ruleObj) return null;

    let rule = {};

    rule.isLoading = false;
    rule.isInfo = false;
    rule._internalAct = false;
    rule._noSelect = false;

    if (ruleObj.isLoading) {
        ruleObj.title = ruleObj.title || 'loading';
        ruleObj.icon = ICONLOADER;
        ruleObj.addInHistory = false;
        ruleObj.persistFuzzy = true;
        rule.isLoading = true;
        rule._internalAct = true;
        rule._noSelect = true;
    }

    if (ruleObj.isInfo) {
        ruleObj.title = ruleObj.title || null;
        ruleObj.icon = ICONINFO;
        ruleObj.addInHistory = false;
        ruleObj.persistFuzzy = true;
        rule.isInfo = true;
        rule._internalAct = true;
        rule._noSelect = true;
    }

    if (!ruleObj.title) {
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
        if (typeof ruleObj.type === 'string' || ruleObj.type instanceof String) {
            rule.type = [ruleObj.type];
        } else {
            rule.type = ruleObj.type;
        }
    } else {
        if (!rule._internalAct && !ruleObj.changePath) {
            rule.type = ['string'];
            rule.description = rule.description || getStringDescription(rule);
        } else {
            rule.type = [];
        }
    }

    if (!rule.type.includes('object') && !rule.type.includes('null')) {
        rule.type.push('object');
    }

    if (ruleObj._noSelect === true) {
        rule._noSelect = true;
    }

    if (rule._noSelect || rule.isLoading) {
        rule.type = ['null'];
    }

    rule.initSort = Number(ruleObj.initSort || 0);

    rule.order = ruleObj.order || ruleObj.title;

    if (!generated) {
        rule.generateStaticRule = ruleObj.generateStaticRule || null;
    }

    rule.component = ruleObj.component || null;

    rule.path = String(ruleObj.path || '/');

    rule.favorite = false;

    //FAV & LAST
    rule.fav_permit = true;
    rule.last_permit = true;
    rule.hidden_permit = true;
    rule.new_permit = true;
    rule.isNew = false;

    if (ruleObj.new_permit === false) {
        rule.new_permit = false;
    }

    if (ruleObj.fav_permit === false || rule._internalAct || rule._noSelect || rule.isLoading) {
        rule.fav_permit = false;
    }
    if (ruleObj.last_permit === false || rule._internalAct || rule._noSelect || rule.isLoading) {
        rule.last_permit = false;
    }
    if (ruleObj.hidden_permit === false || rule._internalAct || rule._noSelect || rule.isLoading) {
        rule.hidden_permit = false;
    }
    if (rule._internalAct || rule._noSelect || rule.isLoading) {
        rule.new_permit = false;
        rule.isNew = false;
    }

    rule.params = ruleObj.params || {};

    rule.isVirtual = !!ruleObj.isVirtual;

    rule.searchField = removeDiacritics(
        (ruleObj.searchField || rule.title)
            .replace(/([^A-Z])([A-Z])/g, '$1 $2')
            .replace(/\-/g, ' ')
            .replace(/\_/g, ' ')
            .replace(/ +(?= )/g, '')
            .toLowerCase()
    );

    rule.persistFuzzy = !!ruleObj.persistFuzzy || false;

    rule.viewer = true;
    if (ruleObj.viewer === false) {
        rule.viewer = false;
    }

    rule._points = 0;

    rule._points_current_key = 0;

    rule._distance_keys = 0;

    rule._score = 0;

    rule._score_p = 0;

    rule.specialScoreMult = 1;

    if (ruleObj.specialScoreMult !== undefined && ruleObj.specialScoreMult !== null) {
        rule.specialScoreMult = Number(ruleObj.specialScoreMult);
    }

    rule.posFixed = 0;

    if (ruleObj.posFixed !== undefined && ruleObj.posFixed !== null) {
        rule.posFixed = Number(ruleObj.posFixed);
    }

    rule._distance_keys_cache = -1;

    rule.id = makeHash((ruleObj._id || rule.title) + rule.type[0] + rule.path);

    rule.icon = icon.get(ruleObj.icon);

    return rule;
};

const makeHash = str => {
    return URLSafeBase64.encode(Buffer.from(str).toString('base64'));
};

module.exports.getNewRule = getNewRule;
module.exports.makeRuleIdHash = makeHash;
module.exports.makeHash = makeHash;
