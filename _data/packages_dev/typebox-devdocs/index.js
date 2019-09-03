'use strict';
const fs = require('fs');
const path = require('path');

const iconDevDocs =
   'data:image/png;base64,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';

const _aux_flatten = arr => {
   return arr.reduce(function(a, b) {
      return a.concat(b);
   }, []);
};

const _aux_name2slug = name => {
   let index = name.indexOf('~');
   if (index == -1) return name;
   return name.substring(0, index).toLowerCase();
};

const _aux_autoScroll = rule => {
   if (!rule || !rule.params || !rule.params.openUrlDoc) return;
   let url = rule.params.openUrlDoc;
   let hshWB = url.substring(url.indexOf('#') + 1);
   if (hshWB && hshWB.length > 0) {
      let hshWBel = document.getElementById(hshWB);
      if (hshWBel) hshWBel.scrollIntoView();
   }
};

const config = {
   url_docs: 'https://devdocs.io/docs/docs.json',
   url_docsBaseSite: 'https://devdocs.io/',
   url_plainDocsBase: 'https://docs.devdocs.io/',
   viewerEnabled: true,
   viewerType: 'internal', //web
   debounceTime_viewer: 760,
   installedDocs: ['moment', 'react', 'lodash~4', 'angularjs~1.6', 'bootstrap~4', 'html', 'jquery', 'css', 'javascript'],
};

module.exports = context => {
   const { result } = context.require('lodash');
   const get = context.get;
   const sub = context.makeHash;
   const icons = require('./icons/index.js');
   let got = null;

   return {
      config,
      init() {
         this._aux_getIconSlug = slug => {
            slug = _aux_name2slug(slug.toLowerCase());
            if (icons[slug]) {
               if (icons[slug].includes('_iconfont')) {
                  return icons[slug];
               }
               let pathIcon = path.join(context.getDir(__dirname), 'icons', icons[slug]);
               return context.packsUtils.iconFile2icontype(pathIcon);
            }
            return null;
         };

         this._aux_getUtlDoc = (slug, obj) => {
            return `${this.config.url_plainDocsBase + slug}/${!obj.path.includes('#') ? `${obj.path}.html` : obj.path.replace('#', '.html#')}`.replace(
               '..h',
               '.ht'
            );
         };

         //CREATE RULES 4 DOCS
         this._aux_obj2rule = (slug, obj) => {
            let _slug = _aux_name2slug(slug.toLowerCase());
            return {
               title: obj.name,
               icon: this._aux_getIconSlug(slug),
               description: slug,
               path: 'DEVDOCS_PATH',
               type: ['DEVDOC_entry'],
               searchField: `${_slug} ${obj.name}`,
               params: {
                  openUrlDoc: this._aux_getUtlDoc(slug, obj),
                  openUrl: `${this.config.url_docsBaseSite + slug}/${obj.path.replace('index', '')}`,
                  slug: _slug,
                  path: obj.path,
                  objDoc: obj,
               },
            };
         };

         this.pushDocRules2Install = () => {
            context.deleteRules();
            context.putLoader('DEVDOCS_PATH_INSTALL');
            got = got || context.require('got');
            got(this.config.url_docs).then(res => {
               if (!res || !res.body || !res.body.length) {
                  //KTODO: alert
                  return;
               }
               let packDocs = res.body.map(obj => {
                  if (obj && (!obj.version || (obj.version && obj.version !== ''))) {
                     let title = obj.name;

                     if (obj.version && obj.version.length) {
                        title += ` (${obj.version})`;
                     } else if (obj.release && obj.release.length) {
                        title += ` (${obj.release})`;
                     }

                     let installed = this.config.installedDocs.includes(obj.slug || obj.type);
                     let searchField = title;
                     title += installed ? ' [installed]' : '';

                     return {
                        title: title,
                        searchField: searchField,
                        specialScoreMult: installed ? 1 : 1,
                        icon: this._aux_getIconSlug(obj.slug.toLowerCase()),
                        path: 'DEVDOCS_PATH_INSTALL',
                        type: ['DEVDOC_SLUG'],
                        addInHistory: false,
                        fav_permit: false,
                        hidden_permit: false,
                        last_permit: false,
                        params: {
                           obj: obj,
                        },
                     };
                  }
               });
               setTimeout(() => {
                  packDocs.sort(function(a, b) {
                     if (a.title < b.title) return -1;
                     if (a.title > b.title) return 1;
                     return 0;
                  });
                  context.setRules(packDocs);
               }, 64);
            });
         };

         this.pushDocSlugRule = (slug, save = false) => {
            return new Promise((resolve, reject) => {
               got = got || context.require('got');

               got(`${this.config.url_plainDocsBase + slug}/index.json`, { json: true })
                  .then(res => {
                     if (!res || !res.body || !res.body.entries || !res.body.entries.length) {
                        resolve([]);
                        //KTODO: alert
                     } else {
                        resolve(res.body.entries.map(obj => this._aux_obj2rule(slug, obj)));
                     }
                  })
                  .catch(e => {
                     resolve([]);
                  });
            });
         };

         this.pushDocSlugRules = (slug, save = false) => {
            context.deleteRules();
            context.putLoader('DEVDOCS_PATH');
            Promise.all(this.config.installedDocs.map(slug => this.pushDocSlugRule(slug, true))).then(rules => {
               setTimeout(() => {
                  context.setRules(_aux_flatten(rules));
               }, 64);
            });
         };

         context.on('changePath', path => {
            if (path === 'DEVDOCS_PATH_INSTALL') {
               this.pushDocRules2Install();
            }
         });

         context.on('changePath', path => {
            if (path === 'DEVDOCS_PATH') {
               this.pushDocSlugRules();
            }
         });

         context.addPermanentRules([
            {
               title: 'Dev Docs',
               type: ['DEVDOCroot'],
               icon: iconDevDocs,
               params: { changePath: { name: 'Dev Docs', path: 'DEVDOCS_PATH' } },
            },
            {
               title: 'Manage Dev Docs',
               path: 'DEVDOCS_PATH',
               type: ['DEVDOCroot'],
               initSort: 15,
               posFixed: 1,
               icon: { type: 'iconFont', iconClass: 'octicon-settings palette-Amber-A200 text' },
               params: { changePath: { name: 'Manage Dev Docs', path: 'DEVDOCS_PATH_OPT' } },
            },
            {
               title: 'All Dev Docs',
               path: 'DEVDOCS_PATH_OPT',
               type: ['DEVDOCroot'],
               icon: { type: 'iconFont', iconClass: 'mdi-plus-box text' },
               params: { changePath: { name: 'Install Dev Docs', path: 'DEVDOCS_PATH_INSTALL' } },
            },
            {
               title: 'Enabled Dev Docs',
               path: 'DEVDOCS_PATH_OPT',
               type: ['DEVDOCroot'],
               icon: { type: 'iconFont', iconClass: 'mdi-note-multiple text' },
               params: { changePath: { name: 'Install Dev Docs', path: 'DEVDOCS_PATH_INSTALL' } },
            },
         ]);
      },
      defineTypeExecutors(obj) {
         this.addPlugin = obj => {
            this.config.installedDocs.push(get(obj.rule, 'params.obj.slug'));
            this.pushDocRules2Install();
         };
         this.removePlugin = obj => {
            this.config.installedDocs = this.config.installedDocs.filter(e => e !== get(obj.rule, 'params.obj.slug'));
            this.pushDocRules2Install();
         };
         this.checkInstalled = obj => {
            return !this.config.installedDocs.includes(result(obj, 'params.obj.slug'));
         };
         return [
            {
               type: 'DEVDOC_SLUG',
               title: 'Enable Doc',
               id: `${this.pathname}IDOC`,
               icon: { type: 'iconFont', iconClass: 'mdi-plus-box text' },
               enabled: obj => {
                  return this.checkInstalled(obj);
               },
               exectFunc: obj => {
                  //KTODO: que el resto del obj venga en un segundo parámetro, ej: rule, objCOMPLETE así la api es igual para enabled y exectFunc
                  if (this.checkInstalled(obj.rule)) {
                     this.addPlugin(obj);
                  } else {
                     this.removePlugin(obj);
                  }
               },
            },
            {
               type: 'DEVDOC_SLUG',
               title: 'Disable Doc',
               id: `${this.pathname}IDOC_RMV`,
               icon: { type: 'iconFont', iconClass: 'mdi-delete text' },
               enabled: obj => {
                  return !this.checkInstalled(obj);
               },
               exectFunc: obj => {
                  this.removePlugin(obj);
               },
            },
         ];
      },
      defineTypeViewers() {
         const viewerComp = {};

         viewerComp.internal = context.createViewerHtml(
            { geturl: rule => rule.params.openUrlDoc, debounceTime_viewer: this.config.debounceTime_viewer },
            (resolve, reject, rule) => {
               //KTODO: Que no de error si la url no existe

               got = got || context.require('got');

               got(encodeURI(rule.params.openUrlDoc))
                  .then(html => {
                     const idRule = sub(rule.id || 'null');

                     resolve({
                        component: Object(
                           context.createComponentFromHtml(
                              `<div id="iFrameView" class="frameInLoad"><Loading></Loading><div class="webview markdownView" style="overflow-x: hidden;" id="contentCodeDocs${idRule}">${html.body}</div></div>`
                           )
                        ),
                        openUrl: String(result(rule, 'params.openUrl')),
                        executeJavaScript: () => {
                           /*highlight*/
                           let placeInner = (response, idRule) => {
                              if (!response || sub(rule.id) !== idRule) return;
                              let contentCodeDocs = document.querySelector(`#contentCodeDocs${idRule}`);
                              if (!contentCodeDocs) return;
                              contentCodeDocs.innerHTML = response;
                              _aux_autoScroll(rule);
                              let iFrameView = document.querySelector('#iFrameView');
                              if (iFrameView) iFrameView.classList.remove('frameInLoad');
                              if (iFrameView) iFrameView.classList.add('frameLoaded');
                           };

                           let codeDocs = document.querySelector(`#contentCodeDocs${idRule}`);
                           if (!codeDocs || !codeDocs.innerHTML) return;
                           let inner = codeDocs.innerHTML;

                           context.highlight(String(codeDocs.innerHTML), 'pre', ['untouched']).then(response => {
                              placeInner(response, idRule);
                           });
                        },
                     });
                  })
                  .catch(e => reject(e));
            }
         );

         viewerComp.web = context.createViewerWebView({
            geturl: rule => rule.params.openUrl,
            openDevTools: false,
            webviewConfig: {
               useragent: 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0',
               extraHeaders: 'Cache-Control: public, max-age=360000\n ',
            },
            executeJavaScript: `
                                let hshWB = String(location.hash).replace('#', '');
                                if (hshWB && hshWB.length > 0) {

                                    let hshWBel = document.getElementById(hshWB);
                                    if (hshWBel) hshWBel.scrollIntoView();

                                    let _contWB1 = document.getElementsByClassName('_content')[0]
                                    if (_contWB1) _contWB1.scrollTop -= 12;

                                    let _contWB2 = document.getElementsByTagName('html')[0]
                                    if (_contWB2) _contWB2.scrollTop -= 12;
                                }
                                if (false) $('body').prepend(Math.round(Math.random()*100));
                            `,
            insertCSS: `
                            ._header, ._notice, ._sidebar, ._path {display:none !important;}
                            ._container {margin: 0 !important;}
                            ._page {padding: 0px !important; width: auto !important;}
                            ._mobile ._container {padding: 0 !important;}
                            /**/
                            ._sidebar-footer-link._sidebar-footer-layout {display: none; }
                            ._sidebar-footer-link._sidebar-footer-light {display: none; }
                            nav._nav {display: none; }
                            `,
         });

         let viewerRes = [];

         if (this.config.viewerEnabled) {
            viewerRes.push({
               type: 'DEVDOC_entry',
               title: 'DEV DOCS Viewer',
               useBlend: false,
               viewerComp: viewerComp[this.config.viewerType],
            });
         }

         return viewerRes;
      },
   };
};
