'use strict';

const _ = require('lodash');
const fetch = require('node-fetch');
const marked = require('marked');
const getPackageReadme = require('get-package-readme');
const repositoryUrl = require('get-repository-url');
const Logger = require('../../logger.js');

module.exports = {
    config: {
        // urlq: "http://node-modules.com/search.json?q=+{{packaNameStr}}+&limit=50",
        urlq: 'https://api.npms.io/v2/search?from=0&q=keywords%3A+{{packaNameStr}}&size=100',
        urlOpen: 'https://www.npmjs.com/package/{{pack}}',
        debounceSearch: 600,
        sortBy: 'order'
    },
    init() {
        //Store last search
        this.lastRuleText = null;

        //Add main rule
        this.app.addPermanentRules([
            {
                title: 'Search Packages',
                type: ['npm-package-plugin-root'],
                path: 'package_options_menu',
                description: '[ command: sp! ]',
                icon: {
                    type: 'iconFont',
                    iconClass: 'mdi-package text'
                },
                params: {
                    changePath: {
                        path: 'npm-package-plugin',
                        sortBy: this.config.sortBy
                    }
                }
            }
        ]);

        //Add result rules
        this.addRules = (pck, pcktxt) => {
            var pck = pck.results;
            if (this.lastRuleText === pcktxt) {
                let packs = [];
                for (let i = 0; i < pck.length; i++) {
                    let obj = pck[i];
                    if (!String(obj.package.name).match(/^@/)) {
                        packs.push({
                            title: obj.package.name,
                            persistFuzzy: true,
                            path: 'npm-package-plugin',
                            order: obj.score.detail.popularity * -1,
                            params: {
                                obj: obj,
                                openUrl: _.result(obj, 'package.homepage') ||
                                    _.result(obj, 'package.links.homepage') ||
                                    _.result(obj, 'package.repository.url') ||
                                    _.result(obj, 'package.repository') ||
                                    this.config.urlOpen.replace('{{pack}}', obj.package.name)
                            },
                            type: ['npm-package-plugin', 'string']
                        });
                    }
                }
                this.app.setRules(packs);
            }
        };

        //fetch
        this.fetchRules = _.debounce($txt => {
            if (this.lastRuleText === $txt) {
                let urlfetch = this.config.urlq.replace('{{packaNameStr}}', $txt);
                fetch(urlfetch).then(res => res.json()).then(resJ => this.addRules(resJ, $txt));
            }
        }, this.config.debounceSearch);

        //Search change
        this.onSearchChange = txt => {
            if (this.app.getPath().path === 'npm-package-plugin') {
                this.lastRuleText = txt;
                this.app.putLoader('npm-package-plugin');
                this.fetchRules(txt);
            }
        };

        //Events Search change
        this.app.on('changeQuery', this.onSearchChange);
        this.app.on('changePath', path => {
            this.onSearchChange('');
        });
    },
    defineTypeExecutors() {
        return [
            {
                type: 'npm-package-plugin',
                title: 'Open Options',
                enabled: obj => {
                    return false;
                },
                exectFunc: obj => {
                    let termino = obj.rule.title;
                    this.app.placeExecutors(obj.rule);
                }
            },
            {
                type: 'npm-package-plugin',
                title: 'Install Package',
                icon: {
                    type: 'iconFont',
                    iconClass: 'mdi-package-down small_ico'
                },
                exectFunc: obj => {
                    let termino = obj.rule.title;
                    //KTODO: INTALL [WIP]
                    Logger.log(termino);
                }
            }
        ];
    },
    defineTypeViewers() {
        return [
            {
                type: 'npm-package-plugin',
                title: 'Package Viewer',
                viewerComp: this.app.createViewerHtml((resolve, reject, rule) => {
                    let packName = _.result(rule, 'params.obj.package.name');
                    if (!packName) return;

                    repositoryUrl(packName, (err, url) => {
                        getPackageReadme(packName, (error, readme) => {
                            if (error || err || !url || !readme) {
                                resolve({
                                    component: this.app.createComponentFromHtml('<div>' + 404 + '</div>'),
                                    openUrl: String(_.result(rule, 'params.openUrl'))
                                });
                                return;
                            }

                            let html = marked(readme);
                            let urlGitHubBaseImg = url.replace('https://github.com', 'https://raw.githubusercontent.com') + '/master';

                            html = this.app.aux_webManager.replaceHtmlSrc(html, urlGitHubBaseImg);
                            html = this.app.aux_webManager.replaceHtmlHrefs(html, url);

                            //KTODO: Cache

                            resolve({
                                component: this.app.createComponentFromHtml("<div class='markdownView'>" + html + '</div>'),
                                openUrl: String(_.result(rule, 'params.openUrl'))
                            });
                        });
                    });
                })
            }
        ];
    }
};
