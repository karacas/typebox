'use strict';

module.exports.getTests = appContext => {
   return [
      {
         name: 'require iohook',
         options: {},
         callBack: async (tape, context) => {
            if (!true) {
               tape.ok(true);
               tape.end();
               return;
            }

            let iohook = null;

            try {
               iohook = appContext.require('iohook');
            } catch (e) {
               tape.error('NO iohook / ERROR:', e);
               appContext.logger.error('NO iohook / ERROR:', e, e.message, e.stack);
               tape.end();
               return;
            }

            // try {
            //    tape.ok(iohook && iohook.start);
            // } catch (e) {
            //    tape.error('NO iohook start / ERROR:', e);
            //    appContext.logger.error('NO iohook start / ERROR:', e, e.message, e.stack);
            // }

            // try {
            //    if (iohook && iohook.unload) {
            //       iohook.unload();
            //       delete require.cache['iohook'];
            //       tape.ok(true, 'UnloadOk');
            //    }
            // } catch (e) {}

            tape.end();
         },
      },
   ];
};
