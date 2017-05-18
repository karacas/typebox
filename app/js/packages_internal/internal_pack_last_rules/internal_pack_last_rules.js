'use strict';

const _ = require('lodash');
const lastRulesManager = require('../../lastRulesManager.js');
var lastRules = [];

module.exports = {
    init() {
        //Add main rule
        this.app.addPermanentRules([
            {
                title: 'Hystory',
                type: ['Hystory', 'null'],
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
                last.path = 'LAST_RULES_PATH';
                last.addInHistory = false;
                packlast.push(last);
            });
            this.app.setRules(packlast);
        };

        this.app.on('changePath', path => {
            if (path === 'LAST_RULES_PATH') {
                this.pushRules();
            }
        });

        this.app.on('avoidCache', path => {
            if (this.app.getPath().path === 'LAST_RULES_PATH') {
                this.pushRules();
            }
        });
    },
    defineTypeExecutors() {
        return [
            {
                title: 'Remove from Hystory',
                type: 'object',
                id: 'package_internal_remove_last',
                enabled: obj => {
                    if (obj.path !== 'LAST_RULES_PATH') return false;
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
