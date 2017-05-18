'use strict';

module.exports = {
    config: {
        test: 1,
        test2: "['a', 'b']",
        test3: {
            a: 1,
            b: 2
        }
    },
    init() {
        this.onChangeQuery = txt => {
            this.app.logger.log(txt, '< txt');
        };

        this.onChangePath = (pathName, path) => {
            this.app.logger.log(pathName, path, '< path');
        };

        this.onShow = () => {
            this.app.logger.log('< show');
        };

        this.app.on('changeQuery', this.onChangeQuery);
        this.app.on('changePath', this.onChangePath);
        this.app.on('show', this.onShow);

        //

        this.app.on('start', () => {
            this.app.logger.log('SKEL: start app');
        });

        this.app.on('show', () => {
            this.app.logger.log('SKEL: show app');
        });

        this.app.on('hide', () => {
            this.app.logger.log('SKEL: hide app');
        });

        this.app.on('idle', () => {
            this.app.logger.log('SKEL: app in idle');
        });

        this.app.on('idleHeavy', () => {
            this.app.logger.log('SKEL: app in idleHeavy');
        });
    },
    __defineTypeExecutors() {
        return [
            {
                title: 'Place Text 2',
                type: 'string',
                id: 'package_default2_place_string',
                exectFunc: obj => {}
            }
        ];
    }
};
