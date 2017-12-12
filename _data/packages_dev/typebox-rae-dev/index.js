'use strict';

const fs = require('fs');
const path = require('path');

module.exports = context => {
    const _ = context.require('lodash');
    const cheerio = context.require('cheerio');
    const request = context.require('superagent/superagent');
    let noCache = context.require('superagent-no-cache');
    context.require('superagent-cache')(request);

    return {
        config: {
            dictArr: './dicts/fs_rae_lemario_2002.js',
            urlRae: 'http://dirae.es./palabras/{{term}}',
            urlRaeViewer: 'http://www.wordreference.com/definicion/{{term}}',
            urlRaeViewerBase: 'http://www.wordreference.com',
            viewerEnabled: true,
            viewerType: 'html', //webView or html
            iconRaeSvg:
                "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><path fill='#FF7043' d='M38 44H12V4h26c2.2 0 4 1.8 4 4v32c0 2.2-1.8 4-4 4'/><path fill='#BF360C' d='M10 4h2v40h-2c-2.2 0-4-1.8-4-4V8c0-2.2 1.8-4 4-4'/><path fill='#E64A19' d='M37 15H17v-4h20v4zm0 2H17v2h20v-2z'/></svg>"
        },
        init() {
            const raeIcon = {
                type: 'iconSvg',
                iconData: this.config.iconRaeSvg
            };

            const raeIconWord = {
                type: 'iconFont',
                iconClass: 'mdi-book palette-Deep-Orange-A200 small_ico text'
            };

            //Add main rule
            context.addPermanentRules([
                {
                    title: 'Diccionario Castellano DEV',
                    type: ['RAEroot_DEV'],
                    icon: raeIcon,
                    params: {
                        changePath: {
                            name: 'Diccionario Castellano',
                            path: 'RAE_PATH_DEV'
                        }
                    }
                }
            ]);

            //Add asyunc rules
            this.pushRules = () => {
                context.putLoader('RAE_PATH_DEV');
                setTimeout(() => {
                    fs.readFile(path.join(context.packsUtils.aux_getDirName(__dirname), this.config.dictArr), 'utf8', (err, data) => {
                        if (err) {
                            context.removeLoader('RAE_PATH_DEV');
                            context.logger.error(err);
                            return;
                        }

                        let fsraedict;

                        try {
                            fsraedict = JSON.parse(data);
                        } catch (e) {
                            context.removeLoader('RAE_PATH_DEV');
                            context.logger.error(e);
                            return;
                        }

                        context.addPermanentRules(
                            fsraedict.map(termino => {
                                return {
                                    title: termino,
                                    path: 'RAE_PATH_DEV',
                                    addInHistory: false,
                                    icon: raeIconWord,
                                    type: ['RAE_DEV', 'string'],
                                    params: {
                                        openUrl: this.config.urlRae.replace('{{term}}', encodeURI(termino))
                                    }
                                };
                            })
                        );

                        context.removeLoader('RAE_PATH_DEV');
                    });
                }, 10);
            };

            context.on('changePath', path => {
                if (path === 'RAE_PATH_DEV') {
                    this.pushRules();
                    this.pushRules = () => null; /*ONLY ONCE*/
                }
            });
        },
        defineTypeViewers() {
            const viewerComp = {};

            //HTML
            viewerComp.html = context.createViewerHtml({ geturl: rule => rule.params.openUrl }, (resolve, reject, rule) => {
                //KTODO: Que no de error si la url no existe
                request
                    .get(this.config.urlRaeViewer.replace('{{term}}', encodeURI(rule.title)))
                    .use(noCache)
                    .expiration(60 * 60)
                    .then(html => {
                        let $ = cheerio.load(
                            cheerio
                                .load(html.text)('body #article')
                                .html()
                        );

                        $('.small1, .FTlist, #FTintro').remove();

                        $ = cheerio.load(context.aux_webManager.sanitizeHtml($.html()));
                        $ = cheerio.load(context.aux_webManager.replaceHtmlHrefs($.html(), this.config.urlRaeViewerBase));

                        resolve({
                            component: Object(context.createComponentFromHtml('<h2>' + rule.title + '</h2>' + $.html())),
                            openUrl: String(_.result(rule, 'params.openUrl'))
                        });
                    })
                    .catch(e => {
                        reject(e);
                    });
            });

            //WEBVIEW
            viewerComp.webView = context.createViewerWebView({
                geturl: rule => rule.params.openUrl,
                webviewConfig: {
                    useragent: 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0',
                    extraHeaders: 'Cache-Control: public, max-age=360000\n '
                },
                insertCSS: `
                    .logo, #searchform, .word-button{
                        display:none!important
                    }
                    h1.lemma {
                        margin: 15px 0 10px 0!important;
                    }
                    #footer{
                        display:none!important;
                    }`
            });

            let viewerRes = [];

            if (this.config.viewerEnabled) {
                viewerRes.push({
                    type: 'RAE_DEV',
                    title: 'Viewer Rae _DEV',
                    useBlend: false,
                    viewerComp: viewerComp[this.config.viewerType]
                });
            }
            return viewerRes;
        }
    };
};
