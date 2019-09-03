'use strict';

const getTapeTests = appContext => {
   const { typeResult } = appContext.require('@uitests/_aux_tests_short_tapes.js');
   return [
      {
         name: 'calc 10!',
         options: {},
         callBack: async (tape, context) => {
            let inRender = false;
            return await typeResult(
               {
                  typeKeySequence: '1,0,!',
                  onRender: async ($event, end, rContext) => {
                     if (String(appContext.get($event, 'lastRuleSelected.title')).indexOf('10!') !== -1) {
                        if (!inRender) {
                           inRender = true;
                           const result = context.getLastviewEvent();
                           tape.ok(result.result_text.indexOf('3628800') !== -1, result.result_text);
                           await end();
                           return true;
                        }
                     }
                  },
               },
               tape,
               context,
               appContext
            );
         },
      },
   ];
};

module.exports.getTests = appContext => {
   return [...getTapeTests(appContext)];
};
