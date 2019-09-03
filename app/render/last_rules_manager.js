'use strict';
const { throttle, includes } = require('lodash');
const global_aux = require('@aux/aux_global.js');
const { loadGenericJson, saveGenericJson } = require('@aux/aux_fs.js');
const { OrderedMap } = require('immutable');
const hiddenRulesManager = require('@render/hidden_rules_manager.js');
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const sharedData = require('@render/shared_data.js');
const getTime = sharedData.realClock.getTime;
const get = global_aux.get;

const fileNameLast = global_aux.normalicePath(`${Config.get('here_are_dragons.paths.lastpath')}/${Config.get('here_are_dragons.paths.lastfile')}`, false);

let lastItems = OrderedMap();
let lastNeedSave = false;

let ephemeralPaths = [];

const icon = {
   type: 'iconFont',
   iconClass: 'mdi-backup-restore accentColor2 text',
};

const path = {
   name: 'lastItems',
   path: 'LAST_RULES_PATH',
   avoidCache: true,
   avoidlastItems: true,
   avoidHistory: true,
   icon: icon,
};

const flatten = global_aux.flatten;

function getItemsToDeleteByPath($path) {
   return lastItems
      .filter(v => v.params.original_last_path === $path)
      .sortBy(r => -r.params.lastDate)
      .slice(Config.get('here_are_dragons.maxLastRules_ephemeral'))
      .toArray()
      .map(r => r[0]);
}

function getItemsToDeleteByPaths($paths) {
   return flatten($paths.map(getItemsToDeleteByPath));
}

function purge() {
   let items2del = getItemsToDeleteByPaths(ephemeralPaths);
   lastItems = lastItems
      .deleteAll(items2del)
      .sortBy(r => -r.params.lastDate)
      .slice(0, Config.get('here_are_dragons.maxLastRules'));
}

function push(rulefavObj) {
   if (!rulefavObj) return;

   let rulelast = global_aux.cloneDeep(rulefavObj);
   rulelast.params = rulelast.params || {};

   const id = rulelast._internal_id || rulelast.id;

   if (!id) return;

   if (!id || !includes(rulelast.type, 'object')) {
      return;
   }

   if (rulelast.last_permit) {
      if (lastItems.get(id)) {
         lastItems = lastItems.delete(id);
      }

      rulelast.component = null;
      rulelast.fav_permit = false;
      rulelast.new_permit = false;
      rulelast.last_permit = false;
      rulelast.description = rulelast.params._note_original_description || rulelast.description;
      rulelast.hidden_permit = false;
      rulelast.persistFuzzy = false;
      rulelast.params.original_last_id = rulelast.id;
      rulelast.params.original_last_path = rulelast.path;
      rulelast.params.original_description = rulelast.description;
      rulelast.params.lastDate = getTime();
      delete rulelast.initSort;
      delete rulelast.posFixed;
      delete rulelast.specialScoreMult;

      if (rulelast._internal_id) rulelast._id = rulelast._internal_id;

      lastItems = lastItems.set(id, rulelast);
      purge();

      lastNeedSave = true;
   }
}

function remove(rulelast) {
   let id = get(rulelast, 'params.original_last_id');
   if (id && lastItems.get(id)) {
      rulelast.last_permit = false;
      lastItems = lastItems.delete(id);
      lastNeedSave = true;
   }

   id = rulelast._internal_id;
   if (id && lastItems.get(id)) {
      rulelast.last_permit = false;
      lastItems = lastItems.delete(id);
      lastNeedSave = true;
   }

   id = rulelast.id;
   if (id && lastItems.get(id)) {
      rulelast.last_permit = false;
      lastItems = lastItems.delete(id);
      lastNeedSave = true;
   }
}

const savelast = throttle(
   () => {
      if (!lastNeedSave) {
         return;
      }

      let obj2save = {
         lastItems: lastItems.toJS(),
      };

      let resp = saveGenericJson(obj2save, fileNameLast);

      if (!resp) {
         Logger.error('[Lasts] Fail savelast:', resp);
      } else {
         Logger.info('[Lasts] last Saved ok:', resp);
         lastNeedSave = false;
      }
   },
   80,
   { trailing: false }
);

function loadlast() {
   if (lastItems === null) {
      return;
   }
   let lastItemsTmp = loadGenericJson(fileNameLast, Config.get('here_are_dragons.lastBackups'));

   try {
      if (lastItemsTmp && lastItemsTmp.lastItems) {
         lastItems = OrderedMap(global_aux.cloneDeep(lastItemsTmp.lastItems))
            .filter(r => r.id && r.title)
            .sortBy(r => -r.params.lastDate);
         Logger.info('[Lasts] lastItems length: ', lastItems.size);
      }
   } catch (e) {}

   if (!lastItems) {
      Logger.info('[Lasts] load last: no last file');
   }
}

//Save events
sharedData.idleTime.getIdleEvent().on('idle', savelast);
sharedData.app_window_and_systray.windowEvent.on('QUIT', savelast);
sharedData.app_window_and_systray.windowEvent.on('REFRESH_WIN', savelast);

//Public

module.exports.push = push;

module.exports.pushToephemeralPaths = $path => {
   if (!$path) return;
   ephemeralPaths = [...new Set(ephemeralPaths.concat([String($path)]))];
};

module.exports.save = savelast;

module.exports.remove = remove;

module.exports.loadlast = loadlast;

module.exports.getlastItems = (filterPaths = true) => {
   let result = lastItems;

   if (result) {
      let toDel = hiddenRulesManager.gethiddenItems().map(r => {
         if (r.params && r.params && r.params.original_hidden_id) {
            return r.id;
         }
      });
      if (toDel.length > 0) result = result.deleteAll(toDel);
   }

   if (filterPaths) {
      let toDel = result.map(r => {
         if (r.type.includes('path')) return r.id;
      });
      if (toDel.length > 0) result = result.deleteAll(toDel);
   }

   return result
      .toSet()
      .sortBy(r => -r.params.lastDate)
      .toArray();
};

module.exports.getAllLastItems = () => {
   return lastItems
      .toSet()
      .sortBy(r => -r.params.lastDate)
      .toArray();
};

module.exports.getlastItemsPath = path => {
   return lastItems
      .filter(v => v.params.original_last_path === path)
      .toSet()
      .sortBy(r => -r.params.lastDate)
      .toArray();
};

module.exports.getIcon = () => {
   return icon;
};

module.exports.getPath = () => {
   return path;
};

module.exports.getFolderLastsPath = () => {
   let fpath = global_aux.cloneDeep(path);
   fpath.name = 'Last folders';
   fpath.path = 'LASTS_DRIVE';
   return fpath;
};

if (Config.isDev && window) {
   window.printlastItems = () => {
      console.log(lastItems.toJS());
   };
   window.printlastItemsString = () => {
      console.log(JSON.stringify(lastItems.toJS(), null, 2));
   };
}
