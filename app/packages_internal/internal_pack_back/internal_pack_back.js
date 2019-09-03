'use strict';

module.exports = context => {
   return {
      init() {
         const { dropRight } = context.require('lodash');
         const { History } = context.require('stateshot');

         const get = context.get;
         const cloneDeep = context.cloneDeep;
         const $timeout = context.global_aux.$timeout;
         const getPathString = path => get(path, 'path') || path;
         const aux_comparePaths = (path1, path2) => getPathString(path1) === getPathString(path2);
         const aux_comparelast = (query, path, last) => last && last.lastQuery === query && aux_comparePaths(path, last.lastPath);

         let noPush = false;

         const history = new History();
         history.pushSync({ lastQuery: '', lastPath: '/' }); // the terser `history.push` API is async

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

            let last = history ? history.get() : {};
            let actual = cloneDeep({ lastQuery: context.getQuery(), lastPath: context.getPath() });
            let objToPush = true ? actual : cloneDeep({ lastQuery: query, lastPath: path });

            if (last && last.lastPath && aux_comparePaths(objToPush.lastPath, last.lastPath)) return;

            history.pushSync(objToPush);
         };

         this.onChangeQuery = txt => {
            this.pushHist(txt, context.getPath());
         };

         this.onChangePath = (pathName, path) => {
            this.pushHist(context.getQuery(), path);
         };

         this.goBackHist = () => {
            let undo = history ? history.undo().get() : null;
            if (!undo || !undo.lastPath) return;

            noPush = true;
            _aux_gotoDir(undo.lastQuery, undo.lastPath);
         };

         this.goForwardHist = () => {
            let redo = history ? history.redo().get() : null;
            if (!redo || !redo.lastPath) return;

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
