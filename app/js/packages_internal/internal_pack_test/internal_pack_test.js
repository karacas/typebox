'use strict';

module.exports = {
    init() {
        this.app.addPermanentRules([
            {
                title: 'Async Test',
                type: ['test_object']
            }
        ]);

        this.app.on('changeQuery', txt => {
            this.app.logger.log(' -> [TEST] changeQuery:', txt);
            if (txt === 'qq!') {
                this.app.setQuery('q!');
            }
            if (txt === 'c!') {
                this.app.setQuery('c2!');
            }
            if (txt === 'c2!') {
                this.app.setQuery('CHANGE_OK');
            }
        });

        this.app.on('changePath', path => {
            this.app.logger.log(' -> [TEST] onChangePath:', path);
        });

        this.app.on('start', () => {
            this.app.logger.log(' -> [TEST] start app');
        });

        this.app.on('show', () => {
            this.app.logger.log(' -> [TEST] show app');
        });

        this.app.on('hide', () => {
            this.app.logger.log(' -> [TEST] hide app');
        });

        this.app.on('idle', () => {
            this.app.logger.log(' -> [TEST] app in idle');
        });

        this.app.on('idleHeavy', () => {
            this.app.logger.log(' -> [TEST] app in idleHeavy');
        });

        this.app.on('changeSettings', (path, dif) => {
            this.app.logger.log(' -> [TEST] app in changeSettings:', path, dif);
        });
    },

    defineTypeExecutors() {
        return [
            {
                title: 'Test object',
                type: 'test_object',
                exectFunc: () => {
                    this.app.setPath(this.name);
                    this.app.putLoader(this.name);
                    setTimeout(() => {
                        this.app.removeLoader(this.name);
                        this.app.addRules([
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
