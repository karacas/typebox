'use strict';

const isUrl = require('is-url');
const path = require('path');
const sharedData = require('@render/shared_data.js');
const ListViewStore = require('@render/list_view_store.js');
const Config = require('@render/config.js');
const Logger = require('@render/logger.js');
const aux_webManager = require('@render/aux_web_manager.js');
const packagesManager = require('@render/packages_manager.js');
const themeManager = require('@render/theme_manager.js');
const { getKeyFromConfig, get, cloneDeep, equal, $timeout } = require('@aux/aux_global.js');

module.exports = context => {
   let fixedOptions = Number(Config.get('fixedTypeBoxOptions'));
   let getRules = level => [
      {
         title: 'Typebox Options',
         initSort: 15,
         posFixed: fixedOptions * 15,
         type: ['null'],
         new_permit: false,
         icon: {
            type: 'iconFont',
            iconClass: 'fe-toggle-left accentColor2 text',
         },
         description: 'Command: o!',
         params: {
            changePath: {
               name: 'options',
               path: level,
            },
         },
      },
      {
         title: 'Edit Typebox Settings',
         path: level,
         description: 'Command:  us! ',
         type: ['internal', 'null'],
         icon: {
            type: 'iconFont',
            iconClass: 'mdi-json',
         },
         params: {
            action: 'open_settings',
         },
      },
      {
         title: 'Open Typebox Log',
         path: level,
         type: ['internal', 'null'],
         description: 'Command: log! ',
         icon: {
            type: 'iconFont',
            iconClass: 'mdi-clock-alert',
         },
         params: {
            action: 'open_log',
         },
      },
      {
         //[WIP]
         title: 'Open Data Folder',
         path: level,
         type: ['internal', 'null'],
         icon: {
            type: 'iconFont',
            iconClass: 'mdi-folder-upload',
         },
         params: {
            action: 'oepn_data_path',
         },
      },
      {
         //[WIP]
         title: 'Reset News',
         path: level,
         type: ['internal', 'null'],
         description: 'Command: rn! ',
         icon: {
            type: 'iconFont',
            iconClass: 'mdi-restore',
         },
         params: {
            action: 'reset_news',
         },
      },
      {
         title: 'Reload Typebox',
         path: level,
         type: ['internal', 'null'],
         description: 'Command: r! ',
         icon: {
            type: 'iconFont',
            iconClass: 'mdi-refresh',
         },
         params: {
            action: 'refresh',
         },
      },
      {
         title: 'Open Dev Tools',
         path: level,
         type: ['internal', 'null'],
         description: 'Command: dt! ',
         icon: {
            type: 'iconFont',
            iconClass: 'mdi-console',
         },
         params: {
            action: 'openDevTools',
         },
      },
      {
         title: 'Toggle Always on Top',
         path: level,
         type: ['internal', 'null'],
         description: `Shortcut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys') || [], 'TOGGLE_ALWAYS_ON_TOP').toUpperCase()} `,
         icon: {
            type: 'iconFont',
            iconClass: 'icons8-pin-3',
         },
         params: {
            action: 'toggleAlwaysOnTop',
         },
      },

      {
         title: 'Reset Window Size',
         path: level,
         type: ['internal', 'null'],
         description: `Shortcut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys') || [], 'RESET_SIZE').toUpperCase()} `,
         icon: {
            type: 'iconFont',
            iconClass: 'mdi-resize',
         },
         params: {
            action: 'resetWindowSize',
         },
      },

      {
         title: 'Toggle Color Mode',
         path: level,
         type: ['internal', 'null'],
         description: `Shortcut: ${getKeyFromConfig(Config.get('here_are_dragons.bindKeys') || [], 'TOGGLE_COLOR_MODE').toUpperCase()} `,
         icon: {
            type: 'iconFont',
            iconClass: 'mdi-white-balance-sunny',
         },
         params: {
            action: 'toggleColorMode',
         },
      },
      {
         title: 'Quit Typebox',
         path: level,
         initSort: -10,
         type: ['internal', 'null'],
         description: 'Command: quit! ',
         icon: {
            type: 'iconFont',
            iconClass: 'fe-power',
         },
         params: {
            action: 'quit',
         },
      },
   ];

   return {
      init() {
         context.addPermanentRules(getRules(this.name));
      },
   };
};
