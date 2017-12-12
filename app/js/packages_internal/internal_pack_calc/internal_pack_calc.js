'use strict';

const _ = require('electron').remote.require('lodash');
const mathjs = require('mathjs');
const HistoryManager = require('../../historyManager.js');
const LastRulesManagerPush = require('../../lastRulesManager.js').push;
const createRule = require('../../rule.js').getNewRule;

module.exports = context => {
    let lastCalcRule = null;
    let putedHistory = false;
    return {
        init() {
            const CALC_PLUGIN_PATH = this.name;

            const CALC_ICON = {
                type: 'iconFont',
                iconClass: 'mdi-calculator text'
            };

            const CALC_PATH = {
                path: CALC_PLUGIN_PATH,
                icon: CALC_ICON,
                name: 'calc',
                keepQueryValue: true,
                ephemeral: true
            };

            let generateStaticRule = rule => {
                return {
                    title: rule.title,
                    icon: rule.icon,
                    path: rule.path,
                    addInHistory: false,
                    params: rule.params,
                    order: context.getTime(),
                    type: ['calc', 'string']
                };
            };

            let saveLastExp = () => {
                if (lastCalcRule !== null) {
                    try {
                        lastCalcRule = createRule(generateStaticRule(lastCalcRule));
                        if (lastCalcRule) {
                            LastRulesManagerPush(lastCalcRule);
                        }
                    } catch (e) {}
                    lastCalcRule = null;
                }
            };

            let putHistory = (force = false) => {
                if (force) putedHistory = false;
                if (putedHistory) return;
                context.addRules(
                    context.getlastItemsPath(CALC_PLUGIN_PATH).map($last => {
                        return Object.assign({}, $last, {
                            title: '[ History ] ' + $last.title,
                            persistFuzzy: true,
                            addInHistory: false,
                            specialScoreMult: 0,
                            generateStaticRule: null,
                            fav_permit: false,
                            path: CALC_PLUGIN_PATH
                        });
                    })
                );
                putedHistory = true;
            };

            let deleteRules = () => {
                context.deleteRules();
                putedHistory = false;
            };

            context.on('changeQuery', txt => {
                let RULES_PATH = context.getPath().path;

                if (RULES_PATH === CALC_PLUGIN_PATH) {
                    context.setResult('');
                    if (txt === '') {
                        context.setPath('/');
                        return;
                    }
                }

                if (txt === '=' && RULES_PATH === '/') {
                    context.setPath(CALC_PATH);
                    RULES_PATH = CALC_PLUGIN_PATH;
                }

                if (txt.length >= 3 && (RULES_PATH === '/' || RULES_PATH === CALC_PLUGIN_PATH)) {
                    let exp = null;

                    let txtToExp = txt;

                    if (txtToExp[0] === '=') txtToExp = txtToExp.substring(1);

                    try {
                        exp = mathjs.eval(txtToExp);
                    } catch (e) {}

                    if (
                        String(exp).includes('undefined') ||
                        txtToExp.slice(0, 4) === 'func' ||
                        txtToExp.slice(0, 3) === 'drop' ||
                        txtToExp.slice(0, 3) === 'exp' ||
                        String(exp).length > 120 ||
                        String(exp).includes('throw') ||
                        String(exp).includes('return')
                    ) {
                        exp = null;
                    }

                    if (exp !== null && String(exp) !== String(txtToExp)) {
                        lastCalcRule = {
                            title: txtToExp + ' = ' + exp,
                            addInHistory: false,
                            hidden_permit: false,
                            persistFuzzy: true,
                            posFixed: 1,
                            path: CALC_PLUGIN_PATH,
                            icon: CALC_ICON,
                            generateStaticRule: generateStaticRule,
                            type: ['calc', 'string'],
                            params: {
                                string: String(exp)
                            }
                        };

                        context.setRules([lastCalcRule]);
                        putHistory(true);

                        context.setResult(' = ' + exp);
                        if (RULES_PATH !== CALC_PLUGIN_PATH) {
                            context.setPath(CALC_PATH);
                        }
                    }
                }

                if (RULES_PATH === CALC_PLUGIN_PATH) {
                    putHistory();
                }
            });

            context.on('changePath', path => {
                if (path === '/') {
                    deleteRules();
                }
                if (path !== CALC_PLUGIN_PATH) {
                    saveLastExp();
                }
            });
        },
        defineTypeExecutors() {
            return [
                {
                    title: 'calc',
                    id: 'calc',
                    type: 'calc',
                    enabled: obj => {
                        return false;
                    },
                    exectFunc: obj => {
                        context.writeString(obj.rule.params.string || obj.rule.title);
                        return false;
                    }
                }
            ];
        }
    };
};
