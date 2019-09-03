const Config = require('@render/config.js');
const { get, extendObj, cloneDeep, equal, removeDiacritics, $timeout, debounce } = require('@aux/aux_global.js');
const PackagesManager = require('@render/packages_manager.js');
const sharedData = require('@render/shared_data.js');
const acceleratorKey = sharedData.acceleratorKey;
const Logger = require('@render/logger.js');
const { deleteStrokes, placeString, waitForBlur, waitForFocus } = require('@render/place_text.js');
const ListViewStore = require('@render/list_view_store.js');
const { windowEvent, popWinHard } = sharedData.app_window_and_systray;
const { getStringOfRule } = require('@render/rule.js');
const status = sharedData.status;
const getStatus = status.get;

let listeners = false;
let initiated = false;
let expanders = [];

let maxLengthAccelerator = Number(Config.get('here_are_dragons.expander_maxLengthAccelerator') || 10);
let minLengthAccelerator = Number(Config.get('here_are_dragons.expander_minLengthAccelerator') || 3);

const rule2Expander = rule => {
   if (!initiated || !rule || !rule.id || !rule.isRule || !rule.expander) return null;

   let expander = typeof rule.expander === 'string' ? [rule.expander] : Array.isArray(rule.expander) ? rule.expander : null;
   let _internal_id = rule.params && rule._internal_id ? rule._internal_id : null;

   expander = expander.filter(exp => {
      if (exp.length < minLengthAccelerator || exp.length > maxLengthAccelerator) {
         // Logger.warn('[EXPANDER], this expander is not valid:', 'MIN:', minLengthAccelerator, 'MAX:', maxLengthAccelerator, rule.title);
         return null;
      }

      if (expanders.find(ex => ex.id !== rule.id && (!rule._internal_id || ex._internal_id !== rule._internal_id) && ex.expander.includes(exp))) {
         // Logger.warn('[EXPANDER], this expander is already taken:', found.title);
         return null;
      }

      return exp;
   });

   if (!expander || expander.length === 0) return null;

   return {
      id: rule.id,
      _internal_id: _internal_id,
      isVirtual: rule.isVirtual,
      title: rule.title,
      expander: expander,
      expanderType: rule.expanderType,
      params: rule.params ? cloneDeep(rule.params) : null,
      type: rule.type,
   };
};

const addExpander = $rule => {
   if (!initiated || !$rule || !$rule.id || !$rule.expander) return;

   let ruleExp = rule2Expander($rule);
   if (!ruleExp) return null;

   //Update if is virtual
   if (ruleExp.isVirtual && ruleExp._internal_id) {
      let found = expanders.findIndex(exp => exp._internal_id === ruleExp._internal_id);
      if (found === -1) found = expanders.findIndex(exp => exp.id === $rule.id);
      if (found !== -1) {
         //KTODO: NO REFREZCA
         expanders[found] = ruleExp;
         remakeExpandersMap();
         return;
      }
   }

   //VALID AND NEW
   expanders.push(ruleExp);
   remakeExpandersMap();
};

const _remakeExpandersMap = () => {
   let tmp_expanders = [];
   expanders.forEach(expRule => {
      expRule.expander.forEach(expander => {
         tmp_expanders.push({
            accelerator: expander,
            id: expRule.id,
         });
      });
   });
   sharedData.expanders = tmp_expanders;
   if (false) Logger.log(tmp_expanders, '[expanders]');
};

const remakeExpandersMap = debounce(_remakeExpandersMap, 128);

const removeListeners = val => {
   if (initiated && listeners) {
      if (acceleratorKey.off && typeof acceleratorKey.off === 'function') {
         acceleratorKey.off('accelerator', onAccelerator);
      }
      listeners = false;
   }
};

const init = () => {
   if (initiated) return;
   if (!Config.get('here_are_dragons.canListenKeyboard')) return;

   if (acceleratorKey.on && typeof acceleratorKey.on === 'function') {
      Logger.info('[expander_manager] init');
      acceleratorKey.on('accelerator', onAccelerator);
      listeners = true;
   }

   initiated = true;
};

const removeExpanderTxt = async strokes => {
   if (!strokes) return;
   await deleteStrokes(strokes);
   return true;
};

const isSearchFocus = () => {
   return document && document.activeElement && document.activeElement.id === 'mainSearch' && getStatus('focused');
};

const onAccelerator = async val => {
   if (!initiated || !val || !val.id) return;

   const accelerator = val.accelerator;
   const rule = expanders.find(exp => exp.id === val.id);
   const isRegex = accelerator.indexOf(':') >= minLengthAccelerator ? true : false;
   const paramRegex = !isRegex ? null : accelerator.slice(1 + accelerator.indexOf(':'));

   if (isSearchFocus()) return null;

   if (isRegex && !paramRegex) return null;

   if (rule && accelerator && rule.id) {
      let changePath = get(rule, 'params.changePath');
      await removeExpanderTxt(1 + accelerator.length);

      //IF CHANGEPATH
      if (changePath) {
         popWinHard();
         windowEvent.emit('GO_TO_PATH', changePath, true);
         return true;
      }

      // IF HAS NORMAL STRING / AVOID OPEN URL, FILE, ETC
      if (rule.type.includes('string')) {
         let str = getStringOfRule(rule);
         if (str) {
            placeString(str, undefined, false, false);
            return true;
         }
      }

      //DEFAULT
      const expander_ev = new CustomEvent('expander', {
         detail: {
            accelerator: accelerator,
            regex: isRegex,
            paramRegex: paramRegex,
         },
         bubbles: true,
         cancelable: true,
      });

      resp = await PackagesManager.executeDefaultAction({ rule: rule, event: expander_ev });
      Logger.log(' > [executeDefaultAction]', resp, rule);
   }
};

windowEvent.on('QUIT', removeListeners);
windowEvent.on('REFRESH_WIN', removeListeners);

module.exports.init = init;
module.exports.addExpander = addExpander;
