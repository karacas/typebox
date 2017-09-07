'use strict';

const _ = require('electron').remote.require('lodash');
const mathjs = require('mathjs');

module.exports = context => {
    let generateStaticRule = rule => {
        return {
            title: rule.title,
            icon: rule.icon,
            path: rule.path,
            params: rule.params,
            order: context.getTime(),
            type: ['calc', 'string']
        };
    };

    return {
        init() {
            context.on('changeQuery', txt => {
                const RULES_PATH = context.getPath().path;

                const CALC_ICON = {
                    type: 'iconFont',
                    iconClass: 'mdi-calculator text'
                };

                const CALC_PATH = {
                    path: this.name,
                    icon: CALC_ICON,
                    name: 'calc',
                    keepQueryValue: true
                };

                if ((txt.length > 2 && RULES_PATH === '/') || RULES_PATH === this.name || txt === '=') {
                    let txtToExp = txt;
                    let exp = null;
                    try {
                        if (txtToExp[0] === '=') txtToExp = txtToExp.substring(1);
                        exp = mathjs.eval(txtToExp);
                        if (String(exp).includes('undefined') || String(exp).includes('function') || String(exp).includes('drop')) {
                            exp = null;
                        }
                    } catch (e) {}

                    if (exp !== null && exp !== Number(txt)) {
                        context.setRules([
                            {
                                title: txtToExp + ' = ' + exp,
                                addInHistory: false,
                                hidden_permit: false,
                                persistFuzzy: true,
                                posFixed: 1,
                                path: this.name,
                                icon: CALC_ICON,
                                generateStaticRule: generateStaticRule,
                                type: ['calc', 'string'],
                                params: {
                                    string: String(exp)
                                }
                            }
                        ]);
                        context.setResult(' = ' + exp);
                    }

                    //History Rules
                    if ((exp !== null && exp !== Number(txt)) || txt === '=') {
                        context.addRules(
                            context.getlastItemsPath(this.name).map($last => {
                                let last = _.cloneDeep($last);
                                last.title = '[ History ] ' + last.title;
                                last.persistFuzzy = true;
                                last.addInHistory = false;
                                last.specialScoreMult = 0;
                                last.fav_permit = false;
                                last.path = this.name;
                                return last;
                            })
                        );
                        context.setPath(CALC_PATH);
                    } else {
                        context.setResult('');
                        context.deleteRules();
                    }
                }

                if (!txt.length && RULES_PATH === this.name) {
                    context.deleteRules();
                    context.setResult('');
                    context.setPath('/');
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
