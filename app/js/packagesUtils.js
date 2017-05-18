'use strict';

const path = require('path');
const npmi = require('npmi');
const fs = require('fs');
const fse = require('fs-extra');
const rimraf = require('rimraf');
const _ = require('lodash');
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');

function installPackage(
    name,
    opt = { force: true, deleteFirst: true, path: path.resolve(path.join(Config.get('here_are_dragons.paths.packages'), name, '/')), version: 'latest' }
) {
    return new Promise((resolve, reject) => {
        Logger.info('[Package] try install package:', name);

        if (name.includes('dummyPackage')) {
            resolve();
            return;
        }

        var options = {
            name: name,
            version: opt.version,
            path: opt.path,
            forceInstall: opt.force,
            npmLoad: {
                loglevel: 'silent'
            }
        };

        //RUN
        if (opt.deleteFirst) {
            removePackage(name).then(() => make_npi(name, options)).then(resolve).catch(reject);
        } else {
            make_npi(name, options).then(resolve).catch(reject);
        }
    });
}

//NPM install
function make_npi(name, options) {
    return new Promise((resolve, reject) => {
        if (npmi) {
            Logger.info('[Package] try npmi install', name, 'npmi.NPM_VERSION', npmi.NPM_VERSION);
        } else {
            Logger.error('[Package] try npmi install error: no npmi');
            reject();
            return;
        }
        npmi(options, (err, result) => {
            Logger.info('try npmi return', name, 'Result:', Boolean(result), 'Error:', Boolean(err));
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
            move_files(name, options).then(resolve).catch(reject);
            return;
        });
    });
}

//Move Files
function move_files(name, options) {
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
            .then(installedPackage)
            .then(resolve)
            .catch(reject);
    });
}

function removePackage(name) {
    return new Promise((resolve, reject) => {
        if (name.includes('dummyPackage')) {
            Logger.info('dummyPackage');
            resolve();
            return;
        }
        var packPath = path.resolve(path.join(Config.get('here_are_dragons.paths.packages'), name));
        if (!fs.existsSync(packPath)) {
            resolve();
            return;
        }
        rimraf(path.normalize(packPath), resolve, reject);
    });
}

function installedPackage(name, path) {
    return new Promise((resolve, reject) => {
        resolve();
    });
}

function updatePackage(name) {
    //WIP: Make updates
    if (name.includes('dummyPackage')) {
        Logger.info('dummyPackage');
        resolve();
        return;
    }

    var packPath = Config.get('here_are_dragons.paths.packages') + name + '/' + 'package.json';

    if (true) {
        return;
    }
    if (!bumper) return;

    bumper.bump(packPath).then(
        e => {
            Logger.info('[Package] Bump OK');
        },
        e => {
            Logger.info('[Package] Bump Fail', e);
        }
    );
}

module.exports.installPackage = installPackage;
module.exports.removePackage = removePackage;
module.exports.updatePackage = updatePackage;
