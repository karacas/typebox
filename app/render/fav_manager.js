'use strict';
const { throttle, includes } = require('lodash');
const { OrderedMap } = require('immutable');
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const createRule = require('@render/rule.js').getNewRule;
const sharedData = require('@render/shared_data.js');
const getTime = sharedData.realClock.getTime;
const global_aux = require('@aux/aux_global.js');
const { loadGenericJson, saveGenericJson } = require('@aux/aux_fs.js');
const get = global_aux.get;

const fileNameFav = global_aux.normalicePath(`${Config.get('here_are_dragons.paths.favpath')}/${Config.get('here_are_dragons.paths.favfile')}`, false);

let favItems = OrderedMap();
let favNeedSave = false;

const icon = {
   type: 'iconFont',
   iconClass: 'mdi-star accentColor2 text',
};

const path = {
   path: 'FAVS_PATH',
   name: 'favorites',
   avoidCache: true,
   avoidHistory: true,
   icon: icon,
};

function push($rulefavObj) {
   let rulefav = global_aux.cloneDeep($rulefavObj);

   if (rulefav.generateStaticRule) rulefav = createRule(rulefav.generateStaticRule($rulefavObj));

   const id = rulefav._internal_id || rulefav.id;

   if (!id) return;

   if (id && rulefav.fav_permit) {
      if (!includes(rulefav.type, 'object')) {
         return;
      }

      if (favItems.get(id)) {
         favItems = favItems.delete(id);
      }

      rulefav.hidden_permit = false;
      rulefav.new_permit = false;
      rulefav.persistFuzzy = false;
      rulefav.params.original_fav_id = id;
      rulefav.params.original_fav_path = rulefav.path;
      rulefav.params.lastDate = getTime();
      delete rulefav.initSort;
      delete rulefav.posFixed;
      delete rulefav.specialScoreMult;

      if (rulefav._internal_id) rulefav._id = rulefav._internal_id;

      favItems = favItems
         .set(id, rulefav)
         .sortBy(r => -r.params.lastDate)
         .slice(0, Config.get('here_are_dragons.maxFavsRules'));
      favNeedSave = true;
   }
}

function toggle(rulefav) {
   let deleted = false;

   let id = rulefav.id;
   if (id && favItems.get(id)) {
      favItems = favItems.delete(id);
      deleted = true;
      favNeedSave = true;
   }

   id = get(rulefav, 'params.original_fav_id');
   if (id && favItems.get(id) && !deleted) {
      favItems = favItems.delete(id);
      deleted = true;
      favNeedSave = true;
   }

   id = rulefav._internal_id;
   if (id && favItems.get(id) && !deleted) {
      favItems = favItems.delete(id);
      deleted = true;
      favNeedSave = true;
   }

   if (rulefav.fav_permit === true && !deleted) {
      push(rulefav);
      favNeedSave = true;
   }
}

function remove(rulefav) {
   let id = rulefav.id;
   if (id && favItems.get(id)) {
      favItems = favItems.delete(id);
      favNeedSave = true;
   }

   id = get(rulefav, 'params.original_fav_id');
   if (id && favItems.get(id)) {
      favItems = favItems.delete(id);
      favNeedSave = true;
   }

   id = rulefav._internal_id;
   if (id && favItems.get(id)) {
      favItems = favItems.delete(id);
      favNeedSave = true;
   }
}

const savefav = throttle(
   () => {
      if (!favNeedSave) return;

      let obj2save = {
         favItems: favItems.toJS(),
      };

      let resp = saveGenericJson(obj2save, fileNameFav);

      if (!resp) {
         Logger.error('[Favs] Fail savefav:', resp);
      } else {
         Logger.info('[Favs] fav Saved ok:', resp);
         favNeedSave = false;
      }
   },
   80,
   { trailing: false }
);

function loadfav() {
   if (favItems === null) {
      return;
   }
   let favItemsTmp = loadGenericJson(fileNameFav, Config.get('here_are_dragons.lastBackups'));

   try {
      if (favItemsTmp && favItemsTmp.favItems) {
         favItems = OrderedMap(global_aux.cloneDeep(favItemsTmp.favItems)).filter(r => r.id && r.title);
         Logger.info('[Favs] favItems length: ', favItems.size);
      }
   } catch (e) {}

   if (!favItems) {
      Logger.info('[Favs] Loadfav: no fav');
   }
}

//Save events
sharedData.idleTime.getIdleEvent().on('idle', savefav);
sharedData.app_window_and_systray.windowEvent.on('QUIT', savefav);
sharedData.app_window_and_systray.windowEvent.on('REFRESH_WIN', savefav);

//Public

module.exports.push = push;
module.exports.toggle = toggle;
module.exports.remove = remove;
module.exports.loadfav = loadfav;
module.exports.save = savefav;

module.exports.getFavItemsIm = () => {
   return favItems;
};

module.exports.getFavItems = () => {
   return favItems.toSet().toArray();
};

module.exports.ifFav = item => {
   const id = item._internal_id || item.id;
   return Boolean(favItems.get(id) && favItems.get(id).fav_permit);
};

module.exports.getIcon = () => {
   return icon;
};

module.exports.getPath = () => {
   return path;
};

module.exports.getFolderFavsPath = () => {
   let fpath = global_aux.cloneDeep(path);
   fpath.name = 'Favorite folders';
   fpath.path = 'FAVS_DRIVE';
   return fpath;
};

if (Config.isDev && window) {
   window.printfavItems = () => {
      console.log(module.exports.getFavItems());
   };
   window.printfavItemsString = () => {
      console.log(JSON.stringify(module.exports.getFavItems(), null, 2));
   };
}
