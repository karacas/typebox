'use strict';

//KTODO: Ver que los valores los traiga desde el config
const packageFileTests = [];

let keyDelay = 24;
let keyDelayRobot = 18;
let pause = 100;

const $timeout = ms => new Promise(res => setTimeout(res, ms));
const $pause = () => new Promise(res => setTimeout(res, pause));

const addPackageFileTest = test => {
   packageFileTests.push(test);
};

const getPackageFileTests = () => {
   return packageFileTests;
};

let objExport = {};
Object.defineProperty(objExport, 'keyDelay', { get: () => keyDelay });
Object.defineProperty(objExport, 'keyDelayRobot', { get: () => keyDelayRobot });
Object.defineProperty(objExport, 'pause', { get: () => pause });

module.exports = {
   $timeout,
   $pause,
   keyDelay: objExport.keyDelay,
   keyDelayRobot: objExport.keyDelayRobot,
   pause: objExport.pause,
   getPackageFileTests,
   addPackageFileTest,
   setKeyDelay: v => {
      keyDelay = v || keyDelay;
   },
   setKeyDelayRobot: v => {
      keyDelayRobot = v || keyDelayRobot;
   },
   setPause: v => {
      pause = v || pause;
   },
};
