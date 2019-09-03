'use strict';

const global_aux = require('@aux/aux_global.js');
const robotUI = require('@main/robot_ui_manager.js');
const aux_fs = require('@aux/aux_fs.js');
const fs = require('fs');
const { $timeout, $pause } = require('@uitests/_aux_tests.js');
const $promiseWrapp = func => new Promise((resolve, reject) => func(resolve, reject));
const { keyTap, keySequence, keyString2array, keyNormalice, goBack, keyTapClassic, acceleratorToRobotJS } = robotUI;
const { get, cloneDeep } = global_aux;

let status = null;
let getStatus = null;
let setStatus = null;

let Logger = require('@main/main_logger.js');

let currentLoad = null;
let test = null;
let toaster = null;
let settings = null;
let sharedObj = null;
let numeral = null;
let uniqBy = null;
let initiated = false;
let viewEvents = false;
let configured = false;
let isExecuting = false;
let testConfig = {};
let tests = [];
let context = {};
let _fails = 0;
let _report = {};
let _testsData = [];
let _reportFile = null;
let _reportPathPass = null;
let lastDate = new Date();

function replaceErrors(key, value) {
   if (value instanceof Error) {
      var error = {};

      Object.getOwnPropertyNames(value).forEach(function(key) {
         error[key] = value[key];
      });

      return error;
   }

   return value;
}

const addTest = $test => {
   if (isExecuting) return;
   if (validateObjTest($test)) {
      if (!true) Logger.log('[addTest]', $test.name);
      tests.push($test);
   }
};

const addTests = $tests => {
   if (!$tests) return;
   if (isExecuting) return;
   if (Array.isArray($tests)) {
      $tests.forEach($test => {
         tests.push($test);
      });
      return;
   }
   if (typeof $tests === 'object') {
      addTest($test);
   }
};

const resetTests = () => {
   tests = [];
};

const initReport = () => {
   if (!initiated) return;
   if (!settings) return;
   if (!testConfig) return;

   numeral = numeral || require('numeral');
   uniqBy = uniqBy || require('lodash').uniqBy;

   _report.actual = {};
   _report.old = [];

   //KTODO: Load & slice reports
   _reportFile = testConfig.reportPath || null;
   _reportPathPass = testConfig.reportPathPass || null;

   if (_reportFile && _reportFile.indexOf('%') === -1 && fs.existsSync(_reportFile)) {
      if (_reportPathPass && testConfig.saveJsonReport) aux_fs.saveFileSync(_reportPathPass, false, 'plain');
      let jreport = aux_fs.loadGenericJson(_reportFile);
      if (jreport && jreport.actual) {
         if (!Array.isArray(jreport.old)) jreport.old = [];
         jreport.old.unshift(cloneDeep(jreport.actual));
         jreport.old = uniqBy(
            jreport.old,
            obj => obj.info.version + obj.info.isDev + obj.info.asar + obj.info.terminal + obj.info.os + obj.info.cantTest + obj.pass
         );
         jreport.old = jreport.old.slice(0, testConfig.reportMaxOlds || 100);
         _report = cloneDeep(jreport);
         _report.actual = {};
      }
   }

   _report.actual.info = {
      version: get(settings, 'here_are_dragons.report.version'),
      isDev: get(settings, 'dev'),
      os: get(settings, 'here_are_dragons.os'),
      terminal: get(settings, 'here_are_dragons.report.__termname') || get(settings, 'here_are_dragons.report.__hostname'),
      start: get(settings, 'here_are_dragons.report.backgroundStartDate'),
      timeToStart: cloneDeep(process.uptime ? process.uptime() : 0),
      asar: get(settings, 'here_are_dragons.report.isRunningInAsar'),
      electron: get(settings, 'here_are_dragons.report.version_electron'),
      tests: get(settings, 'tests'),
      isTestSuite: testConfig.isTestSuite,
   };

   _report.actual.tests = _report.actual.tests || [];
};

const setAndSaveFinalDataReport = async obj => {
   if (!initiated) return;
   if (!settings) return;
   if (!obj) return;

   numeral = numeral || require('numeral');

   if (currentLoad) {
      await currentLoad(data => {
         if (data) {
            _report.actual.info.cpuavgload = data.avgload;
            _report.actual.info.currentload = data.currentload;

            if (_report.actual.info.cpuavgload) _report.actual.info.cpuavgload = numeral(_report.actual.info.cpuavgload).format('0.00');
            if (_report.actual.info.currentload) _report.actual.info.currentload = numeral(_report.actual.info.currentload).format('0.00');
         }
      });
   }

   if (process && process.memoryUsage) {
      _report.actual.info.mem = process.memoryUsage().heapUsed;
      if (_report.actual.info.mem) _report.actual.info.mem = numeral(_report.actual.info.mem).format('0.0b');
   }

   _report.actual.info.timeToEnd = numeral(cloneDeep(process.uptime() - _report.actual.info.timeToStart)).format('0.00');

   if (sharedObj._timeToStart) _report.actual.info.timeToStart = numeral(sharedObj._timeToStart).format('0.00');
   _report.actual.info.cantTest = obj.cantTest;
   _report.actual.pass = obj.pass;

   if (_reportFile && _reportFile.indexOf('%') === -1 && testConfig.saveJsonReport && fs.existsSync(_reportFile)) {
      aux_fs.saveFileSync(_reportFile, JSON.stringify(_report, null, 2), 'plain');
      if (_reportPathPass) aux_fs.saveFileSync(_reportPathPass, obj.pass, 'plain');
   }

   return _report;
};

const setDataReport = obj => {
   if (!initiated) return;
   if (!settings) return;
   if (!obj) return;
   if (!lastDate) return;

   let dif = new Date() - lastDate;
   let $obj = `${obj.nameId}  |  ${dif}ms. ` + `  |  ${get(sharedObj.getLastviewEvent(), 'queryTime')}ms. ` + `  |  ${obj.ok}`;

   _report.actual.tests.push($obj);
};

const setErrorReport = err => {
   if (!initiated) return;
   if (!settings) return;
   if (!_report.actual.error) _report.actual.error = [];
   _report.actual.error.push(err);
};

const getPrintReport = (small = false) => {
   if (!initiated) return;
   if (!settings) return;

   let $report = cloneDeep(_report);

   return JSON.stringify($report, null, 2);
};

const validateObjTest = $test => {
   return $test && typeof $test === 'object' && typeof $test.name === 'string' && typeof $test.callBack === 'function';
};

const onReady = () => {
   if (!initiated) return;
   if (false) return;

   if (testConfig.canRunTests) {
      if (testConfig.autoRunTests) {
         viewEvents.once('APP_IS_USABLE', async () => {
            await $pause();
            if (makeTests) makeTests();
         });
      }
      //KTODO: Cambiar evento
      viewEvents.on('RUN_TESTS', async () => {
         await $pause();
         if (makeTests) makeTests();
      });
   }
};

const init = () => {
   if (initiated) return;
   initiated = true;
   sharedObj = global.sharedObj;
   settings = sharedObj.settings_manager.getSettings();
   testConfig = global_aux.get(settings, 'here_are_dragons.testConfig');
   viewEvents = sharedObj.viewEvents;
   status = sharedObj.status;
   getStatus = status.get;
   setStatus = status.set;
   toaster = require('@main/toaster.js');

   if (get(settings, 'here_are_dragons.report.superdev')) {
      Logger = console;
   }

   onReady();
};

const configTest = async () => {
   if (!initiated) return false;
   if (!sharedObj) return false;
   if (isExecuting) return false;

   _fails = 0;
   _report = {};
   _testsData = [];
   _reportFile = null;
   _reportPathPass = null;

   await $pause();

   initReport();
   test = !test ? require('tape') : require('tape').createHarness();

   await $pause();

   if (testConfig.openDevTools && !get(settings, 'here_are_dragons.report.superdev') && sharedObj.app_window_and_systray) {
      sharedObj.app_window_and_systray.openDevTools();
      await $pause();
   }

   currentLoad = currentLoad || require('systeminformation').currentLoad;

   if (get(settings, 'here_are_dragons.report.superdev')) {
      require('pretty-error').start();
   }

   //[COnTEXT]
   context = {
      goBack,
      keySequence,
      keyTap,
      keyString2array,
      sharedObj,
      isDev: get(settings, 'dev'),
      renderEvent: sharedObj.viewEvents,
      getLastviewEvent: sharedObj.getLastviewEvent,
      timeout: $timeout,
      pause: $pause,
   };

   //[FINISH]
   test.onFinish(async () => {
      let $report = await setAndSaveFinalDataReport({
         pass: _fails === 0,
         cantTest: tests.length,
      });

      if ($report) $report = $report.actual || {};

      isExecuting = false;
      status.switch('in_test', false);
      goBack();

      if (sharedObj.app_window_and_systray) {
         sharedObj.app_window_and_systray.setAlwaysOnTop(false);
      }

      if (testConfig.printJsonReport) Logger.log(getPrintReport(true));

      if (testConfig.quitOnFinish) {
         sharedObj.app_window_and_systray.quit(`[TAPE FINISH] Quit! / nFails: ${_fails}`);
      }

      if (_fails) {
         Logger.info('\n[TAPE END]\n', 'FAILS:', _fails);
         if (!get(settings, 'here_are_dragons.report.superdev')) Logger.info(_report.actual.error, '\n\n');
      } else {
         Logger.info('\n[TAPE END] pass ok!\n');
      }

      if (testConfig.toastOnFinish && toaster) {
         if (_fails === 0) {
            toaster.notify({ message: 'Test Pass Ok', maxTime: 5000 });
         } else {
            toaster.notify({ message: `Test Pass Fail: ${_report.actual.tests}`, maxTime: 5000 });
         }
      }

      if (!get(settings, 'here_are_dragons.report.superdev')) Logger.info('\n', $report, '\n');
   });

   //[FAIL]
   test.onFailure(e => {
      _fails++;
   });

   //[REPORT]
   if (testConfig.printReport) {
      test.createStream({ objectMode: true }).on('data', (data, data2) => {
         let $data = cloneDeep(data);

         let testsData = _testsData.find(x => x.id === $data.test);

         if (data.type === 'test') {
            _testsData.push($data);
         }

         if (testsData && testsData.name) {
            $data.nameId = testsData.name;
         }

         if ($data.error) {
            $data.error = data.error.toString();
            setErrorReport($data);
         }

         if ($data.type !== 'test' && $data.type !== 'end') {
            setDataReport($data);
         }
      });
   }

   //[SUMMARIZE]
   if (testConfig.summarize && process && process.stdout) {
      test
         .createStream()
         .pipe(require('tap-summary')({ ansi: false, progress: false }))
         .pipe(process.stdout);
   }

   configured = true;
   return true;
};

const preTest = async () => {
   if (!initiated) return;
   if (!sharedObj) return;
   if (!configured) return false;
   if (true) {
      sharedObj.app_window_and_systray.popWinHard();
   }
   await $pause();
   lastDate = new Date();
   return true;
};

const executeTests = async $tests => {
   if (!initiated) return;
   if (!sharedObj) return;
   if (!configured) return false;
   if (isExecuting) return false;

   isExecuting = true;
   status.switch('in_test', true);

   Logger.info('\n[TAPE START]\n', 'length', $tests.length, '\n');

   const result = [];

   for (const $test of $tests) {
      if (validateObjTest($test)) {
         await test($test.name, $test.options, async t => {
            await preTest();
            return await $test.callBack(t, context);
         });
         result.push(true);
      } else {
         result.push(false);
      }
   }

   let _endTest = endTest()[0];
   await test(_endTest.name, _endTest.options, async t => {
      return await _endTest.callBack(t, context);
   });

   return result;
};

const endTest = () => {
   return [
      {
         name: 'EndTest',
         callBack: async tape => {
            tape.end();
            return true;
         },
      },
   ];
};

const makeTests = async () => {
   if (!initiated) return false;
   if (!testConfig.canRunTests) return false;
   if (!tests || !tests.length) return false;
   if (isExecuting) return false;

   sharedObj.app_window_and_systray.setAlwaysOnTop(true);
   await $pause();
   (await configTest()) && (await executeTests(tests));
   return true;
};

if (false) {
   addTests();
}

module.exports.init = init;
module.exports.initiated = !!initiated;
module.exports.isExecuting = !!isExecuting;
module.exports.addTest = addTest;
module.exports.addTests = addTests;
module.exports.resetTests = resetTests;

//DEPRECATED?
if (false) startStopAppKeyListener('mainShortcut_StopKeyListener');
if (false) {
   const startStopAppKeyListener = async keyConfig => {
      if (!keyConfig) return;
      let StopKeyListenerKeys = global_aux.get(settings, keyConfig);
      if (StopKeyListenerKeys && StopKeyListenerKeys.length) {
         let _keys = StopKeyListenerKeys.split('+');
         _keys = _keys.map(acceleratorToRobotJS);
         let _keys1 = _keys[_keys.length - 1];
         let _keys2 = _keys.slice(0, _keys.length - 1);
         console.log(_keys1, _keys2);

         try {
            await $pause();
            let res = keyTapClassic(_keys1, _keys2);
            await $pause();
            console.log('startStopAppKeyListener', res ? 'OK' : 'FAIL');
         } catch (e) {
            console.error('startStopAppKeyListener', e);
         }
      }
   };
}
