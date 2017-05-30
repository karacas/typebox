'use strict';

const _ = require('lodash');
const isUrl = require('is-url');
const path = require('path');
const sharedData = require('../../sharedData.js');
const ListViewStore = require('../../listViewStore.js');
const Config = require('../../config.js');
const Logger = require('../../logger.js');
const aux_webManager = require('../../aux_webManager.js');
const packagesManager = require('../../packagesManager.js');
const themeManager = require('../../themeManager.js');

var getRules = level => [
    {
        title: 'typebox Options',
        initSort: 15,
        type: ['null'],
        icon: {
            type: 'iconSvg',
            iconData: '<svg version="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#607D8B" d="M39.6 27.2c.1-.7.2-1.4.2-2.2s-.1-1.5-.2-2.2l4.5-3.2c.4-.3.6-.9.3-1.4L40 10.8c-.3-.5-.8-.7-1.3-.4l-5 2.3c-1.2-.9-2.4-1.6-3.8-2.2L29.4 5c-.1-.5-.5-.9-1-.9h-8.6c-.5 0-1 .4-1 .9l-.5 5.5c-1.4.6-2.7 1.3-3.8 2.2l-5-2.3c-.5-.2-1.1 0-1.3.4l-4.3 7.4c-.3.5-.1 1.1.3 1.4l4.5 3.2c-.1.7-.2 1.4-.2 2.2s.1 1.5.2 2.2L4 30.4c-.4.3-.6.9-.3 1.4L8 39.2c.3.5.8.7 1.3.4l5-2.3c1.2.9 2.4 1.6 3.8 2.2l.5 5.5c.1.5.5.9 1 .9h8.6c.5 0 1-.4 1-.9l.5-5.5c1.4-.6 2.7-1.3 3.8-2.2l5 2.3c.5.2 1.1 0 1.3-.4l4.3-7.4c.3-.5.1-1.1-.3-1.4l-4.2-3.2zM24 35c-5.5 0-10-4.5-10-10s4.5-10 10-10 10 4.5 10 10-4.5 10-10 10z"/><path fill="#455A64" d="M24 13c-6.6 0-12 5.4-12 12s5.4 12 12 12 12-5.4 12-12-5.4-12-12-12zm0 17c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/></svg>'
        },
        icon: {
            type: 'iconFont',
            iconClass: 'feather-toggle palette-Amber-A200 text'
        },
        description: '[ command: o! ]',
        params: {
            changePath: {
                path: level
            }
        }
    },
    {
        title: 'Edit typebox Settings',
        path: level,
        description: '[ command:  us! ]',
        type: ['internal', 'null'],
        icon: {
            type: 'iconFont',
            iconClass: 'mdi-json'
        },
        params: {
            action: 'open_settings'
        }
    },
    {
        title: 'Open typebox log',
        path: level,
        type: ['internal', 'null'],
        description: '[ command: log! ]',
        icon: {
            type: 'iconFont',
            iconClass: 'mdi-clock-alert'
        },
        params: {
            action: 'open_log'
        }
    },
    {
        title: 'typebox Package Manager',
        path: level,
        description: '[ command: pm! ]',
        icon: {
            type: 'iconFont',
            iconClass: 'mdi-package'
        },
        params: {
            changePath: {
                path: 'package_options_menu'
            }
        }
    },
    {
        title: 'Quit typebox',
        path: level,
        initSort: -10,
        type: ['internal', 'null'],
        description: '[ command: quit! / q! ]',
        icon: {
            type: 'iconFont',
            iconClass: 'feather-power'
        },
        params: {
            action: 'quit'
        }
    }
];

module.exports = {
    init() {
        this.app.addPermanentRules(getRules(this.name));
    },
    defineTypeExecutors() {
        return [];
    }
};
