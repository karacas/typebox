'use strict';

const config = require('@render/config.js');
const ICONS = config.get('icons');
const { getFsFileIconWin, getFsFileIconMac, getFsFileIconLnx } = require('@render/aux_drive_manager.js');
const aux_driveManager = require('@render/aux_drive_manager.js');
const logger = require('@render/logger.js');
const lrucache = require('lru-cache');
const ms = require('ms');
const cache_get_icons = new lrucache({ max: 1024, maxAge: ms('1h') });

const getDefaultIcon = () => {
   return {
      type: 'iconFont',
      iconClass: 'fe-align-left small_ico',
      iconClassColor: null,
      styleColor: null,
      delayed: false,
   };
};

const rejectIcon = (e, $icon) => {
   logger.warn('[getIconDelayed] no icon', e);
   return makeIcon();
};

const getIconDelayedCache = ico => cache_get_icons.get(ico);
let functResolve = null;

const getIconDelayed = icon => {
   return new Promise((resolve, reject) => {
      if (!ICONS) return {};
      if (!icon) return icon;
      if (icon.type === 'noIcon') return icon;

      const idDelayed = icon.dataDelayedFile && icon.dataDelayedFile.length ? icon.dataDelayedFile : null;

      if (icon.delayed === false && (icon.iconData || icon.iconDataDelayed)) {
         resolve(icon);
         if (idDelayed) cache_get_icons.set(idDelayed, icon);
         return;
      }

      if (!icon.dataDelayedFile) {
         resolve(rejectIcon(icon));
         Logger.warn('[getIconDelayed] not valid:', icon);
         return;
      }

      if (idDelayed) {
         const mem = getIconDelayedCache(idDelayed);
         if (mem) {
            resolve(mem);
            return;
         }
      }

      const responseIconData = iconData => {
         if (iconData === null || typeof iconData !== 'string') {
            resolve(rejectIcon(icon));
            return;
         }
         icon.iconDataDelayed = iconData;
         icon.delayed = false;
         resolve(icon);
         if (idDelayed) cache_get_icons.set(idDelayed, icon);
         return;
      };

      if (functResolve === null) {
         if (config.isWin) functResolve = aux_driveManager['getFsFileIconWin'];
         if (config.isMac) functResolve = aux_driveManager['getFsFileIconMac'];
         if (config.isLinux) functResolve = aux_driveManager['getFsFileIconLnx'];
      }

      if (functResolve && typeof functResolve === 'function') {
         functResolve(icon.dataDelayedFile).then(responseIconData);
         return;
      } else {
         Logger.error('[getIconDelayed] functResolve not valid:', functResolve);
      }

      resolve(rejectIcon(icon));
   });
};

const makeIcon = icon => {
   if (!ICONS) return {};

   if (icon && icon.type === 'noIcon') return icon;

   const resIcon = getDefaultIcon();

   if (!icon) return resIcon;

   resIcon.iconClass = null;

   if (typeof icon === 'string') {
      if (icon.indexOf('<?xml') === 0 || icon.indexOf('<svg') === 0) {
         resIcon.type = 'iconSvg';
         resIcon.iconData = icon;
      } else if (
         icon.indexOf('data:') === 0 ||
         icon.indexOf('http') === 0 ||
         icon.indexOf('file') === 0 ||
         icon.toLowerCase().indexOf('.jpg') !== -1 ||
         icon.toLowerCase().indexOf('.jpeg') !== -1 ||
         icon.toLowerCase().indexOf('.svg') !== -1 ||
         icon.toLowerCase().indexOf('.png') !== -1 ||
         icon.toLowerCase().indexOf('.ico') !== -1
      ) {
         resIcon.type = 'iconSrc';
         resIcon.iconData = icon;
      } else if (icon.toLowerCase().indexOf('.exe') !== -1 || icon.toLowerCase().indexOf('.lnk') !== -1) {
         resIcon.type = 'iconSrc';
         resIcon.dataDelayedFile = icon;
         resIcon.delayed = true;
      } else {
         resIcon.type = 'iconFont';
         resIcon.iconClass = icon;
         if (resIcon.iconClass.indexOf('feather-') !== -1) resIcon.iconClass = resIcon.iconClass.replace('feather-', 'fe-');
         if (resIcon.iconClass.indexOf('palette-') !== -1 && resIcon.iconClass.indexOf('text') === -1) {
            resIcon.iconClass += ' text';
         }
      }
      return resIcon;
   }

   if (icon.type) resIcon.type = icon.type;
   if (icon.iconClass && typeof icon.iconClass === 'string') resIcon.iconClass = icon.iconClass.replace('feather-', 'fe-');
   if (icon.iconSrc) resIcon.iconSrc = icon.iconSrc;
   if (icon.iconClassColor) resIcon.iconClassColor = icon.iconClassColor;
   if (icon.dataDelayedFile) resIcon.dataDelayedFile = icon.dataDelayedFile;
   if (icon.iconData) resIcon.iconData = icon.iconData;
   if (icon.delayed === true) resIcon.delayed = true;
   if (icon.type === 'iconFont' && icon.styleColor) resIcon.styleColor = icon.styleColor;

   return resIcon;
};

const getLoader = () => {
   return {
      type: 'iconSvg',
      iconClass: 'animate-spin-ico noShadow colorDefault',
      iconData:
         "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'><path fill='%23fff' d='M25.3 6.5C15 6.5 6.6 14.8 6.6 25h4c0-8 6.6-14.5 14.7-14.5v-4z'/></svg>",
   };
};

const getInfo = () => {
   return {
      type: 'iconFont',
      iconClass: 'mdi-information-outline colorDefault',
   };
};

module.exports.get = makeIcon;
module.exports.getLoader = getLoader;
module.exports.getInfo = getInfo;
module.exports.getIconDelayed = getIconDelayed;
module.exports.getIconDelayedCache = getIconDelayedCache;

/*
icon: {
    "type": "iconSvg",
    "iconData": "<svg version='1' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48' enable-background='new 0 0 48 48'><path fill='#616161' d='M40,16H8v24c0,2.2,1.8,4,4,4h24c2.2,0,4-1.8,4-4V16z'/><path fill='#424242' d='M36,4H12C9.8,4,8,5.8,8,8v9h32V8C40,5.8,38.2,4,36,4z'/><path fill='#9CCC65' d='M36,14H12c-0.6,0-1-0.4-1-1V8c0-0.6,0.4-1,1-1h24c0.6,0,1,0.4,1,1v5C37,13.6,36.6,14,36,14z'/><g fill='#33691E'><rect x='33' y='10' width='2' height='2'/><rect x='29' y='10' width='2' height='2'/></g><path fill='#FF5252' d='M36,23h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C37,22.6,36.6,23,36,23z'/><g fill='#E0E0E0'><path d='M15,23h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C16,22.6,15.6,23,15,23z'/><path d='M22,23h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C23,22.6,22.6,23,22,23z'/><path d='M29,23h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C30,22.6,29.6,23,29,23z'/><path d='M15,29h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C16,28.6,15.6,29,15,29z'/><path d='M22,29h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C23,28.6,22.6,29,22,29z'/><path d='M29,29h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C30,28.6,29.6,29,29,29z'/><path d='M15,35h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C16,34.6,15.6,35,15,35z'/><path d='M22,35h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C23,34.6,22.6,35,22,35z'/><path d='M29,35h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C30,34.6,29.6,35,29,35z'/><path d='M15,41h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C16,40.6,15.6,41,15,41z'/><path d='M22,41h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C23,40.6,22.6,41,22,41z'/><path d='M29,41h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C30,40.6,29.6,41,29,41z'/></g><g fill='#BDBDBD'><path d='M36,29h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C37,28.6,36.6,29,36,29z'/><path d='M36,35h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C37,34.6,36.6,35,36,35z'/><path d='M36,41h-3c-0.6,0-1-0.4-1-1v-2c0-0.6,0.4-1,1-1h3c0.6,0,1,0.4,1,1v2C37,40.6,36.6,41,36,41z'/></g></svg>"
}
icon: {
    "type": "iconSrc",
    "iconData": "data:image/png;base64,iVBORw0K..."
}
icon: {
    "iconClass": "feather-monitor",
    "iconClassColor": "palette-Red-A100 text"
}
icon: {
    "type": "iconFont",
    "iconClass": "mdi-backup-restore palette-Amber-A200 text",
    "iconClassColor": "palette-Red-A100 text"
}
icon: {
    "type": "iconSvg",
    "iconClass": "animate-spin-ico noShadow colorDefault",
    "iconClassColor": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 5"
}

icon = {
   type: 'iconSrc',
   iconClass: null,
   delayed: true,
   dataDelayedFile: 'c:\Dropbox\portable\sublime3\sublime_text.exe',
};

icon = 'c:\Dropbox\portable\sublime3\sublime_text.exe'

icon = {
   type: 'iconChar',
   iconData: '🤒',
}
*/
