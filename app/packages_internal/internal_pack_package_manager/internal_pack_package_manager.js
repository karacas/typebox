'use strict';

const { clone } = require('lodash');
const getPackageReadme = require('get-package-readme');
const repositoryUrl = require('get-repository-url');
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const packagesManager = require('@render/packages_manager.js');
const ListViewStore = require('@render/list_view_store.js');
const { aux_getDirName, normalicePath, get } = require('@aux/aux_global.js');
let got = null;

module.exports = context => {
   return {
      disabled: !Config.get('here_are_dragons.installPackages'),
      config: {
         // urlq: 'https://api.npms.io/v2/search?from=0&q=keywords%3A+{{keyword}}&size=100',
         urlq: 'http://registry.npmjs.org/-/v1/search?text=keywords:{{keyword}}&size=100',
         urlOpen: 'https://www.npmjs.com/package/{{pack}}',
         debounceSearchSecs: 60,
         sortBy: 'order',
         command: 'pm!',
         commandSearch: 'sp!',
      },
      init() {
         //Store last search
         this.pathname = 'npm-package-plugin';

         this.path = {
            path: this.pathname,
            sortBy: this.config.sortBy,
            checkNews: true,
            icon: {
               type: 'iconFont',
               iconClass: 'mdi-package text',
            },
         };

         this.pathInstalled = {
            path: `${this.pathname}-installed`,
            sortBy: this.config.sortBy,
            checkNews: true,
            icon: {
               type: 'iconFont',
               iconClass: 'mdi-package text',
            },
         };

         this.pm_path = {
            path: 'package_options_menu',
            sortBy: this.config.sortBy,
            icon: this.path.icon,
         };

         //Add main rule
         let $permanentRules = [];

         $permanentRules.push({
            title: 'Search available Packages',
            type: [`${this.pathname}-root`],
            path: this.pm_path.path,
            description: `Command: ${this.config.commandSearch}`,
            icon: {
               type: 'iconFont',
               iconClass: 'mdi-magnify text',
            },
            hidden_permit: false,
            new_permit: false,
            params: {
               changePath: this.path,
            },
         });

         if (packagesManager.getSettingsPackages().length) {
            $permanentRules.push({
               title: 'Installed Packages',
               type: [`${this.pathname}-root`],
               path: this.pm_path.path,
               icon: this.path.icon,
               hidden_permit: false,
               new_permit: false,
               params: {
                  changePath: this.pathInstalled,
               },
            });
         }

         if (packagesManager.getSettingsPackages().length && Config.get('here_are_dragons.updatePackages')) {
            $permanentRules.push({
               title: 'Update all Packages',
               type: ['updatePackages', null],
               hidden_permit: false,
               last_permit: false,
               new_permit: false,
               path: this.pm_path.path,
               icon: {
                  type: 'iconFont',
                  iconClass: 'mdi-backup-restore text',
               },
            });
         }

         $permanentRules.push({
            title: 'Package Manager',
            path: 'internal_pack_options',
            type: ['internal', 'null'],
            description: `Command: ${this.config.command}`,
            new_permit: false,
            icon: {
               type: 'iconFont',
               iconClass: 'mdi-package',
            },
            params: {
               changePath: {
                  path: 'package_options_menu',
               },
            },
         });

         context.addPermanentRules($permanentRules);

         //Name to rule
         this.getRule = (namePack, $path, $obj) => {
            let obj = clone($obj);

            const installed = packagesManager.isInUserSettingPackages(namePack);
            let localJson = installed ? packagesManager.requierePackageJson(namePack) : null;
            let errorPackInstalled = false;

            if (installed && (!localJson || !localJson.version)) {
               Logger.error('[Package]', namePack, 'Unable to load installed package / no package.json / path:', $path);
               errorPackInstalled = true;
            }

            let installedStr = '';
            let remoteVersion = '';
            let insVersion = '';

            if (get(obj, 'package.version')) remoteVersion = ` ${get(obj, 'package.version')}`;
            if (installed && !errorPackInstalled) insVersion = ` ${localJson.version}`;
            if (installed && !errorPackInstalled) installedStr = ` [ installed ${insVersion} ]`;

            let pack = {
               title: `${namePack} ${remoteVersion}${installedStr}${errorPackInstalled ? ' [ERROR]' : ''}`,
               path: $path,
               description: errorPackInstalled ? `Unable to load / ${$path}` : null,
               addInHistory: false,
               fav_permit: false,
               hidden_permit: false,
               last_permit: false,
               viewer: !errorPackInstalled,
               icon: {
                  type: 'iconFont',
                  iconClass: 'mdi-package text',
               },
               params: {
                  name: namePack,
                  obj: obj,
                  errorPackInstalled,
                  version: (localJson ? localJson.version : null) || get(obj, 'package.version') || null,
                  installed: `${!!installed}`,
                  openUrl:
                     get(obj, 'package.homepage') ||
                     get(obj, 'package.links.homepage') ||
                     get(obj, 'package.repository.url') ||
                     get(obj, 'package.repository') ||
                     this.config.urlOpen.replace('{{pack}}', namePack),
               },
               type: [this.pathname],
            };

            if (installed) pack.new_permit = false;

            return pack;
         };

         //Add result rules
         this.addFetchedRules = ($pck, pcktxt) => {
            if (context.getPath().path !== this.pathname) return;

            let packs = $pck.objects.map(obj => {
               let namePack = get(obj, 'package.name');
               if (obj && namePack && packagesManager.validatePackage(obj.package) && !namePack.includes('-dev')) {
                  return this.getRule(namePack, this.pathname, obj);
               }
            });

            context.setRules(packs);
         };

         //fetch
         this.fetchRules = async () => {
            //ERROR: Por acá no viene, no es el fetch
            let urlfetch = this.config.urlq.replace('{{keyword}}', 'typebox');
            let exp = this.config.debounceSearchSecs;

            got = got || require('got');
            const { body } = await got(urlfetch, { json: true });

            setTimeout(() => {
               //KTODO: LRU CACHE?
               this.addFetchedRules(body, 'typebox');
            }, exp);
         };

         this.getInstalledPackagesRules = () => {
            let installedPackages = packagesManager.getSettingsPackages();
            let packs = [];
            installedPackages.map(pack => {
               let obj = packagesManager.requierePackageJson(pack);
               if (obj) packs.push(this.getRule(pack, this.pathInstalled.path, obj));
            });
            if (packs && packs.length) {
               context.setRules(packs);
            } else {
               context.putInfo(this.pathInstalled.path, 'No packages installed');
            }
         };

         //Change Path
         context.on('changePath', path => {
            if (path === this.pathname) {
               context.putLoader(this.pathname, 'Searching packages');
               setTimeout(() => {
                  this.fetchRules();
               }, 10);
            }
            if (path === this.pathInstalled.path) {
               this.getInstalledPackagesRules();
            }
         });

         //Commands
         context.on('changeQuery', txt => {
            if (txt === this.config.commandSearch || txt === 'searchPackages!') {
               context.setQuery('');
               context.setPath(this.path);
            }
            if (txt === this.config.command || txt === 'packageManager!') {
               context.setQuery('');
               context.setPath(this.pm_path);
            }
         });
      },
      defineTypeExecutors() {
         return [
            {
               type: this.pathname,
               title: 'Open Contextual Options',
               id: `${this.pathname}OCP`,
               enabled: obj => {
                  return false;
               },
               exectFunc: obj => {
                  context.placeExecutors(obj.rule);
               },
            },
            {
               type: 'updatePackages',
               title: 'internal',
               id: 'updatePackages OCP',
               enabled: obj => {
                  return !(packagesManager.getSettingsPackages().length && Config.get('here_are_dragons.updatePackages'));
               },
               exectFunc: obj => {
                  if (!Config.get('here_are_dragons.updatePackages') || !packagesManager.getSettingsPackages().length) {
                     Logger.warn('updatePackages is disabled or no packages');
                     return false;
                  }
                  context.setPath({
                     path: `${this.pm_path.path}load`,
                     avoidHistory: true,
                  });
                  context.putLoader(`${this.pm_path.path}load`, 'Check packages updates');
                  packagesManager
                     .updateAllPackages(false)
                     .then(res => {
                        if (context.getPath().path === `${this.pm_path.path}load`) {
                           if (!res || !res.length > 0) {
                              setTimeout(() => {
                                 context.putInfo(`${this.pm_path.path}load`, 'No packages to update');
                              }, 0);
                           }
                        }
                     })
                     .catch(res => {
                        context.removeLoader(`${this.pm_path.path}load`);
                        context.setPath(this.pm_path);
                     });
               },
            },
            {
               type: this.pathname,
               title: 'Install Package',
               id: `${this.pathname}IP`,
               icon: {
                  type: 'iconFont',
                  iconClass: 'mdi-download text',
               },
               enabled: obj => {
                  if (!Config.get('here_are_dragons.installPackages')) {
                     return false;
                  }
                  let name = get(obj, 'params.name');
                  return !packagesManager.isInUserSettingPackages(name);
               },
               exectFunc: obj => {
                  if (!Config.get('here_are_dragons.installPackages')) {
                     Logger.warn('installPackages is disabled');
                     return false;
                  }
                  let name = get(obj, 'rule.params.name');

                  context.setQuery('');
                  context.setPath({
                     path: `${this.pm_path.path}load`,
                     avoidHistory: true,
                  });
                  context.putLoader(`${this.pm_path.path}load`, 'Installing package');

                  packagesManager
                     .addPackage(name)
                     .then(() => {})
                     .catch(() => {
                        if (context.getPath().path === `${this.pm_path.path}load`) {
                           context.removeLoader('load');
                           ListViewStore.storeActions.backRulesPath();
                        }
                     });
               },
            },
            {
               type: this.pathname,
               title: 'Remove Package',
               id: `${this.pathname}RP`,
               icon: {
                  type: 'iconFont',
                  iconClass: 'mdi-delete text',
               },
               enabled: obj => {
                  if (!Config.get('here_are_dragons.deletePackages')) {
                     return false;
                  }
                  let name = get(obj, 'params.name');
                  return packagesManager.isInUserSettingPackages(name);
               },
               exectFunc: obj => {
                  if (!Config.get('here_are_dragons.deletePackages')) {
                     Logger.warn('deletePackages is disabled');
                     return false;
                  }
                  let name = get(obj, 'rule.params.name');
                  context.setQuery('');
                  if (packagesManager.removePackage(name)) {
                     context.setPath({
                        path: `${this.pm_path.path}load`,
                        avoidHistory: true,
                     });
                     context.putLoader(`${this.pm_path.path}load`, 'Removing package');
                  }
               },
            },
            {
               type: this.pathname,
               title: 'Update Package',
               id: `${this.pathname}UP`,
               icon: {
                  type: 'iconFont',
                  iconClass: 'mdi-backup-restore text',
               },
               enabled: obj => {
                  if (!Config.get('here_are_dragons.updatePackages')) {
                     return false;
                  }
                  let name = get(obj, 'params.name');
                  return packagesManager.isInUserSettingPackages(name);
               },
               exectFunc: obj => {
                  if (!Config.get('here_are_dragons.updatePackages')) {
                     Logger.warn('updatePackages is disabled');
                     return false;
                  }
                  let name = get(obj, 'rule.params.name');
                  if (!name) return;
                  context.setPath({
                     path: `${this.pm_path.path}load`,
                     avoidHistory: true,
                  });
                  context.putLoader(`${this.pm_path.path}load`, 'Updating package');

                  packagesManager
                     .updatePackage(name)
                     .then(res => {
                        if (context.getPath().path === `${this.pm_path.path}load`) {
                           context.removeLoader(`${this.pm_path.path}load`);
                           context.setPath(this.pm_path);
                        }
                     })
                     .catch(res => {
                        if (context.getPath().path === `${this.pm_path.path}load`) {
                           context.removeLoader(`${this.pm_path.path}load`);
                           context.setPath(this.pm_path);
                        }
                     });
               },
            },
            {
               type: this.pathname,
               title: 'Edit Package Settings',
               id: `${this.pathname}EPS`,
               icon: {
                  type: 'iconFont',
                  iconClass: 'mdi-json text',
               },
               enabled: obj => {
                  let name = get(obj, 'params.name');
                  if (!packagesManager.isInUserSettingPackages(name)) {
                     return false;
                  }
                  let file = packagesManager.getPackcageSettingsFile(name);
                  return !!file;
               },
               exectFunc: obj => {
                  let name = get(obj, 'rule.params.name');
                  let file = packagesManager.getPackcageSettingsFile(name);
                  if (file) {
                     context.getDriveManager().openFile(file);
                  }
               },
            },
         ];
      },
      defineTypeViewers() {
         return [
            {
               type: this.pathname,
               title: 'Package Viewer',
               viewerComp: context.createViewerHtml({ geturl: rule => rule.params.openUrl }, (resolve, reject, rule) => {
                  let packName = get(rule, 'params.name');
                  if (!packName) {
                     reject();
                     return;
                  }

                  const version = rule.params.version;
                  const errorPackInstalled = rule.params.errorPackInstalled;
                  const description = get(rule.params, 'obj.package.description');
                  const username = get(rule.params, 'obj.package.author.username');

                  let moreData = '\n';
                  moreData += `**name:** ${packName}\n`;
                  if (version) moreData += `**version:** ${version}\n`;
                  if (description) moreData += `**description:** ${description}\n`;
                  if (username) moreData += `**username:** ${username}\n`;
                  if (errorPackInstalled) moreData += '**error:** ' + 'true' + '\n';
                  moreData += `**installed:** ${rule.params.installed}\n`;
                  if (rule.params.openUrl) moreData += `\n${rule.params.openUrl}\n`;

                  repositoryUrl(packName, (err, url) => {
                     //KTODO: Si está instalado usar local / usar packote y get
                     getPackageReadme(packName, (error, readme) => {
                        if (error || err || !url || !readme) {
                           resolve({
                              component: context.createComponentFromMarkDownElement(`## Unable to find a readme \n${moreData}`),
                              openUrl: String(get(rule, 'params.openUrl')),
                           });
                           return;
                        }

                        let urlGitHubBaseImg = `${url.replace('https://github.com', 'https://raw.githubusercontent.com')}/master`;

                        //KTODO: Cache
                        resolve({
                           component: context.createComponentFromMarkDownElement(`${readme}\n___\n${moreData}`, url, urlGitHubBaseImg),
                           openUrl: String(get(rule, 'params.openUrl')),
                        });
                     });
                  });
               }),
            },
         ];
      },
   };
};
