'use strict';

const _ = require('lodash');
const favManager = require('../../favManager.js');
var lastFavs = [];

module.exports = {
    init() {
        //Add main rule
        this.app.addPermanentRules([
            {
                title: 'Favorites',
                type: ['Favorites', 'null'],
                description: '[ command: f! / shortcut: ctrl+shift+f ]',
                icon: favManager.getIcon(),
                fav_permit: false,
                initSort: 5,
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
                fav.favorite = true;
                fav.persistFuzzy = false;
                fav.path = favManager.getPath().path;
                fav.addInHistory = false;
                packFav.push(fav);
            });
            this.app.setRules(packFav);
        };

        this.app.on('changePath', path => {
            if (path === favManager.getPath().path) {
                this.pushRules();
            }
        });

        this.app.on('avoidCache', path => {
            if (this.app.getPath().path === favManager.getPath().path) {
                this.pushRules();
            }
        });
    },
    defineTypeExecutors() {
        return [
            {
                title: 'Add to Favorites',
                type: 'object',
                description: '[ shortCut: ctrl+f ]',
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
                    this.app.toggle(obj.rule);
                }
            },
            {
                title: 'Remove from Favorites',
                type: 'object',
                description: '[ shortCut: ctrl+f ]',
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
                    this.app.toggle(obj.rule);
                }
            }
        ];
    }
};
