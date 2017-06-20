'use strict';

const _ = require('lodash');
const Moment = require('moment');
const Auxjs = require('../auxfs.js');
const HistoryManager = require('../js/historyManager.js');
const LastRulesManager = require('../js/lastRulesManager.js');
const PackagesManager = require('../js/packagesManager.js');
const ListViewStore = require('../js/listViewStore.js');
const ExecAuxPlaceText = require('../js/execAuxPlaceText.js');
const ruleManager = require('../js/ruleManager.js');
const getNewRule = require('../js/rule.js').getNewRule;
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');

function executeRule($rule, keys, $objExec, event = null) {
    if (!$rule) {
        return;
    }

    let deleteSearchOnFire = true;

    if ($rule.generateStaticRule) $rule = getNewRule($rule.generateStaticRule($rule));

    if (Config.get('here_are_dragons.debug.no_executeAction')) {
        return;
    }

    //MAKE RULEOBJ
    let ruleObj = {
        rule: Auxjs.cloneDeep($rule),
        keys: keys,
        path: ListViewStore.store.getState().rulesPath,
        event: event
    };

    let ruleObjPrint = Auxjs.cloneDeep(ruleObj);

    if (_.result(ruleObjPrint, 'rule.icon.iconData')) {
        ruleObjPrint.rule.icon.iconData = null;
    }
    if (_.result(ruleObjPrint, 'rule.params.changePath.icon.iconData')) {
        ruleObjPrint.rule.params.changePath.icon.iconData = null;
    }
    if (_.result(ruleObjPrint, 'path.icon.iconData')) {
        ruleObjPrint.path.icon.iconData = null;
    }

    if (Config.get('dev')) {
        Logger.info(' >> RULE FIRE: ', _.result(ruleObjPrint, 'rule.title'), ruleObjPrint, ' / objExec: ' + $objExec);
    } else {
        Logger.info(' >> RULE FIRE: ', _.result(ruleObjPrint, 'rule.title'));
    }

    //If exec is String
    if ($objExec && _.isString($objExec)) {
        let executor = PackagesManager.getExecutorById($objExec);
        if (executor) {
            $objExec = executor;
        }
    }

    ruleManager.resetCacheslastRules();

    if ($objExec && !ruleObj.rule._internalAct) {
        //EXECUTOR
        if ($objExec.exectFunc && $objExec.type && _.has(ruleObj, 'rule.type') && _.includes(ruleObj.rule.type, $objExec.type)) {
            try {
                deleteSearchOnFire = $objExec.exectFunc(ruleObj);
            } catch (e) {
                Logger.error('objExec exectFunc:', e, $objExec, $objExec.type);
            }
            ListViewStore.storeActions.removeSubExecutors();
        } else {
            return;
        }
    } else if (_.has(ruleObj, 'rule.params.changePath')) {
        let path = _.cloneDeep(ruleObj.rule.params.changePath);
        if (!path.icon) path.icon = ruleObj.rule.icon;
        ListViewStore.storeActions.changeRulesPath(path);
    } else {
        //DEFAULT EXECUTER
        deleteSearchOnFire = PackagesManager.executeDefaultAction(ruleObj);
    }

    //SAVE IN HISTORY

    HistoryManager.push(ruleObj);

    LastRulesManager.push(ruleObj.rule);

    Logger.info('End rule fire');

    return deleteSearchOnFire;
}

function auxCallExecutors(rule) {
    let executors = PackagesManager.call_executors(rule);
    if (executors && executors.size) {
        ListViewStore.storeActions.placeSubExecutors(executors);
    }
}

module.exports.executeRule = executeRule;
module.exports.auxPlaceString = ExecAuxPlaceText.placeString;
module.exports.auxCallExecutors = auxCallExecutors;
module.exports.auxCopyToClipboard = ExecAuxPlaceText.copyToClipboard;
