'use strict';

const CONFIG = require('../js/config.js');
const ICONS = CONFIG.get('icons');

const DEFAULT_ICON = {
    type: 'iconFont',
    iconClass: 'feather-align-left small_ico',
    iconClassColor: null,
    iconData: null
};

module.exports.get = (icon = {}) => {
    if (!ICONS) return {};

    if (icon && icon.type === 'noIcon') return icon;

    if (icon && (typeof icon === 'string' || icon instanceof String)) {
        let iconTmp;
        if (icon.startsWith('<?xml') || icon.startsWith('<svg')) {
            iconTmp = {
                type: 'iconSvg',
                iconData: icon
            };
        } else if (icon.startsWith('data:')) {
            iconTmp = {
                type: 'iconSrc',
                iconData: icon
            };
        } else {
            iconTmp = {
                type: 'iconFont',
                iconClass: icon
            };
        }
        icon = iconTmp;
    }

    let defaultIconCopy = Object.assign({}, DEFAULT_ICON);

    if (icon && icon.type && icon.type !== 'iconFont') defaultIconCopy.iconClass = null;

    return Object.assign({}, defaultIconCopy, icon);
};

module.exports.getLoader = () => {
    return {
        type: 'iconSvg',
        iconClass: 'animate-spin-ico noShadow colorDefault',
        iconClassColor: null,
        iconData:
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'><path fill='#fff' d='M25.3 6.5C15 6.5 6.6 14.8 6.6 25h4c0-8 6.6-14.5 14.7-14.5v-4z'/></svg>"
    };
};

module.exports.getInfo = () => {
    return {
        type: 'iconFont',
        iconClass: 'mdi-information-outline small_ico colorDefault',
        iconClassColor: null,
        iconData: null
    };
};

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
*/
