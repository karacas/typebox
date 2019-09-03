var Benchmark = require('benchmark');
var deepdiff = require('deep-diff').diff;
var deepobjdiff = require('deep-object-diff').diff;
var suite = new Benchmark.Suite();
var equal = require('fast-deep-equal');

let testObj1 = {
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

let testObj3 = {
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
    _note_modifyDate: 1559614445221
  }
};

// add tests
suite
  .add('deepdiff', function() {
    deepdiff(testObj1, testObj1);
    deepdiff(testObj2, testObj1);
    deepdiff(testObj2, testObj2);
    deepdiff(testObj2, testObj3);
  })
  .add('deepobjdiff', function() {
    deepobjdiff(testObj1, testObj1);
    deepobjdiff(testObj2, testObj1);
    deepobjdiff(testObj2, testObj2);
    deepobjdiff(testObj2, testObj3);
  })
  .add('equal', function() {
    equal(testObj1, testObj1) && deepobjdiff(testObj1, testObj1);
    equal(testObj2, testObj1) && deepobjdiff(testObj2, testObj1);
    equal(testObj2, testObj2) && deepobjdiff(testObj2, testObj2);
    equal(testObj2, testObj3) && deepobjdiff(testObj2, testObj3);
  })
  .on('cycle', function(event) {
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run({ async: !true });