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
    var result = null;
    if (!obj3) {
        var result = _.mergeWith(cloneDeep(obj1), cloneDeep(obj2), customizer);
    } else {
        var result = _.mergeWith(cloneDeep(obj1), cloneDeep(obj2), cloneDeep(obj3), customizer);
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
        var name = dir + '/' + file;
        if (fs.statSync(name).isDirectory()) {
            return getFiles(name, files);
        } else {
            return name;
        }
    });
}

function krange(
    $value, //VALOR ACTUAL
    $oldMin, //RANGO MINIMO ANTERIOR
    $oldMax, //RANGO ACTUAL ANTERIOR
    $newMin, //NUEVO MINIMO
    $newMax, //NUEVO MAXIMO
    $outPutLimit //LIMITE DEL OUPUT
) {
    var oldMin = $oldMin || 0;
    var oldMax = $oldMax || 1;
    var newMin = $newMin || 0;
    var newMax = $newMax || 1;
    var outPutLimit = $outPutLimit || false;

    var range1 = ($value - oldMin) / (oldMax - oldMin);
    var range2 = (newMax - newMin) * range1 + newMin;

    if (outPutLimit) {
        if (range2 < newMin) range2 = newMin;
        if (range2 > newMax) range2 = newMax;
    }
    return range2;
}

module.exports.cloneDeep = cloneDeep;
module.exports.extendObj = extendObj;
module.exports.getDirectories = getDirectories;
module.exports.getFiles = getFiles;
module.exports.krange = krange;
