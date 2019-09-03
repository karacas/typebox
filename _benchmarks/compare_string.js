var Benchmark = require('benchmark');
var _get = require('lodash.get');
var suite = new Benchmark.Suite();
var equal = require('fast-deep-equal');

let testObj1 =
  'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
const testObj2 =
  'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
const testObj3 = '11'
const testObj4 =
  'orem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
const testObj5 = '';
let testObj6 = '';

for (var i = 0; i < 100000; i++) {
  testObj6 += testObj1;
}

var obj = {a:{b:"Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."}}
testObj6 = obj.a.b

console.log(testObj1.length);
console.log(testObj2.length);
console.log(testObj3.length);
console.log(testObj4.length);
console.log(testObj5.length);
console.log(testObj6.length);

// add tests
suite
  .add('===', function() {
    testObj1 === testObj2;
    testObj1 === testObj3;
    testObj1 === testObj4;
    testObj1 === testObj5;
    testObj1 === testObj6;
  })
  .add('==', function() {
    testObj1 == testObj2;
    testObj1 == testObj3;
    testObj1 == testObj4;
    testObj1 == testObj5;
    testObj1 == testObj6;
  })
  .add('bool ==', function() {
    !(testObj1 != testObj2);
    !(testObj1 != testObj3);
    !(testObj1 != testObj4);
    !(testObj1 != testObj5);
    !(testObj1 != testObj6);
  })
  .add('string() ==', function() {
    String(testObj1) == String(testObj2);
    String(testObj1) == String(testObj3);
    String(testObj1) == String(testObj4);
    String(testObj1) == String(testObj5);
    String(testObj1) == String(testObj6);
  })
  .add('Number() ==', function() {
    Number(testObj1) == Number(testObj2);
    Number(testObj1) == Number(testObj3);
    Number(testObj1) == Number(testObj4);
    Number(testObj1) == Number(testObj5);
    Number(testObj1) == Number(testObj6);
  })
  .add('length & ==', function() {
    testObj1.length == testObj2.length && testObj1 == testObj2
    testObj1.length == testObj3.length && testObj1 == testObj3
    testObj1.length == testObj4.length && testObj1 == testObj4
    testObj1.length == testObj5.length && testObj1 == testObj5
    testObj1.length == testObj6.length && testObj1 == testObj6
  })
  .add('localeCompare', function() {
    testObj1.localeCompare(testObj2);
    testObj1.localeCompare(testObj3);
    testObj1.localeCompare(testObj4);
    testObj1.localeCompare(testObj5);
    testObj1.localeCompare(testObj6);
  })
  .add('< / >', function() {
    !(testObj1 > testObj2 && testObj1 < testObj2);
    !(testObj1 > testObj3 && testObj1 < testObj3);
    !(testObj1 > testObj4 && testObj1 < testObj4);
    !(testObj1 > testObj5 && testObj1 < testObj5);
    !(testObj1 > testObj6 && testObj1 < testObj6);
  })
  .add('same ===', function() {
    testObj6 === testObj6;
    testObj6 === testObj6;
    testObj6 === testObj6;
    testObj6 === testObj6;
    testObj6 === testObj6;
  })
  .add('same ==', function() {
    testObj6 == testObj6;
    testObj6 == testObj6;
    testObj6 == testObj6;
    testObj6 == testObj6;
    testObj6 == testObj6;
  })
  .add('same2 ===', function() {
    testObj3 === testObj5;
    testObj3 === testObj5;
    testObj3 === testObj5;
    testObj3 === testObj5;
    testObj3 === testObj5;
  })
  .add('=== 2', function() {
    testObj1 === testObj2;
    testObj1 === testObj3;
    testObj1 === testObj4;
    testObj1 === testObj5;
    testObj1 === testObj6;
  })
  .on('cycle', function(event) {
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run({ async: !true });