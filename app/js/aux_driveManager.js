'use strict';

const _ = require('lodash');
const fs = require('fs-plus');
const path = require('path');
const rimraf = require('rimraf');
const Immutable = require('immutable');
const app = require('electron').remote.app;
const shell = require('electron').remote.shell;
const nativeImage = require('electron').nativeImage;
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');
const ListViewStore = require('../js/listViewStore.js');
const aux_webManager = require('../js/aux_webManager.js');
const walk = require('walk');
const opn = require('opn');
const fileExtension = require('file-extension');
const isUrl = require('is-url');
const isexe = require('isexe');
const child_process = require('child_process');
const globby = require('globby');
const app2png = require('app2png');

let cacheFilesImmutable = Immutable.Map();
const icons = Config.get('icons');

function checkIfNeedUnpopWin() {
    if (Config.get('here_are_dragons.gotoRootOnExec')) {
        ListViewStore.storeActions.backRootRulesPath();
        sharedData.app_window_and_systray.unpopWin();
    }
}

function getFileInfo($pathname) {
    return new Promise((resolve, reject) => {
        let pathname = path.normalize($pathname);
        let isFile = fs.isFileSync(pathname);

        if (cacheFilesImmutable.size && cacheFilesImmutable.size > 0) {
            let cacheFile = cacheFilesImmutable.get(pathname);
            if (cacheFile && cacheFile.params.originalData && cacheFile.icon && cacheFile.icon.iconData) {
                let dataTmp = cacheFile.params.originalData;
                if (icons) dataTmp.iconUrl = cacheFile.icon.iconData;
                resolve(dataTmp);
                return;
            }
        }

        let isDir = !isFile;
        let isEmptyDir = isDir && fs.listSync(pathname).length == 0;

        let data = {
            icon: null,
            iconType: 'null',
            path: pathname,
            isFile: isFile,
            isDir: isDir,
            isEmptyDir: isEmptyDir,
            lnkSource: null,
            realSource: pathname
        };

        if (isFile && pathname.toLowerCase().includes('.lnk')) {
            try {
                let symLink = shell.readShortcutLink(pathname);
                if (symLink && symLink.target) {
                    data.lnkSource = path.normalize(symLink.target);
                    data.realSource = data.lnkSource;
                    if (symLink.args && symLink.args.length) {
                        data.lnkSource += ' ' + symLink.args;
                        data.realSource = data.lnkSource;
                    }
                }
            } catch (e) {}
        }

        if (isDir && !pathname.includes('.app')) {
            resolve(data);
        } else {
            auxGetFileIcon(pathname, ico => {
                if (ico && ico.dataUrl) {
                    data.iconType = 'dataURL';
                    data.iconUrl = ico.dataUrl;
                }
                if (ico && ico.type && ico.iconClass) {
                    data.iconType = ico.type;
                    data.iconClass = ico.iconClass;
                }
                resolve(data);
            });
        }
    });
}

function auxGetMacApptoDataUrl(file) {
    return new Promise((resolve, reject) => {
        let tmpPng = path.normalize(Config.get('here_are_dragons.paths.tmp') + '/' + path.basename(file).replace('.app', '.png'));
        try {
            let dataImg = null;

            app2png
                .convert(file, tmpPng)
                .then(() => {
                    try {
                        //KTODO: En macs no retina usar 32x32
                        dataImg = nativeImage
                            .createFromPath(tmpPng)
                            .resize({ width: 64, height: 64 })
                            .toDataURL();
                    } catch (e) {}
                    if (dataImg) {
                        resolve(dataImg);
                    } else {
                        resolve();
                    }
                    setTimeout(() => {
                        try {
                            rimraf.sync(tmpPng);
                        } catch (e) {}
                    }, 1);
                })
                .catch(e => {
                    Logger.error(e);
                    resolve();
                });
        } catch (e) {
            Logger.error(e);
            resolve();
        }
    });
}

function auxGetFileIcon(file, resolve) {
    if (!icons) {
        resolve();
        return;
    }

    //KTODO: LAS EXTENCIONES CONOCIADAS USAR UN FONTICON
    let ext = path.extname(file).toLowerCase();
    if (ext === '.dll' || ext === '.bin' || ext === '.nls') {
        resolve();
        return;
    }
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.nef' || ext === '.gif') {
        resolve({
            type: 'iconFont',
            iconClass: 'mdi-file-image small_ico text'
        });
        return;
    }
    if (ext === '.js' || ext === '.jsx' || ext === '.json') {
        resolve({
            type: 'iconFont',
            iconClass: 'mdi-language-javascript palette-Amber-A200 text small_ico'
        });
        return;
    }

    //MAC APP ICON
    if (/^darwin/.test(process.platform) && file.includes('.app')) {
        auxGetMacApptoDataUrl(file)
            .then(ico => resolve({ dataUrl: ico }))
            .catch(e => {
                resolve();
            });
        return;
    }

    //KTODO: LNX ICON

    try {
        app.getFileIcon(getLinkIconPath(file), { size: 'normal' }, function(err, res) {
            //KTODO: thread promise
            if (res && res.getSize && res.getSize().width) {
                resolve({ dataUrl: res.toDataURL() });
                return;
            } else {
                resolve();
            }
        });
    } catch (e) {
        resolve();
    }
}

function getLinkIconPath(file) {
    if (file.toLowerCase().includes('.lnk')) {
        try {
            let fileTmp = shell.readShortcutLink(file).target;
            if (
                fileTmp &&
                (fileTmp.toLowerCase().includes('.dll') ||
                    fileTmp.toLowerCase().includes('.exe') ||
                    fileTmp.toLowerCase().includes('.cpl') ||
                    fileTmp.toLowerCase().includes('.msc') ||
                    fileTmp.toLowerCase().includes('.ico'))
            ) {
                file = fileTmp;
            }
        } catch (e) {}
    }
    return file;
}

function checkIsExec(file) {
    if (!fileExsit(file)) return false;

    //MAC .APP
    if (/^darwin/.test(process.platform)) {
        if (/\.app$/.test(file)) {
            return true;
        }
        return false;
    }

    //KTODO: Ver de agarrar los íconos de exec de lnx
    // en LNX ver:
    // http://stackoverflow.com/questions/16258578/how-do-i-check-if-a-file-is-executable-in-node-js

    //WIN NO EXE
    if (/^win/.test(process.platform)) {
        if (
            !file.toLowerCase().includes('.exe') &&
            !file.toLowerCase().includes('.lnk') &&
            !file.toLowerCase().includes('.cpl') &&
            !file.toLowerCase().includes('.msc')
        ) {
            return false;
        }
    }

    // WIN LNK
    if (file.toLowerCase().includes('.lnk')) {
        try {
            let fileTmp = shell.readShortcutLink(file).target;
            if (!fileTmp || !fileExsit(fileTmp) || fileTmp.toLowerCase().includes('.lnk')) {
                return false;
            }
            if (checkIsExec(fileTmp)) {
                return true;
            }
        } catch (e) {}
        //KTODO: Ver .lnk especiales
        // let ws = require('windows-shortcuts');
        //ws.query("c:\\Users\\karacas\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\People - Shortcut.lnk", console.log);
    }

    //LINUX .desktop
    if (/^linux/.test(process.platform)) {
        if (/\.desktop$/.test(file)) {
            return true;
        }
    }

    if (isexe.sync(file)) {
        return true;
    }

    return false;
}

function getMutipleFiles(arr) {
    if (Config.get('here_are_dragons.launcherCache')) {
        let cacheFiles = _.get(sharedData.dataManager, 'dataLoaded.launcherCache') || [];
        cacheFilesImmutable = Immutable.Map(
            cacheFiles.map(el => {
                return [_.get(el, 'params.originalData.path'), el];
            })
        );
    }
    return new Promise((resolve, reject) => {
        Promise.all(arr.filter(fileExsit).map(getFileInfo))
            .then(values => resolve(values))
            .catch(values => resolve(values));
    });
}

function fileExsit(file) {
    return Boolean(fs.existsSync(file));
}

function existDriveWin(drive) {
    if (fs.existsSync(path.normalize(drive + ':/'))) {
        return drive + ':/';
    }
    return false;
}

function pathToArray(pathname) {
    return new Promise((resolve, reject) => {
        fs.readdir(pathname, (err, files) => {
            if (err) {
                resolve([]);
                return;
            }
            let arr = [];
            files.forEach(file => {
                try {
                    let _file = path.normalize(pathname + '/' + file);
                    if (fs.listSync(_file)) {
                        arr.push(_file);
                    }
                } catch (e) {}
            });
            resolve(arr);
        });
    });
}

function getPathRules(pathname) {
    if (pathname == '/' && /^win/.test(process.platform)) {
        let drives = 'abcdefghijklmnopqrstuvwxyz'
            .toUpperCase()
            .split('')
            .filter(item => existDriveWin(item))
            .map(item => item + ':/');
        if (drives.length) {
            return getMutipleFiles(drives);
        }
    }

    return new Promise((resolve, reject) => {
        pathToArray(pathname)
            .then(arr => getMutipleFiles(arr))
            .then(resolve)
            .catch(reject);
    });
}

//KTODO: ver de hacer un open file with SU
function openFile(item, forceSU = false, useOverride = true) {
    let pathItem = _.get(item, 'rule.params.drive_path') || _.get(item, 'params.drive_path') || item;

    Logger.info('[OpenFile]', pathItem);

    if (!pathItem) return;

    //IF URL
    if (isUrl(pathItem)) {
        Logger.info('[OpenFile], isUrl:', pathItem);
        aux_webManager.openUrl(pathItem);
        return;
    }

    //IF NOT EXIST
    if (!fileExsit(pathItem)) {
        sharedData.toaster.notify('Error, file does not exist: ' + pathItem);
        Logger.error('Error, file does not exist: ' + pathItem);
        return;
    }

    //IS EXEC
    if (checkIsExec(pathItem)) {
        Logger.info('[OpenFile], isExec:', pathItem);

        //ON LINUX
        if (/^linux/.test(process.platform)) {
            if (/\.desktop$/.test(pathItem)) {
                let content = fs.readFileSync(pathItem, 'utf-8');
                if (!content) return;

                let exec = /^Exec\s?=\s?(.+)/gm.exec(content);
                if (!exec) return;
                if (!exec[1]) return;

                pathItem = exec[1];
            }

            child_process.exec(pathItem.replace(/%./g, ''), (error, stdout) => {
                if (!error) {
                    checkIfNeedUnpopWin();
                } else {
                    sharedData.toaster.notify('Error opening ' + pathItem);
                    Logger.error(error, 'Error opening ' + pathItem);
                }
            });
            return;
        }

        //WIN-MAC
        if (shell.openItem(pathItem)) {
            checkIfNeedUnpopWin();
            return;
        }

        opn(pathItem)
            .then(r => {
                checkIfNeedUnpopWin();
            })
            .catch(error => {
                sharedData.toaster.notify('Error opening ' + pathItem);
                Logger.error(error, 'Error opening ' + pathItem);
            });

        return;
    }

    //CHECK OVERRRIDE APP FOR THIS EXTENSION
    let defaultApp = null;
    let extension = fileExtension(pathItem);
    let defApps = Config.get('overwriteDefaultFileAssociations');
    if (useOverride && extension && extension.length && defApps && defApps.length) {
        defApps.forEach(app => {
            app.extensions.forEach(ext => {
                if (ext === extension) {
                    defaultApp = app.app;
                }
            });
        });
    }

    //OPEN DOCUMENT IN DEFAULT APP
    try {
        if (defaultApp) {
            opn(pathItem, { app: defaultApp }).then(() => {
                checkIfNeedUnpopWin();
            });
        } else if (shell.openItem(pathItem)) {
            checkIfNeedUnpopWin();
        }
    } catch (e) {
        sharedData.toaster.notify('Error opening ' + pathItem);
        Logger.error(error, 'Error opening ' + pathItem);
    }
}

function execCommand(item, forceSU = false) {
    let cmd = _.get(item, 'rule.params.command');
    if (!cmd) return;
    try {
        child_process.exec(cmd, (error, stdout, stderr) => {
            if (error && !String(error).includes('.cpl') && !String(error).includes('control')) {
                console.log(error, stdout, stderr);
                Logger.error(error);
                return;
            }
            checkIfNeedUnpopWin();
        });
    } catch (e) {
        Logger.error(e);
    }
}

//KTODO: ver de hacer un open file with SU
function openTerminal(item, forceSU = false) {
    let pathItem = _.get(item, 'rule.params.drive_path') || _.get(item, 'params.drive_path') || item;

    if (!pathItem) return;

    let cmd;
    let params;

    let isDir = _.get(item, 'rule.params.isDir') || _.get(item, 'params.isDir');
    if (!isDir && !_.isString(item)) {
        pathItem = path.parse(pathItem).dir;
    }

    //KTODO: LNX

    if (/^darwin/.test(process.platform)) {
        try {
            cmd = Config.get('defaultTerminalApp') || 'Terminal';
            params = pathItem;
            Logger.log('[openTerminal]', cmd, params);
            opn(params, { app: cmd }).then(() => {
                checkIfNeedUnpopWin();
            });
        } catch (e) {
            Logger.error(e);
        }
    }

    if (/^win/.test(process.platform)) {
        try {
            cmd = Config.get('defaultTerminalApp') || ['cmd', '-/K']; //['PowerShell', '-noexit', '-command'];

            let slashD = '';
            if (cmd[0] === 'cmd') slashD = '/d ';

            params =
                'cd ' +
                slashD +
                pathItem
                    .replace(/\//g, '\\')
                    .replace(/\\$/, '')
                    .toLowerCase();

            Logger.log('[openTerminal]', cmd, params);

            opn(params, { app: cmd }).then(() => {
                checkIfNeedUnpopWin();
            });
        } catch (e) {
            Logger.error(e);
        }
    }
}

function walkPaths(arr, params) {
    return new Promise((resolve, reject) => {
        return globby(arr, params.options)
            .then(values => resolve(_.uniq(_.flatten(values))))
            .catch(values => resolve(_.uniq(_.flatten(values))));
    });
}

function pathsReplaceEnvVar(p) {
    return path.normalize(
        p.replace(/%([^%]+)%/g, function(_, n) {
            return process.env[n];
        })
    );
}

function deleteCaches() {
    sharedData.dataManager.deleteCaches();
}

function deleteUserData() {
    sharedData.dataManager.deleteUserData();
}

module.exports.getPathRules = getPathRules;
module.exports.getMutipleFiles = getMutipleFiles;
module.exports.openFile = openFile;
module.exports.pathToArray = pathToArray;
module.exports.walkPaths = walkPaths;
module.exports.checkIsExec = checkIsExec;
module.exports.execCommand = execCommand;
module.exports.fileExsit = fileExsit;
module.exports.openTerminal = openTerminal;
module.exports.pathsReplaceEnvVar = pathsReplaceEnvVar;
module.exports.deleteCaches = deleteCaches;
module.exports.deleteUserData = deleteUserData;
