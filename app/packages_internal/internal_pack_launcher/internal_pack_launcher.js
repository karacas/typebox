'use strict';

const { chain } = require('lodash');
const path = require('path');
const fs = require('fs');
const mkpath = require('@aux/aux_fs.js').mkpath;
const aux_driveManager = require('@render/aux_drive_manager.js');
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const sharedData = require('@render/shared_data.js');
const global_aux = require('@aux/aux_global.js');
const get = global_aux.get;
const equal = global_aux.equal;
const ms = require('ms');
const fileCacheLaunch = global_aux.normalicePath(
   `${Config.get('here_are_dragons.paths.caches')}/${Config.get('here_are_dragons.paths.launcherCachefile')}`,
   false
);

const { JSON_parse_async } = global_aux;

let lastWalkPathsResult = [];
let initiated = false;

const terminalName = Config.get('here_are_dragons.terminalName');

const ICON_FILE = {
   iconClass: 'mdi-file palette-Light-Blue-A100 text',
};

let config = {
   uniqByExec: true,
   remakeIdle: true,
   unique: true,
   suppressErrors: true,
   followSymbolicLinks: true,
   onlyFiles: true,
   remakeIdleTime: ms('2h'),
   waitToPutRules: 128,
   deep: 4,
   extensions: [],
   ignore: [
      '**/*nstal*',
      '**/*add to*',
      '**/*open*with*',
      '**/*help*',
      '**/*readme*',
      '**/*register*',
      '**/*{u,U}pdate*',
      '**/*{u,U}pgrade*',
      '**/*run.lnk',
      '**/*{s,S}etup*.exe',
      '**/*{s,S}etup.exe',
      '**/squirrel.exe',
      '**/typebox.exe',
      '**/typebox.lnk',
      '**/typebox_*.exe',
      '**/*Build Tools Command Prompt.lnk',
      '**/*release*info*',
      '**/*release*notes*',
      '**/*plug*in*',
      '**/typebox.app',
      '**/node_modules/**',
      '**/.git/**',
   ],
};

if (Config.isWin) {
   config.extensions = ['exe', 'lnk', 'cpl', 'msc', 'appref-ms'];
   config.followSymbolicLinks = false;
   config.paths = [
      '%APPDATA%/Microsoft/Windows/Start Menu/**/**/*',
      '%PROGRAMDATA%/Microsoft/Windows/Start Menu/**/**/*',
      '%USERPROFILE%/Desktop/*',
      '%USERPROFILE%/Links/*',
      '%USERPROFILE%/Test/*',
      '%APPDATA%/Microsoft/Internet Explorer/Quick Launch/User Pinned/TaskBar/*',
      '%PROGRAMDATA%/chocolatey/bin/**/*',
   ];
}

if (Config.isMac) {
   config.paths = ['/Applications'];
   config.ignore.push('/Applications/*/*/*/**');
   config.ignore.push('**/Contents/**');
   config.onlyFiles = false;
}

if (Config.isLinux) {
   config.extensions = ['desktop'];
   config.onlyFiles = false;
   config.paths = ['/usr/local/share', '/usr/share/applications', '/var/lib/snapd/desktop', '~/.local/share/applications'];
}

//KARACAS DEV
if (true && Config.isWin && (terminalName.includes('prystore') || terminalName.includes('der2'))) {
   config.paths.push('D:/tmp/**');
   config.paths.push('C:/Dropbox/portable/**');
   config.paths.push('C:/dropbox/Dropbox/portable/**');
}

function saveCache(jSon2cache) {
   if (!initiated) return;
   //KTODO: Cambiar  el here_are_dragons.launcherCache' por un setting local
   if (!Config.get('here_are_dragons.launcherCache') || !jSon2cache) {
      return;
   }

   //KTODO: DELAY SAVE
   if (!fs.existsSync(path.dirname(fileCacheLaunch))) mkpath.sync(path.dirname(fileCacheLaunch));
   fs.writeFile(fileCacheLaunch, JSON.stringify(jSon2cache), err => {
      if (err) {
         Logger.error('[Launcher] Fail saveLauncherCache:', err);
         return;
      }
      Logger.info('[Launcher] saveLauncherCache OK:');
   });
}

async function getSavedCache() {
   if (!initiated) return;
   return new Promise((resolve, reject) => {
      if (!Config.get('here_are_dragons.launcherCache') || !fs.existsSync(fileCacheLaunch)) {
         resolve(null);
         return;
      }
      fs.readFile(fileCacheLaunch, 'utf8', async (err, data) => {
         if (err) {
            resolve(null);
            return;
         }
         data = await JSON_parse_async(data);
         resolve(data);
      });
   });
}

function resetCache() {
   if (!initiated) return;
   lastWalkPathsResult = [];
   saveCache(null);
}

//KTODO: Hacer lo mismo para el package de PATHS
let file2rule = file => {
   if (!initiated) return;
   let ruleFile = {
      title: path.parse(file.path).name,
      searchField: path.parse(file.path).base.replace(/\.(exe|lnk|app|bat|com|dll)$/i, ''),
      description: path.normalize(file.path),
      icon: ICON_FILE,
      persistFuzzy: false,
      type: ['file', 'string'],
      initSort: -10,
      path: '/',
      _id: path.normalize(file.path),
      params: {
         drive_path: file.path,
         string: file.path,
      },
   };

   if (file.delayed) {
      ruleFile.icon = {
         type: 'iconSrc',
         delayed: true,
         dataDelayedFile: file.dataDelayedFile,
      };
   }

   if (!file.delayed && file.iconType == 'dataURL' && file.iconUrl) {
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

module.exports = context => {
   //KTODO: Avoid cache, parameter
   let makingGetLauncherRules = false;
   //KTODO: pasar a this. para no tener que usar "params"
   const getLauncherRules = (params, notif = false, resetcache = false) => {
      if (!initiated) return;
      if (resetcache) {
         resetCache();
      }

      if (makingGetLauncherRules) return;
      makingGetLauncherRules = true;

      let startLaunchTime = new Date();

      params.config.pathsRep = params.config.paths.map(global_aux.pathsReplaceEnvVar);

      let walkThisPaths = params.config.pathsRep;

      //KTODO: Que las opciones estén directas en el config
      //OSEA esponer el config de globby directo en el config
      let walkOptions = {
         ignore: params.config.ignore,
         onlyFiles: params.config.onlyFiles,
         unique: params.config.unique,
         suppressErrors: params.config.suppressErrors,
         deep: params.config.deep,
         extensions: params.config.extensions,
         followSymbolicLinks: params.config.followSymbolicLinks,
         throwErrorOnBrokenSymbolicLink: false,
      };

      Logger.log('[Launcher] --> START Walk', { walkThisPaths, config: params.config, walkOptions });

      aux_driveManager
         .walkPaths(walkThisPaths, walkOptions)
         .then(async $resp => {
            Logger.log('[Launcher] --> Walk END, parcial-time:', new Date() - startLaunchTime);

            const $respWait = await global_aux.filterPromise($resp, async item => {
               return await aux_driveManager.checkIsExec(item);
            });

            const resp = $respWait.sort();

            //CHECK IS DIFFERENT FROM CACHE (lastWalkPathsResult)
            if (lastWalkPathsResult && lastWalkPathsResult.length && equal(resp, lastWalkPathsResult)) {
               if (notif) sharedData.toaster.notify('Refresh launcher rules done.');

               Logger.info('[Launcher] rules are the same that last cache:', lastWalkPathsResult.length, '/ Total-time:', new Date() - startLaunchTime);

               makingGetLauncherRules = false;
               return;
            }

            lastWalkPathsResult = resp;

            //WALKPATHS 2 RULES
            aux_driveManager
               .getMutipleFiles(resp, false) /* ID:X13 : <- un parametro que le diga si usar cache o no*/
               .then(execs => {
                  Logger.log('[Launcher] --> get files info:', new Date() - startLaunchTime, '/ rules added:', execs.length);

                  if (params.config.uniqByExec) {
                     execs = chain(execs)
                        .orderBy(['lnkSource'], ['asc'])
                        .uniqBy('realSource')
                        .value();
                  }

                  execs = execs.map(file2rule);
                  saveCache(execs);

                  context.setRules(execs);
                  execs.length = 0;

                  //KTODO: 2LangModule
                  if (notif) sharedData.toaster.notify('Refresh launcher rules done.');
                  Logger.info('[Launcher] --> DONE / Total-time:', new Date() - startLaunchTime, '/ rules added:', execs.length);
                  makingGetLauncherRules = false;
               })
               .catch(e => {
                  makingGetLauncherRules = false;
                  Logger.warn('[Launcher] rules add fail:', e);
               });
         })
         .catch(e => {
            makingGetLauncherRules = false;
            Logger.warn('[Launcher] rules add fail:', e);
         });
   };

   //KTODO: Pasar el config a user.settings
   return {
      config: config,
      init() {
         if (initiated) return;
         initiated = true;
         //ONCE viewIsReady
         let viewIsReadyOnce = false;
         context.on('viewIsReady', () => {
            setTimeout(() => {
               if (viewIsReadyOnce) return;
               viewIsReadyOnce = true;
               this.initDelay();
            }, this.config.waitToPutRules);
         });
      },
      initDelay() {
         Logger.info('[Launcher] Start');

         //ADD REFRESH TO MENU
         context.addPermanentRules([
            {
               title: 'Refresh Launcher Catalog',
               path: 'internal_pack_aux_dev',
               description: 'Command: rc!',
               type: ['internal_launcher', 'null'],
               icon: {
                  iconClass: 'mdi-chevron-right text',
               },
               params: {
                  action: 'refreshLauncherCatalog',
               },
            },
            {
               title: 'Refresh Launcher Catalog',
               path: 'internal_pack_options',
               description: 'Command: rc!',
               type: ['internal_launcher', 'null'],
               icon: {
                  iconClass: 'mdi-cached text',
               },
               params: {
                  action: 'refreshLauncherCatalog',
               },
            },
         ]);

         //REFRESH COMMAND
         context.on('changeQuery', txt => {
            if (txt === 'rc!' || txt === 'refreshCatalog!') {
               context.setQuery('');
               getLauncherRules(this, true, true);
            }
         });

         //GET RULES
         getSavedCache().then(data => {
            if (data && data.length) {
               setTimeout(() => {
                  Logger.info('[Launcher] getLauncherRules from cache OK', data.length);
                  context.setRules(data);
               }, 1);
            } else {
               setTimeout(() => {
                  Logger.info('[Launcher] getLauncherRules on start');
                  getLauncherRules(this);
               }, 1);
            }

            if (this.config.remakeIdle) {
               sharedData.idleTime.onIdleTimeInterval(() => {
                  Logger.info('[Launcher] getLauncherRules on idle');
                  getLauncherRules(this);
               }, this.config.remakeIdleTime);
            }
         });
      },
      defineTypeExecutors() {
         return [
            {
               title: 'internal_launcher',
               type: 'internal_launcher',
               enabled: obj => {
                  return false;
               },
               exectFunc: obj => {
                  let action = get(obj.rule, 'params.action');
                  if (action === 'refreshLauncherCatalog') {
                     getLauncherRules(this, true, true);
                  }
               },
            },
         ];
      },
   };
};
