'use strict';

const { $timeout } = require('@uitests/_aux_tests.js');

const getTapeTests = appContext => {
   let get = appContext.get;
   let _console = null;
   let timeout = false;

   if (appContext.isDev && appContext.isWin && process.stdout && process.stderr) {
      let nodeConsole = require('console');
      _console = new nodeConsole.Console(process.stdout, process.stderr);
   } else {
      _console = appContext.logger;
   }

   return [
      {
         name: 'check type something',
         options: {},
         callBack: async (tape, context) => {
            const removeListener = () => {
               context.renderEvent.removeListener('RENDER', onRender);
            };

            const onRender = async event => {
               const result = get(context.getLastviewEvent(), 'search_text');
               if (result === 'typebox') {
                  removeListener();
                  if (!timeout) {
                     timeout = true;
                     tape.ok(true, 'result is typebox');
                     tape.end();
                     _console = null;
                     return true;
                  }
               }
            };

            context.renderEvent.on('RENDER', onRender);

            await context.goBack();
            await context.keySequence(context.keyString2array('t,y,p,e,b,o,x'));

            await $timeout(6000);
            if (!timeout) {
               timeout = true;
               removeListener();
               tape.ok(false, get(context.getLastviewEvent(), 'search_text'));
               tape.end();
            }

            return true;
         },
      },
   ];
};

module.exports.getTests = appContext => {
   return [...getTapeTests(appContext)];
};
