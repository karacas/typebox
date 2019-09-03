'use strict';

const browserBookmarks = require('browser-bookmarks');

function extractHostname(url) {
   var hostname;
   if (url.indexOf('://') > -1) {
      hostname = url.split('/')[2];
   } else {
      hostname = url.split('/')[0];
   }
   hostname = hostname.split(':')[0];
   hostname = hostname.split('?')[0];
   return hostname;
}

module.exports = context => {
   const isurl = context.require('is-url');

   const iconSvgData =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280.028 280.028"><path d="M52.506 0h175.017c9.661 0 17.502 7.832 17.502 17.502v245.024c0 10.212-7.71 17.502-17.502 17.502-8.191 0-70.269-38.81-78.758-43.754-8.497-4.944-8.628-5.233-17.502 0-8.873 5.259-70.409 43.754-78.758 43.754-9.915 0-17.502-7.027-17.502-17.502V17.502C35.004 7.832 42.845 0 52.506 0z" fill="#e2574c"/><path d="M227.523 0h-87.509v232.466c2.258-.018 4.419 1.278 8.751 3.807 8.453 4.927 70.086 43.448 78.618 43.728h.411c9.661-.14 17.23-7.359 17.23-17.475V17.502C245.025 7.832 237.184 0 227.523 0z" fill="#cb4e44"/><path d="M210.048 105.395l-46.038-3.404-23.995-49.486-24.266 49.486-45.758 3.404 30.628 38.197-8.751 48.9 48.147-22.507 48.147 22.507-8.908-48.9 30.794-38.197z" fill="#efc75e"/><path fill="#d7b354" d="M188.162 192.501l-8.909-48.899 30.795-38.207-46.039-3.404-23.994-49.486v117.498z"/></svg>';

   const iconSvg = {
      type: 'iconSvg',
      iconData: iconSvgData,
   };

   return {
      config: { favicons: false },
      init() {
         //Add asyunc rules
         this.pushDocRules2Install = () => {};

         this.pushbookmarkRules = slug => {};

         //INIT
         this.pushbookmarkRules = () => {
            context.putLoader('CHROMEBOOKMARKS_PATH');

            browserBookmarks.getChrome().then(bookmarks => {
               context.addPermanentRules(
                  bookmarks.map(obj => {
                     if (obj && obj.url && isurl(obj.url)) {
                        let title = obj.title;
                        let hostName = extractHostname(obj.url);

                        if (hostName && hostName.indexOf('.') !== -1) {
                           if (title && title.length) {
                              title = `${title} / ${hostName}`;
                           } else {
                              title = hostName;
                           }

                           let icon = iconSvg;

                           if (this.config.favicons && obj.favicon && obj.favicon.length) {
                              icon = {
                                 type: 'iconSrc',
                                 iconData: obj.favicon,
                              };
                           }

                           return {
                              title: title,
                              icon: icon,
                              description: obj.url,
                              path: 'CHROMEBOOKMARKS_PATH',
                              type: ['CHROMEBOOKMARKS_entry'],
                              params: {
                                 openUrl: obj.url,
                              },
                           };
                        }
                        return null;
                     }
                  })
               );
               context.removeLoader('CHROMEBOOKMARKS_PATH');
            });
         };

         context.on('changePath', path => {
            if (path === 'CHROMEBOOKMARKS_PATH') {
               this.pushbookmarkRules();
               this.pushbookmarkRules = () => null; /*ONLY ONCE*/
            }
         });

         context.addPermanentRules([
            {
               title: 'Chrome Bookmarks',
               type: ['CHROMEBOOKMARKSroot'],
               icon: iconSvg,
               params: {
                  changePath: {
                     name: 'Chrome Bookmarks',
                     path: 'CHROMEBOOKMARKS_PATH',
                  },
               },
            },
         ]);
      },
   };
};
