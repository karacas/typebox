const Benchmark = require('benchmark');
const suite = new Benchmark.Suite;
const removeDiacritics = require('diacritics').remove;
const deburr = require("lodash").deburr;
const memoize = require("lodash").memoize;

const data = 'Cualquier cosa me avisás. #hash';
const regexA = /([^A-Z])([A-Z])/g
const regexB = /(\-|\_)/g
const regexC = / +(?= )/g

console.log('');
console.log('removeDiacritics     ', removeDiacritics(data));
console.log('deburr               ', deburr(data));
console.log('normalize            ', data.normalize('NFD').replace(/[\u0300-\u036f]/g, ""))

console.log('rule                 ', removeDiacritics(
  (data)
  .replace(/([^A-Z])([A-Z])/g, '$1 $2') /*CAPS TO SPACES*/
  .replace(/\-/g, ' ')
  .replace(/\_/g, ' ')
  .replace(/ +(?= )/g, '')
  .toLowerCase()
));

console.log('rule2                ', (data)
  .replace(/([^A-Z])([A-Z])/g, '$1 $2') /*CAPS TO SPACES*/
  .replace(/(\-|\_)/g, ' ')
  .replace(/ +(?= )/g, '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
)
console.log('rule5                ', removeDiacritics(data)
  .replace(regexA, '$1 $2') /*CAPS TO SPACES*/
  .replace(regexB, ' ')
  .replace(regexC, '')
  .toLowerCase()
)

console.log('');

suite.add(`removeDiacritics`, () =>
  removeDiacritics(data)
);
suite.add(`deburr`, () =>
  deburr(data)
);
suite.add(`normalize`, () =>
  data.normalize('NFD').replace(/[\u0300-\u036f]/g, "")
);
suite.add(`rule`, () =>
  removeDiacritics(
    (data)
    .replace(/([^A-Z])([A-Z])/g, '$1 $2') /*CAPS TO SPACES*/
    .replace(/\-/g, ' ')
    .replace(/\_/g, ' ')
    .replace(/ +(?= )/g, '')
    .toLowerCase()
  )
);
suite.add(`rule2`, () =>
  (data)
  .replace(/([^A-Z])([A-Z])/g, '$1 $2') /*CAPS TO SPACES*/
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
  .replace(/\-/g, ' ')
  .replace(/\_/g, ' ')
  .replace(/ +(?= )/g, '')
)
suite.add(`rule3`, () =>
  removeDiacritics(data)
  .replace(/([^A-Z])([A-Z])/g, '$1 $2') /*CAPS TO SPACES*/
  .toLowerCase()
  .replace(/\-/g, ' ')
  .replace(/\_/g, ' ')
  .replace(/ +(?= )/g, '')
)
suite.add(`rule4`, () =>
  removeDiacritics(data)
  .replace(/([^A-Z])([A-Z])/g, '$1 $2') /*CAPS TO SPACES*/
  .replace(/(\-|\_)/g, ' ')
  .replace(/ +(?= )/g, '')
  .toLowerCase()
)
suite.add(`rule5`, () =>
  removeDiacritics(data)
  .replace(regexA, '$1 $2') /*CAPS TO SPACES*/
  .replace(regexB, ' ')
  .replace(regexC, '')
  .toLowerCase()
)

suite.on('cycle', function(event) {
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run();