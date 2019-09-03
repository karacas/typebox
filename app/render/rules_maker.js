'use strict';

const _clone = require('lodash').clone;
const path = require('path');
const ruleManager = require('@render/rule_manager.js');
const { getFile } = require('@aux/aux_fs.js');
const { getFiles, cloneDeep } = require('@aux/aux_global.js');
const pushRule = ruleManager.pushRule;
const pushRulePack = ruleManager.pushRulePack;
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const sharedData = require('@render/shared_data.js');
const _deleteOriginalArrayDataRules = !!Config.get('here_are_dragons.deleteOriginalArrayDataRules');
let _dev = Config.isDev;

function makeRules() {
   makeRulesfromFolder(Config.get('here_are_dragons.paths.rules'), true);
   if (Number(Config.get('here_are_dragons.debug.makeDummyRules')) > 0)
      setTimeout(() => {
         makeRulesTest(Number(Config.get('here_are_dragons.debug.makeDummyRules')));
      }, 1);
}

function makeRulesUser() {
   makeRulesfromFolder(Config.get('here_are_dragons.paths.user_rules'), false);
}

function makeRulesfromFolder(folder, internal = true) {
   try {
      getFiles(folder).map(rulesPackName => {
         pushRulesFromFile(rulesPackName, String(folder), internal);
      });
   } catch (e) {
      Logger.log('[Rules] No rules:', folder);
   }
}

function pushRulesFromFile(fileRule, $file, internal = true) {
   let ignoreTheseRules = Config.get('ignoreTheseRules');
   const PLATFORM = process.platform;

   if (checkInList(fileRule, ignoreTheseRules)) {
      Logger.warn('[Rules] Ignore this fileRule [ignoreTheseRules]:', fileRule);
   }

   let data = getFile(fileRule, 'AUTO');

   if ((data && data.enabled === false) || data.disabled == true) {
      Logger.warn('[Rules] this fileRule is disabled:', fileRule);
      return;
   }

   if (!data || !data.rules || !data.name || !Array.isArray(data.rules) || !data.rules.length) {
      Logger.warn('[Rules] error in this fileRule:', fileRule, data);
      return;
   }

   if (data.plataforms && data.plataforms.length) {
      let $plataforms = data.plataforms;
      if (typeof $plataforms === 'string') {
         $plataforms.split(',');
      }
      if (!$plataforms.includes(PLATFORM)) {
         Logger.warn('[Rules] this fileRule is disabled by platform:', fileRule, PLATFORM, $plataforms);
         return;
      }
   }

   let $fileRulenorm = path.normalize(fileRule);

   if (Config.isWin) {
      $fileRulenorm = $fileRulenorm.replace(/\\/g, '\\');
   }

   let $rules = data.rules.map($rule => {
      if ($rule === undefined || $rule === null) return null;

      if ($rule.plataforms && $rule.plataforms.length) {
         let $plataformsRule = $rule.plataforms;
         if (typeof $plataformsRule === 'string') {
            $plataformsRule.split(' ');
         }
         if (!$plataformsRule.includes(PLATFORM)) {
            Logger.warn('[Rule] this fileRule is disabled by platform:', $rule, PLATFORM, $plataformsRule);
            return null;
         }
      }

      if (data.icon && !$rule.icon) {
         $rule.icon = data.icon;
      }

      if ($rule.type) {
         if (Array.isArray($rule.type) && !$rule.type.includes('rule_from_filepack')) {
            $rule.type = _clone($rule.type).concat(['rule_from_filepack']);
         }
         if (typeof $rule.type === 'string' || $rule.type instanceof String) {
            $rule.type = [$rule.type, 'rule_from_filepack'];
         }
      } else {
         $rule.type = ['string', 'rule_from_filepack'];
      }

      if ($rule.params === undefined || $rule.params === null) {
         $rule.params = {};
      }

      $rule.params._rff_fileOrigin = fileRule;
      $rule.params._rff_fileOriginNorm = $fileRulenorm;
      $rule.params._rff_fileName = data.name;
      $rule.params._rff_internal = internal;

      return $rule;
   });

   pushRulePack($rules, data, String(fileRule));

   if (_deleteOriginalArrayDataRules) {
      $rules = [];
      data.rules = [];
   }

   setTimeout(() => {
      Logger.info('[Rules] Added:', path.basename(fileRule));
   }, 0);
}

const pushRulesFromFileExternal = (name, $file) => pushRulesFromFile(name, $file, false);

function makeRulesTest(cant) {
   let tmpPack = Array.from(new Array(cant), (x, i) => i).map(i => {
      return {
         title: `Test ${i}`,
         params: {
            param: `${i}Test Expander OK: `,
         },
      };
   });
   pushRulePack(tmpPack, null, 'makeRulesTest');
}

function checkInList(name, arrayIndex) {
   return arrayIndex.some(obj => {
      if (name.indexOf(obj) !== -1 && obj.length) {
         return true;
      }
   });
}

module.exports = { makeRules, makeRulesUser, pushRulesFromFileExternal };

if (_dev) {
   window.makeRulesTest = makeRulesTest;
}
