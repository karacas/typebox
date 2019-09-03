'use strict';

const { $timeout, $pause, getPackageTest } = require('@uitests/_aux_tests.js');
const getInstalledPackages = require('@uitests/installed_packages.js');

const getInternalTestFirst = appContext => {
   return [
      ...require('@uitests/intesting.js').getTests(appContext),
      ...require('@uitests/robotjs.js').getTests(appContext),
      ...require('@uitests/crypto.js').getTests(appContext),
      ...require('@uitests/type.js').getTests(appContext),
      ...require('@uitests/calc.js').getTests(appContext),
      ...require('@uitests/notes.js').getTests(appContext),
   ];
};

const getInternalTestLast = appContext => {
   return [...require('@uitests/iohook.js').getTests(appContext)];
};

module.exports.getTests = appContext => {
   return [...getInternalTestFirst(appContext), ...getInstalledPackages.getTests(appContext), ...getInternalTestLast(appContext)];
};
