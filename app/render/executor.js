'use strict';

const { has, includes } = require('lodash');
const isString = val => typeof val === 'string';
const HistoryManager = require('@render/history_manager.js');
const LastRulesManager = require('@render/last_rules_manager.js');
const PackagesManager = require('@render/packages_manager.js');
const ListViewStore = require('@render/list_view_store.js');
const ExecAuxPlaceText = require('@render/place_text.js');
const ruleManager = require('@render/rule_manager.js');
const getNewRule = require('@render/rule.js').getNewRule;
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const { cloneDeep, get } = require('@aux/aux_global.js');
const { gotoRootOnExec, unpopWin } = require('@render/aux_executor.js');
const sharedData = require('@render/shared_data.js');

const $timeout = ms => new Promise(res => setTimeout(res, ms));

async function executeRule($rule, keys, $objExec, event = null, execute = true) {
   if (!$rule) {
      logger.info('[executeRule] abort: no rule');
      return true;
   }

   if (Config.get('here_are_dragons.debug.no_executeAction')) {
      logger.info('[executeRule] abort: no_executeAction');
      return true;
   }

   if ($rule.generateStaticRule) {
      if ($objExec && $objExec.namePlugin && !$rule.generate_by_plugin) $rule.generate_by_plugin = ` / exec: ${$objExec.namePlugin}`;
      $rule = getNewRule($rule.generateStaticRule($rule), true);
   }

   let deleteSearchOnFire = true;

   //MAKE RULEOBJ
   let ruleObj = {
      rule: cloneDeep($rule),
      keys: keys,
      path: ListViewStore.store.getState().rulesPath,
      event: event,
   };

   if (Config.isDev) {
      let ruleObjPrint = cloneDeep(ruleObj);

      if (get(ruleObjPrint, 'rule.icon.iconData')) {
         ruleObjPrint.rule.icon.iconData = null;
      }
      if (get(ruleObjPrint, 'rule.params.changePath.icon.iconData')) {
         ruleObjPrint.rule.params.changePath.icon.iconData = null;
      }
      if (get(ruleObjPrint, 'path.icon.iconData')) {
         ruleObjPrint.path.icon.iconData = null;
      }

      Logger.log('');
      Logger.log('[executeRule] [executeRule] rule fire', { rule: get(ruleObj, 'rule.title'), ruleObjPrint });
   } else {
      Logger.info('[executeRule] [executeRule] rule fire', { rule: get(ruleObj, 'rule.title') });
   }

   //KTODO: #3242342234 error en jsx

   if (execute) {
      if (Config.isDev) Logger.log('[executor]', { rule: get(ruleObj, 'rule.title'), objExec: $objExec, event: cloneDeep(event), canExecute: execute });

      if ($objExec && isString($objExec)) {
         let executor = PackagesManager.getExecutorById($objExec);
         if (executor) {
            $objExec = executor;
            Logger.log({ id: $objExec.id, namePlugin: $objExec.namePlugin, exectFunc: !!$objExec.exectFunc, type: $objExec.type });
         }
      }

      ruleManager.resetCacheslastRules();

      if ($objExec && !ruleObj.rule._internalAct) {
         //EXECUTOR
         if ($objExec.exectFunc && $objExec.type && has(ruleObj, 'rule.type') && includes(ruleObj.rule.type, $objExec.type)) {
            try {
               deleteSearchOnFire = $objExec.exectFunc(ruleObj, ruleObj.rule || ruleObj, event);
               Logger.log($objExec.id, 'ok');
            } catch (e) {
               Logger.error('objExec exectFunc:', { e: e, objExec: $objExec, objExec: $objExec.type });
            }
            ListViewStore.storeActions.removeSubExecutors();
         } else {
            return true;
         }
      } else if (has(ruleObj, 'rule.params.changePath')) {
         let path = cloneDeep(ruleObj.rule.params.changePath);
         if (!path.icon) path.icon = ruleObj.rule.icon;
         ListViewStore.storeActions.changeRulesPath(path);
         deleteSearchOnFire = undefined;
         Logger.log('[changePath]');
      } else {
         //DEFAULT EXECUTER
         Logger.log('[default executer]');
         deleteSearchOnFire = await PackagesManager.executeDefaultAction(ruleObj);
      }
   } else {
      Logger.info('[executeRule] rule fire: disabled by execute param');
      deleteSearchOnFire = false;
      ruleManager.resetCacheslastRules();
   }

   //SAVE IN HISTORY

   if (deleteSearchOnFire === undefined) deleteSearchOnFire = false;

   if (!deleteSearchOnFire) {
      HistoryManager.push(ruleObj);
      LastRulesManager.push(ruleObj.rule);
   }

   Logger.info('[End] [executeRule] rule fire', { executed: !deleteSearchOnFire, rule: $rule.title }, '\n');

   return deleteSearchOnFire;
}

function auxCallExecutors(rule) {
   let executors = PackagesManager.call_executors(rule);
   if (executors && executors.size) {
      ListViewStore.storeActions.placeSubExecutors(executors);
   }
}

module.exports.executeRule = executeRule;
module.exports.auxCallExecutors = auxCallExecutors;
module.exports.auxPlaceString = ExecAuxPlaceText.placeString;
module.exports.deleteStrokes = ExecAuxPlaceText.deleteStrokes;
module.exports.auxCopyToClipboard = ExecAuxPlaceText.copyToClipboard;
module.exports.unpopWin = unpopWin;

/*TEST*/

if (Config.isDev || Config.get('here_are_dragons.safe_secure_commands') === false) {
   window.executeRule = executeRule;
}

// test
if (false) {
   window.executeRule({
      type: ['file', 'string', 'object'],
      path: '/',
      params: {
         drive_path: 'C:\\Users\\karacas\\AppData\\Roaming\\Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar\\Command Prompt.lnk',
      },
   });
   window.executeRule({
      type: ['string', 'object'],
      path: '/',
      params: {
         string: 'Alejandro Emparan↵Proyectiva S.A.↵http://www.proyectiva.com',
      },
   });
   window.executeRule({
      type: ['command', 'object'],
      params: {
         command: 'control desk.cpl',
      },
   });
   window.executeRule({
      type: ['command', 'object'],
      params: {
         command: 'start cmd.exe /K ping 8.8.4.4 -t',
      },
   });
   window.executeRule({
      type: ['command', 'object'],
      params: {
         command: 'start cmd.exe /K  systeminfo ^| find "System Boot Time:"',
      },
   });
   window.executeRule({
      type: ['command', 'object'],
      params: {
         command: 'start c:\\totalcmd\\TOTALCMD.EXE /l=D:\\DEV\\usbwebserver\\htdocs\\typebox /p=l /O',
      },
   });
}
