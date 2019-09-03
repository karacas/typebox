'use strict';

const Benchmark = require('benchmark');
const { originalScore, scoreKrcv2, scoreKrcv3, scoreKrcv2WIP_PREFORMANCE } = require('../app/js/aux_score_krc.js');;

const suiteA = new Benchmark.Suite();
const suiteB = new Benchmark.Suite();

let arryStr = ['t', 'total', 'total commander', 'c', 'camino', 'caminant', 'cami nant', 'xxxxxxxxxx'];
let arrySearchs = ['tc', 'to', 'tc', 'tot', 'com', 'c', 'ca', 'zzzzzz'];

suiteA
   .add('scoreKrcv2', function() {
      arryStr.map(str => {
         arrySearchs.map(saarch => {
            scoreKrcv2(str, saarch);
         });
      });
   })
   .add('scoreKrcv3', function() {
      arryStr.map(str => {
         arrySearchs.map(saarch => {
            scoreKrcv3(str, saarch);
         });
      });
   })
   .add('originalScore', function() {
      arryStr.map(str => {
         arrySearchs.map(saarch => {
            originalScore(str, saarch);
         });
      });
   })
   .add('scoreKrcv2WIP_PREFORMANCE', function() {
      arryStr.map(str => {
         arrySearchs.map(saarch => {
            scoreKrcv2WIP_PREFORMANCE(str, saarch);
         });
      });
   })
   .on('complete', function() {
      console.log('Fastest is ' + this.filter('fastest').map('name'));
      console.log('');
      console.log(this[0].hz, this[0].name);
      console.log(this[1].hz, this[1].name);
      console.log(this[2].hz, this[2].name);
      console.log(this[3].hz, this[3].name);
   });
suiteA.run();


suiteB
   .add('1', function() {
      let strHasSpaces = /\s/.test(arryStr[3]);
   })
   .add('1', function() {
      let strHasSpaces = arryStr[3].indexOf(' ') !== -1;
   })
   .add('1', function() {
      let letter = 1
      let a = (arryStr[3].indexOf(arryStr[3][1], 2));
   })
   .on("complete", function() {
      console.log('Fastest is ' + this.filter('fastest').map('name'));
      console.log('');
      console.log(this[0].hz);
      console.log(this[1].hz);
      console.log(this[2].hz);
   })
// suiteB.run()


// console.log(arryStr[3].slice(2).indexOf(4));
// console.log(arryStr[3].indexOf(4, 2));