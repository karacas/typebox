'use strict';

module.exports = context => {
   return {
      init() {
         const { dropRight } = context.require('lodash');
         const History = context.require('immutable-undo');
         const get = context.get;
         const cloneDeep = context.cloneDeep;
         const $timeout = context.global_aux.$timeout;
         const getPathString = path => get(path, 'path') || path;
         const aux_comparePaths = (path1, path2) => getPathString(path1) === getPathString(path2);
         const aux_comparelast = (query, path, last) => last && last.lastQuery === query && aux_comparePaths(path, last.lastPath);

         let noPush = false;
         let history = History.create({ maxUndos: 100 }).push({ lastQuery: '', lastPath: '/' });

         const _aux_gotoDir = (query, path) => {
            if (query === null || path === null) return;

            query = query.replace(/\s$/, '');
            query = query.replace(/!$/, '');

            context.setPath(path);

            if (query && query !== context.getQuery()) {
               context.setQuery(query);
            }
         };

         this.pushHist = async (query, path) => {
            if (query === null || path === null) return;

            if (noPush) {
               noPush = false;
               return;
            }

            await $timeout(1);

            let last = history && history.canUndo && history.previous ? cloneDeep(history.previous) : null;
            let actual = cloneDeep({ lastQuery: context.getQuery(), lastPath: context.getPath() });
            let objToPush = true ? actual : cloneDeep({ lastQuery: query, lastPath: path });

            if (last && aux_comparePaths(objToPush.lastPath, last.lastPath)) return;

            history = history.push(objToPush);
         };

         this.onChangeQuery = txt => {
            this.pushHist(txt, context.getPath());
         };

         this.onChangePath = (pathName, path) => {
            this.pushHist(context.getQuery(), path);
         };

         this.goBackHist = () => {
            if (!history.canUndo) {
               _aux_gotoDir('', '/');
               return;
            }

            let actual = cloneDeep({ lastQuery: context.getQuery(), lastPath: context.getPath() });

            let undo = history.previous ? history.previous : null;
            if (!undo || !undo.lastPath) return;

            history = history.undo(actual);

            noPush = true;
            _aux_gotoDir(undo.lastQuery, undo.lastPath);
         };

         this.goForwardHist = () => {
            if (!history.canRedo) return;

            let actual = cloneDeep({ lastQuery: context.getQuery(), lastPath: context.getPath() });

            let redo = history.next ? history.next : null;
            if (!redo || !redo.lastPath) return;

            history = history.redo(actual);

            noPush = true;
            _aux_gotoDir(redo.lastQuery, redo.lastPath);
         };

         context.on('changePath', this.onChangePath);
         context.on('goBackHist', this.goBackHist);
         context.on('goForwardHist', this.goForwardHist);
         // context.on('changeQuery', this.onChangeQuery);
         // this.pushHist(context.getQuery(), context.getPath());
      },
   };
};
