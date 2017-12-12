'use strict';

const fs = require('fs');
const path = require('path');
const _ = require('lodash');

function cloneDeep(obj) {
    // return Object.assign({}, obj);
    return JSON.parse(JSON.stringify(obj));
}

function customizer(objValue, srcValue) {
    if (_.isArray(srcValue)) {
        return srcValue;
    }
}

function extendObj(obj1, obj2, obj3) {
    let result = null;
    if (!obj3) {
        result = _.mergeWith(cloneDeep(obj1), cloneDeep(obj2), customizer);
    } else {
        result = _.mergeWith(cloneDeep(obj1), cloneDeep(obj2), cloneDeep(obj3), customizer);
    }
    return result;
}

function getDirectories(srcpath) {
    return fs.readdirSync(srcpath).filter(function(file) {
        return fs.statSync(path.join(srcpath, file)).isDirectory();
    });
}

function getFiles(dir, files) {
    if (!fs.existsSync(dir)) {
        mkpath.sync(dir);
    }
    return fs.readdirSync(dir).map(function(file) {
        let name = dir + '/' + file;
        if (fs.statSync(name).isDirectory()) {
            return getFiles(name, files);
        } else {
            return name;
        }
    });
}

function bindKet2actualOs(bind) {
    if (!bind) return '';
    let mod = 'ctrl';
    if (process.platform === 'darwin') mod = 'command';
    return bind.replace('mod', mod);
}

function getKeyFromConfig(arr, action) {
    let k = (arr || []).find(k => k.action === action);
    if (!k || !k.keys) return '';
    k = k.keys[0];
    return bindKet2actualOs(k);
}

function krange(
    $value, //VALOR ACTUAL
    $oldMin, //RANGO MINIMO ANTERIOR
    $oldMax, //RANGO ACTUAL ANTERIOR
    $newMin, //NUEVO MINIMO
    $newMax, //NUEVO MAXIMO
    $outPutLimit //LIMITE DEL OUPUT
) {
    let oldMin = $oldMin || 0;
    let oldMax = $oldMax || 1;
    let newMin = $newMin || 0;
    let newMax = $newMax || 1;
    let outPutLimit = $outPutLimit || false;

    let range1 = ($value - oldMin) / (oldMax - oldMin);
    let range2 = (newMax - newMin) * range1 + newMin;

    if (outPutLimit) {
        if (range2 < newMin) range2 = newMin;
        if (range2 > newMax) range2 = newMax;
    }
    return range2;
}

const aux_getDirName = $__dirname => {
    let __$dirname = String($__dirname);
    if (__$dirname.includes('resources')) {
        __$dirname = __$dirname.slice(0, __$dirname.indexOf('resources'));
    }
    if (__$dirname.includes('node_modules')) {
        __$dirname = __$dirname.slice(0, __$dirname.indexOf('node_modules'));
    }
    return path.normalize(__$dirname).replace(/\\/g, '/');
};

module.exports.cloneDeep = cloneDeep;
module.exports.extendObj = extendObj;
module.exports.getDirectories = getDirectories;
module.exports.getFiles = getFiles;
module.exports.krange = krange;
module.exports.bindKet2actualOs = bindKet2actualOs;
module.exports.getKeyFromConfig = getKeyFromConfig;
module.exports.aux_getDirName = aux_getDirName;
