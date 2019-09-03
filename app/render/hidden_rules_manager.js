'use strict';
const { throttle, includes } = require('lodash');
const global_aux = require('@aux/aux_global.js');
const { OrderedMap } = require('immutable');
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const sharedData = require('@render/shared_data.js');
const favManager = require('@render/fav_manager.js');
const getTime = sharedData.realClock.getTime;
const resetScore = require('@render/history_manager.js').remove;
const { loadGenericJson, saveGenericJson } = require('@aux/aux_fs.js');
const get = global_aux.get;

let hiddenItems = OrderedMap();
let hiddenNeedSave = false;

const fileNameHidden = global_aux.normalicePath(
   `${Config.get('here_are_dragons.paths.hidden_path')}/${Config.get('here_are_dragons.paths.hiddenRulesfile')}`,
   false
);

const icon = {
   type: 'iconFont',
   iconClass: 'mdi-eye-off-outline accentColor2 text',
};

const path = {
   path: 'HIDDEN_RULES_PATH',
   avoidCache: true,
   avoidHistory: true,
   icon: icon,
};

function push($hiddenItem) {
   let hiddenItem = global_aux.cloneDeep($hiddenItem);

   const id = hiddenItem._internal_id || hiddenItem.id;

   if (!id) return;

   if (!includes(hiddenItem.type, 'object')) {
      return;
   }

   if (id && hiddenItem.hidden_permit) {
      if (hiddenItem.favorite) {
         favManager.toggle(hiddenItem);
      }

      if (hiddenItems.get(id)) {
         hiddenItems = hiddenItems.delete(id);
      }

      resetScore(id);

      hiddenItem.component = null;
      hiddenItem.hidden_permit = false;
      hiddenItem.fav_permit = false;
      hiddenItem.favorite = false;
      hiddenItem.last_permit = false;
      hiddenItem.new_permit = false;
      hiddenItem.persistFuzzy = false;
      hiddenItem.params.original_hidden_id = hiddenItem.id;
      hiddenItem.params.original_hidden_path = hiddenItem.path;
      hiddenItem.params.hiddentDate = getTime();
      delete hiddenItem.initSort;
      delete hiddenItem.posFixed;
      delete hiddenItem.specialScoreMult;

      if (hiddenItem._internal_id) hiddenItem._id = hiddenItem._internal_id;

      hiddenItems = hiddenItems
         .set(id, hiddenItem)
         .sortBy(r => -r.params.hiddentDate)
         .slice(0, Config.get('here_are_dragons.maxHiddenRules'));
      hiddenNeedSave = true;
   }
}

function remove(hiddenItem) {
   let id = get(hiddenItem, 'params.original_hidden_id');
   if (id && hiddenItems.get(id)) {
      hiddenItems = hiddenItems.delete(id);
      resetScore(id);
      hiddenNeedSave = true;
   }

   id = hiddenItem._internal_id;
   if (id && hiddenItems.get(id)) {
      hiddenItems = hiddenItems.delete(id);
      resetScore(id);
      hiddenNeedSave = true;
   }

   id = hiddenItem.id;
   if (id && hiddenItems.get(id)) {
      hiddenItems = hiddenItems.delete(id);
      resetScore(id);
      hiddenNeedSave = true;
   }
}

const saveHiddenRules = throttle(
   () => {
      if (!hiddenNeedSave) {
         return;
      }

      let obj2save = {
         hiddenItems: hiddenItems.toJS(),
      };

      let resp = saveGenericJson(obj2save, fileNameHidden);

      if (!resp) {
         Logger.error('[HiddenRules] Fail saveHiddenRules:', resp);
      } else {
         Logger.info('[HiddenRules] saveHiddenRules Saved ok:', resp);
         hiddenNeedSave = false;
      }
   },
   80,
   { trailing: false }
);

function loadHiddenRules() {
   if (hiddenItems === null) {
      return;
   }
   let hiddenItemsTmp = loadGenericJson(fileNameHidden, Config.get('here_are_dragons.historyBackups'));

   try {
      if (hiddenItemsTmp && hiddenItemsTmp.hiddenItems) {
         hiddenItems = OrderedMap(global_aux.cloneDeep(hiddenItemsTmp.hiddenItems)).filter(r => r.id && r.title);
         Logger.info('[HiddenRules] hiddenItems length: ', hiddenItems.size);
      }
   } catch (e) {}

   if (!hiddenItems) {
      Logger.warn('[loadHiddenRules] error proccesing:', e);
   }
}

function toggle(hiddenItem) {
   let id = hiddenItem.id;

   if (id && hiddenItems.get(id)) {
      hiddenItems = hiddenItems.delete(id);
      hiddenNeedSave = true;
   }

   id = get(hiddenItem, 'params.original_hidden_id');
   if (id && hiddenItems.get(id)) {
      hiddenItems = hiddenItems.delete(id);
      hiddenNeedSave = true;
      return;
   }

   id = hiddenItem._internal_id;
   if (id && hiddenItems.get(id)) {
      hiddenItems = hiddenItems.delete(id);
      hiddenNeedSave = true;
      return;
   }

   if (hiddenItem.hidden_permit === true) {
      push(hiddenItem);
      hiddenNeedSave = true;
      return;
   }
}

//Save events
sharedData.idleTime.getIdleEvent().on('idle', saveHiddenRules);
sharedData.app_window_and_systray.windowEvent.on('QUIT', saveHiddenRules);
sharedData.app_window_and_systray.windowEvent.on('REFRESH_WIN', saveHiddenRules);

//Public

module.exports.push = push;
module.exports.remove = remove;
module.exports.toggle = toggle;
module.exports.save = saveHiddenRules;
module.exports.loadHiddenRules = loadHiddenRules;

module.exports.gethiddenItemsIm = () => {
   return hiddenItems;
};

module.exports.gethiddenItems = () => {
   return hiddenItems.toSet().toArray();
};

module.exports.gethiddenItemsPath = path => {
   return hiddenItems
      .filter(v => v.params.original_hidden_path === path)
      .toSet()
      .toArray();
};

module.exports.isHide = item => {
   const id = item._internal_id || item.id;
   return Boolean(hiddenItems.get(id));
};

module.exports.getIcon = () => {
   return icon;
};

module.exports.getPath = () => {
   return path;
};

if (Config.isDev && window) {
   window.printhiddenItems = () => {
      console.log(hiddenItems.toJS());
   };
   window.printhiddenItemsString = () => {
      console.log(JSON.stringify(hiddenItems.toJS(), null, 2));
   };
}
