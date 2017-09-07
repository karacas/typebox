'use strict';

const _ = require('lodash');
const favManager = require('../../favManager.js');
const Config = require('../../config.js');
const { bindKet2actualOs, getKeyFromConfig } = require('../../../auxfs.js');
let lastFavs = [];

module.exports = context => {
    return {
        init() {
            let fixedOptions = Number(Config.get('fixedTypeBoxOptions'));
            //Add main rule
            context.addPermanentRules([
                {
                    title: 'Favorites',
                    type: ['Favorites', 'null'],
                    description: '[ command: f! / shortcut: ' + getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'FAVS') + ' ]',
                    icon: favManager.getIcon(),
                    fav_permit: false,
                    initSort: 10,
                    posFixed: fixedOptions * 10,
                    params: {
                        changePath: favManager.getPath()
                    }
                }
            ]);

            this.pushRules = () => {
                let favs = favManager.getFavItems();
                if (_.isEqual(favs, lastFavs)) {
                    //Avoid Loop
                    return;
                }
                lastFavs = favs;
                let packFav = [];
                favs.forEach(fav => {
                    fav.persistFuzzy = false;
                    fav.path = favManager.getPath().path;
                    fav.addInHistory = false;
                    packFav.push(fav);
                });
                context.setRules(packFav);
            };

            context.on('changePath', path => {
                if (path === favManager.getPath().path) {
                    this.pushRules();
                }
            });

            context.on('avoidCache', path => {
                if (context.getPath().path === favManager.getPath().path) {
                    this.pushRules();
                }
            });
        },
        defineTypeExecutors() {
            return [
                {
                    title: 'Add to Favorites',
                    type: 'object',
                    description: '[ shortCut: ' + getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'TOGGLE_FAVORITE') + ' ]',
                    id: 'package_internal_add_fav',
                    icon: {
                        iconClass: 'mdi-star small_ico'
                    },
                    enabled: obj => {
                        if (obj.fav_permit === false) return false;
                        if (obj.favorite === true) return false;
                        if (obj.path === favManager.getPath().path) return false;
                        return true;
                    },
                    exectFunc: obj => {
                        if (obj.fav_permit === false) return;
                        if (obj.favorite === true) return;
                        if (obj.path === favManager.getPath().path) return;
                        context.toggle(obj.rule);
                    }
                },
                {
                    title: 'Remove from Favorites',
                    type: 'object',
                    description: '[ shortCut: ' + getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'TOGGLE_FAVORITE') + ' ]',
                    id: 'package_internal_remove_fav',
                    icon: {
                        iconClass: 'mdi-star-off small_ico'
                    },
                    enabled: obj => {
                        if (obj.path === favManager.getPath().path) return true;
                        if (obj.favorite === true) return true;
                        return false;
                    },
                    exectFunc: obj => {
                        context.toggle(obj.rule);
                        return false;
                    }
                }
            ];
        }
    };
};
