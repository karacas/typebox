'use strict';

const path = require('path');
const npmi = require('npmi');
const request = require('superagent/superagent');
const noCache = require('superagent-no-cache');
require('superagent-cache')(request);
const fs = require('fs');
const fse = require('fs-extra');
const rimraf = require('rimraf');
const semver = require('semver');
const _ = require('lodash');
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');

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
        version: 'latest'
    }
) {
    return new Promise((resolve, reject) => {
        Logger.info('[Package] try install package:', name);

        if (name.includes('-dev') || name.includes('dummyPackage') || name.includes('internal_pack') || Config.get('ignoreThesePackages').includes(name)) {
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
            forceInstall: opt.force,
            npmLoad: {
                loglevel: 'silent'
            }
        };

        validateConnection()
            .then(() => validateRemotePackage(name))
            .then(validate => {
                if (!validate) return false;
                if (opt.deleteFirst) {
                    return removePackage(name);
                }
            })
            .then(() => make_npi(name, options))
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
        // require('dns').resolve('www.google.com', function(err) {
        //     if (err) {
        //         reject('no connection');
        //     } else {
        //         resolve();
        //     }
        // });
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
    if (!obj) {
        return { validate: false, error: 'no object' };
    }

    if (!obj.name) {
        return { validate: false, error: 'no object name' };
    }

    if (obj.name.includes('dummyPackage') || obj.name.includes('internal_pack') || obj.name === 'typebox') {
        return { validate: false, error: obj.name + ' no valid name object' };
    }

    let engine = _.get(obj, 'engines.typebox');
    if (!engine) {
        return { validate: false, error: obj.name + ' no engine' };
    }

    let plataforms = _.get(obj, 'plataforms');
    if (plataforms && !plataforms.includes(process.platform)) {
        return { validate: false, error: obj.name + ' no valid plataform' + ' ' + 'process.platform:' + ' ' + process.platform, plataforms };
    }

    let version = Config.get('here_are_dragons.report.version');
    if (!version || !semver.satisfies(version, engine)) {
        return { validate: false, error: obj.name + ' version error: ' + ' version: ' + version + ' / engine: ' + engine };
    }

    if (engine.includes('0.0.0')) {
        return { validate: false, error: obj.name + ' engine version is 0.0.0' };
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
function make_npi(name, options) {
    name = aux_packOnlyName(name);
    return new Promise((resolve, reject) => {
        if (npmi) {
            Logger.info('[Package] try npmi install', name, 'npmi.NPM_VERSION', npmi.NPM_VERSION);
        } else {
            Logger.error('[Package] try npmi install error: no npmi');
            reject('no npmi');
            return;
        }
        npmi(options, (err, result) => {
            Logger.info('try npmi return', name, 'Result:', Boolean(result));
            if (err) {
                if (err.code === npmi.LOAD_ERR) {
                    Logger.error('[Package] npm load error', err);
                } else if (err.code === npmi.INSTALL_ERR) {
                    Logger.error('[Package] npm install error', err);
                }
                reject(err);
                return;
            }
            Logger.info('make_npi / move files', name);
            move_files(name, options)
                .then(resolve)
                .catch(reject);
            return;
        });
    });
}

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

        fse
            .copy(path_in, path_out, { overwrite: true })
            .then(() => {
                new Promise((resolve, reject) => {
                    rimraf(path_in, resolve, resolve);
                });
            })
            .then(resolve)
            .catch(reject);
    });
}

function removePackage(name) {
    name = aux_packOnlyName(name);
    return new Promise((resolve, reject) => {
        if (name.includes('dummyPackage') || name.includes('internal_pack') || Config.get('ignoreThesePackages').includes(name)) {
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
    return _.get(requierePackageJson(name), 'version');
}

function checkRemotePackageObj(name) {
    name = aux_packOnlyName(name);
    return new Promise((resolve, reject) => {
        let urlfetch = Config.get('here_are_dragons.packagesRepo');
        let $name = aux_packOnlyName(name);
        request
            .get(urlfetch.replace('{{packname}}', $name))
            .use(noCache)
            .expiration(60)
            .then(res => {
                setTimeout(() => {
                    if (!res.body) {
                        reject($name + ' res.body');
                        return false;
                    }
                    let version = _.get(res.body, 'dist-tags.latest');
                    if (!version) {
                        reject($name + ' no version');
                        return false;
                    }
                    let obj = res.body.versions[version];
                    if (!obj) {
                        reject($name + ' no object');
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
    let url = Config.get('here_are_dragons.paths.packages') + '/' + pack;
    let obj = null;
    try {
        obj = require(path.normalize(url + '/package.json'));
    } catch (e) {}
    return obj || null;
}

function installedPackage(name, path) {
    name = aux_packOnlyName(name);
    return new Promise((resolve, reject) => {
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

            return fse
                .copy(path_in, path_out, { overwrite: true })
                .then(() => {
                    new Promise((resolve, reject) => {
                        rimraf(path_in, resolve, resolve);
                    });
                })
                .then(resolve)
                .catch(reject);
        });
    });
}

function updatePackage($name) {
    $name = aux_packOnlyName($name);
    return new Promise((resolve, reject) => {
        //TEST
        if ($name.includes('dummyPackage') || $name.includes('internal_pack')) {
            Logger.info('dummyPackage');
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
                    reject(name + ' is already updated');
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
                Logger.info(name + ' updated ok');
            })
            .catch(reject);
    });
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
