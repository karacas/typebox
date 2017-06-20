'use strict';

const path = require('path');
const _ = require('lodash');
const Moment = require('moment');
const sub = require('hash-sum');
const aux_driveManager = require('../../aux_driveManager.js');
const Logger = require('../../logger.js');
const Config = require('../../config.js');
const sharedData = require('../../sharedData.js');

let lastWalkPathsResult = [];

const ICON_FILE = {
    iconClass: 'mdi-file palette-Light-Blue-A100 text'
};

function saveCache(jSon2cache) {
    if (!sharedData.dataManager) {
        return;
    }

    if (!Config.get('here_are_dragons.launcherCache')) {
        return;
    }

    let resp = sharedData.dataManager.saveLauncherCache(jSon2cache);

    if (!resp) {
        Logger.error('[Launcher] Fail saveLauncherCache:', resp);
    } else {
        Logger.info('[Launcher] saveLauncherCache OK:', resp);
    }
}

function getSavedCache() {
    return _.result(sharedData.dataManager, 'dataLoaded.launcherCache');
}

function resetCache() {
    lastWalkPathsResult = [];
    saveCache(null);
}

//KTODO: Hacer lo mismo para el package de PATHS
let file2rule = file => {
    let originalData = _.cloneDeep(file);
    delete originalData.iconUrl;

    let ruleFile = {
        _id: path.normalize(file.path),
        title: path.parse(file.path).name,
        searchField: path.parse(file.path).base,
        description: path.normalize(file.path),
        icon: ICON_FILE,
        persistFuzzy: false,
        type: ['file', 'string'],
        initSort: -10,
        path: '/',
        params: {
            drive_path: file.path,
            string: file.path,
            originalData: originalData
        }
    };

    if (file.iconType == 'dataURL' && file.iconUrl) {
        ruleFile.icon = {
            type: 'iconSrc',
            iconData: file.iconUrl
        };
    }

    if (file.iconType == 'iconFont' && file.iconClass) {
        ruleFile.icon = {
            type: 'iconFont',
            iconClass: file.iconClass
        };
    }

    return ruleFile;
};

module.exports = context => {
    //KTODO: Avoid cache, parameter
    let makingGetLauncherRules = false;
    //KTODO: pasar a this. para no tener que usar "params"
    let getLauncherRules = (params, notif = false, resetcache = false) => {
        if (resetcache) {
            resetCache();
        }

        if (makingGetLauncherRules) return;
        makingGetLauncherRules = true;

        let startLaunchTime = new Date();

        Logger.log('[Launcher] --> START Walk');

        aux_driveManager
            .walkPaths(params.config.pathsToWalk.map(aux_driveManager.pathsReplaceEnvVar), {
                options: { ignore: params.config.exclude, nosort: true, nodir: false, strict: false, silent: true }
            })
            .then(resp => {
                Logger.log('[Launcher] --> Walk END, parcial-time:', Moment(new Date()) - Moment(startLaunchTime));

                //FILTER & SORT
                resp = resp.filter(aux_driveManager.checkIsExec).sort();

                //CHECK IS DIFFERENT FROM CACHE (lastWalkPathsResult)
                if (lastWalkPathsResult && lastWalkPathsResult.length && _.isEqual(resp, lastWalkPathsResult)) {
                    if (notif) sharedData.toaster.notify('Refresh launcher rules done.');

                    Logger.info(
                        '[Launcher] rules are the same that last cache:',
                        lastWalkPathsResult.length,
                        '/ Total-time:',
                        Moment(new Date()) - Moment(startLaunchTime)
                    );

                    makingGetLauncherRules = false;
                    return;
                }

                lastWalkPathsResult = resp;

                //WALKPATHS 2 RULES
                aux_driveManager
                    .getMutipleFiles(resp) /* ID:X13 : <- un parametro que le diga si usar cache o no*/
                    .then(execs => {
                        if (params.config.uniqByExec) {
                            execs = _.chain(execs).orderBy(['lnkSource'], ['asc']).uniqBy('realSource').value();
                        }

                        execs = execs.map(file2rule);
                        context.setRules(execs);
                        saveCache(execs);

                        Logger.info('[Launcher] --> DONE / Total-time:', Moment(new Date()) - Moment(startLaunchTime), '/ rules added:', execs.length);

                        //KTODO: 2LangModule
                        if (notif) sharedData.toaster.notify('Refresh launcher rules done.');

                        makingGetLauncherRules = false;
                    })
                    .catch(e => {
                        makingGetLauncherRules = false;
                        Logger.warn('[Launcher] rules add fail:', e);
                    });
            })
            .catch(e => {
                makingGetLauncherRules = false;
                Logger.warn('[Launcher] rules add fail:', e);
            });
    };

    return {
        config: {
            pathsToWalk: [
                /*WIN*/
                '%APPDATA%/Microsoft/Windows/Start Menu/**/*.lnk',
                '%PROGRAMDATA%/Microsoft/Windows/Start Menu/**/*.lnk',
                '%USERPROFILE%/Desktop/*.lnk',
                '%USERPROFILE%/Links/*.lnk',
                '%APPDATA%/Microsoft/Internet Explorer/Quick Launch/User Pinned/TaskBar/*.lnk',
                /*MAC*/
                '/Applications/**/*.app',
                /*LNX*/
                '/usr/local/share/**/*.desktop',
                '/usr/share/applications/**/*.desktop',
                '/var/lib/snapd/desktop/**/*.desktop',
                /*USER*/
                'D:/tmp/**',
                'C:/Dropbox/portable/**',
                'C:/dropbox/Dropbox/portable/**'
            ],
            exclude: [
                '**/*nstall*',
                '**/*unin*',
                '**/*help*',
                '**/*readme*',
                '**/*register*',
                '**/*buy*',
                '**/*update*',
                '**/*run.lnk',
                '**/*release*info*',
                '**/*release*notes*',
                '**/node_modules/**',
                /*MAC*/
                '/Applications/*/*/*/**',
                /*LNX*/
                '/usr/local/share/*/*/*/**',
                '/usr/share/applications/*/*/*/**',
                '/var/lib/snapd/desktop/*/*/*/**',
                /*USER*/
                'D:/tmp/*/*/*/**',
                'C:/Dropbox/portable/*/*/*/*/**',
                'C:/dropbox/Dropbox/portable/*/*/*/*/**'
            ],
            uniqByExec: true,
            remakeIdleTime: 6 * 60 * 60 * 1000
        },
        init() {
            Logger.info('[Launcher] Start');

            //ADD REFRESH TO MENU
            context.addPermanentRules([
                {
                    title: 'Refresh Launcher Catalog',
                    path: 'internal_pack_aux_dev',
                    description: '[ command: rc! ]',
                    type: ['internal_launcher', 'null'],
                    icon: {
                        iconClass: 'mdi-chevron-right text'
                    },
                    params: {
                        action: 'refreshLauncherCatalog'
                    }
                },
                {
                    title: 'Refresh Launcher Catalog',
                    path: 'internal_pack_options',
                    description: '[ command: rc! ]',
                    type: ['internal_launcher', 'null'],
                    icon: {
                        iconClass: 'mdi-cached text'
                    },
                    params: {
                        action: 'refreshLauncherCatalog'
                    }
                }
            ]);

            //REFRESH COMMAND
            context.on('changeQuery', txt => {
                if (!txt.match(/\!$/)) return;
                if (txt === 'rc!' || txt === 'refreshCatalog!') {
                    context.setQuery('');
                    getLauncherRules(this, true, true);
                }
            });

            //GET RULES
            let cacheLaunch = getSavedCache();

            if (cacheLaunch && cacheLaunch.length) {
                setTimeout(() => {
                    Logger.info('[Launcher] getLauncherRules from cache OK');
                    context.setRules(cacheLaunch);
                }, 250);
            } else {
                setTimeout(() => {
                    getLauncherRules(this);
                }, 250);
            }

            sharedData.idleTime.onIdleTimeInterval(() => {
                getLauncherRules(this);
            }, this.config.remakeIdleTime);
        },
        defineTypeExecutors() {
            return [
                {
                    title: 'internal_launcher',
                    type: 'internal_launcher',
                    enabled: obj => {
                        return false;
                    },
                    exectFunc: obj => {
                        let action = _.result(obj.rule, 'params.action');
                        if (action === 'refreshLauncherCatalog') {
                            getLauncherRules(this, true, true);
                        }
                    }
                }
            ];
        }
    };
};
