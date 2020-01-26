'use strict';

const getTapeTests = appContext => {
   // npx electron . --user_settings_file=_data_test/user/user_settings.json --tests=notes.js --chromiumConsole=false

   let hasPackNotes = appContext.packageEnabledByName('internal_pack_notes');
   if (!hasPackNotes) return [];

   let get = appContext.get;
   const { typeResult } = appContext.require('@uitests/_aux_tests_short_tapes.js');
   const cheerio = appContext.require('cheerio');

   return [
      {
         name: 'new note 2',
         options: {},
         callBack: async (tape, context) => {
            let foundTBN = false;

            return await typeResult(
               {
                  setPath: 'INTERNAL_PACK_NOTES',
                  intervalTToForceReRender: 100,
                  _name: 'notes2',
                  onRender: async ($event, end, rContext) => {
                     if (!foundTBN) {
                        const lastRuleTxt = String(appContext.get($event, 'lastRuleSelected.title')).toLowerCase();
                        const cherioDoc = cheerio.load(context.getLastviewEvent()._document);
                        const htmlHasTBN = cherioDoc('#TBN_main').length > 0;
                        const isTestSuite = !!appContext.config.get('here_are_dragons.testConfig.isTestSuite');

                        if (lastRuleTxt && htmlHasTBN) {
                           foundTBN = true;

                           if (isTestSuite) await tape.ok(cherioDoc('#listadoRules .ruleListCelda').length === 1, 'empty Notes');
                           await tape.ok(cherioDoc('#noteTitle').length > 0, 'hasTitle');
                           await tape.ok(cherioDoc('.CodeMirror').length > 0, 'hasCM');
                           await tape.ok(cherioDoc('.noteFooterBar').length > 0, 'noteFooterBar');

                           if (!true) {
                              tape.comment(`[1] / ${cherioDoc('#listadoRules .ruleListCelda').length}`);
                              tape.comment(`[2] / ${cherioDoc('.CodeMirror textarea').val().length}`);
                              tape.comment(`[3] / ${cherioDoc('#listadoRules').html()}`);
                           }

                           await end();
                           return true;
                        }
                     }

                     return false;
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
