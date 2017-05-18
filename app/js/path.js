'use strict';

var defaultPath = {
    path: '/',
    name: null,
    sort: true,
    sortBy: null,
    keepQueryValue: false,
    path: null,
    avoidCache: false,
    avoidHystory: false
};

module.exports.get = path => {
    let result = Object.assign({}, defaultPath, path);
    if (!result.path) result.path = '/';
    return result;
};
