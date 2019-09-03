'use strict';

const { $timeout } = require('@uitests/_aux_tests.js');

const getTapeTests = appContext => {
   return [
      {
         name: 'tmp test',
         options: {},
         callBack: async (tape, context) => {
            tape.ok(!!$timeout);
            tape.end();
         },
      },
   ];
};

module.exports.getTests = appContext => {
   return [...getTapeTests(appContext)];
};
