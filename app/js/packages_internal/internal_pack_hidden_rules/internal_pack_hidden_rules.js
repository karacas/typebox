'use strict';

const _ = require('lodash');
const hiddenRulesManager = require('../../hiddenRulesManager.js');
var hiddenRules = [];

module.exports = {
    init() {
        //Add main rule
        this.app.addPermanentRules([
            {
                title: 'View hidden items',
                type: ['Hidden', 'null'],
                icon: {
                    type: 'iconFont',
                    iconClass: 'mdi-eye-outline-off text'
                },
                fav_permit: false,
                description: '[ command: h! ]',
                path: 'internal_pack_options',
                initSort: 10,
                params: {
                    changePath: hiddenRulesManager.getPath()
                }
            }
        ]);

        this.pushRules = () => {
            let hiddenItems = hiddenRulesManager.gethiddenItems();

            if (_.isEqual(hiddenItems, hiddenRules)) {
                //Avoid Loop
                return;
            }
            hiddenRules = hiddenItems;
            let packHidden = [];
            hiddenItems.forEach(hidden => {
                hidden.persistFuzzy = false;
                hidden.path = hiddenRulesManager.getPath().path;
                hidden.addInHistory = false;
                packHidden.push(hidden);
            });
            this.app.setRules(packHidden);
        };

        this.app.on('changePath', path => {
            if (path === hiddenRulesManager.getPath().path) {
                this.pushRules();
            }
        });

        this.app.on('avoidCache', path => {
            if (this.app.getPath().path === hiddenRulesManager.getPath().path) {
                this.pushRules();
            }
        });
    },
    defineTypeExecutors() {
        return [
            {
                title: 'Hide',
                type: 'object',
                id: 'package_internal_add_hide',
                icon: {
                    iconClass: 'mdi-eye-outline-off small_ico'
                },
                enabled: obj => {
                    if (obj.hidden_permit === false) return false;
                    if (obj.path === hiddenRulesManager.getPath().path) return false;
                    if (hiddenRulesManager.isHide(obj.id)) return false;
                    return true;
                },
                exectFunc: obj => {
                    if (obj.hidden_permit === false) return;
                    if (obj.path === hiddenRulesManager.getPath().path) return;
                    if (hiddenRulesManager.isHide(obj.id)) return;
                    hiddenRulesManager.push(obj.rule);
                }
            },
            {
                title: 'Remove from hidden',
                type: 'object',
                id: 'package_internal_remove_hide',
                icon: {
                    iconClass: 'mdi-eye-outline small_ico'
                },
                enabled: obj => {
                    if (obj.path === hiddenRulesManager.getPath().path) return true;
                    return false;
                },
                exectFunc: obj => {
                    if (obj.path === hiddenRulesManager.getPath().path) return;
                    obj.rule.hidden_permit = false;
                    hiddenRulesManager.remove(obj.rule);
                }
            }
        ];
    }
};
