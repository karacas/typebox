'use strict';

const Config = require('@render/config.js');
const ListViewStore = require('@render/list_view_store.js');
const sharedData = require('@render/shared_data.js');
const Logger = require('@render/logger.js');
const $timeout = ms => new Promise(res => setTimeout(res, ms));
const getStringOfRule = require('@render/rule.js').getStringOfRule;
const clipboard = require('electron').clipboard;

let safeEval = null;
let mathExpression = null;
let safeEvalContext = null;
let isDev = Config.isDev;

const str2notevil = async ($rule, $data, $params) => {
   $rule = $rule.rule || $rule;

   safeEval = safeEval || require('notevil');
   mathExpression = mathExpression || require('math-expression-evaluator');

   safeEvalContext = safeEvalContext || {
      _: require('lodash'),
      nanoid: require('nanoid'),
      numeral: require('numeral'),
      dayjs: require('dayjs'),
      ms: require('ms'),
      log: Logger.log,
      env: process.env,
      os: require('os'),
      mathEval: $val => {
         return mathExpression.eval(String($val));
      },
   };

   let clipBoard = clipboard.readText();
   if (clipBoard > 1024) clipBoard = null;
   safeEvalContext.clipboard = clipBoard || '';
   safeEvalContext.params = $params || clipBoard;

   if (isDev && true) Logger.log('[str2notevil]', $data, $params);

   try {
      const res = safeEval($data, { context: safeEvalContext });
      if (isDev && true) Logger.log('[str2notevil res]', res);
      if (res && String(res).length) {
         return String(res);
      } else {
         return null;
      }
   } catch (ex) {
      logger.warn(ex.trace);
      return null;
   }

   return $data;
};

const gotoRootOnExec = async (close = true) => {
   return new Promise(async (resolve, reject) => {
      if (!(close && Config.get('here_are_dragons.gotoRootOnExec'))) {
         backRoot();
         resolve(false);
         return;
      }
      await unpopWin(Config.get('here_are_dragons.gotoRootOnExec'));
      resolve(true);
   });
};

const unpopWin = async (forceGotoRoot = false) => {
   const gotoRoot = forceGotoRoot;

   if (gotoRoot) {
      sharedData.app_window_and_systray.windowEvent.emit('UNPOP_AND_BACK');
   } else {
      sharedData.app_window_and_systray.unpopWin();
   }

   await $timeout(Config.get('here_are_dragons.unpopWinAndbackRootTime') || 64);

   Logger.log('[SOFT UNPOPWIN]', { gotoRoot });
   await $timeout(1);
   return true;
};

const backRootAndHide = () => {
   return unpopWin(true);
};

const backRoot = () => {
   ListViewStore.storeActions.backRootRulesPath();
   return true;
};

module.exports.gotoRootOnExec = gotoRootOnExec;
module.exports.unpopWin = unpopWin;
module.exports.backRootAndHide = backRootAndHide;
module.exports.backRoot = backRoot;
module.exports.str2notevil = str2notevil;
