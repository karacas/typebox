'use strict';

module.exports.getTests = appContext => {
   return [
      {
         name: 'require robotjs',
         options: {},
         callBack: async (tape, context) => {
            try {
               const robot = appContext.require('robotjs');
               tape.ok(!!robot.keyTap);
            } catch (e) {
               tape.error('NO ROBOT / ERROR:', e);
            }
            tape.end();
         },
      },
   ];
};
