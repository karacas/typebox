'use strict';

const DEFAULT_PATH = {
    path: '/',
    name: null,
    sort: true,
    sortBy: null,
    keepQueryValue: false,
    checkNews: false,
    avoidCache: false,
    avoidHistory: false,
    ephemeral: false
};

module.exports.get = path => {
    let result = Object.assign({}, DEFAULT_PATH, path);
    if (!result.path) result.path = '/';
    if (result.path === '/') {
        result.checkNews = true;
    } else {
        result.checkNews = path.checkNews;
    }
    return result;
};
