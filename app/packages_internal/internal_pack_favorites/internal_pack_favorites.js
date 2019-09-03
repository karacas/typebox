'use strict';

const favManager = require('@render/fav_manager.js');
const Config = require('@render/config.js');
const { idleTime } = require('@render/shared_data.js');
const { bindKet2actualOs, getKeyFromConfig, equal } = require('@aux/aux_global.js');
let lastFavs = [];
let initiated = false;

module.exports = context => {
   return {
      lazyInit() {
         if (initiated) return;
         if (!favManager || !favManager.getFavItems || !favManager.getFavItems().length) return;
         let fixedOptions = Number(Config.get('fixedTypeBoxOptions'));

         //Add main rule
         context.addPermanentRules([
            {
               title: 'Favorites',
               type: ['Favorites', 'null'],
               description: `Command: f! / Shortcut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'FAVS')}`,
               icon: favManager.getIcon(),
               fav_permit: false,
               last_permit: false,
               hidden_permit: false,
               new_permit: false,
               initSort: 10,
               posFixed: fixedOptions * 10,
               params: {
                  changePath: favManager.getPath(),
               },
            },
         ]);

         initiated = true;
      },
      init() {
         this.pushRules = () => {
            if (!favManager || !favManager.getFavItems) return;
            const favs = favManager.getFavItems();
            if (equal(favs, lastFavs)) {
               //Avoid Loop
               return;
            }

            lastFavs = favs;

            const packFav = [];

            favs.forEach(fav => {
               fav.persistFuzzy = false;
               fav.path = favManager.getPath().path;
               fav.addInHistory = true;
               packFav.push(fav);
            });

            context.setRules(packFav);
         };

         context.on('changePath', path => {
            if (!initiated) this.lazyInit();
            if (!initiated) return;
            if (path === favManager.getPath().path) {
               this.pushRules();
            }
         });

         context.on('avoidCache', path => {
            if (!initiated) return;
            if (context.getPath().path === favManager.getPath().path) {
               this.pushRules();
            }
         });

         this.lazyInit();
      },
      defineTypeExecutors() {
         return [
            {
               title: 'Add to Favorites',
               type: 'object',
               description: `ShortCut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'TOGGLE_FAVORITE')}`,
               id: 'package_internal_add_fav',
               icon: {
                  iconClass: 'w-icon-star-on small_ico',
               },
               enabled: obj => {
                  if (obj.fav_permit === false) return false;
                  if (obj.favorite === true) return false;
                  if (obj.path === favManager.getPath().path) return false;
                  return true;
               },
               exectFunc: obj => {
                  if (obj.fav_permit === false) return;
                  if (obj.favorite === true) return;
                  if (obj.path === favManager.getPath().path) return;
                  context.toggle(obj.rule);
               },
            },
            {
               title: 'Remove from Favorites',
               type: 'object',
               description: `ShortCut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'TOGGLE_FAVORITE')}`,
               id: 'package_internal_remove_fav',
               icon: {
                  iconClass: 'mdi-star-off small_ico',
               },
               enabled: obj => {
                  if (obj.path === favManager.getPath().path) return true;
                  if (obj.favorite === true) return true;
                  return false;
               },
               exectFunc: obj => {
                  context.toggle(obj.rule);
                  return false;
               },
            },
         ];
      },
   };
};
