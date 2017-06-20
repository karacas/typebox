'use strict';

const _ = require('lodash');
const lastRulesManager = require('../../lastRulesManager.js');
const Config = require('../../config.js');
const { bindKet2actualOs, getKeyFromConfig } = require('../../../auxfs.js');
let lastRules = [];

module.exports = context => {
    return {
        init() {
            //Add main rule
            context.addPermanentRules([
                {
                    title: 'History',
                    type: ['History', 'null'],
                    description: '[ shortcut: ' + getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'HISTORY') + ' ]',
                    icon: lastRulesManager.getIcon(),
                    fav_permit: false,
                    initSort: 10,
                    params: {
                        changePath: lastRulesManager.getPath()
                    }
                }
            ]);

            this.pushRules = () => {
                let lasts = lastRulesManager.getlastItems();
                if (_.isEqual(lasts, lastRules)) {
                    //Avoid Loop
                    return;
                }
                lastRules = lasts;
                let packlast = [];
                lasts.forEach(last => {
                    last.persistFuzzy = false;
                    last.path = lastRulesManager.getPath().path;
                    last.addInHistory = false;
                    packlast.push(last);
                });
                context.setRules(packlast);
            };

            context.on('changePath', path => {
                if (path === lastRulesManager.getPath().path) {
                    this.pushRules();
                }
            });

            context.on('avoidCache', path => {
                if (context.getPath().path === lastRulesManager.getPath().path) {
                    this.pushRules();
                }
            });
        },
        defineTypeExecutors() {
            return [
                {
                    title: 'Remove from History',
                    type: 'object',
                    id: 'package_internal_remove_last',
                    icon: {
                        iconClass: 'mdi-restart small_ico'
                    },
                    enabled: obj => {
                        if (obj.path !== lastRulesManager.getPath().path) return false;
                        return true;
                    },
                    exectFunc: obj => {
                        obj.rule.last_permit = false;
                        lastRulesManager.remove(obj.rule);
                    }
                }
            ];
        }
    };
};
