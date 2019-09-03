'use strict';

const fs = require('fs');
const path = require('path');

module.exports = context => {
   const { result } = context.require('lodash');
   const lrucache = context.require('lru-cache');
   const { promisify } = context.require('util');
   const InlineWorker = context.require('inline-worker');
   const $pause = time => new Promise(res => setTimeout(res, time || 1));

   let cheerio = null;
   let got = null;

   let cache_html_dict = new lrucache({ max: 32, maxAge: 60 * 60 * 1000 });

   return {
      config: {
         dictArr: './dicts/fs_rae_lemario_2002.js',
         urlRae: 'http://dirae.es./palabras/{{term}}',
         urlRaeViewer: 'http://www.wordreference.com/definicion/{{term}}',
         urlRaeViewerBase: 'http://www.wordreference.com',
         viewerEnabled: true,
         viewerType: 'html', //webView or html
         expander: ['dic', 'rae'],
         iconRaeSvg:
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><path fill='#FF7043' d='M38 44H12V4h26c2.2 0 4 1.8 4 4v32c0 2.2-1.8 4-4 4'/><path fill='#BF360C' d='M10 4h2v40h-2c-2.2 0-4-1.8-4-4V8c0-2.2 1.8-4 4-4'/><path fill='#E64A19' d='M37 15H17v-4h20v4zm0 2H17v2h20v-2z'/></svg>",
      },
      init() {
         const raeIcon = {
            type: 'iconSvg',
            iconData: this.config.iconRaeSvg,
         };

         const raeIconWord = {
            type: 'iconFont',
            iconClass: 'mdi-book palette-Deep-Orange-A200 small_ico text',
         };

         //Add main rule
         context.addPermanentRules([
            {
               title: 'Diccionario Castellano DEV',
               type: ['RAEroot_DEV'],
               icon: raeIcon,
               expander: this.config.expander,
               params: {
                  changePath: {
                     name: 'Diccionario Castellano',
                     path: 'RAE_PATH_DEV',
                  },
               },
            },
         ]);

         let parseworker = null;
         const asyncparse = (data, openUrl, icon) => {
            let self = {};
            parseworker =
               parseworker ||
               new InlineWorker(function(self) {
                  self.onmessage = e => {
                     postMessage(self._make(e.data));
                     setTimeout(() => {
                        if (true) self.close();
                     }, 1000);
                  };
                  self._make = function(params) {
                     if (!params || !params.data) return null;

                     params.data = JSON.parse(params.data);

                     if (!params.data || !Array.isArray(params.data)) return null;

                     return params.data.map(termino => {
                        return {
                           title: termino,
                           path: 'RAE_PATH_DEV',
                           addInHistory: false,
                           icon: params.icon || null,
                           type: ['RAE_DEV', 'string'],
                           params: {
                              openUrl: String(params._openUrl || null).replace('{{term}}', encodeURI(termino)),
                           },
                        };
                     });
                  };
               }, self);

            return new Promise(res => {
               parseworker.onmessage = e => {
                  setTimeout(() => {
                     if (true && parseworker) parseworker = undefined;
                  }, 0);
                  return res(e.data);
               };
               parseworker.postMessage({ data, openUrl, icon });
            });
         };

         //Add asyunc rules
         this.pushRules = async () => {
            context.putLoader('RAE_PATH_DEV');

            const time = new Date();
            const fileData = path.join(context.packsUtils.aux_getDirName(__dirname), '/', this.config.dictArr);

            let data = await promisify(fs.readFile)(fileData, 'utf8');

            if (!data) {
               context.removeLoader('RAE_PATH_DEV');
               context.logger.error(err);
               return;
            }

            data = await asyncparse(data, this.config.urlRae, raeIconWord);

            if (!data) {
               context.removeLoader('RAE_PATH_DEV');
               context.logger.error(err);
               return;
            }

            context.addPermanentRules(data);

            context.clean_array(data);
            context.logger.info('RAE PUT RULES ms:', new Date() - time);
            context.removeLoader('RAE_PATH_DEV');
            data.length = 0;
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
            let cache = cache_html_dict.get(rule.id);
            if (cache) {
               resolve(cache);
               return;
            }

            //KTODO: Que no de error si la url no existe
            got = got || context.require('got');

            got(this.config.urlRaeViewer.replace('{{term}}', encodeURI(rule.title)), { useElectronNet: false })
               .then(html => {
                  cheerio = cheerio || context.require('cheerio');
                  let $ = cheerio.load(
                     cheerio
                        .load(html.body)('body #article')
                        .html()
                  );

                  $('.small1, .FTlist, #FTintro').remove();

                  $ = cheerio.load(context.aux_webManager.sanitizeHtml($.html()));
                  $ = cheerio.load(context.aux_webManager.replaceHtmlHrefs($.html(), this.config.urlRaeViewerBase));

                  let data = {
                     component: Object(context.createComponentFromHtml(`<h1>${rule.title}</h1>${$.html()}`), { extraClass: '__maxViewWidth' }),
                     openUrl: String(result(rule, 'params.openUrl')),
                  };
                  cache_html_dict.set(rule.id, data);
                  resolve(data);
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
               extraHeaders: 'Cache-Control: public, max-age=360000\n ',
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
                    }`,
         });

         let viewerRes = [];

         if (this.config.viewerEnabled) {
            viewerRes.push({
               type: 'RAE_DEV',
               title: 'Viewer Rae _DEV',
               useBlend: false,
               viewerComp: viewerComp[this.config.viewerType],
            });
         }
         return viewerRes;
      },
   };
};
