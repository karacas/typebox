const typeResult = async (opt = {}, tape, context, appContext) => {
   let cheerio = appContext.require('cheerio');
   let get = appContext.get;
   let _console = null;
   let timeout = false;
   /**/
   let htmlRes = null;
   let htmlLastRes = null;
   let doc = null;
   let expectedHtml = null;
   let counter = 0;
   let nodeConsole = null;
   let end = false;
   let intervalRerender = null;

   if (appContext.isDev && appContext.isWin && process.stdout && process.stderr) {
      nodeConsole = nodeConsole || require('console');
      _console = new nodeConsole.Console(process.stdout, process.stderr);
   } else {
      _console = appContext.logger;
   }

   const removeListener = () => {
      context.renderEvent.removeListener('RENDER', onRender);
   };

   const removeInterval = () => {
      if (intervalRerender) {
         clearInterval(intervalRerender);
         intervalRerender = null;
      }
   };

   const _end = async () => {
      timeout = true;
      removeInterval();
      removeListener();

      await context.timeout(100);
      if (!opt.avoidGoBack) await context.goBack();
      await tape.end();

      _console = null;
      nodeConsole = null;
      get = null;
      cheerio = null;

      return true;
   };

   if (opt == {} || !tape || !context || !appContext) {
      tape.ok(false, 'insufficient args');
      return await _end();
   }

   const _onRender = async event => {
      if (!timeout) {
         const result = context.getLastviewEvent();

         if (!result) {
            await tape.ok(false, 'No result');
            return await _end();
         }

         doc = result._document;
         if (!doc) {
            await tape.ok(false, 'No document');
            return await _end();
         }

         if (cheerio && opt.elHtml) {
            try {
               htmlRes = cheerio
                  .load(doc)(opt.elHtml || 'div')
                  .eq(0)
                  .html();
               if (htmlRes && htmlRes.length) htmlLastRes = htmlRes;
            } catch (e) {
               await tape.ok(false, ['error', e]);
               if (!appContext.isDev) appContext.logger.warn(e, counter, opt.elHtml, doc);
               return await _end();
            }
         }

         if (opt.expectedHtml) {
            expectedHtml = opt.expectedHtml;

            if (opt.whitOutSpaces) {
               if (htmlRes) htmlRes = htmlRes.replace(/\s/g, '');
               if (expectedHtml) expectedHtml = expectedHtml.replace(/\s/g, '');
            }

            if (opt.toLowerCase) {
               if (htmlRes) htmlRes = htmlRes.toLowerCase();
               if (expectedHtml) expectedHtml = expectedHtml.toLowerCase();
            }

            if (opt.verbose && opt.expectedHtml && _console.log) _console.log(htmlRes, counter, expectedHtml);

            if (!end && opt.expectedHtml && (htmlRes || '').indexOf(expectedHtml) !== -1) {
               end = true;
               tape.plan(1);
               await tape.ok(true, 'expectedHtml ok');
               return await _end();
            }
         }

         counter++;
      }
   };

   const onRender = opt.onRender ? async $event => await opt.onRender($event, _end, { log: _console.log }) : _onRender;

   context.renderEvent.on('RENDER', onRender);

   if (opt.typeKeySequence) {
      if (!opt.avoidGoBack) await context.goBack();
      await context.keySequence(context.keyString2array(opt.typeKeySequence));
   } else if (opt.setPath) {
      if (!opt.avoidGoBack) await context.goBack();
      appContext.setPath(opt.setPath);
   }

   if (opt.timeToForceReRender) {
      await context.timeout(opt.timeToForceReRender);
      context.renderEvent.emit('MAIN_FORCE_UPDATE');
   }

   if (opt.intervalTToForceReRender && !intervalRerender) {
      intervalRerender = setInterval(() => {
         if (!timeout) context.renderEvent.emit('MAIN_FORCE_UPDATE');
      }, opt.intervalTToForceReRender);
   }

   await context.timeout(opt.timeout || 5000);

   if (!timeout) {
      context.renderEvent.emit('MAIN_FORCE_UPDATE');
      tape.comment('mhhh... long wait try re-render');
      await context.timeout(1000);
   }

   if (!timeout) {
      //FAIL
      tape.ok(false, [
         'timeout / not found ',
         ' / res: ',
         htmlLastRes,
         ' / exp: ',
         expectedHtml,
         opt.verbose || true ? '/ doc: ' : '',
         opt.verbose || true ? doc : '',
         '/ counter: ',
         counter,
      ]);
      return await _end();
   }

   return true;
};

module.exports = {
   typeResult,
};

/* EXAMPLE */
/*

'use strict';
const getTapeTests = appContext => {
   const { typeResult } = appContext.require('@uitests/_aux_tests_short_tapes.js');
   return [
      {
         name: 'TEST JSX',
         options: {},
         callBack: async (tape, context) => {
            return await typeResult(
               {
                  typeKeySequence: 'T,T,B,0,0,1,J,S,X',
                  expectedHtml: 'test TTB001JSX ok!',
                  elHtml: '#ruleViewerWrapp',
                  timeout: 10000,
                  whitOutSpaces: true,
               },
               tape,
               context,
               appContext
            );
         },
      },
   ];
};

module.exports = appContext => [...getTapeTests(appContext)];

*/
