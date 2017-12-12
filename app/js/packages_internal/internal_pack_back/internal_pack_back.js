'use strict';

module.exports = context => {
    return {
        init() {
            const _ = context.require('lodash');

            let pairs = [];
            let noPush = false;

            this.aux_resetPairs = () => {
                pairs = [];
            };

            this.aux_comparePaths = (path1, path2) => {
                //KTODO: Que sea un método de los paths y hacer otro que sea ifRoot
                return (_.get(path1, 'path') || path1) === (_.get(path2, 'path') || path2);
            };

            this.aux_comparelast = (query, path, last) => {
                return last && last.lastQuery === query && this.aux_comparePaths(path, last.lastPath);
            };

            this.aux_dropRight = () => {
                if (pairs.length > 0) {
                    pairs = _.dropRight(pairs, 1);
                }
            };

            this.aux_getLast = () => {
                if (pairs && pairs.length > 0) {
                    return pairs[pairs.length - 1];
                }
                this.aux_resetPairs();
                return null;
            };

            this._aux_gotoDir = (query, path) => {
                if (query === null || path === null) return;

                query = query.replace(/\s$/, '');
                query = query.replace(/!$/, '');

                if (!this.aux_comparePaths(path, context.getPath())) {
                    context.setPath(path);
                }
                if (query !== context.getQuery()) {
                    context.setQuery(query);
                }
            };

            this.pushHist = (query, path) => {
                if (query === null || path === null) return;

                if (noPush) {
                    noPush = false;
                    return;
                }

                let pathString = _.get(path, 'path') || path;
                if (query === '' && pathString === '/') return;

                let last = this.aux_getLast();
                var objToPush = { lastQuery: query, lastPath: path };

                if (last && this.aux_comparePaths(path, last.lastPath)) {
                    if (last.lastQuery == '' || (query !== last.lastQuery && query !== '' && !last.lastQuery.includes(query))) {
                        pairs[pairs.length - 1] = objToPush;
                    }
                } else {
                    if (pathString === '/') {
                        objToPush.lastQuery = '';
                    }
                    pairs.push(objToPush);
                }
            };

            this.pushHistDelay = (...args) => {
                setTimeout(() => {
                    this.pushHist(...args);
                });
            };

            this.onChangeQuery = txt => {
                this.pushHistDelay(txt, context.getPath());
            };

            this.onChangePath = (pathName, path) => {
                this.pushHistDelay(context.getQuery(), path);
            };

            this.goBackHist = () => {
                let goTo = this.aux_getLast();

                if (!goTo) {
                    this._aux_gotoDir('', '/');
                    return;
                }

                this.aux_dropRight();
                noPush = true;

                if (this.aux_comparelast(context.getQuery(), context.getPath(), goTo)) {
                    this.goBackHist();
                    return;
                }

                this._aux_gotoDir(goTo.lastQuery, goTo.lastPath);
            };

            context.on('changeQuery', this.onChangeQuery);
            context.on('changePath', this.onChangePath);
            context.on('goBackHist', this.goBackHist);
            this.pushHist(context.getQuery(), context.getPath());
        }
    };
};
