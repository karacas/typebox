var Benchmark = require('benchmark');
var _get = require('lodash.get');
var suite = new Benchmark.Suite();
var equal = require('fast-deep-equal');

var testObj1 = {
  a: 'b',
  'hyph"en': 10,
  'hy[ph]en': 11,
  b: {
    c: [1, 2, 3],
    d: ['h', 'ch'],
    e: [{}, { f: 'g' }],
    f: 'i'
  }
};

let testObj2 = {
  title: 'test',
  params: {
    _note_is_new: false,
    _internal_id: 'TB_NOTE_v1_NsjN04dh10Valh_jMkUAD',
    _note_encrypt: false,
    _note_original_description: '[TAB] to edit',
    _note_creationDate: 1559614443319,
    _note_type: 'text',
    _note_rulefile: 'note-test.json',
    mode: 'null',
    _note_lineWrapping: true,
    _note_dataExtension: 'txt',
    _note_datafile: 'data-test.txt',
    _meta: {
      paste: false,
      terminal: 'der2',
      user: 'karacas',
      modify_lenght: 0
    },
    _note_originalTitle: 'test',
    _note_modifyDate: 1559614445220
  }
};
// add tests
suite
  .add('stringify', function() {
    JSON.stringify(testObj1) === JSON.stringify(testObj1);
    JSON.stringify(testObj2) === JSON.stringify(testObj1);
    JSON.stringify(testObj2) === JSON.stringify(testObj2);
  })
  .add('equal', function() {
    equal(testObj1, testObj1);
    equal(testObj2, testObj1);
    equal(testObj2, testObj2);
  })
  .on('cycle', function(event) {
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run({ async: true });
