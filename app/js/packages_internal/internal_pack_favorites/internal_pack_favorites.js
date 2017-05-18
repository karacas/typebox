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
                fav.path = 'FAVS_PATH';
                fav.addInHistory = false;
                packFav.push(fav);
            });
            this.app.setRules(packFav);
        };

        this.app.on('changePath', path => {
            if (path === 'FAVS_PATH') {
                this.pushRules();
            }
        });

        this.app.on('avoidCache', path => {
            if (this.app.getPath().path === 'FAVS_PATH') {
                this.pushRules();
            }
        });
    },
    defineTypeExecutors() {
        return [
            {
                title: 'Add to Favorites',
                type: 'object',
                id: 'package_internal_add_fav',
                icon: {
                    iconClass: 'mdi-star small_ico'
                },
                enabled: obj => {
                    if (obj.fav_permit === false) return false;
                    if (obj.favorite === true) return false;
                    return true;
                },
                exectFunc: obj => {
                    this.app.toggle(obj.rule);
                }
            },
            {
                title: 'Remove from Favorites',
                type: 'object',
                id: 'package_internal_remove_fav',
                icon: {
                    iconClass: 'mdi-star small_ico'
                },
                enabled: obj => {
                    if (obj.fav_permit === false) return false;
                    if (obj.favorite === !true) return false;
                    return true;
                },
                exectFunc: obj => {
                    this.app.toggle(obj.rule);
                }
            }
        ];
    }
};
