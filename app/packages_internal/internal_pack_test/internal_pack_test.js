'use strict';

const { aux_getDirName, normalicePath, get } = require('@aux/aux_global.js');
const $timeout = ms => new Promise(res => setTimeout(res, ms));

const Config = require('@render/config.js');

module.exports = context => {
   const makeTests = $testFiles => {
      let testFiles = $testFiles || Config.get('tests');

      if (!testFiles || !testFiles.length) return;

      testFiles = testFiles.split(',');

      let tapeTests = [];
      testFiles.forEach(obj => {
         try {
            //KTODO: Que pueda tomar el path completo y no lo joinee
            let tapeTestFile = obj.indexOf('/') === -1 ? normalicePath(Config.get('here_are_dragons.testConfig.testsPath') + obj, false) : obj;

            let tapeTest = require(tapeTestFile).getTests ? require(tapeTestFile).getTests(context) : require(tapeTestFile)(context);

            tapeTests = [...tapeTest];
         } catch (e) {
            context.logger.warn('[internal_pack_test.js] error:', e);
         }
      });

      if (tapeTests && tapeTests.length) {
         context.addTapeTests(tapeTests);
      }
   };

   const _makeTests = () => {
      context.logger.log('[makeTests]');

      try {
         context.setQuery('');
         context.setPath('/');
      } catch (e) {
         context.logger.error(e);
      }

      try {
         context.resetTapeTests();
      } catch (e) {
         context.logger.error(e);
      }

      try {
         makeTests('all.js');
      } catch (e) {
         context.logger.error(e);
      }

      setTimeout(() => {
         try {
            context.viewEvents.emit('RUN_TESTS');
         } catch (e) {
            context.logger.error(e);
         }
      }, 24);
   };

   return {
      init() {
         if (true && Config.get('here_are_dragons.testConfig.canRunTests')) makeTests();

         //KTODO: Que prod ejecute los tests con commando y con menú #213123

         context.on('changeQuery', txt => {
            if (txt.length > 256) return;
            if (!txt.match(/\!$/)) return;

            if (txt === 't!') {
               _makeTests();
               return;
            }

            if (txt.toLowerCase() === 'q!') {
               if (Config.isDev) {
                  context.quit();
               } else {
                  context.closeDevTools();
                  context.setQuery('');
                  context.setPath('/');
                  context.hide();
               }
               return;
            }
         });

         context.addPermanentRules([
            /*MOVER A DEV*/
            {
               title: 'Run all tests',
               type: ['test_object_run'],
               path: 'internal_pack_aux_dev',
               icon: {
                  iconClass: 'fe-chevron-right text',
               },
               params: {
                  action: 'runa_all_test',
               },
            },
         ]);

         if (Config.dev) {
            //KTODO: Que prod ejecute los tests con commando y con menú #213123
            context.addPermanentRules([
               /*MOVER A DEV*/
               {
                  title: 'Async Test',
                  type: ['test_object'],
               },
            ]);

            context.on('changeQuery', txt => {
               context.logger.log('[TEST] changeQuery:', txt);
               if (txt === 'qq!') {
                  context.setQuery('q!');
               }
               if (txt === 'c!') {
                  context.setQuery('c2!');
               }
               if (txt === 'c2!') {
                  context.setQuery('CHANGE_OK');
               }
            });

            context.on('changePath', path => {
               context.logger.log('[TEST] onChangePath:', path);
            });

            context.on('viewIsReady', () => {
               context.logger.log('[TEST] viewIsReady');
            });

            context.on('show', () => {
               context.logger.log('[TEST] show app');
            });

            context.on('hide', () => {
               context.logger.log('[TEST] hide app');
            });

            context.on('idle', () => {
               context.logger.log('[TEST] app in idle');
            });

            context.on('changeSettings', (path, dif) => {
               context.logger.log('[TEST] app in changeSettings:', path, dif);
            });
         }
      },

      defineTypeExecutors() {
         return [
            {
               title: 'Test object',
               type: 'test_object',
               exectFunc: () => {
                  context.setPath(this.name);
                  context.putLoader(this.name);

                  try {
                     context.logger.info('run all tests, obj test!');
                  } catch (e) {
                     context.logger.error(e);
                     return;
                  }

                  setTimeout(() => {
                     context.removeLoader(this.name);
                     context.addRules([
                        {
                           title: 'Loading OK',
                           path: this.name,
                           type: ['object'],
                        },
                     ]);
                  }, 1000);
               },
            },
            {
               title: 'run all tests',
               type: 'test_object_run',
               exectFunc: () => {
                  _makeTests();
               },
            },
         ];
      },
   };
};
