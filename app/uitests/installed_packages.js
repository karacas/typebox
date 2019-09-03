'use strict';

const { getPackageFileTests } = require('@uitests/_aux_tests.js');

module.exports.getTests = appContext => {
   let tests = [];

   getPackageFileTests().forEach($test => {
      try {
         const test = require($test)(appContext);
         tests.push(...test);
      } catch (e) {
         console.warn('[getPackageFileTests]', e, 'test:', $test);
      }
   });

   return tests;
};
