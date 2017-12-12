'use strict';

const _ = require('lodash');
const request = require('superagent/superagent');
const noCache = require('superagent-no-cache');
require('superagent-cache')(request);
const marked = require('marked');
const getPackageReadme = require('get-package-readme');
const repositoryUrl = require('get-repository-url');
const Logger = require('../../logger.js');
const Config = require('../../config.js');
const packagesManager = require('../../packagesManager.js');
const ListViewStore = require('../../listViewStore.js');

module.exports = context => {
    return {
        config: {
            // urlq: 'https://api.npms.io/v2/search?from=0&q=keywords%3A+{{keyword}}&size=100',
            urlq: 'http://registry.npmjs.org/-/v1/search?text=keywords:{{keyword}}&size=100',
            urlOpen: 'https://www.npmjs.com/package/{{pack}}',
            debounceSearchSecs: 60,
            sortBy: 'order'
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
                    iconClass: 'mdi-package text'
                }
            };

            this.pathInstalled = {
                path: this.pathname + '-installed',
                sortBy: this.config.sortBy,
                checkNews: true,
                icon: {
                    type: 'iconFont',
                    iconClass: 'mdi-package text'
                }
            };

            this.pm_path = {
                path: 'package_options_menu',
                sortBy: this.config.sortBy,
                icon: this.path.icon
            };

            //Add main rule
            context.addPermanentRules([
                {
                    title: 'Installed Packages',
                    type: [this.pathname + '-root'],
                    path: this.pm_path.path,
                    icon: this.path.icon,
                    hidden_permit: false,
                    params: {
                        changePath: this.pathInstalled
                    }
                },
                {
                    title: 'Search available Packages',
                    type: [this.pathname + '-root'],
                    path: this.pm_path.path,
                    description: '[ command: sp! ]',
                    icon: {
                        type: 'iconFont',
                        iconClass: 'mdi-magnify text'
                    },
                    hidden_permit: false,
                    params: {
                        changePath: this.path
                    }
                },
                {
                    title: 'Update all Packages',
                    type: ['updatePackages', null],
                    hidden_permit: false,
                    last_permit: false,
                    path: this.pm_path.path,
                    icon: {
                        type: 'iconFont',
                        iconClass: 'mdi-backup-restore text'
                    }
                }
            ]);
            //Name to rule
            this.getRule = (namePack, $path, $obj) => {
                let obj = _.clone($obj);

                let installed = packagesManager.isInUserSettingPackages(namePack);
                let localJson = packagesManager.requierePackageJson(namePack);

                let installedStr = '';
                let remoteVersion = '';
                let insVersion = '';

                if (_.get(obj, 'package.version')) remoteVersion = ' ' + _.get(obj, 'package.version');
                if (installed) insVersion = ' ' + localJson.version;
                if (installed) installedStr = ' [ installed ' + insVersion + ' ]';

                let pack = {
                    title: namePack + ' ' + remoteVersion + installedStr,
                    path: $path,
                    addInHistory: false,
                    fav_permit: false,
                    hidden_permit: false,
                    last_permit: false,
                    icon: {
                        type: 'iconFont',
                        iconClass: 'mdi-package text'
                    },
                    params: {
                        name: namePack,
                        obj: obj,
                        openUrl:
                            _.get(obj, 'package.homepage') ||
                            _.get(obj, 'package.links.homepage') ||
                            _.get(obj, 'package.repository.url') ||
                            _.get(obj, 'package.repository') ||
                            this.config.urlOpen.replace('{{pack}}', namePack)
                    },
                    type: [this.pathname]
                };

                if (installed) pack.new_permit = false;

                return pack;
            };

            //Add result rules
            this.addFetchedRules = ($pck, pcktxt) => {
                if (context.getPath().path !== this.pathname) return;

                let packs = $pck.objects.map(obj => {
                    let namePack = _.get(obj, 'package.name');
                    if (obj && namePack && packagesManager.validatePackage(obj.package) && !namePack.includes('-dev')) {
                        return this.getRule(namePack, this.pathname, obj);
                    }
                });

                context.setRules(packs);
            };

            //fetch
            this.fetchRules = () => {
                //ERROR: Por acá no viene, no es el fetch
                let urlfetch = this.config.urlq.replace('{{keyword}}', 'typebox');
                let exp = this.config.debounceSearchSecs;
                request
                    .get(urlfetch)
                    .use(noCache)
                    .expiration(exp)
                    .then(res => {
                        setTimeout(() => {
                            this.addFetchedRules(res.body, 'typebox');
                        }, 10);
                    });
            };

            this.getInstalledPackagesRules = () => {
                let installedPackages = packagesManager.getSettingsPackages();
                let packs = [];
                installedPackages.map(pack => {
                    let obj = packagesManager.requierePackageJson(pack);
                    if (obj) packs.push(this.getRule(pack, this.pathInstalled.path, obj));
                });
                context.setRules(packs);
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
                if (txt === 'sp!' || txt === 'searchPackages!') {
                    context.setQuery('');
                    context.setPath(this.path);
                }
                if (txt === 'pm!' || txt === 'packageManager!') {
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
                    id: this.pathname + 'OCP',
                    enabled: obj => {
                        return false;
                    },
                    exectFunc: obj => {
                        context.placeExecutors(obj.rule);
                    }
                },
                {
                    type: 'updatePackages',
                    title: 'internal',
                    id: 'updatePackages OCP',
                    enabled: obj => {
                        return false;
                    },
                    exectFunc: obj => {
                        context.setPath({
                            path: this.pm_path.path + 'load',
                            avoidHistory: true
                        });
                        context.putLoader(this.pm_path.path + 'load', 'Check packages updates');
                        packagesManager
                            .updateAllPackages()
                            .then(res => {
                                if (context.getPath().path === this.pm_path.path + 'load') {
                                    if (!res || !res.length > 0) {
                                        setTimeout(() => {
                                            context.removeLoader(this.pm_path.path + 'load');
                                            context.setPath(this.pm_path);
                                        }, 0);
                                    }
                                }
                            })
                            .catch(res => {
                                context.removeLoader(this.pm_path.path + 'load');
                                context.setPath(this.pm_path);
                            });
                    }
                },
                {
                    type: this.pathname,
                    title: 'Install Package',
                    id: this.pathname + 'IP',
                    icon: {
                        type: 'iconFont',
                        iconClass: 'mdi-download text'
                    },
                    enabled: obj => {
                        let name = _.get(obj, 'params.name');
                        return !packagesManager.isInUserSettingPackages(name);
                    },
                    exectFunc: obj => {
                        let name = _.get(obj, 'rule.params.name');

                        context.setQuery('');
                        context.setPath({
                            path: this.pm_path.path + 'load',
                            avoidHistory: true
                        });
                        context.putLoader(this.pm_path.path + 'load', 'Check package updates');

                        packagesManager
                            .addPackage(name)
                            .then(() => {})
                            .catch(() => {
                                if (context.getPath().path === this.pm_path.path + 'load') {
                                    context.removeLoader('load');
                                    ListViewStore.storeActions.backRulesPath();
                                }
                            });
                    }
                },
                {
                    type: this.pathname,
                    title: 'Remove Package',
                    id: this.pathname + 'RP',
                    icon: {
                        type: 'iconFont',
                        iconClass: 'mdi-delete text'
                    },
                    enabled: obj => {
                        let name = _.get(obj, 'params.name');
                        return packagesManager.isInUserSettingPackages(name);
                    },
                    exectFunc: obj => {
                        let name = _.get(obj, 'rule.params.name');
                        context.setQuery('');
                        if (packagesManager.removePackage(name)) {
                            context.setPath({
                                path: this.pm_path.path + 'load',
                                avoidHistory: true
                            });
                            context.putLoader(this.pm_path.path + 'load', 'Removing package');
                        }
                    }
                },
                {
                    type: this.pathname,
                    title: 'Update Package',
                    id: this.pathname + 'UP',
                    icon: {
                        type: 'iconFont',
                        iconClass: 'mdi-backup-restore text'
                    },
                    enabled: obj => {
                        let name = _.get(obj, 'params.name');
                        return packagesManager.isInUserSettingPackages(name);
                    },
                    exectFunc: obj => {
                        let name = _.get(obj, 'rule.params.name');
                        if (!name) return;
                        context.setPath({
                            path: this.pm_path.path + 'load',
                            avoidHistory: true
                        });
                        context.putLoader(this.pm_path.path + 'load', 'Updating package');

                        packagesManager
                            .updatePackage(name)
                            .then(res => {
                                if (context.getPath().path === this.pm_path.path + 'load') {
                                    context.removeLoader(this.pm_path.path + 'load');
                                    context.setPath(this.pm_path);
                                }
                            })
                            .catch(res => {
                                if (context.getPath().path === this.pm_path.path + 'load') {
                                    context.removeLoader(this.pm_path.path + 'load');
                                    context.setPath(this.pm_path);
                                }
                            });
                    }
                },
                {
                    type: this.pathname,
                    title: 'Edit Package Settings',
                    id: this.pathname + 'EPS',
                    icon: {
                        type: 'iconFont',
                        iconClass: 'mdi-json text'
                    },
                    enabled: obj => {
                        let name = _.get(obj, 'params.name');
                        if (!packagesManager.isInUserSettingPackages(name)) {
                            return false;
                        }
                        let file = packagesManager.getPackcageSettingsFile(name);
                        return !!file;
                    },
                    exectFunc: obj => {
                        let name = _.get(obj, 'rule.params.name');
                        let file = packagesManager.getPackcageSettingsFile(name);
                        if (file) {
                            context.getDriveManager().openFile(file);
                        }
                    }
                }
            ];
        },
        defineTypeViewers() {
            return [
                {
                    type: this.pathname,
                    title: 'Package Viewer',
                    viewerComp: context.createViewerHtml({ geturl: rule => rule.params.openUrl }, (resolve, reject, rule) => {
                        let packName = _.get(rule, 'params.name');
                        if (!packName) return;

                        repositoryUrl(packName, (err, url) => {
                            getPackageReadme(packName, (error, readme) => {
                                if (error || err || !url || !readme) {
                                    resolve({
                                        component: context.createComponentFromHtml(404),
                                        openUrl: String(_.get(rule, 'params.openUrl'))
                                    });
                                    return;
                                }

                                let urlGitHubBaseImg = url.replace('https://github.com', 'https://raw.githubusercontent.com') + '/master';

                                //KTODO: Cache

                                resolve({
                                    component: context.createComponentFromMarkDown(readme, url, urlGitHubBaseImg),
                                    openUrl: String(_.get(rule, 'params.openUrl'))
                                });
                            });
                        });
                    })
                }
            ];
        }
    };
};
