'use strict';
const _ = require('lodash');
const fs = require('fs');
const mkpath = require('mkpath');
const path = require('path');
const ruleManager = require('../js/ruleManager.js');
const getFiles = require('../auxfs.js').getFiles;
const pushRule = ruleManager.pushRule;
const pushRulePack = ruleManager.pushRulePack;
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');

function makeRules() {
    makeRulesfromFolder(Config.get('here_are_dragons.paths.rules'));
    makeRulesfromFolder(Config.get('here_are_dragons.paths.user_rules'));
    setTimeout(makeRulesTest, 100);
}

function makeRulesfromFolder(folder) {
    try {
        getFiles(folder).map(rulesPackName => {
            pushRulesFromFile(rulesPackName);
        });
    } catch (e) {
        Logger.warn('[Rules] No rules:', folder);
    }
}

function pushRulesFromFile(fileRule) {
    Logger.info('[Rules] Add file rules:', fileRule);
    let data = sharedData.dataManager.getFile(fileRule, 'JSON5');
    if (!data || !data.rules) {
        return;
    }
    let ignoreTheseRules = Config.get('ignoreTheseRules');
    if (!checkInList(fileRule, ignoreTheseRules)) {
        pushRulePack(data.rules);
    } else {
        Logger.warn('[Rules] Ignore this fileRule:', fileRule);
    }
}

function makeRulesTest() {
    let tmpPack = Array.from(new Array(Config.get('here_are_dragons.debug.makeDummyRules')), (x, i) => i).map(i => {
        return {
            title: 'Test ' + i,
            params: {
                param: i + 'Test Expander OK: '
            }
        };
    });
    pushRulePack(tmpPack);
}

function checkInList(name, arrayIndex) {
    return arrayIndex.some(obj => {
        if (name.indexOf(obj) !== -1 && obj.length) {
            return true;
        }
    });
}

module.exports.makeRules = makeRules;
