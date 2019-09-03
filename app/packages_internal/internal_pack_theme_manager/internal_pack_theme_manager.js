'use strict';

const Config = require('@render/config.js');
const { bindKet2actualOs, getKeyFromConfig, equal } = require('@aux/aux_global.js');
const sharedData = require('@render/shared_data.js');
const themeManager = require('@render/theme_manager.js');

const defaultTheme = {
   name: 'default',
   packagejson: {
      shortname: 'Stock themes',
      theme: 'ui',
      subThemes: [
         'default',
         'defaultLight',
         'defaultBlack',
         'defaultGray',
         'active',
         'ambience',
         'atomo',
         'arc',
         'bauhaus',
         'black',
         'blueberry',
         'bluegray',
         // 'bluePrint',
         'blues',
         'darkBlues',
         'brick',
         // 'brown',
         'citylights',
         'cream',
         // 'cupertinoAlt',
         'cupertino',
         'cupertinoDark',
         'cupertinoX',
         'cupertinoLight',
         // 'cyan',
         'darkUi',
         // 'darkPurple',
         'darky',
         'dracula',
         'experimental',
         'experimental2',
         'forest',
         // 'grayscale',
         'iceberg',
         // 'jupiter',
         'lightGray',
         'lightUi',
         'material',
         'materialAlt',
         'metrodark',
         'monokai',
         'newblue',
         'nord',
         'neuromancer',
         'oldSchoolDisplay',
         // 'primer',
         'photo',
         'rabbits',
         'snazzy',
         'snazzyDark',
         'spacegray',
         'statics',
         'staticsAlt',
         'vscoding',
         'white',
         // 'soft',
      ],
   },
};

module.exports = context => {
   return {
      config: {
         command: 'tm!',
         commandResetDark: 'td!',
         commandThemeLight: 'tl!',
         defaultThemeDark: ['default', 'default'],
         defaultThemeLight: ['default', 'defaultLight'],
      },
      init() {
         const defaultThemeDark = this.config.defaultThemeDark;
         const defaultThemeLight = this.config.defaultThemeLight;

         themeManager.setDefaultThemes([defaultTheme], defaultTheme.packagejson.subThemes);
         themeManager.setUserDefaultThemes(defaultThemeDark, defaultThemeLight);

         const $permanentRules = [];
         const pathThemes = [];
         const pathtOptions = 'internal_pack_options';
         const pathtName = 'internal_theme_manager';

         const defaultPath = {
            name: 'Theme Manager',
            path: pathtName,
            checkNews: true,
            sortByNoRules: 'order',
            icon: {
               type: 'iconFont',
               iconClass: 'icons8-monitor text',
            },
         };

         context.on('viewIsReady', path => {
            $permanentRules.push({
               title: 'Theme Manager',
               description: `Command: ${this.config.command}`,
               path: pathtOptions,
               type: ['internal', 'null'],
               new_permit: false,
               icon: defaultPath.icon,
               params: {
                  changePath: defaultPath,
               },
            });

            $permanentRules.push({
               title: 'Reset to default darkt theme ',
               path: defaultPath.path,
               description: `Command: ${this.config.commandResetDark}`,
               type: ['tb-theme', 'internal', 'object'],
               new_permit: true,
               icon: {
                  type: 'iconFont',
                  iconClass: 'mdi-restore text',
               },
               order: 0,
               addInHistory: false,
               last_permit: false,
               params: {
                  theme: {},
                  themeName: 'Default Theme',
                  subThemeName: 'Default Theme',
                  themeId: defaultThemeDark[0],
                  subThemeId: defaultThemeDark[1],
               },
            });

            $permanentRules.push({
               title: 'Reset to default light theme ',
               path: defaultPath.path,
               description: `Command: ${this.config.commandThemeLight}`,
               type: ['tb-theme', 'internal', 'object'],
               new_permit: true,
               icon: {
                  type: 'iconFont',
                  iconClass: 'mdi-restore text',
               },
               order: 0,
               addInHistory: false,
               last_permit: false,
               params: {
                  theme: {},
                  themeName: 'Default Theme',
                  subThemeName: 'Default Theme',
                  themeId: defaultThemeLight[0],
                  subThemeId: defaultThemeLight[1],
               },
            });

            const availableUserThemes = themeManager.getAvailableUserThemes();

            availableUserThemes.forEach((theme, i) => {
               if (theme && theme.packagejson) {
                  const shortname = theme.packagejson.shortname;
                  const subThemes = theme.packagejson.subThemes;

                  //ROOT THEME
                  $permanentRules.push({
                     title: shortname,
                     path: defaultPath.path,
                     type: ['internal', 'object'],
                     new_permit: true,
                     icon: defaultPath.icon,
                     order: i,
                     addInHistory: false,
                     last_permit: false,
                     params: {
                        changePath: {
                           name: shortname,
                           path: `${pathtName}-${theme.name}`,
                           checkNews: false,
                           icon: theme.icon || defaultPath.icon,
                           sortByNoRules: 'order',
                        },
                     },
                  });

                  subThemes.forEach((subTheme, j) => {
                     $permanentRules.push({
                        title: subTheme,
                        path: `${pathtName}-${theme.name}`,
                        type: ['tb-theme', 'internal', 'object'],
                        new_permit: true,
                        icon: theme.icon || defaultPath.icon,
                        order: j,
                        addInHistory: false,
                        last_permit: false,
                        params: {
                           theme: theme.packagejson,
                           themeName: theme.name,
                           subThemeName: subTheme,
                           themeId: theme.name,
                           subThemeId: subTheme,
                        },
                     });
                  });
               }
            });

            context.addPermanentRules($permanentRules);

            //Commands
            context.on('changeQuery', txt => {
               if (txt === this.config.command || txt === 'themeManager!') {
                  context.setQuery('');
                  context.setPath(defaultPath);
               }

               if (txt === this.config.commandResetDark || txt === 'themeReset!') {
                  context.setQuery('');
                  themeManager.setThemeAndSubTheme(defaultThemeDark[0], defaultThemeDark[1]);
               }

               if (txt === this.config.commandThemeLight || txt === 'themeLight!') {
                  context.setQuery('');
                  themeManager.setThemeAndSubTheme(defaultThemeLight[0], defaultThemeLight[1]);
               }
            });
         });
      },
      defineTypeExecutors() {
         return [
            {
               type: 'tb-theme',
               id: 'tb-theme',
               title: 'Apply theme',
               enabled: obj => true,
               exectFunc: (obj, rule) => {
                  const themeId = context.get(rule, 'params.themeId');
                  const subThemeId = context.get(rule, 'params.subThemeId');
                  if (themeId && subThemeId) {
                     themeManager.setThemeAndSubTheme(themeId, subThemeId);
                  }
               },
            },
         ];
      },
   };
};
