'use strict';

const { $timeout } = require('@uitests/_aux_tests.js');

const getTapeTests = appContext => {
   return [
      {
         name: 'check status in_test',
         options: {},
         callBack: async (tape, context) => {
            tape.ok(appContext.status.get('in_test') === true);
            tape.end();
         },
      },
   ];
};

module.exports.getTests = appContext => {
   return [...getTapeTests(appContext)];
};
