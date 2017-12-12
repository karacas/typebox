'use strict';
const path = require('path');

module.exports = context => {
    const svelte = context.require('svelte');
    const _ = context.require('lodash');

    let fileCompo = path.join(context.packsUtils.aux_getDirName(__dirname), '/App.svelte');
    let code = context.packsUtils.getString(fileCompo);
    let svelte_appCompo = svelte.create(code, { format: 'eval' });

    let svelte_appCompo_setInstance = ins => {
        ins.set({ casa: 'CASA!' });
    };

    return {
        config: { test: 1 },
        init() {
            context.addPermanentRules([
                {
                    title: 'Sveltle Test, num:',
                    type: ['test_svelte']
                },
                {
                    title: 'Sveltle Test 2, num:',
                    type: ['test_svelte']
                }
            ]);
        },
        defineTypeViewers() {
            const createSvelteComp = () => {
                return context.packsUtils.inferno_svelete({
                    component: svelte_appCompo,
                    onInstance: svelte_appCompo_setInstance,
                    data: {
                        count: 10,
                        _deburr: _.deburr
                    }
                });
            };

            return [
                {
                    title: 'Sveltle Test',
                    type: 'test_svelte',
                    viewerComp: createSvelteComp()
                }
            ];
        }
    };
};
