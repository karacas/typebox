'use strict';
const { startsWith } = require('lodash');
const path = require('path');
const fs = require('fs');
const favManager = require('@render/fav_manager.js');
const lastRulesManager = require('@render/last_rules_manager.js');
const Config = require('@render/config.js');
const { bindKet2actualOs, getKeyFromConfig, get, normalicePath, equal } = require('@aux/aux_global.js');
const $pause = time => new Promise(res => setTimeout(res, time || 1));
let lastFavs = [];
let lastRules = [];
let fixedOptions = Number(Config.get('fixedTypeBoxOptions'));

module.exports = context => {
   const TBDR_PATH = 'typebox-path';
   const TBDR_ROOT = '/__typebox_root';

   let iconFolder = {
      type: 'iconFont',
      iconClass: 'mdi-folder accentColor2 text',
   };
   let iconFolderBack = {
      type: 'iconFont',
      iconClass: 'mdi-folder-upload accentColor2 text',
   };
   let iconFile = {
      type: 'iconFont',
      iconClass: 'mdi-file small_ico text',
   };
   let iconArchive = {
      type: 'iconFont',
      // iconClass: 'octicon-file-submodule accentColor2 text',
      iconClass: 'octicon-file-symlink-directory accentColor2 text',
   };

   let pathFav = favManager.getFolderFavsPath();
   let pathLast = lastRulesManager.getFolderLastsPath();

   //KTODO: Hacer un replace de "typebox-path"

   return {
      config: {
         startOnSlash: true,
         goToStrPath: true,
         showHiddenFiles: false,
      },
      init() {
         this.driveManager = context.getDriveManager();

         context.addPermanentRules([
            {
               title: 'Favorite folders',
               path: TBDR_PATH + TBDR_ROOT,
               icon: favManager.getIcon(),
               description: `Shortcut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'FOLDER_FAVS')}`,
               specialScoreMult: 0,
               initSort: -1,
               params: {
                  changePath: pathFav,
               },
               type: ['null'],
            },
            {
               title: 'Last folders',
               path: TBDR_PATH + TBDR_ROOT,
               icon: lastRulesManager.getIcon(),
               specialScoreMult: 0,
               initSort: -2,
               params: {
                  changePath: pathLast,
               },
               type: ['null'],
            },
            {
               title: 'Typebox File Manager',
               description: 'Shortcut: /',
               initSort: 4,
               posFixed: fixedOptions * 4,
               path: '/',
               icon: {
                  type: 'iconFont',
                  // iconClass: 'octicon-file-submodule accentColor2 text',
                  iconClass: 'octicon-file-symlink-directory accentColor2 text',
               },
               type: ['null'],
               params: {
                  changePath: {
                     path: TBDR_PATH + TBDR_ROOT,
                     icon: iconArchive,
                     name: ' ',
                  },
               },
            },
         ]);

         this.returnPathsFromItem = item => {
            let pathItem = get(item, 'rule.params.drive_path') || item;

            if ((get(item, 'rule.type') || []).includes('pathBack')) {
               pathItem = path.join(pathItem, '../');
            }

            if (!pathItem || !this.driveManager._isPath(pathItem)) return;

            context.setPath({
               path: TBDR_PATH + pathItem,
               icon: iconArchive,
               name: pathItem.replace(/\\/g, '/'),
            });
         };

         this.files2rules = (file, pathRoute) => {
            if (!file) {
               return null;
            }

            if (file.isHidden && !showHiddenFiles && currentPath !== '/') {
               return null;
            }

            let ruleFile = {
               _id: `${String(normalicePath(file.path), false)}_${file.isDir ? 'DIR' : 'FILE'}`,
               _internal_id: `path__${file.path}_${file.isDir ? 'DIR' : 'FILE'}`,
               persistFuzzy: false,
               path: pathRoute,
               description: file.path,
               params: {
                  isDir: file.isDir,
                  isMacAppDir: file.isMacAppDir,
                  isHidden: file.isHidden,
                  drive_path: file.path,
                  string: file.path,
               },
            };

            //KTODO: Remmplazar nobre de [root/desktop/userhome/etc]
            if (file.isDir) {
               ruleFile.title =
                  String(file.path)
                     .split(path.sep)
                     .slice(-1)[0] || file.path;
               ruleFile.searchField = ruleFile.title;
               ruleFile.icon = iconFolder;
               ruleFile.type = ['path', 'string'];
            }

            if (file.isFile) {
               ruleFile.title = path.parse(file.path).base;
               ruleFile.searchField = path.parse(file.path).base;
               ruleFile.icon = iconFile;
               ruleFile.type = ['file', 'string'];
            }

            if (file.delayed) {
               if (file.isFile || file.isMacAppDir) {
                  ruleFile.icon = {
                     type: 'iconSrc',
                     delayed: true,
                     dataDelayedFile: file.dataDelayedFile,
                  };
               }
            }

            if (!file.delayed && file.iconType === 'dataURL' && file.iconUrl) {
               ruleFile.icon = {
                  type: 'iconSrc',
                  iconData: file.iconUrl,
               };
            }
            if (!file.delayed && file.iconType == 'iconFont' && file.iconClass) {
               ruleFile.icon = {
                  type: 'iconFont',
                  iconClass: file.iconClass,
               };
            }

            return ruleFile;
         };

         //Print Path rules
         this.returnPaths = async (currentPath, $showHiddenFiles, parallel = true) => {
            if (!this.driveManager) return;

            const showHiddenFiles = $showHiddenFiles === !!$showHiddenFiles ? $showHiddenFiles : this.config.showHiddenFiles;

            let pathRoute = TBDR_PATH + currentPath;
            context.putLoader(pathRoute);

            let filesInPath = await this.driveManager.getPathRules(currentPath, parallel);
            let $rules = [];

            // if (parallel){
            //    await $pause(4);
            //    $rules = filesInPath.map(file => this.files2rules(file, pathRoute))
            // }else{
            //    for (const file of filesInPath) {
            //       $rules.push(this.files2rules(file, pathRoute));
            //    }
            // }

            for (const file of filesInPath) {
               $rules.push(this.files2rules(file, pathRoute));
            }

            if (currentPath !== TBDR_ROOT) {
               let pathBackBack = path.join(currentPath);
               let pathBack = path.join(currentPath, '../');

               let ruleBack = {
                  title: '[ .. ]',
                  persistFuzzy: false,
                  path: pathRoute,
                  description: pathBack,
                  searchField: ' ',
                  addInHistory: false,
                  fav_permit: false,
                  hidden_permit: false,
                  initSort: 15,
                  posFixed: 15,
                  type: ['pathBack', 'path'],
                  icon: iconFolderBack,
                  params: {
                     isDir: true,
                     isHidden: false,
                     drive_path: pathBackBack,
                     string: pathBack,
                  },
               };

               if (!pathBack || !this.driveManager.fileExists(pathBack) || pathBack == currentPath) {
                  ruleBack.type = ['null'];
                  ruleBack.description = 'Root - Shortcut: / ';
                  ruleBack.params = {
                     changePath: {
                        path: TBDR_PATH + TBDR_ROOT,
                        name: ' ',
                     },
                  };
               }

               $rules.push(ruleBack);
            }

            context.setRules($rules);

            await $pause(32);
            $rules.length = 0;
         };

         this.pushFavRules = () => {
            let favs = favManager.getFavItems();
            if (equal(favs, lastFavs)) {
               //Avoid Loop
               return;
            }

            lastFavs = favs;
            let packFav = [];

            favs.forEach(fav => {
               fav.path = pathFav.path;
               fav.addInHistory = false;
               fav.fav_permit = true;
               if (fav.type.includes('path')) {
                  packFav.push(fav);
               }
            });
            context.setRules(packFav);
         };

         this.pushLastRules = () => {
            let lasts = lastRulesManager.getlastItems(false);
            if (equal(lasts, lastRules)) {
               //Avoid Loop
               return;
            }
            lastRules = lasts;
            let packlast = [];
            lasts.forEach(last => {
               last.persistFuzzy = false;
               last.path = pathLast.path;
               last.addInHistory = false;
               if (last.type.includes('path')) {
                  packlast.push(last);
               }
            });
            context.setRules(packlast);
         };

         context.on('changePath', path => {
            if (startsWith(path, TBDR_PATH)) {
               this.returnPaths(path.replace(TBDR_PATH, ''));
            }

            if (path === pathFav.path) {
               this.pushFavRules();
            } else {
               lastFavs = [];
            }

            if (path === pathLast.path) {
               this.pushLastRules();
            } else {
               lastRules = [];
            }
         });

         context.on('avoidCache', path => {
            if (context.getPath().path === pathFav.path) {
               this.pushFavRules();
            }
            if (context.getPath().path === pathLast.path) {
               this.pushLastRules();
            }
         });

         //On "/" key
         if (this.config.startOnSlash || this.config.goToStrPath) {
            context.on('changeQuery', txt => {
               const thisPath = context.getPath().path;

               if (this.config.startOnSlash && context.getPath().path === '/' && txt === '/') {
                  context.setPath({
                     path: TBDR_PATH + TBDR_ROOT,
                     icon: iconArchive,
                     name: ' ',
                  });
                  return;
               }

               if (
                  this.config.goToStrPath &&
                  txt.length > 2 &&
                  (thisPath === '/' || thisPath.indexOf('typebox-path') === 0) &&
                  this.driveManager._isPath(txt) &&
                  txt !== '/'
               ) {
                  const basePath = path.parse(txt).dir;
                  const file = path.parse(txt).base;
                  this.returnPathsFromItem(basePath);
                  setTimeout(() => {
                     context.setQuery(file);
                  }, 0);
                  return;
               }
            });
         }
      },
      defineTypeExecutors() {
         return [
            {
               title: 'Explore Path',
               id: 'fspaths_explorepath',
               type: 'path',
               icon: {
                  iconClass: 'feather-disc small_ico text',
               },
               exectFunc: this.returnPathsFromItem,
            },
            {
               title: 'Navigate Path',
               id: 'fspaths_navigatepath',
               type: 'path',
               icon: {
                  iconClass: 'mdi-window-maximize  small_ico text',
               },
               exectFunc: this.driveManager.openFile,
            },
            {
               title: 'Open Path in Terminal',
               id: 'fspaths_opentermpath',
               description: `Shortcut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'OPEN_IN_TERMINAL')}`,
               type: 'path',
               icon: {
                  iconClass: 'mdi-console  small_ico text',
               },
               exectFunc: this.driveManager.openTerminal,
            },
            {
               title: 'Open File',
               id: 'fspaths_openfile',
               type: 'file',
               icon: {
                  iconClass: 'mdi-play-circle-outline  small_ico text',
               },
               exectFunc: obj => {
                  this.driveManager.openFile(obj);
               },
            },
            {
               title: 'Execute command',
               id: 'fspaths_exeCmnd',
               type: 'command',
               icon: {
                  iconClass: 'mdi-play-circle-outline  small_ico text',
               },
               exectFunc: obj => {
                  this.driveManager.execCommand(obj);
               },
            },
            {
               title: 'Open File Path in Terminal',
               id: 'fspaths_file_opentermpath',
               description: `Shortcut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'OPEN_IN_TERMINAL')}`,
               type: 'file',
               icon: {
                  iconClass: 'mdi-console  small_ico text',
               },
               exectFunc: this.driveManager.openTerminal,
            },
            {
               title: 'Navigate File Path Container',
               id: 'fspaths_opentermpath',
               type: 'file',
               icon: {
                  iconClass: 'mdi-window-maximize  small_ico text',
               },
               exectFunc: obj => {
                  let objPath = path.parse(obj.rule.params.drive_path).dir;
                  this.driveManager.openFile(objPath);
               },
            },
         ];
      },
   };
};
