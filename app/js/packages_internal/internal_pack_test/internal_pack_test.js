'use strict';

module.exports = context => {
    return {
        init() {
            context.addPermanentRules([
                {
                    title: 'Async Test',
                    type: ['test_object']
                }
            ]);

            context.on('changeQuery', txt => {
                context.logger.log(' -> [TEST] changeQuery:', txt);
                if (txt === 'qq!') {
                    context.setQuery('q!');
                }
                if (txt === 'c!') {
                    context.setQuery('c2!');
                }
                if (txt === 'c2!') {
                    context.setQuery('CHANGE_OK');
                }
            });

            context.on('changePath', path => {
                context.logger.log(' -> [TEST] onChangePath:', path);
            });

            context.on('start', () => {
                context.logger.log(' -> [TEST] start app');
            });

            context.on('show', () => {
                context.logger.log(' -> [TEST] show app');
            });

            context.on('hide', () => {
                context.logger.log(' -> [TEST] hide app');
            });

            context.on('idle', () => {
                context.logger.log(' -> [TEST] app in idle');
            });

            context.on('changeSettings', (path, dif) => {
                context.logger.log(' -> [TEST] app in changeSettings:', path, dif);
            });
        },

        defineTypeExecutors() {
            return [
                {
                    title: 'Test object',
                    type: 'test_object',
                    exectFunc: () => {
                        context.setPath(this.name);
                        context.putLoader(this.name);
                        setTimeout(() => {
                            context.removeLoader(this.name);
                            context.addRules([
                                {
                                    title: 'Loading OK',
                                    path: this.name,
                                    type: ['object']
                                }
                            ]);
                        }, 1000);
                    }
                }
            ];
        }
    };
};
