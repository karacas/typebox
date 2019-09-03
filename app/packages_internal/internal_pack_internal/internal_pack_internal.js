'use strict';

const isUrl = require('is-url');
const fs = require('fs');
const sharedData = require('@render/shared_data.js');
const Config = require('@render/config.js');
const { bindKet2actualOs, getKeyFromConfig, get, has } = require('@aux/aux_global.js');
const Logger = require('@render/logger.js');
const aux_webManager = require('@render/aux_web_manager.js');
const aux_viewer = require('@render/aux_viewer.js');
const resetScore = require('@render/history_manager.js').remove;
const { str2notevil } = require('@render/aux_executor.js');
const PATH = require('path');
const ListViewStore = require('@render/list_view_store.js');
const Executor = require('@render/executor.js');

module.exports = context => {
   let driveManager;

   return {
      init() {
         this.driveManager = context.getDriveManager();

         context.on('quit', txt => {
            context.logger.info('App QUIT OK [event]', txt);
         });

         this.copyObjToClipboard = obj => {
            context.copyToClipboard(JSON.stringify(obj, null, 2));
         };

         this.copyObjToClipboardEnabled = () => {
            return Config.isDev || Config.userkaracas || Config.get('here_are_dragons.enable_copy_item_to_clipboard');
         };

         context.keyboard_bind('alt+c', (e, b) => {
            let lastRule = context.getLastRuleSelected();
            if (!lastRule) return;
            context.copyToClipboard(JSON.stringify(lastRule, null, 2), false);
            if (e && e.preventDefault) e.preventDefault();
         });
      },
      defineTypeExecutors() {
         return [
            {
               title: 'Place Text',
               type: 'string',
               id: 'internal_pack_place_string',
               description: `Shortcut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'ENTER')}`,
               icon: {
                  iconClass: 'mdi-pencil-box small_ico',
               },
               enabled: rule => {
                  return true;
               },
               exectFunc: (obj, rule) => {
                  const permitClose = get(obj, 'event.type') === 'expander' ? false : undefined;
                  context.writeString(context.getStringOfRule(obj), undefined, permitClose, permitClose);
               },
            },
            {
               title: 'Copy to clipboard',
               type: 'string',
               description: `Shortcut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'COPY_STRING')}`,
               id: 'internal_pack_copy_text',
               icon: {
                  iconClass: 'mdi-paperclip small_ico',
               },
               enabled: rule => {
                  return true;
               },
               exectFunc: (obj, rule) => {
                  context.copyToClipboard(context.getStringOfRule(obj), !(obj.event && obj.event.shiftKey), true, true, obj.event);
               },
            },
            {
               title: 'Open in browser',
               id: 'internal_pack_open_in_browser_url',
               icon: {
                  iconClass: 'mdi-web small_ico',
               },
               type: 'url',
               enabled: rule => {
                  const url = get(rule, 'params.openUrl');
                  return url && isUrl(url);
               },
               exectFunc: (obj, rule) => {
                  const url = get(rule, 'params.openUrl');
                  const hasUrl = url && isUrl(url);
                  if (hasUrl) {
                     aux_webManager.openUrl(obj, rule);
                     return false;
                  }
                  return true;
               },
            },
            {
               title: 'Open in browser',
               id: 'internal_pack_open_in_browser_url',
               icon: {
                  iconClass: 'mdi-web small_ico',
               },
               type: 'object',
               enabled: rule => {
                  const url = get(rule, 'params.openUrl');
                  return url && isUrl(url);
               },
               exectFunc: (obj, rule) => {
                  const url = get(rule, 'params.openUrl');
                  const hasUrl = url && isUrl(url);
                  if (hasUrl) {
                     aux_webManager.openUrl(obj, rule);
                     return false;
                  }
                  return true;
               },
            },
            {
               //KTODO: Agregar hotKey Ctrl+Alt+O ?
               title: 'Edit this file item',
               type: 'rule_from_filepack',
               id: 'internal_rule_from_filepacke',
               icon: {
                  iconClass: 'mdi-xml small_ico',
               },
               enabled: rule => {
                  return fs.existsSync(get(rule, 'params._rff_fileOriginNorm'));
               },
               exectFunc: (obj, rule) => {
                  let ruleFile = get(obj, 'rule.params._rff_fileOriginNorm');
                  if (ruleFile) {
                     this.driveManager.openFile(ruleFile);
                  } else {
                     Logger.warn('No _rff_fileOrigin', obj);
                  }
               },
            },
            {
               title: 'Place JS Command',
               id: 'internal_rule_node_command',
               type: 'jscommand',
               icon: {
                  iconClass: 'mdi-pencil-box small_ico',
               },
               exectFunc: async obj => {
                  const param = get(obj, 'event.detail.paramRegex');
                  const permitClose = get(obj, 'event.type') === 'expander' ? false : undefined;
                  const str = await str2notevil(obj.rule, context.getStringOfRule(obj), param);
                  context.writeString(str, undefined, permitClose, permitClose);
               },
            },
            {
               title: 'Copy JS Command to clipboard',
               type: 'jscommand',
               description: `Shortcut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'COPY_STRING')}`,
               id: 'jscommand_clipboard',
               icon: {
                  iconClass: 'mdi-paperclip small_ico',
               },
               exectFunc: async (obj, rule) => {
                  const param = get(obj, 'event.detail.paramRegex');
                  const str = await str2notevil(obj.rule, context.getStringOfRule(obj), param);
                  context.copyToClipboard(str, !(obj.event && obj.event.shiftKey), true, true, obj.event);
               },
            },
            {
               title: 'Copy item rule to clipboard [dev] [alt+c]',
               type: 'object',
               id: 'internal_pack_copy_rule',
               icon: {
                  iconClass: 'mdi-clipboard small_ico',
               },
               enabled: rule => {
                  return this.copyObjToClipboardEnabled();
               },
               exectFunc: (obj, rule) => {
                  this.copyObjToClipboard(rule);
               },
            },
            {
               title: 'Reset New',
               type: 'object',
               id: 'reset_new',
               icon: {
                  type: 'iconFont',
                  iconClass: 'mdi-restore',
               },
               enabled: rule => {
                  return rule.isNew;
               },
               exectFunc: async (obj, rule) => {
                  const newsManager = require('@render/news_manager.js');
                  newsManager.resetItemById(rule);
               },
            },
            {
               title: 'Reset News in this path',
               type: 'object',
               id: 'reset_news_in_path',
               icon: {
                  type: 'iconFont',
                  iconClass: 'mdi-restore',
               },
               enabled: rule => {
                  return get(rule, 'params.changePath.checkNews');
               },
               exectFunc: async (obj, rule) => {
                  const newsManager = require('@render/news_manager.js');
                  const changePath = get(rule, 'params.changePath');
                  newsManager.resetnews(changePath);
               },
            },
            {
               title: 'Score up',
               type: 'object',
               description: `Shortcut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'SCORE_UP')}`,
               id: 'up_score',
               icon: {
                  type: 'iconFont',
                  iconClass: 'ion-ios-arrow-up',
               },
               enabled: rule => {
                  return Config.get('advancedContextuals') && has(rule, '_points');
               },
               exectFunc: async (obj, rule) => {
                  Executor.executeRule(rule, '', null, event, false);
                  ListViewStore.storeActions.updateFilterlist();
               },
            },
            {
               title: 'Reset Score',
               type: 'object',
               description: `Shortcut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'RESET_SCORE')}`,
               id: 'reset_score',
               icon: {
                  type: 'iconFont',
                  iconClass: 'ion-ios-arrow-down',
               },
               enabled: rule => {
                  return Config.get('advancedContextuals') && get(rule, '_points');
               },
               exectFunc: async (obj, rule) => {
                  resetScore(rule.id);
                  ListViewStore.storeActions.updateFilterlist();
               },
            },
         ];
      },
      defineTypeViewers() {
         const viewerComp = context.createViewerHtml({}, (resolve, reject, rule) => {
            resolve({ component: context.createComponentFromHtml(aux_viewer.getHtmlCodeDataFromRule(rule)) });
         });
         return [
            {
               type: 'string',
               title: 'String Viewer',
               enabled: obj => {
                  return (
                     get(obj, 'params.snippet') ||
                     get(obj, 'params.plain_code') ||
                     (obj.type[0] === 'string' && get(obj, 'params.string') && get(obj, 'params.string') !== obj.title)
                  );
               },
               viewerComp: viewerComp,
            },
            {
               type: 'snippet',
               title: 'snippet Viewer',
               viewerComp: viewerComp,
            },
            {
               type: 'plain_code',
               title: 'code Viewer',
               viewerComp: viewerComp,
            },
         ];
      },
   };
};
