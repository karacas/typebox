'use strict';

const icon = require('@render/icon.js');
const icon_get = icon.get;
const { getKeyFromConfig, get, makeHash, removeDiacritics } = require('@aux/aux_global.js');
const Config = require('@render/config.js');

const BINDKEYS = Config.get('here_are_dragons.bindKeys');
const ENTERKEY = getKeyFromConfig(BINDKEYS, 'ENTER');
const COPYKEY = getKeyFromConfig(BINDKEYS, 'COPY_STRING');
const ICONLOADER = icon.getLoader();
const ICONINFO = icon.getInfo();
const DEFAULT_DESCRIPTION = `Press ${ENTERKEY} to expand text / ${COPYKEY} to clipboard`;
const MAX_LENGTH_TITLE = 128;
const MAX_LENGTH_DESCR = 128;

const _makeHash = makeHash;

const getNewRuleSoft = (ruleObj, generated = false) => {
   if (ruleObj === null || ruleObj === undefined || typeof ruleObj !== 'object') return null;
   if (ruleObj.isRuleSoft) return ruleObj;

   const rule = {};

   rule.isLoading = false;
   rule.isInfo = false;
   rule._internalAct = false;
   rule._noSelect = false;

   if (ruleObj.isLoading === true) {
      ruleObj.title = ruleObj.title || 'loading';
      ruleObj.icon = ICONLOADER;
      ruleObj.addInHistory = false;
      ruleObj.persistFuzzy = true;
      rule.isLoading = true;
      rule._internalAct = true;
      rule._noSelect = true;
   }

   if (ruleObj.isInfo === true) {
      ruleObj.title = ruleObj.title || 'info';
      ruleObj.icon = ICONINFO;
      ruleObj.addInHistory = false;
      ruleObj.persistFuzzy = true;
      rule.isInfo = true;
      rule._internalAct = true;
      rule._noSelect = true;
   }

   if (!ruleObj.title || typeof ruleObj.title !== 'string') {
      return null;
   }

   rule.title = ruleObj.title;

   rule.addInHistory = true;
   if (ruleObj.addInHistory === false) {
      rule.addInHistory = false;
   }

   rule.description = ruleObj.description;

   //Type
   if (ruleObj.type !== null && ruleObj.type !== undefined) {
      if (typeof ruleObj.type === 'string') {
         rule.type = [ruleObj.type];
      } else if (Array.isArray(ruleObj.type)) {
         rule.type = ruleObj.type.filter($type => typeof $type === 'string');
         if (!rule.type.length) rule.type = ['string'];
      }
   } else {
      if (!rule._internalAct && !ruleObj.changePath) {
         rule.type = ['string'];
         rule.description = rule.description || 'DEFAULT_DESCRIPTION';
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

   if (rule._noSelect === true || rule.isLoading === true || rule.isInfo === true) {
      rule.type = ['null'];
   }

   rule.initSort = Number(ruleObj.initSort || 0);

   rule.order = ruleObj.order || ruleObj.title;

   rule.generate_by_plugin = ruleObj.generate_by_plugin || null;

   if (generated === false) {
      rule.generateStaticRule = ruleObj.generateStaticRule || null;
   } else {
      rule.generate_by_plugin = `GENERATED_${rule.generate_by_plugin}`;
   }

   rule.component = ruleObj.component || null;

   if (ruleObj.path && typeof ruleObj.path !== 'string') ruleObj.path = null;
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

   if (ruleObj.fav_permit === false || rule._internalAct === true || rule._noSelect === true || rule.isLoading === true || rule.isInfo === true) {
      rule.fav_permit = false;
   }
   if (ruleObj.last_permit === false || rule._internalAct === true || rule._noSelect === true || rule.isLoading || rule.isInfo === true) {
      rule.last_permit = false;
   }
   if (ruleObj.hidden_permit === false || rule._internalAct === true || rule._noSelect === true || rule.isLoading === true || rule.isInfo === true) {
      rule.hidden_permit = false;
   }
   if (rule._internalAct === true || rule._noSelect === true || rule.isLoading === true || rule.isInfo === true) {
      rule.new_permit = false;
      rule.isNew = false;
   }

   rule.params = ruleObj.params || {};

   rule.isVirtual = !!ruleObj.isVirtual;

   rule.searchField = ruleObj.searchField;

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

   if (ruleObj._id && typeof ruleObj._id !== 'string') ruleObj._id = null;

   rule.id = String(ruleObj._id || rule.title + rule.type[0]) + rule.path + (rule.generate_by_plugin || rule.generateStaticRule || 'null');
   rule.icon = ruleObj.icon | null;

   rule.generate_by_getNewRule_func = true;

   rule.isRuleSoft = true;

   return rule;
};

const getNewRule = (ruleObj, generated = false) => {
   if (ruleObj === null || ruleObj === undefined || typeof ruleObj !== 'object') return null;
   const rule = ruleObj.isRuleSoft ? ruleObj : getNewRuleSoft(ruleObj, (generated = false));

   rule.searchField = removeDiacritics(
      (ruleObj.searchField || ruleObj.title)
         .replace(/([^A-Z])([A-Z])/g, '$1 $2') /*CAPS TO SPACES*/
         .replace(/\-/g, ' ')
         .replace(/\_/g, ' ')
         .replace(/ +(?= )/g, '')
         .toLowerCase()
   );

   if (rule.title.length > MAX_LENGTH_TITLE) {
      rule.title = rule.title.slice(0, MAX_LENGTH_TITLE);
   }

   if (rule.description === 'DEFAULT_DESCRIPTION') {
      rule.description = DEFAULT_DESCRIPTION;
   } else if (rule.description && rule.description.length > MAX_LENGTH_DESCR) {
      rule.description = rule.description.slice(0, MAX_LENGTH_DESCR);
   }

   rule.id = _makeHash(rule.id);
   rule.icon = icon_get(ruleObj.icon || null);
   rule.isRuleSoft = false;
   rule.isRule = true;
   return rule;
};

const getStringOfRule = rule => {
   if (rule.rule) rule = rule.rule;
   if (typeof rule === 'string') return rule;
   if (typeof rule !== 'object') return null;
   return String(get(rule, 'params.string') || get(rule, 'params.snippet') || get(rule, 'params.plain_code') || get(rule, 'title'));
};

module.exports.getNewRule = getNewRule;
module.exports.makeRuleIdHash = _makeHash;
module.exports.makeHash = _makeHash;
module.exports.getStringOfRule = getStringOfRule;
module.exports.DEFAULT_DESCRIPTION = DEFAULT_DESCRIPTION;
