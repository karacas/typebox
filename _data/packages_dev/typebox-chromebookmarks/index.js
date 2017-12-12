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

    const iconData =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4HsAAAAw1BMVEVVVVUAAABVVVVmX1WZgFj1uFz5vlz3ulz/xFyIdVj9wVzLXFJ2T0qSS0HIQi7PQCzPWlPUQCvYp1rEWlPWWlPSoVlvZFL9vlvTSC/3sVvBWVOWc1TCdEL+w1z/vFPzrlj/qlX/tFjLZFPAYlOKdlipilnwX1D/wVzwXU/+uFv+9/bxZlHxZ1n/wFzxalzxYFHNQCzPQy/uXU76YFDPQSz97Ov/xl3SSjD8tln+YFD2X1D/wV3zYFDMPivyZ1L8ZlHtW03rebOEAAAAJnRSTlMEAAcYEu7u7u0Y7Y0XE+7tge2OgoJ/Evvtv3w8Lu/s5rGtjokfG/u3O9UAAAG+SURBVFjD7ZTZbsIwEEU9hLBvZd+6tziUhtBSwr78/1fVDogB3AwOSOkLA7pgWefKPiIwYACHcXZOCTERiOwCoJrJGtkMFYJBAph4R2R6Ae3nx3o+d5fL+0bdbLQACdFzwLP2g9sdD37kyyeW44lbax3xDFfw5M4n4+WAGFEwdxuRPSF5XFVNLgq+yBEF3KzuefmJbcmUzbu9zTcxm16X24koHvtIYjQmClYdh5jOqst53PCRaMS5OIHVIcaSJ4hF/5bIoglbqyCV9JFomFon4KZBSNQooCTuCyx1dgV6Ep2+Ok4AiVZ/9HE6o76lI5Eu0JfofKrjaEukC2iJ9BVCkUheIQyJ9BXCk0j/lGmJxMMU4uNMF9z+E28SbxL/SeJsdp3EYbM5vUbisABQGl4iEXkGhUVgicjLXSjPLpM4TMO2HQrT4BKRl1GaBpaIvNyVJvUlqjya1JOo8p5JbYkqjya1JCo8mtSTqPBoUk+iH8+gvNCRqPJoMj07L3GNvBqQXp+TaL8QvNh4tWmJbpHgPWMVlxMSVV41WeT3vhJtgkeTxZqfxLcKxaPJyvuJROFhdxvwvtGxRXEJDK4IBr+m+Dh2KRLKywAAAABJRU5ErkJggg==';

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
                                        title = title + ' / ' + hostName;
                                    } else {
                                        title = hostName;
                                    }

                                    let icon = iconData;

                                    if (this.config.favicons && obj.favicon && obj.favicon.length) {
                                        icon = {
                                            type: 'iconSrc',
                                            iconData: obj.favicon
                                        };
                                    }

                                    return {
                                        title: title,
                                        icon: icon,
                                        description: obj.url,
                                        path: 'CHROMEBOOKMARKS_PATH',
                                        type: ['CHROMEBOOKMARKS_entry'],
                                        params: {
                                            openUrl: obj.url
                                        }
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
                    icon: iconData,
                    params: {
                        changePath: {
                            name: 'Chrome Bookmarks',
                            path: 'CHROMEBOOKMARKS_PATH'
                        }
                    }
                }
            ]);
        }
    };
};
