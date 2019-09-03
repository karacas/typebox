'use strict';

const fs = require('fs');
const sharedData = require('@render/shared_data.js');
const Config = require('@render/config.js');
const { getKeyFromConfig, get } = require('@aux/aux_global.js');
const Logger = require('@render/logger.js');
const aux_webManager = require('@render/aux_web_manager.js');
const aux_viewer = require('@render/aux_viewer.js');
const { promisify } = require('util');

const path = require('path');

module.exports = context => {
   return {
      config: {
         maxTxtFileSize: 100 * 1024,
         minTxtFileSize: 10,
         disableExtensions: [],
         userExtensions: [],
         viewer: true,
      },
      viewer: false,
      init() {
         this.viewer = this.config.viewer;

         if (this.config.viewer === 'auto') {
            this.viewer = false;

            const onKey = event => {
               let lastRule = context.getLastRuleSelected();
               let isTab = event && event.code === 'Tab';
               let isFile = context.get(lastRule, 'params.drive_path');
               if (isTab && isFile) {
                  if (event && event.preventDefault) event.preventDefault();
                  this.viewer = !this.viewer;
                  if (context.forceRefreshRules) context.forceRefreshRules();
               }
            };

            if (document && document.addEventListener) document.addEventListener('keydown', onKey);
         }
      },
      defineTypeViewers() {
         if (!this.config.viewer) return;

         const disableExtensions = this.config.disableExtensions || [];
         const userExtensions = this.config.userExtensions || [];

         const getRuleExtension = rule => {
            const drive_path = context.get(rule, 'params.drive_path');
            if (!drive_path) return null;
            let drive_path_ext = path.extname(drive_path);
            drive_path_ext = drive_path_ext.length > 0 ? drive_path_ext.substr(1) : drive_path_ext;
            return drive_path_ext;
         };

         const isValidTxt = rule => {
            const drive_path = context.get(rule, 'params.drive_path');
            if (!drive_path === null) return null;

            const drive_path_ext = getRuleExtension(rule);
            const textextensions = context.require('textextensions');
            const isText =
               drive_path &&
               !disableExtensions.includes(drive_path_ext) &&
               (drive_path_ext === '' || textextensions.includes(drive_path_ext) || userExtensions.includes(drive_path_ext));
            if (!isText) return false;

            let stats = null;
            try {
               stats = fs.statSync(drive_path);
            } catch (e) {
               Logger.warn(e);
            }
            if (!stats) return false;

            let fileSizeInBytes = stats['size'];
            let big = fileSizeInBytes > this.config.maxTxtFileSize;
            let small = fileSizeInBytes < this.config.minTxtFileSize;
            if (big || small) return false;

            return true;
         };

         const viewerTxtComp = context.createViewerHtml({}, async (resolve, reject, rule) => {
            const fileName = context.get(rule, 'params.drive_path');
            const data = await promisify(fs.readFile)(fileName, 'utf8');
            const drive_path_ext = getRuleExtension(rule);
            const isCode = drive_path_ext !== 'txt' && drive_path_ext !== '' && drive_path_ext !== 'doc';
            resolve({ component: context.createComponentFromHtml(aux_viewer.string2HtmlCode(data, isCode)) });
         });

         return [
            {
               type: 'file',
               title: 'File String Viewer',
               enabled: rule => {
                  return this.viewer && isValidTxt(rule);
               },
               viewerComp: viewerTxtComp,
            },
         ];
      },
   };
};
