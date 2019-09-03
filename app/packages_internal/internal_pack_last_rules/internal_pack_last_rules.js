'use strict';

let relativeTime = null;
let dayjs = null;
const lastRulesManager = require('@render/last_rules_manager.js');
const Config = require('@render/config.js');
const { bindKet2actualOs, getKeyFromConfig, equal } = require('@aux/aux_global.js');
const sharedData = require('@render/shared_data.js');
const getTime = sharedData.realClock.getTime;
let lastRules = [];
let initiated = false;

module.exports = context => {
   return {
      lazyInit() {
         if (initiated) return;
         if (!lastRulesManager || !lastRulesManager.getAllLastItems || !lastRulesManager.getAllLastItems().length) return;
         let fixedOptions = Number(Config.get('fixedTypeBoxOptions'));

         //Add main rule
         context.addPermanentRules([
            {
               title: 'History',
               type: ['History', 'null'],
               description: `Shortcut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'HISTORY')}`,
               icon: lastRulesManager.getIcon(),
               fav_permit: false,
               new_permit: false,
               initSort: 8,
               posFixed: fixedOptions * 8,
               params: {
                  changePath: lastRulesManager.getPath(),
               },
            },
         ]);

         initiated = true;
      },

      init() {
         relativeTime = relativeTime || require('dayjs/plugin/relativeTime');
         dayjs = dayjs || require('dayjs');
         dayjs.extend(relativeTime);

         this.pushRules = () => {
            let lasts = lastRulesManager.getlastItems();
            if (equal(lasts, lastRules)) {
               //Avoid Loop
               return;
            }
            lastRules = lasts;

            context.setRules(
               lasts.map(last => {
                  last.persistFuzzy = false;
                  last.path = lastRulesManager.getPath().path;
                  last.description = `[${dayjs(getTime())
                     .add(0.5, 'm')
                     .to(last.params.lastDate)}] ${last.params._note_original_description || last.params.original_description || ''}`;
                  last.addInHistory = false;
                  return last;
               })
            );
         };

         context.on('changePath', path => {
            if (!initiated) this.lazyInit();
            if (!initiated) return;
            if (path === lastRulesManager.getPath().path) {
               this.pushRules();
            }
         });

         context.on('avoidCache', path => {
            if (!initiated) return;
            if (context.getPath().path === lastRulesManager.getPath().path) {
               this.pushRules();
            }
         });

         this.lazyInit();
      },
      defineTypeExecutors() {
         return [
            {
               title: 'Remove from History',
               type: 'object',
               id: 'package_internal_remove_last',
               icon: {
                  iconClass: 'mdi-restart small_ico',
               },
               enabled: obj => {
                  if (obj.path !== lastRulesManager.getPath().path) return false;
                  return true;
               },
               exectFunc: obj => {
                  obj.rule.last_permit = false;
                  lastRulesManager.remove(obj.rule);
               },
            },
         ];
      },
   };
};
