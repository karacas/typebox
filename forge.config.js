'use strict';

const path = require('path');
const _package = require('./package.json');

const appId = 'com.karacas.typebox';
const companyName = 'karacas';
const homepage = 'https://github.com/karacas/typebox';
const iconPath = path.resolve(__dirname, 'app/assets/icons/');

const _ignore = require('./prune_data.js').prod;

const _electronPackagerConfig = {
   asar: true,
   prune: true,
   overwrite: true,
   name: 'typebox',
   appCopyright: 'typebox',
   win32metadata: {
      ProductName: 'typebox',
      InternalName: 'typebox',
      FileDescription: 'typebox launcher',
      CompanyName: companyName,
      OriginalFilename: 'typebox.exe',
   },
   ignore: _ignore,
   icon: path.resolve(iconPath, 'icon'),
   appBundleId: appId,
   appCategoryType: 'public.app-category.developer-tools',
   win32metadata: {
      CompanyName: companyName,
      OriginalFilename: 'typebox',
   },
   __asarUnpack: ['./node_modules/iohook', '**/*.node', '**/*.dll'],
   __unpackDir: ['./node_modules/iohook'],
   __osxSign: {
      identity: 'Developer ID Application: karacas (XXXXXXXX)',
   },
};

if (!true) {
   _electronPackagerConfig.prune = false;
   _electronPackagerConfig.asar = false;
}

//https://js.electronforge.io/maker/
const $config = {
   electronPackagerConfig: _electronPackagerConfig,
   packagerConfig: _electronPackagerConfig,
   makers: [
      {
         name: '@electron-forge/maker-squirrel',
         platforms: ['win32'],
         config: arch => {
            return {
               name: 'typebox',
               authors: 'karacas',
               exe: 'typebox.exe',
               noMsi: true,
               remoteReleases: '',
               // setupExe: `typebox-${_package.version}-setup-${arch}.exe`,
               setupExe: 'typebox_setup.exe',
               animation: path.resolve(iconPath, 'inv.gif'),
               loadingGif: path.resolve(iconPath, 'inv.gif'),
               setupIcon: path.resolve(iconPath, 'icon.ico'),
            };
         },
      },
      {
         name: '@electron-forge/maker-wix',
         platforms: ['__win32'],
         config: {
            language: 1033,
            manufacturer: 'karacas',
         },
      },
      {
         name: '@electron-forge/maker-dmg',
         platforms: ['darwin'],
         config: {
            backgroundColor: '#ffffff',
            icon: path.resolve(iconPath, 'color_256.icns'),
            overwrite: true,
            // format: 'ULFO',
         },
      },
      {
         name: '@electron-forge/maker-zip',
         platforms: ['darwin'],
      },
      {
         //https://npm.taobao.org/package/electron-installer-debian
         name: '@electron-forge/maker-deb',
         platforms: ['linux'],
         config: {
            description: 'Universal & Open Source keystroke launcher',
            categories: ['productivity'],
            icon: {
               scalable: path.resolve(iconPath, 'ico512_color.svg'),
               '256x256': path.resolve(iconPath, 'color_256.png'),
            },
         },
      },
      {
         name: '@electron-forge/maker-rpm',
         platforms: ['linux'],
         config: {
            description: 'Universal & Open Source keystroke launcher',
            categories: ['productivity'],
            icon: {
               scalable: path.resolve(iconPath, 'ico512_color.svg'),
               '256x256': path.resolve(iconPath, 'color_256.png'),
            },
         },
      },
      {
         name: '@electron-forge/maker-snap',
         platforms: ['linux'],
         config: {
            description: 'Universal & Open Source keystroke launcher',
            categories: ['productivity'],
         },
         escription: 'Universal & Open Source keystroke launcher',
      },
      {
         name: '@electron-forge/maker-flatpak',
         platforms: ['linux'],
         config: {
            description: 'Universal & Open Source keystroke launcher',
            categories: ['productivity'],
            icon: {
               scalable: path.resolve(iconPath, 'ico512_color.svg'),
               '256x256': path.resolve(iconPath, 'color_256.png'),
            },
         },
      },
   ],
};

if (!true) console.log('\n\n\n', 'electron-forge-config: ', $config, '\n\n');

module.exports = $config;
