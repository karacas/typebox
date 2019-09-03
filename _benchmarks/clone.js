var Benchmark = require("benchmark");
var _get = require("lodash.get");
var dotProp = require("dot-prop");
var objectResolvePath = require("object-resolve-path");
var suite = new Benchmark.Suite();

const { mergeWith, debounce, cloneDeep, get, memoize } = require("lodash");

var testObj = {
  a: "b",
  'hyph"en': 10,
  "hy[ph]en": 11,
  b: {
    c: [1, 2, 3],
    d: ["h", "ch"],
    e: "g",
    f: "i"
  }
};

const deepClone30 = obj => {
  if (obj == null || typeof obj === "string") return obj;
  let clone = Object.assign({}, obj);
  Object.keys(clone).forEach(key => (clone[key] = typeof obj[key] === "object" ? deepClone30(obj[key]) : obj[key]));
  return Array.isArray(obj) && obj.length ? (clone.length = obj.length) && Array.from(clone) : Array.isArray(obj) ? Array.from(obj) : clone;
};

const _cloneDeep = obj => {
  if (obj == null || typeof obj === "string") return obj;
  if (typeof obj !== "object") obj;
  return JSON.parse(JSON.stringify(obj));
};

// add tests
suite
  .add("deepClone 30sec", function() {
    deepClone30(testObj);
  })
  .add("_cloneDeep stringify", function() {
    _cloneDeep(testObj);
  })
  .add("cloneDeep lodash", function() {
    cloneDeep(testObj);
  })
  // add listeners
  .on("cycle", function(event) {
    console.log(String(event.target));
  })
  .on("complete", function() {
    console.log("Fastest is " + this.filter("fastest").map("name"));
  })
  // run async
  .run({ async: true });
