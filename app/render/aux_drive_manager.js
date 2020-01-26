'use strict';

const path = require('path');
const rimraf = require('rimraf');
const app = require('electron').remote.app;

// @ts-ignore
const mkpath = require('@aux/aux_fs.js').mkpath;
// @ts-ignore
const Logger = require('@render/logger.js');
// @ts-ignore
const Config = require('@render/config.js');
// @ts-ignore
const sharedData = require('@render/shared_data.js');
// @ts-ignore
const aux_webManager = require('@render/aux_web_manager.js');
// @ts-ignore
const global_aux = require('@aux/aux_global.js');
// @ts-ignore
const aux_fs = require('@aux/aux_fs.js');
// @ts-ignore
const { gotoRootOnExec } = require('@render/aux_executor.js');

const fileExtension = require('file-extension');
const isUrl = require('is-url');
const winshort = require('windows-shortcuts');
const sudo = require('sudo-prompt');
const get = global_aux.get;
const icons = Config.get('icons');
const Lrucache = require('lru-cache');
const isValidPath = require('is-valid-path');
const Queue = require('promise-queue');
const ms = require('ms');
const cache_get_file_info = new Lrucache({ max: 4096 * 2, maxAge: ms('5m') });
const cache_icon_exist = new Lrucache({ max: 4096, maxAge: ms('5m') });
const fileExists = aux_fs.fileExists;
const _isPath = aux_fs._isPath;
const { shell } = require('electron').remote;
const globby = require('globby');
const fs = require('fs');
const fsPlus = require('fs-plus');
const { promisify } = require('util');
const fs_statAsync = promisify(fs.stat);

const $pause = time => new Promise(res => setTimeout(res, time || 1));
let child_process = null;

const isString = val => typeof val === 'string';
const isElevated = Config.get('here_are_dragons.report.isElevated');
const NOICON = '__NOICON__';

let open = null;
let app2png = null;
let nativeImage = null;
let queueGetFsFileIcon = null;
let isexe = null;
let cache_getFsFileIconLnx = null;

async function getFileInfo($pathname, useCache = true) {
   return new Promise(async (resolve, reject) => {
      if (!$pathname) {
         resolve(null);
         return;
      }

      let pathnameHash = null;
      let pathstats = null;
      let pathname = normalicePath($pathname, true);

      try {
         pathstats = await fs_statAsync(pathname);
      } catch (e) {
         resolve(null);
         return;
      }

      if (!pathstats) {
         resolve(null);
         return;
      }

      if (useCache) {
         pathnameHash = pathname;
         let tmpcache = cache_get_file_info.get(pathnameHash);
         if (tmpcache) {
            resolve(tmpcache);
            return;
         }
      }

      let isFile = !pathstats.isDirectory();
      let isDir = !isFile;
      let isMacAppDir = Config.isMac && isDir && pathname.includes('.app');
      let isHidden =
         pathname
            .replace(/\\/g, '/')
            .split('/')
            .slice(-1)[0]
            .charAt(0) === '.';

      let data = {
         icon: null,
         iconType: 'null',
         path: pathname,
         lnkSource: null,
         realSource: pathname,
         isFile,
         isDir,
         isMacAppDir,
         isHidden,
      };

      //KTODO: Mover a una funcion aparte
      //KTODO: Que lo llame la función de ícono nada más
      if (Config.isWin && isFile && pathname.toLowerCase().endsWith('.lnk')) {
         try {
            let symLink = shell.readShortcutLink(pathname);
            if (symLink && symLink.target) {
               if (symLink.target.toLowerCase().endsWith('.lnk')) {
                  data = await getFileInfo(symLink.target, useCache);
               } else {
                  data.lnkSource = normalicePath(symLink.target);
                  data.realSource = data.lnkSource;
                  if (symLink.args && symLink.args.length) {
                     data.lnkSource += ` ${symLink.args}`;
                     data.realSource = data.lnkSource;
                  }
               }
            }
         } catch (e) {}

         if (!data.lnkSource || !data.realSource) {
            await new Promise((resolve, reject) => {
               winshort.query(pathname, ($error, $file) => {
                  if (!$error && $file.target && checkWinIsExecExt($file.target)) {
                     if (Config.isDev) Logger.log('[getFileInfo] alternative');
                     data._icon = $file.icon || $file.target || null;
                     data.lnkSource = normalicePath($file.target);
                     data.realSource = data.lnkSource;
                     if ($file.expanded && $file.expanded.args && $file.expanded.args.length) {
                        data.lnkSource += ` ${$file.expanded.args}`;
                        data.realSource = data.lnkSource;
                     }
                  }
                  resolve();
               });
            });
         }
      }

      if (isDir && !isMacAppDir) {
         if (useCache) cache_get_file_info.set(pathnameHash, data);
         resolve(data);
      } else {
         //KTODO: Que lo llame la función de ícono nada más
         auxGetFileIcon(data._icon || pathname, ico => {
            if (ico && ico.dataUrl && !ico.delayed) {
               data.iconType = 'dataURL';
               data.iconUrl = ico.dataUrl;
               data.delayed = false;
            }
            if (ico && ico.type && ico.iconClass && !ico.delayed) {
               data.iconType = ico.type;
               data.iconClass = ico.iconClass;
               data.delayed = false;
            }
            if (ico && ico.delayed) {
               data.iconUrl = null;
               data.delayed = true;
               data.iconType = 'dataURL';
               data.dataDelayedFile = ico.dataDelayedFile;
            }
            if (useCache) cache_get_file_info.set(pathnameHash, data);
            resolve(data);
         });
      }
   });
}

function auxGetFileIcon(file, resolve) {
   if (!file || typeof file !== 'string') {
      resolve();
      return false;
   }

   if (!icons) {
      resolve();
      return;
   }

   //KTODO: MOVER A UN AUXILIAR
   let ext = path.extname(file).toLowerCase();

   if (Config.isWin && ext === '') {
      resolve();
      return;
   }

   if (ext === '.dll' || ext === '.bin' || ext === '.nls' || ext === '.sys' || ext === '.tmp') {
      resolve();
      return;
   }

   if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.nef' || ext === '.gif' || ext === '.psd' || fsPlus.isImageExtension(ext)) {
      resolve({
         type: 'iconFont',
         iconClass: 'mdi-file-image  text',
      });
      return;
   }

   if (fsPlus.isPdfExtension(ext)) {
      resolve({
         type: 'iconFont',
         iconClass: 'mdi-file-pdf text ',
      });
      return;
   }

   if (ext === '.js' || ext === '.jsx') {
      resolve({
         type: 'iconFont',
         iconClass: 'mdi-language-javascript accentColor2 text ',
      });
      return;
   }

   if (ext === '.json' || ext === '.yaml' || ext === '.yam') {
      resolve({
         type: 'iconFont',
         iconClass: 'mdi-json text ',
      });
      return;
   }

   if (ext === '.css' || ext === '.sass' || ext === '.sty' || ext === '.styl' || ext === '.less') {
      resolve({
         type: 'iconFont',
         iconClass: 'mdi-language-css3 text ',
      });
      return;
   }

   if (ext === '.htm' || ext === '.html') {
      resolve({
         type: 'iconFont',
         iconClass: 'mdi-language-html5 text ',
      });
      return;
   }

   if (ext === '.zip' || ext === '.rar' || ext === '.7z' || fsPlus.isCompressedExtension(ext)) {
      resolve({
         type: 'iconFont',
         iconClass: 'mdi-zip-box text',
      });
      return;
   }

   if (fsPlus.isMarkdownExtension(ext)) {
      resolve({
         type: 'iconFont',
         iconClass: 'mdi-file-document text ',
      });
      return;
   }

   if (ext === '.txt' || ext === '.rtf' || fsPlus.isReadmePath(file)) {
      resolve({
         type: 'iconFont',
         iconClass: 'mdi-file-document text ',
      });
      return;
   }

   //MAC APP ICON
   if (Config.isMac && file.includes('.app')) {
      resolve({ type: 'iconSrc', delayed: true, dataDelayedFile: file });
      return;
   }

   if (Config.isWin) {
      resolve({ type: 'iconSrc', delayed: true, dataDelayedFile: file });
      return;
   }

   //LNX ICON
   if (Config.isLinux) {
      resolve({ type: 'iconSrc', delayed: true, dataDelayedFile: file });
      return;
   }

   resolve();
   return;
}

function fileapp2fileicon(file, ext) {
   if (!file || typeof file !== 'string' || file.indexOf(NOICON) !== -1) return normalicePath(`${Config.get('here_are_dragons.paths.caches_icons')}/${NOICON}`);
   file = normalicePath(file, true);
   let _file = `${file}v0.8`;
   let exp = ext || !Config.isLinux ? '.png' : '';
   return normalicePath(`${Config.get('here_are_dragons.paths.caches_icons')}/${global_aux.makeHash(_file)}${exp}`);
}

function tryGetFileAppCacheExist(file) {
   if (!file || typeof file !== 'string') return null;

   const tmp = cache_icon_exist.get(file);
   if (tmp) return tmp;

   if (Config.isLinux && fileExists(`${file}.svg`)) {
      cache_icon_exist.set(`${file}.svg`, true);
      return `${file}.svg`;
   }

   if (fileExists(file)) {
      cache_icon_exist.set(file, true);
      return file;
   }

   return null;
}

function tryGetFileAppCache(file) {
   if (!file || typeof file !== 'string') return false;
   return tryGetFileAppCacheExist(fileapp2fileicon(file));
}

function getFsFileIconWin(file) {
   queueGetFsFileIcon = queueGetFsFileIcon || new Queue(2, Infinity);
   return new Promise((resolve, reject) => {
      queueGetFsFileIcon.add(() => _getFsFileIconWin(file)).then(resolve);
   });
}

function getFsFileIconLnx(file) {
   queueGetFsFileIcon = queueGetFsFileIcon || new Queue(1, Infinity);
   return new Promise((resolve, reject) => {
      queueGetFsFileIcon.add(() => _getFsFileIconLnx(file)).then(resolve);
   });
}

function getFsFileIconMac(file) {
   queueGetFsFileIcon = queueGetFsFileIcon || new Queue(1, Infinity);
   return new Promise((resolve, reject) => {
      queueGetFsFileIcon.add(() => _getFsFileIconMac(file)).then(resolve);
   });
}

function _getFsFileIconWin(file) {
   const tmpIcon = fileapp2fileicon(file);

   return new Promise((resolve, reject) => {
      let _tryGetFileAppCacheExist = tryGetFileAppCacheExist(tmpIcon);

      Logger.log(tmpIcon);

      if (_tryGetFileAppCacheExist) {
         resolve(_tryGetFileAppCacheExist);
         return;
      }

      if (!fileExists(file, true)) {
         resolve(NOICON);
         return;
      }
      app.getFileIcon(getLinkIconPath(file), { size: 'large' })
         .then(res => {
            if (res && res.getSize && res.getSize().width) {
               if (!fileExists(path.dirname(tmpIcon), true)) mkpath.sync(path.dirname(tmpIcon));
               fs.writeFile(tmpIcon, res.toPNG(), function(err) {
                  if (err) {
                     Logger.warn('[getFsFileIcon]', file, tmpIcon, 'writeFile', err);
                     resolve(NOICON);
                     return;
                  }
                  resolve(tmpIcon);
               });
            }
         })
         .catch(err => {
            Logger.warn('[getFsFileIcon]', file, tmpIcon, 'noDataImg', err);
            resolve(NOICON);
         });
   });
}

function _getFsFileIconMac(file) {
   app2png = app2png || require('app2png');

   const tmpIcon = normalicePath(`${Config.get('here_are_dragons.paths.tmp')}/${path.basename(file).replace('.app', '.png')}`);
   const tmpIconCache = fileapp2fileicon(file);

   return new Promise((resolve, reject) => {
      let _tryGetFileAppCacheExist = tryGetFileAppCacheExist(tmpIconCache);
      if (_tryGetFileAppCacheExist) {
         resolve(_tryGetFileAppCacheExist);
         return;
      }

      if (!fileExists(file, true)) {
         resolve(NOICON);
         return;
      }

      const iconSize = { width: 64, height: 64 };

      app2png
         .convert(file, tmpIcon)
         .then(() => {
            nativeImage = nativeImage || require('electron').nativeImage;
            try {
               let dataImg = nativeImage.createFromPath(tmpIcon);
               if (dataImg.getSize().width && dataImg.getSize().width > iconSize.width) {
                  dataImg = dataImg.resize(iconSize);
               }

               if (!fileExists(path.dirname(tmpIconCache), true)) mkpath.sync(path.dirname(tmpIconCache));

               fs.writeFile(tmpIconCache, dataImg.toPNG(), function(err) {
                  if (err) {
                     Logger.warn('[getFsFileIconMac]', file, tmpIconCache, 'writeFile', err);
                     resolve(NOICON);
                     return;
                  }
                  resolve(tmpIconCache);
               });
            } catch (e) {
               Logger.warn('[getFsFileIconMac A]', e);
               resolve(NOICON);
            }
         })
         .catch(e => {
            Logger.warn('[getFsFileIconMac B]', e);
            resolve(NOICON);
         });
   });
}

//KTODO: Poner en config de internal_pack_launcher.js
const linux_list_icon_paths = ['/usr/share/icons/**/apps/**', '/usr/share/icons/**/devices/**'];
const linux_list_icon_paths_ignore = ['**/8x8/**', '**/16x16/**', '**/22x22/**', '**/24x24/**', '**/Adwaita/**', '**/symbolic/**'];
const linux_list_foder_themes = [
   '/gnome/scalable/',
   'gnome/256',
   'gnome/48',
   'elementary-xfce/apps/64',
   'Ultra-Flat/apps/scalable',
   '/scalable/',
   '/128',
   '/64',
   '.svg',
   '.png',
];

function _getFsFileIconLnx(file) {
   let __time1 = new Date();
   const tmpIcon = fileapp2fileicon(file);

   return new Promise(async (resolve, reject) => {
      let _tryGetFileAppCacheExist = tryGetFileAppCacheExist(tmpIcon);

      if (_tryGetFileAppCacheExist) {
         resolve(_tryGetFileAppCacheExist);
         return;
      }

      if (!fileExists(file, true)) {
         Logger.warn('[icon file not exists] \n', { file });
         resolve(NOICON);
         return;
      }

      let nameIcon = getIconLinuxName(file);

      if (!nameIcon) {
         Logger.warn('[icon nameIcon file not found] \n', { file, nameIcon });
         resolve(NOICON);
         return;
      }

      if (nameIcon.indexOf('.png') !== -1 && fileExists(nameIcon, true)) {
         let directIcon = await tryCreateCacheIconFileLinux(nameIcon, tmpIcon);
         if (directIcon) {
            resolve(directIcon);
            return;
         }
      }

      nameIcon = path.basename(nameIcon, path.extname(nameIcon));

      if (!cache_getFsFileIconLnx) {
         cache_getFsFileIconLnx = await globby(linux_list_icon_paths, {
            // extensions: ['png', 'svg'],
            onlyFiles: true,
            followSymbolicLinks: true,
            suppressErrors: true,
            throwErrorOnBrokenSymbolicLink: false,
            deep: 5,
            ignore: linux_list_icon_paths_ignore,
         });
      }

      const ico = cache_getFsFileIconLnx.filter(p => p.indexOf(nameIcon) !== -1);

      if (!ico || !ico.length) {
         if (true) Logger.warn('[icon ico not found] \n', { ico, nameIcon, cache_getFsFileIconLnx: cache_getFsFileIconLnx.length });
         resolve(NOICON);
         return;
      }

      let defIco = getLnxDesktop2icon(ico);
      let obj = await tryCreateCacheIconFileLinux(defIco, tmpIcon);

      resolve(obj || NOICON);
      return;
   });
}

function getLnxDesktop2icon(icos) {
   if (!icos || !icos.length) return null;

   let defIco = null;

   for (let i = 0; i < linux_list_foder_themes.length; i++) {
      if (!defIco) {
         defIco = icos.find(_ico => _ico.indexOf(linux_list_foder_themes[i]) !== -1);
      }
   }

   return defIco || null;
}

function tryCreateCacheIconFileLinux(defIco, tmpIcon) {
   return new Promise((resolve, reject) => {
      if (!fileExists(defIco, true)) {
         Logger.warn('[icon error] defIco not exist', defIco);
         resolve(NOICON);
         return;
      }

      if (defIco.toLowerCase().indexOf('.svg') !== -1) tmpIcon += '.svg';

      fsPlus.makeTreeSync(path.dirname(tmpIcon));

      fs.copyFile(defIco, tmpIcon, err => {
         if (err) {
            Logger.warn('[icon error copy] \n', err);
            resolve(NOICON);
            return;
         } else {
            resolve(tmpIcon);
            return;
         }
      });
   });
}

function getLinkIconPath(file) {
   if (!file || typeof file !== 'string') return null;
   if (!fileExists(file, true)) return null;

   let fileTmp = null;

   if (file.toLowerCase().endsWith('.lnk')) {
      try {
         fileTmp = shell.readShortcutLink(file).target;
      } catch (e) {}

      if (
         fileTmp &&
         String(fileTmp)
            .toLowerCase()
            .endsWith('.lnk')
      ) {
         const fileTmp2 = getLinkIconPath(fileTmp);
         if (fileTmp2) fileTmp = fileTmp2;
      }
      if (fileTmp) file = fileTmp;
   }

   return file || null;
}

function checkWinIsExecExt(file, checkWinLnk = false) {
   if (!file || typeof file !== 'string') return false;

   if (Config.isWin && file.toLowerCase().endsWith('.lnk')) {
      const _file = getLinkIconPath(file);
      if (_file === file) {
         //KTODO: link raro, no trae ícono #342352
         if (Config.isDev) Logger.log('_file === file', file);
         return false;
      }

      return checkWinIsExecExt(_file);
   }

   return (
      Config.isWin &&
      (file.toLowerCase().endsWith('.exe') ||
         file.toLowerCase().endsWith('.cpl') ||
         file.toLowerCase().endsWith('.msc') ||
         file.toLowerCase().endsWith('.appref-ms')) &&
      fileExists(file, true)
   );
}

function checkIsExecInternal(file, checkWinLnk = false) {
   file = normalicePath(file, true);

   if (!fileExists(file, true)) return false;

   //MAC
   if (Config.isMac) {
      return /\.(prefPane|app)$/.test(file);
   }

   //LINUX .desktop
   if (Config.isLinux) {
      //KTODO: Ver de agarrar los íconos de exec de lnx
      // en LNX ver: http://stackoverflow.com/questions/16258578/how-do-i-check-if-a-file-is-executable-in-node-js
      return /\.desktop$/.test(file);
   }

   if (Config.isWin) {
      return checkWinIsExecExt(file, checkWinLnk);
   }

   return false;
}

async function checkIsExecAlt(file) {
   if (!file || typeof file !== 'string') return false;

   file = normalicePath(file, true);

   if (!fileExists(file, true)) return false;

   isexe = isexe || require('isexe');
   return await new Promise((resolve, reject) => {
      isexe(file, function(err, isExe) {
         if (err) {
            resolve(false);
            return false;
         } else if (isExe) {
            resolve(true);
            return true;
         } else {
            resolve(false);
            return false;
         }
      });
   });
}

function getIconLinuxName(pathItem) {
   if (/\.desktop$/.test(pathItem)) {
      let content = fs.readFileSync(pathItem, 'utf-8');
      if (!content) return null;

      let icon = /^Icon\s?=\s?(.+)/gm.exec(content);
      if (!icon) return null;
      if (!icon[1]) return null;

      return icon[1];
   }
   return null;
}

function checkIsExecAltLinux(pathItem) {
   if (/\.desktop$/.test(pathItem)) {
      if (true) {
         try {
            //KTODO: PROBAR
            const pathstats = fs.statSync(pathItem);
            if (pathstats && pathstats.mode) {
               return !(pathstats.mode & 0b001001001);
            }
         } catch (e) {}
      }

      let content = fs.readFileSync(pathItem, 'utf-8');
      if (!content) return;

      let exec = /^Exec\s?=\s?(.+)/gm.exec(content);

      if (!exec) return;
      if (!exec[1]) return;

      let icon = /^Icon\s?=\s?(.+)/gm.exec(content);

      if (!icon) return;
      if (!icon[1]) return;

      return exec[1];
   }
}

async function checkIsExec(file) {
   if (!file || typeof file !== 'string') return false;

   file = normalicePath(file, true);

   if (!fileExists(file, true)) return false;

   //MAC-LNX
   if (Config.isMac) return checkIsExecInternal(file);
   if (Config.isLinux) return !!checkIsExecAltLinux(file);

   //WIN
   if (checkIsExecInternal(file, false)) return true;

   if (file.toLowerCase().endsWith('.lnk')) {
      try {
         let fileTmp = shell.readShortcutLink(file).target;
         if (!fileTmp || !fileExists(fileTmp, true)) {
            if (String(fs.readFileSync(file, 'utf16le')).includes('Windows.ShellExperienceHost')) {
               //KTODO: 342352 Nuevo tipo de app W10 / Ver íconos
               if (Config.isDev) console.warn('.lnk ShellExperienceHost', file, fileTmp);
               return true;
            }
            return false;
         }
         return checkWinIsExecExt(fileTmp);
      } catch (e) {
         return await new Promise((resolve, reject) => {
            winshort.query(file, ($error, $file) => resolve(!$error && $file && $file.target && checkWinIsExecExt($file.target)));
         });
      }
   }

   return false;
}

function getMutipleFilesParallel(arr) {
   return new Promise(async (resolve, reject) => {
      Promise.all(arr.map(f => getFileInfo(f, true)))
         .then(values => {
            resolve(values);
         })
         .catch(e => {
            Logger.warn('getMutipleFiles, error', e);
            resolve([]);
         });
   });
}

function getMutipleFilesSerial(arr) {
   let res = [];
   return new Promise(async (resolve, reject) => {
      for (const f of arr) res.push(await getFileInfo(f, true));
      resolve(res);
   });
}

const getMutipleFiles = (arr, par = true) => (par ? getMutipleFilesParallel(arr) : getMutipleFilesSerial(arr));

function existDriveWin(drive) {
   if (!drive) return false;
   if (fileExists(normalicePath(`${drive}:/`))) {
      return `${drive}:/`;
   }
   return false;
}

function pathToArray_OLD(pathname) {
   let arr = [];
   let _file = null;

   return new Promise((resolve, reject) => {
      if (!pathname || typeof pathname !== 'string' || !fileExists(pathname)) {
         Logger.warn('pathToArray: ', { pathname });
         resolve([]);
         return;
      }

      fs.readdir(pathname, (err, files) => {
         if (err) {
            Logger.error('pathToArray: ', err);
            // resolve([]);
            // return;
         }
         setTimeout(() => {
            if (files && files.length) {
               files.forEach(file => {
                  _file = normalicePath(`${pathname}/${file}`);
                  arr.push(_file);
               });
            }
            resolve(arr);
            return;
         }, 1);
      });
   });
}

function pathToArray(pathname) {
   return new Promise(async (resolve, reject) => {
      let _paths = await globby(`${normalicePath(pathname, false)}/*`, {
         deep: 0,
         onlyFiles: false,
         followSymbolicLinks: true,
         suppressErrors: true,
         throwErrorOnBrokenSymbolicLink: false,
      });
      _paths = (_paths || []).map(p => normalicePath(p, false));
      setTimeout(() => {
         resolve(_paths);
      }, 4);
   });
}

function getPathRules(pathname, parallel = true) {
   if (Config.isWin && pathname === '/__typebox_root') {
      let $drives = 'abcdefghijklmnopqrstuvwxyz'
         .toUpperCase()
         .split('')
         .filter(item => existDriveWin(item))
         .map(item => `${item}:/`);

      $drives = $drives || [];

      $drives.push(normalicePath(Config.get('here_are_dragons.paths.userHome')));
      $drives.push(normalicePath('%USERPROFILE%/Desktop', true));

      return getMutipleFiles($drives, parallel);
   }

   if (!Config.isWin && pathname === '/__typebox_root') {
      let $drivesNX = [normalicePath(Config.get('here_are_dragons.paths.userHome')), '/../'];
      return getMutipleFiles($drivesNX, parallel);
   }

   if (!Config.isWin && pathname === '/') {
      //KTODO: reemplazar el title de la rule con un if
      pathname = '/../';
   }

   return new Promise((resolve, reject) => {
      pathToArray(pathname)
         .then(arr => getMutipleFiles(arr, parallel))
         .then(data => {
            resolve(data);
         })
         .catch(e => {
            Logger.warn('getPathRules, error', e);
            resolve([]);
         });
   });
}

function openFile(item, forceSU = false, useOverride = true, goBack = true) {
   if (Config.get('here_are_dragons.disableOpenFile')) {
      Logger.info('[openFile disabled]');
      return;
   }

   if (Config.get('here_are_dragons.sudoOpenFile')) {
      forceSU = true;
   }

   if (!isElevated && forceSU) {
      Logger.warn('[forceSU is enabled !], here_are_dragons.sudoOpenFile');
   }

   let pathItem = get(item, 'rule.params.drive_path') || get(item, 'params.drive_path') || item;

   Logger.info('[OpenFile]', pathItem);

   if (!pathItem) return;

   //IF URL
   if (isUrl(pathItem)) {
      Logger.info('[OpenFile], isUrl:', pathItem);
      aux_webManager.openUrl(pathItem);
      return;
   }

   pathItem = normalicePath(pathItem, true);

   //IF NOT EXIST
   if (!fileExists(pathItem)) {
      sharedData.toaster.notify(`Error, file does not exist: ${pathItem}`);
      Logger.error('Error, file does not exist: ', pathItem);
      return;
   }

   //IS EXEC
   if (checkIsExecInternal(pathItem, true)) {
      Logger.info('[OpenFile], isExec:', pathItem);

      //ON LINUX
      if (Config.isLinux) {
         if (/\.desktop$/.test(pathItem)) {
            if (true) {
               try {
                  //KTODO: PROBAR
                  const pathstats = fs.statSync(pathItem);
                  if (pathstats && pathstats.mode) {
                     return !(pathstats.mode & 0b001001001);
                  }
               } catch (e) {}
            }

            let _exec = checkIsExecAltLinux(pathItem);
            if (!_exec) return;
            pathItem = _exec;
         }

         child_process = child_process || require('child_process');
         child_process.exec(pathItem.replace(/%./g, ''), (error, stdout) => {
            if (!error) {
               if (goBack) gotoRootOnExec(goBack);
            } else {
               sharedData.toaster.notify(`Error opening ${pathItem}`);
               Logger.warn(error, `Error opening ${pathItem}`);
            }
         });
         return;
      }

      //WIN-MAC
      if (shell.openItem(pathItem)) {
         if (goBack) gotoRootOnExec(goBack);
         return;
      }

      open = open || require('open');
      open(pathItem)
         .then(r => {
            if (goBack) gotoRootOnExec(goBack);
         })
         .catch(error => {
            sharedData.toaster.notify(`Error opening ${pathItem}`);
            Logger.warn(error, `Error opening ${pathItem}`);
            return;
         });

      sharedData.toaster.notify(`Error opening ${pathItem}`);
      Logger.warn(`Error opening ${pathItem}`);
      return;
   }

   //CHECK OVERRRIDE APP FOR THIS EXTENSION
   let defaultApp = null;
   let extension = fileExtension(pathItem);
   let defApps = Config.get('overwriteDefaultFileAssociations');
   if (useOverride && extension && extension.length && defApps && defApps.length) {
      defApps.forEach(app => {
         app.extensions.forEach(ext => {
            if (ext === extension) {
               defaultApp = app.app;
            }
         });
      });
   }

   //OPEN DOCUMENT IN DEFAULT APP
   if (defaultApp) {
      if (!isElevated && forceSU) {
         sudo.exec(`${defaultApp} ` + `"${pathItem}"`, { name: 'typebox' }, (error, stdout, stderr) => {
            if (error) {
               Logger.warn(error, '[execCommand SU]');
               return;
            }
            Logger.log(`[execCommand sudo stdout]: ${stdout}`);
         });
         if (goBack) gotoRootOnExec(goBack);
      } else {
         open = open || require('open');
         open(pathItem, { app: defaultApp }).then(() => {
            if (goBack) gotoRootOnExec(goBack);
         });
      }
   } else if (shell.openItem(pathItem)) {
      if (goBack) gotoRootOnExec(goBack);
   }
}

function execCommand(item, forceSU = false, goBack = true) {
   //KTODO: ver https://github.com/patrick-steele-idem/child-process-promise lo usa upTerm

   if (Config.get('here_are_dragons.disableExecCommand')) {
      Logger.info('[execCommand disabled]');
      return;
   }

   let cmd = get(item, 'rule.params.command') || item;
   if (!cmd || !isString(cmd)) return;

   if (Config.get('here_are_dragons.sudoTerminal')) {
      forceSU = true;
   }

   if (!isElevated && forceSU) {
      Logger.warn('[forceSU is enabled !], here_are_dragons.sudoTerminal');
   }

   Logger.info('[execCommand], command:', cmd, 'sudo:', forceSU);

   if (!isElevated && forceSU) {
      sudo.exec(cmd, { name: 'typebox' }, (error, stdout, stderr) => {
         if (error) {
            Logger.warn(error, '[execCommand SU]');
            return;
         }
         Logger.log(`[execCommand sudo stdout]: ${stdout}`);
      });
      if (goBack) setTimeout(gotoRootOnExec, 100);
      return;
   }

   child_process = child_process || require('child_process');
   child_process.exec(cmd, (error, stdout, stderr) => {
      if (error && !String(error).endsWith('.cpl') && !String(error).includes('control')) {
         Logger.log(error, stdout, stderr, '\n\nexecCommand, cmd:', cmd);
         Logger.warn(error, '[execCommand]');
         return;
      }
   });

   if (goBack) setTimeout(gotoRootOnExec, 100);
}

function openTerminal(item, forceSU = false, goBack = true) {
   if (Config.get('here_are_dragons.disableOpenTerminal')) {
      Logger.info('[openTerminal disabled]');
      return;
   }

   if (!item) return;

   let pathItem = get(item, 'rule.params.drive_path') || get(item, 'params.drive_path') || item;

   if (!pathItem || typeof pathItem !== 'string') {
      Logger.warn('[openTerminal] wrong path:', pathItem);
      return;
   }

   pathItem = normalicePath(pathItem, true);

   if (Config.get('here_are_dragons.sudoTerminal')) {
      forceSU = true;
   }

   if (!isElevated && forceSU) {
      Logger.warn('[forceSU is enabled !], here_are_dragons.sudoTerminal');
   }

   let cmd;
   let params;

   let isDir = get(item, 'rule.params.isDir') || get(item, 'params.isDir');
   if (!isDir && !isString(item)) {
      pathItem = path.parse(pathItem).dir;
   }

   if (Config.isMac || Config.isLinux) {
      cmd = Config.get('defaultTerminalApp') || 'Terminal';

      let slashD = '';

      if (Config.isLinux) {
         if (cmd[0] === 'gnome-terminal' || cmd === 'gnome-terminal') slashD = '--working-directory=';
      }

      if (Array.isArray(cmd)) cmd = cmd.join(' ');

      params = pathItem;
      params = slashD + pathItem;

      Logger.info('[_openTerminal]', cmd, params);

      open = open || require('open');
      open(params, { app: cmd }).then(() => {
         if (goBack) gotoRootOnExec(goBack);
      });

      return;
   }

   if (Config.isWin) {
      cmd = Config.get('defaultTerminalApp') || ['cmd', '-/K']; //['PowerShell', '-noexit', '-command'];

      let slashD = '';

      if (cmd[0] === 'cmd' || cmd === 'cmd') slashD = '/d cd';
      if (cmd[0] === 'cmder' || cmd === 'cmder') slashD = '/START';
      if (cmd[0] === 'conemu' || cmd === 'conemu') slashD = '/START';

      params = `${slashD} ` + `"${pathItem.toLowerCase()}"`;
      params = params.replace(/\/\//g, '/');

      if (Array.isArray(cmd)) cmd = cmd.join(' ');
      let command = `start ${cmd} ${params}`;
      command = command.replace(/\s\s/g, ' ');

      if (!isElevated && forceSU) {
         Logger.info('[openTerminal sudo]', '/ command:', command, '/ cmd:', cmd, '/ params:', params);
         sudo.exec(command, { name: 'typebox' }, (error, stdout, stderr) => {
            if (error) {
               Logger.warn(error, '[openTerminal sudo]');
               return;
            }
            Logger.log(`[openTerminal sudo stdout]: ${stdout}`);
         });
         if (goBack) setTimeout(gotoRootOnExec, 100);
         return;
      }

      child_process = child_process || require('child_process');
      child_process.exec(command, gotoRootOnExec);
      Logger.info('[openTerminal]', '/ command:', command, '/ cmd:', cmd, '/ params:', params);

      return;
   }
}

function walkPaths(arr, options) {
   arr = arr.map(p => global_aux.normalicePath(p, false));
   return new Promise((resolve, reject) => {
      return globby(arr, options)
         .then(values => {
            resolve(values);
         })
         .catch((values, e) => {
            Logger.warn(e);
            resolve([]);
         });
   });
}

function pathsReplaceEnvVar(p) {
   return global_aux.pathsReplaceEnvVar(p);
}

function normalicePath(p, replaceWinSlash = true) {
   return global_aux.normalicePath(p, replaceWinSlash);
}

function deleteCaches() {
   let cacheFolder = Config.get('here_are_dragons.paths.caches');
   if (!cacheFolder || !sharedData.app_window_and_systray) return;
   try {
      rimraf.sync(cacheFolder);
   } catch (e) {
      Logger.warn(e);
   }

   let cacheFolderIcons = Config.get('here_are_dragons.paths.caches_icons');
   if (!cacheFolderIcons || !sharedData.app_window_and_systray) return;
   try {
      rimraf.sync(cacheFolderIcons);
   } catch (e) {
      Logger.warn(e);
   }

   sharedData.app_window_and_systray.refreshListWindow();
}

function deleteUserData() {
   let userFolder = Config.get('here_are_dragons.paths.user');
   if (!userFolder || !sharedData.app_window_and_systray) return;
   try {
      rimraf.sync(userFolder);
      setTimeout(() => {
         sharedData.app_window_and_systray.refreshListWindow();
      }, 100);
   } catch (e) {
      Logger.warn(e);
   }
}

// TEST walkPaths
if (window && Config.isDev) {
   // @ts-ignore
   window.testWP = (arr, $options) => {
      $options || {};
      arr = arr.map(pathsReplaceEnvVar);
      walkPaths(arr, $options)
         .then(resp => {
            Logger.log('\n\n\n Resp:', resp, arr, $options);
         })
         .catch((values, e) => {
            Logger.log('\n\n\n RespErr:', values, e, arr);
         });
   };
}

//KTODO: Ver que vale la pena mover a global_aux
module.exports.getPathRules = getPathRules;
module.exports.getMutipleFiles = getMutipleFiles;
module.exports.openFile = openFile;
module.exports.pathToArray = pathToArray;
module.exports.walkPaths = walkPaths;
module.exports.checkIsExec = checkIsExec;
module.exports.execCommand = execCommand;
module.exports.fileExists = fileExists;
module.exports._isPath = _isPath;
module.exports.openTerminal = openTerminal;
module.exports.deleteCaches = deleteCaches;
module.exports.deleteUserData = deleteUserData;
module.exports.getFsFileIconWin = getFsFileIconWin;
module.exports.getFsFileIconMac = getFsFileIconMac;
module.exports.getFsFileIconLnx = getFsFileIconLnx;
module.exports.fileapp2fileicon = fileapp2fileicon;
module.exports.tryGetFileAppCache = tryGetFileAppCache;
