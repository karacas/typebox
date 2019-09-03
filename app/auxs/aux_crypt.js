'use strict';

// ktodo: https://github.com/queicherius/asymmetric-crypto
let crypto = null;
let triplesec = null;
let pbkdf2 = null;
let XXHash = null;
let highwayhash = null;

const makeHashMD5 = data => {
   if (typeof data !== 'string') return null;
   crypto = crypto || require('crypto');
   return crypto
      .createHash('md5')
      .update(data)
      .digest('hex');
};

const makeHighwayhash = data => {
   if (typeof data !== 'string') return null;
   highwayhash = highwayhash || require('highwayhash');
   return highwayhash.asHexString(KEY_HIGHWAYHASH, Buffer.from(data));
};

const makeHashpbkdf2 = str => {
   crypto = crypto || require('crypto');
   return new Promise(res => {
      crypto.pbkdf2(str, SALT, 872791, 32, 'sha512', (err, derivedKey) => {
         if (err) {
            console.error(err);
            res(null);
            return;
         }
         res(derivedKey.toString('hex'));
      });
   });
};

const encryptaes256gcm = (text, masterkey) => {
   //https://gist.github.com/AndiDittrich/4629e7db04819244e843
   crypto = crypto || require('crypto');
   return new Promise(res => {
      try {
         masterkey = makeHashMD5(masterkey);
         text = String(text);
         const iv = crypto.randomBytes(16);
         const salt = crypto.randomBytes(64);
         const key = crypto.pbkdf2Sync(masterkey, salt, 2145, 32, 'sha512');
         const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
         const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
         const tag = cipher.getAuthTag();
         const result = Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
         res(result);
      } catch (e) {
         console.error(e);
         res(null);
      }
   });
};

const decryptaes256gcm = (encdata, masterkey) => {
   //https://gist.github.com/AndiDittrich/4629e7db04819244e843
   crypto = crypto || require('crypto');
   return new Promise(res => {
      try {
         masterkey = makeHashMD5(masterkey);
         const bData = Buffer.from(encdata, 'base64');
         const salt = bData.slice(0, 64);
         const iv = bData.slice(64, 80);
         const tag = bData.slice(80, 96);
         const text = bData.slice(96);
         const key = crypto.pbkdf2Sync(masterkey, salt, 2145, 32, 'sha512');
         const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
         decipher.setAuthTag(tag);
         const decrypted = decipher.update(text, 'binary', 'utf8') + decipher.final('utf8');
         res(decrypted);
      } catch (e) {
         console.error(e);
         res(null);
      }
   });
};

const encryptTriplesec = (data, key) => {
   return new Promise(res => {
      triplesec = triplesec || require('triplesec');
      triplesec.encrypt(
         {
            data: triplesec.Buffer.from(data),
            key: triplesec.Buffer.from(key),
            progress_hook: obj => {},
         },
         (err, buff) => {
            if (!err) {
               res(buff.toString('hex'));
               return;
            }

            console.error(err);
            res(null);
            return;
         }
      );
   });
};

const decryptTriplesec = (data, key) => {
   return new Promise(res => {
      triplesec = triplesec || require('triplesec');
      triplesec.decrypt(
         {
            data: triplesec.Buffer.from(data, 'hex'),
            key: triplesec.Buffer.from(key),
            progress_hook: obj => {},
         },
         (err, buff) => {
            if (!err) {
               res(buff.toString() || '');
               return;
            }

            console.error(err);
            res(null);
            return;
         }
      );
   });
};

const __encryptData = async (data, key, type = 'aes256gcm' /*'aes256gcm', 'aes256', 'triplesec' */) => {
   if (data !== null && typeof data === 'object') {
      data = JSON.stringify(data);
   } else {
      data = String(data || '');
   }

   if (!key) {
      console.error('No Key');
      return null;
   }

   key = String(key);

   let encoder = null;
   if (type === 'triplesec') {
      encoder = encryptTriplesec;
   }
   if (type === 'aes256gcm' || !encoder) {
      encoder = encryptaes256gcm;
   }

   try {
      let res = await encoder(data, key);
      if (res === null) {
         return null;
      }
      return String(res);
   } catch (e) {
      console.error(e, 'encryptData fail', type);
      return null;
   }
};

const __decryptData = async (data, key, type = 'aes256gcm' /*'aes256gcm', 'aes256', 'triplesec' */) => {
   key = String(key);

   if (data === null || !key) {
      console.error('No data / No Key');
      return null;
   }

   let decoder = null;
   if (type === 'triplesec') {
      decoder = decryptTriplesec;
   }
   if (type === 'aes256') {
      decoder = decryptAes256;
   }
   if (type === 'aes256gcm' || !decoder) {
      decoder = decryptaes256gcm;
   }

   try {
      let res = await decoder(data, key);
      if (res === null) {
         return null;
      }
      return String(res);
   } catch (e) {
      console.error(e, 'decryptData fail', type);
      return null;
   }
};

module.exports.encrypt = __encryptData;
module.exports.decrypt = __decryptData;
module.exports.makeHashpbkdf2 = makeHashpbkdf2;
module.exports.makeHash = makeHighwayhash;

const KEY_HIGHWAYHASH = Buffer.from('xOc4JQguXT0ail6Pqf011xyAT5Vshi4sIKZmqTZSggs=', 'base64');
const SALT = makeHashMD5(
   (!![] +
      [][
         (![] + [])[+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + (![] + [])[!+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+!+[]]
      ])[!+[] + !+[] + [+[]]] +
      ([][(![] + [])[+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + (![] + [])[!+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+!+[]]]
         [
            ([][
               (![] + [])[+[]] +
                  ([![]] + [][[]])[+!+[] + [+[]]] +
                  (![] + [])[!+[] + !+[]] +
                  (!![] + [])[+[]] +
                  (!![] + [])[!+[] + !+[] + !+[]] +
                  (!![] + [])[+!+[]]
            ] + [])[!+[] + !+[] + !+[]] +
               (!![] +
                  [][
                     (![] + [])[+[]] +
                        ([![]] + [][[]])[+!+[] + [+[]]] +
                        (![] + [])[!+[] + !+[]] +
                        (!![] + [])[+[]] +
                        (!![] + [])[!+[] + !+[] + !+[]] +
                        (!![] + [])[+!+[]]
                  ])[+!+[] + [+[]]] +
               ([][[]] + [])[+!+[]] +
               (![] + [])[!+[] + !+[] + !+[]] +
               (!![] + [])[+[]] +
               (!![] + [])[+!+[]] +
               ([][[]] + [])[+[]] +
               ([][
                  (![] + [])[+[]] +
                     ([![]] + [][[]])[+!+[] + [+[]]] +
                     (![] + [])[!+[] + !+[]] +
                     (!![] + [])[+[]] +
                     (!![] + [])[!+[] + !+[] + !+[]] +
                     (!![] + [])[+!+[]]
               ] + [])[!+[] + !+[] + !+[]] +
               (!![] + [])[+[]] +
               (!![] +
                  [][
                     (![] + [])[+[]] +
                        ([![]] + [][[]])[+!+[] + [+[]]] +
                        (![] + [])[!+[] + !+[]] +
                        (!![] + [])[+[]] +
                        (!![] + [])[!+[] + !+[] + !+[]] +
                        (!![] + [])[+!+[]]
                  ])[+!+[] + [+[]]] +
               (!![] + [])[+!+[]]
         ](
            (!![] + [])[+!+[]] +
               (!![] + [])[!+[] + !+[] + !+[]] +
               (!![] + [])[+[]] +
               ([][[]] + [])[+[]] +
               (!![] + [])[+!+[]] +
               ([][[]] + [])[+!+[]] +
               (![] + [+![]])[
                  ([![]] + [][[]])[+!+[] + [+[]]] +
                     (!![] + [])[+[]] +
                     (![] + [])[+!+[]] +
                     (![] + [])[!+[] + !+[]] +
                     ([![]] + [][[]])[+!+[] + [+[]]] +
                     ([][
                        (![] + [])[+[]] +
                           ([![]] + [][[]])[+!+[] + [+[]]] +
                           (![] + [])[!+[] + !+[]] +
                           (!![] + [])[+[]] +
                           (!![] + [])[!+[] + !+[] + !+[]] +
                           (!![] + [])[+!+[]]
                     ] + [])[!+[] + !+[] + !+[]] +
                     (![] + [])[!+[] + !+[] + !+[]]
               ]()[+!+[] + [+[]]] +
               [+[]] +
               (![] + [+![]])[
                  ([![]] + [][[]])[+!+[] + [+[]]] +
                     (!![] + [])[+[]] +
                     (![] + [])[+!+[]] +
                     (![] + [])[!+[] + !+[]] +
                     ([![]] + [][[]])[+!+[] + [+[]]] +
                     ([][
                        (![] + [])[+[]] +
                           ([![]] + [][[]])[+!+[] + [+[]]] +
                           (![] + [])[!+[] + !+[]] +
                           (!![] + [])[+[]] +
                           (!![] + [])[!+[] + !+[] + !+[]] +
                           (!![] + [])[+!+[]]
                     ] + [])[!+[] + !+[] + !+[]] +
                     (![] + [])[!+[] + !+[] + !+[]]
               ]()[+!+[] + [+[]]]
         )()
         [
            ([][
               (![] + [])[+[]] +
                  ([![]] + [][[]])[+!+[] + [+[]]] +
                  (![] + [])[!+[] + !+[]] +
                  (!![] + [])[+[]] +
                  (!![] + [])[!+[] + !+[] + !+[]] +
                  (!![] + [])[+!+[]]
            ] + [])[!+[] + !+[] + !+[]] +
               (!![] +
                  [][
                     (![] + [])[+[]] +
                        ([![]] + [][[]])[+!+[] + [+[]]] +
                        (![] + [])[!+[] + !+[]] +
                        (!![] + [])[+[]] +
                        (!![] + [])[!+[] + !+[] + !+[]] +
                        (!![] + [])[+!+[]]
                  ])[+!+[] + [+[]]] +
               ([][[]] + [])[+!+[]] +
               (![] + [])[!+[] + !+[] + !+[]] +
               (!![] + [])[+[]] +
               (!![] + [])[+!+[]] +
               ([][[]] + [])[+[]] +
               ([][
                  (![] + [])[+[]] +
                     ([![]] + [][[]])[+!+[] + [+[]]] +
                     (![] + [])[!+[] + !+[]] +
                     (!![] + [])[+[]] +
                     (!![] + [])[!+[] + !+[] + !+[]] +
                     (!![] + [])[+!+[]]
               ] + [])[!+[] + !+[] + !+[]] +
               (!![] + [])[+[]] +
               (!![] +
                  [][
                     (![] + [])[+[]] +
                        ([![]] + [][[]])[+!+[] + [+[]]] +
                        (![] + [])[!+[] + !+[]] +
                        (!![] + [])[+[]] +
                        (!![] + [])[!+[] + !+[] + !+[]] +
                        (!![] + [])[+!+[]]
                  ])[+!+[] + [+[]]] +
               (!![] + [])[+!+[]]
         ]() + [])[!+[] + !+[] + !+[]]
);
