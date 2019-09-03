var Benchmark = require('benchmark')
var _get = require('lodash.get')
var dotProp = require('dot-prop');
var objectResolvePath = require('object-resolve-path')
var suite = new Benchmark.Suite

var testObj = {
  a: 'b',
  'hyph"en': 10,
  'hy[ph]en': 11,
  b: {
    c: [1, 2, 3],
    d: ['h', 'ch'],
    e: [{}, {f: 'g'}],
    f: 'i'
  }
}

const get30 = (from, ...selectors) =>
   [...selectors].map(s =>
      s
         .replace(/\[([^\[\]]*)\]/g, '.$1.')
         .split('.')
         .filter(t => t !== '')
         .reduce((prev, cur) => prev && prev[cur], from)
   )[0] || undefined;


// add tests
suite.add('lodash.get', function () {
  _get(testObj, 'b.e[1].f') === 'g'
})
  .add('object-resolve-path2', function () {
    objectResolvePath(testObj, 'b.e[1].f') === 'g'
  })
  .add('get30', function () {
    get30(testObj, 'b.e[1].f') === 'g'
  })
  // add listeners
  .on('cycle', function (event) {
    console.log(String(event.target))
  })
  .on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  })
  // run async
  .run({ 'async': true })