'use strict';

const $timeout = ms => new Promise(res => setTimeout(res, ms));

const tapeTests = [
   {
      name: 'test fail',
      options: {},
      callBack: async (tape, context) => {
         tape.ok(false);
         tape.end();
      },
   },
];

module.exports.getTests = appContext => {
   return tapeTests;
};
