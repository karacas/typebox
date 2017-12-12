'use strict';

module.exports = context => {
    return {
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
                context.logger.log(txt, '< txt');
            };

            this.onChangePath = (pathName, path) => {
                context.logger.log(pathName, path, '< path');
            };

            this.onShow = () => {
                context.logger.log('< show');
            };

            context.on('changeQuery', this.onChangeQuery);
            context.on('changePath', this.onChangePath);
            context.on('show', this.onShow);

            //

            context.on('viewIsReady', () => {
                context.logger.log('SKEL: start app');
            });

            context.on('show', () => {
                context.logger.log('SKEL: show app');
            });

            context.on('hide', () => {
                context.logger.log('SKEL: hide app');
            });

            context.on('idle', () => {
                context.logger.log('SKEL: app in idle');
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
};
