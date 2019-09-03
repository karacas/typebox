'use strict';

module.exports.getTests = appContext => {
   const cryptTest = [
      {
         name: 'crypt',
         options: {},
         callBack: async (tape, context) => {
            try {
               const { encrypt, decrypt } = appContext.require('@aux/aux_crypt.js');
               const data = 'encrypt my data';
               const key = '123';
               const sectret = await encrypt(data, key);
               const deSectret = await decrypt(sectret, key);
               tape.ok(deSectret === data, JSON.stringify({ decrypted: deSectret, sectret_length: sectret.length }));
            } catch (e) {
               tape.error('crypto:', e);
            }
            tape.end();
         },
      },
      {
         name: 'crypt empty data',
         options: {},
         callBack: async (tape, context) => {
            try {
               const { encrypt, decrypt } = appContext.require('@aux/aux_crypt.js');
               const data = '';
               const key = '123';
               const sectret = await encrypt(data, key);
               const deSectret = await decrypt(sectret, key);
               tape.ok(deSectret === data, JSON.stringify({ decrypted: deSectret, sectret_length: sectret.length }));
            } catch (e) {
               tape.error('crypto:', e);
            }
            tape.end();
         },
      },
      {
         name: 'crypt triplesec (slow)',
         options: {},
         callBack: async (tape, context) => {
            try {
               const { encrypt, decrypt } = appContext.require('@aux/aux_crypt.js');
               const data = 'a';
               const key = 'b';
               const sectret = await encrypt(data, key, 'triplesec');
               const deSectret = await decrypt(sectret, key, 'triplesec');
               tape.ok(deSectret === data, JSON.stringify({ decrypted: deSectret, sectret_length: sectret.length }));
            } catch (e) {
               tape.error('crypto:', e);
            }
            tape.end();
         },
      },
   ];

   return [cryptTest[0], cryptTest[1]];
};
