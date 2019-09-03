'use strict';

const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const semver = require('semver');
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const global_aux = require('@aux/aux_global.js');
const get = global_aux.get;
const debounce = global_aux.debounce;

let got = null;
let pacote = null;
let rcopy = null;

function aux_packOnlyName(pack) {
   if (!pack) return null;
   return pack
      .toLowerCase()
      .replace(/\s/g, '')
      .split('@')[0];
}

function aux_packOnlyVersion(pack) {
   if (name && name.split('@').length > 1) {
      return pack.split('@')[1];
   }
   return null;
}

function installPackage(
   name,
   opt = {
      force: true,
      deleteFirst: true,
      path: path.resolve(path.join(Config.get('here_are_dragons.paths.packages'), aux_packOnlyName(name), '/')),
      version: 'latest',
   }
) {
   return new Promise((resolve, reject) => {
      Logger.info('[Package] try install package:', name);

      if (!name) {
         Logger.warn('No name');
         resolve();
         return;
      }

      if (!Config.get('here_are_dragons.installPackages')) {
         Logger.warn('installPackages is disabled');
         resolve();
         return;
      }

      if (name.includes('-dev') || name.includes('dummyPackage') || name.includes('internal_pack') || Config.get('ignoreThesePackages').includes(name)) {
         Logger.warn('Dev or Ignore package');
         resolve();
         return;
      }

      name = name.toLowerCase().replace(/\s/g, '');
      let $name = aux_packOnlyName(name);
      let $version = aux_packOnlyVersion(name) ? aux_packOnlyVersion(name) : opt.version;

      let options = {
         name: $name,
         version: $version,
         path: opt.path,
         pacoteOptions: {},
      };

      validateConnection()
         .then(() => validateRemotePackage(name))
         .then(validate => {
            if (!validate) return false;
            if (opt.deleteFirst) {
               return removePackage(name);
            }
         })
         .then(() => make_npm(name, options))
         .then(() => {
            return validatePackage(name);
         })
         .then(val => {
            if (val) {
               return installedPackage(name);
            } else {
               reject();
               return;
            }
         })
         .then(resolve)
         .catch(reject);
   });
}

function validateConnection() {
   return new Promise((resolve, reject) => {
      if (navigator && navigator.onLine) {
         resolve();
      } else {
         reject();
      }
   });
}

function validateRemotePackage($name) {
   return new Promise((resolve, reject) => {
      checkRemotePackageObj($name)
         .then(obj => {
            let validate = validatePackage(obj);
            if (validate && validate.validate) {
               resolve(true);
            } else {
               if (!validate) validate = {};
               if (!validate.error) validate.error = null;
               Logger.warn('[Package]', $name, 'No validate:', validate.error, ' / package.json > ', obj);
               reject({ error: validate.error });
            }
         })
         .catch(reject);
   });
}

function validatePackage(obj) {
   if (!Config.get('here_are_dragons.installPackages')) {
      return { validate: false, onlyWarn: true, error: 'installPackages is disabled' };
   }

   if (!obj) {
      return { validate: false, error: 'no object' };
   }

   if (!obj.name) {
      return { validate: false, error: 'no object name' };
   }

   if (Config.get('ignoreThesePackages').includes(obj.name)) {
      return { validate: false, onlyWarn: true, error: 'in ignoreThesePackages' };
   }

   if (obj.name.includes('dummyPackage') || obj.name.includes('internal_pack') || obj.name === 'typebox') {
      return { validate: false, error: `${obj.name} no valid name object` };
   }

   let engine = get(obj, 'engines.typebox');
   if (!engine) {
      return { validate: false, error: `${obj.name} no engine` };
   }

   let plataforms = get(obj, 'plataforms');
   if (typeof plataforms === 'string') {
      plataforms.split(',');
   }
   if (plataforms && !plataforms.includes(process.platform)) {
      return {
         validate: false,
         onlyWarn: true,
         error: `${obj.name} no valid plataform` + ` ` + `process.platform:` + ` ${process.platform}`,
         plataforms,
      };
   }

   let version = Config.get('here_are_dragons.report.version');
   if (!version || !semver.satisfies(version, engine)) {
      return { validate: false, error: `${obj.name} version error: ` + ` version: ${version} / engine: ${engine}` };
   }

   if (engine.includes('0.0.0')) {
      return { validate: false, error: `${obj.name} engine version is 0.0.0` };
   }

   return { validate: true };
}

function installToTmp($name) {
   let tmpFolder = path.resolve(path.join(Config.get('here_are_dragons.paths.packages_updates'), $name, '/'));
   return new Promise((resolve, reject) => {
      rimraf(tmpFolder, resolve, resolve);
   }).then(() => {
      return installPackage($name, { path: tmpFolder });
   });
}

//NPM install
function make_npm($name, options) {
   const name = aux_packOnlyName($name);
   const nameAndVersion = `${name}@${options.version || 'latest'}`;
   const path = options.path;

   if (!Config.get('here_are_dragons.installPackages')) {
      Logger.error('[Package] installPackages is disabled');
      reject('installPackages is disabled');
      return;
   }

   if (Config.get('ignoreThesePackages').includes(name)) {
      Logger.error('[Package] ignoreThesePackages');
      reject('ignoreThesePackages');
      return;
   }

   return new Promise((resolve, reject) => {
      pacote = pacote || require('pacote');

      if (pacote) {
         Logger.log('[Package] try pacote install', name, nameAndVersion);
      } else {
         Logger.error('[Package] try pacote install , error: no pacote', pacote);
         reject('no pacote');
         return;
      }

      pacote
         .extract(nameAndVersion, path, options.pacoteOptions || {})
         .then(result => {
            resolve(true);
            Logger.log('[Package] pacote install ok', name);
            deb_clean_pacote();
            return;
         })
         .catch(err => {
            Logger.error('[Package] install error', err, '\n', { nameAndVersion, path, options });
            reject('install error');
            return;
         });
   });
}

function clean_pacote() {
   if (!pacote) return;
   pacote.clearMemoized();
   try {
      pacote = null;
      delete require.cache['pacote'];
   } catch (e) {}
   Logger.log('[Package] pacote clean ok');
}

const deb_clean_pacote = debounce(clean_pacote, 5000);

//Move Files
function move_files(name, options) {
   name = aux_packOnlyName(name);
   return new Promise((resolve, reject) => {
      let path_in = path.normalize(path.join(options.path, '/node_modules/', name, '/'));
      let path_out = path.normalize(path.join(options.path, '/'));

      Logger.info('[Package] Moves files:', name, path_in, path_out);

      if (!fs.existsSync(path_in)) {
         resolve('[Package] Move no need, ', path_in, 'no exist');
         return;
      }

      if (!fs.existsSync(path_out)) {
         reject('[Package] No path out, ', path_out);
         return;
      }

      rcopy = rcopy || require('recursive-copy');
      rcopy(path_in, path_out, { overwrite: true })
         .then(() => {
            new Promise((resolve, reject) => {
               rimraf(path_in, resolve, resolve);
            });
         })
         .then(resolve)
         .catch(e => {
            Logger.warn(e);
            reject(null);
         });
   });
}

function removePackage(name) {
   name = aux_packOnlyName(name);
   return new Promise((resolve, reject) => {
      if (!Config.get('here_are_dragons.deletePackages')) {
         Logger.warn('deletePackages is disabled');
         resolve();
         return;
      }

      if (name.includes('dummyPackage') || name.includes('internal_pack')) {
         Logger.info('dummyPackage');
         resolve();
         return;
      }
      let packPath = path.resolve(path.join(Config.get('here_are_dragons.paths.packages'), name));
      if (!fs.existsSync(packPath)) {
         resolve();
         return;
      }
      rimraf(path.normalize(packPath), resolve, reject);
   });
}

function checkLocalVersion(name) {
   name = aux_packOnlyName(name);
   return get(requierePackageJson(name), 'version');
}

function checkRemotePackageObj(name) {
   name = aux_packOnlyName(name);
   return new Promise((resolve, reject) => {
      let urlfetch = Config.get('here_are_dragons.packagesRepo');
      let $name = aux_packOnlyName(name);
      got = got || require('got');
      got(urlfetch.replace('{{packname}}', $name), { json: true })
         .then(res => {
            setTimeout(() => {
               if (!res.body) {
                  reject(`${$name} res.body`);
                  return false;
               }
               let version = get(res.body, 'dist-tags.latest');
               if (!version) {
                  reject(`${$name} no version`);
                  return false;
               }
               let obj = res.body.versions[version];
               if (!obj) {
                  reject(`${$name} no object`);
                  return false;
               }
               resolve(obj);
            });
         })
         .catch(e => {
            setTimeout(() => {
               reject(e);
            });
         });
   });
}

function checkRemoteVesion(name) {
   name = aux_packOnlyName(name);
   return new Promise((resolve, reject) => {
      let urlfetch = Config.get('here_are_dragons.packagesRepo');
      checkRemotePackageObj(name)
         .then(res => {
            let version = res.version;
            resolve(version);
         })
         .catch(reject);
   });
}

function requierePackageJson(pack) {
   let url = `${Config.get('here_are_dragons.paths.packages')}/${pack}`;
   let obj = null;
   let urlPack = path.normalize(`${url}/package.json`);

   if (!fs.existsSync(urlPack)) {
      Logger.warn('requierePackageJson / no exist urlPack:', urlPack);
      return false;
   }

   try {
      obj = require(urlPack);
   } catch (e) {
      console.error(e);
   }
   return obj || null;
}

function installedPackage(name, path) {
   name = aux_packOnlyName(name);
   return new Promise((resolve, reject) => {
      if (!Config.get('here_are_dragons.installPackages')) {
         Logger.warn('installPackages is disabled');
         resolve();
         return;
      }

      Logger.log(name, 'installed OK!');
      resolve({ install: true, name, path });
   });
}

function moveTmpUpdatedPackage(name) {
   let $name = aux_packOnlyName(name);
   let path_in = path.resolve(path.join(Config.get('here_are_dragons.paths.packages_updates'), $name));
   let path_out = path.resolve(path.join(Config.get('here_are_dragons.paths.packages'), $name));

   return new Promise((resolve, reject) => {
      rimraf(path_out, resolve, resolve);
   }).then(() => {
      return new Promise((resolve, reject) => {
         Logger.info('[Package Update] Moves files:', $name, path_in, path_out);

         if (!fs.existsSync(path_in)) {
            reject('[Package Update] Move no need, ', path_in, 'no exist');
            return false;
         }

         rcopy = rcopy || require('recursive-copy');
         rcopy(path_in, path_out, { overwrite: true })
            .then(() => {
               new Promise((resolve, reject) => {
                  rimraf(path_in, resolve, resolve);
               });
            })
            .then(resolve)
            .catch(e => {
               Logger.warn(e);
               reject(null);
            });
      });
   });
}

function updatePackage($name) {
   $name = aux_packOnlyName($name);
   return new Promise((resolve, reject) => {
      Logger.info('Try to update', $name);
      //TEST
      if ($name.includes('dummyPackage') || $name.includes('internal_pack')) {
         Logger.info('dummyPackage');
         resolve();
         return;
      }

      if (!Config.get('here_are_dragons.updatePackages')) {
         Logger.warn('updatePackages is disabled');
         resolve();
         return;
      }

      if (Config.get('ignoreThesePackages').includes($name)) {
         Logger.warn('is in ignoreThesePackages');
         resolve();
         return;
      }

      //VERSION
      let name = $name;
      let localVersion = checkLocalVersion(name);

      validateConnection()
         .then(() => checkRemoteVesion(name))
         .then(ver => {
            let need = semver.gt(ver, localVersion);
            if (!need) {
               reject(`${name} is already updated`);
               return false;
            } else {
               return installToTmp(name);
            }
         })
         .then(res => {
            if (res === false) return false;
            return moveTmpUpdatedPackage(name);
         })
         .then(res => {
            if (res === false) return false;
            resolve({ updated: true, name: name });
            Logger.info(`${name} updated ok`);
         })
         .catch(reject);
   });
}

if (!Config.get('here_are_dragons.installPackages')) {
   function installPackage(name, options) {
      return new Promise((resolve, reject) => {
         Logger.error('[Package] installPackages is disabled');
         resolve();
         return;
      });
   }
   function make_npm(name, options) {
      return new Promise((resolve, reject) => {
         Logger.error('[Package] installPackages is disabled');
         reject('installPackages is disabled');
      });
   }
}

if (!Config.get('here_are_dragons.updatePackages')) {
   function updatePackage(name, options) {
      return new Promise((resolve, reject) => {
         Logger.error('[Package] updatePackages is disabled');
         resolve();
      });
   }
}

if (!Config.get('here_are_dragons.deletePackages')) {
   function removePackage(name) {
      return new Promise((resolve, reject) => {
         Logger.warn('deletePackages is disabled');
         resolve();
         return;
      });
   }
}

module.exports.installPackage = installPackage;
module.exports.removePackage = removePackage;
module.exports.updatePackage = updatePackage;
module.exports.requierePackageJson = requierePackageJson;
module.exports.checkLocalVersion = checkLocalVersion;
module.exports.checkRemoteVesion = checkRemoteVesion;
module.exports.checkRemotePackageObj = checkRemotePackageObj;
module.exports.validateRemotePackage = validateRemotePackage;
module.exports.validatePackage = validatePackage;
module.exports.aux_packOnlyName = aux_packOnlyName;
module.exports.aux_packOnlyVersion = aux_packOnlyVersion;
