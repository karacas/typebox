const { makeHashMD5 } = require('../app/auxs/aux_crypt.js');
const farmhash = require('farmhash');
const Benchmark = require('benchmark');
const suite = new Benchmark.Suite;
const crypto = require('crypto')
const highwayhash = require('highwayhash');
const key2 = require('crypto').randomBytes(32);
const key = Buffer.from('xOc4JQguXT0ail6Pqf011xyAT5Vshi4sIKZmqTZSggs=', 'base64');
let data = 'C:/Windows/System32/07409496-a423-4a3e-b620-2cfb01a9318d_HyperV-ComputeNetwork.dll_FILEtypebox-pathC:\\Windows\\System32null'

// for (var i = 0; i < 600; i++) {
//    data = data + Math.random()
// }

console.log(data.length);

let XXHash
const makeHashXXHash = data => {
  if (typeof data !== 'string') return null;
  XXHash = XXHash || require('xxhash');
  return XXHash.hash(Buffer.from(data), 0xCAFEBABE);
};

const makeHashXXHash64 = data => {
  if (typeof data !== 'string') return null;
  XXHash = XXHash || require('xxhash');
  return XXHash.hash64(Buffer.from(data), 0xCAFEBABE).toString('hex');
};


const scenarios = [
  { alg: 'sha1', digest: 'base64' },
  { alg: 'sha256', digest: 'base64' }
];

console.log('');
console.log('');
console.log('highwayhash.asHexString(key, input)', highwayhash.asHexString(key, Buffer.from(data)));
console.log('makeHashMD5(data)', makeHashMD5(data));
console.log('makeHashXXHash 64(data)', makeHashXXHash64(data));
console.log('makeHashXXHash(data)', makeHashXXHash(data));
console.log('farmhash.hash64(data)', farmhash.hash64(data));
console.log('farmhash.fingerprint64(data)', farmhash.fingerprint64(data));
console.log(key.toString('base64'));
console.log('');


suite.add(`highwayhash`, () =>
  highwayhash.asHexString(key, Buffer.from(data))
);

suite.add(`makeHashMD5`, () =>
  makeHashMD5(data)
);

suite.add(`makeHashXXHash64`, () =>
  makeHashXXHash64(data)
);

suite.add(`makeHashXXHash`, () =>
  makeHashXXHash(data)
);

suite.add(`farmhashhash64`, () =>
  farmhash.hash64(data)
);

suite.add(`fingerprint64`, () =>
  farmhash.fingerprint64(data)
);





// for (const { alg, digest } of scenarios) {
//   suite.add(`${alg}-${digest}`, () =>
//     hash(alg).update(data).digest(digest)
//   );
// }

suite.on('cycle', function(event) {
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run();