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
