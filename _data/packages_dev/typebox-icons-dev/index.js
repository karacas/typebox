'use strict';
module.exports = context => {
    return {
        init() {
            var colorIdex = -1;
            var colors = [
                'palette-Red-A100 text',
                'palette-Pink-A100 text',
                'palette-Purple-A100 text',
                'palette-Deep-Purple-A100 text',
                'palette-Indigo-A100 text',
                'palette-Blue-A100 text',
                'palette-Light-Blue-A100 text',
                'palette-Cyan-A100 text',
                'palette-Teal-A100 text',
                'palette-Green-A100 text',
                'palette-Light-Green-A100 text',
                'palette-Lime-A100 text',
                'palette-Yellow-A100 text',
                'palette-Amber-A100 text',
                'palette-Orange-A100 text',
                'palette-Deep-Orange-A100 text',
                /**/
                'palette-Red-A200 text',
                'palette-Pink-A200 text',
                'palette-Purple-A200 text',
                'palette-Deep-Purple-A200 text',
                'palette-Indigo-A200 text',
                'palette-Blue-A200 text',
                'palette-Light-Blue-A200 text',
                'palette-Cyan-A200 text',
                'palette-Teal-A200 text',
                'palette-Green-A200 text',
                'palette-Light-Green-A200 text',
                'palette-Lime-A200 text',
                'palette-Yellow-A200 text',
                'palette-Amber-A200 text',
                'palette-Orange-A200 text',
                'palette-Deep-Orange-A200 text',
                /**/
                'palette-Red-A400 text',
                'palette-Pink-A400 text',
                'palette-Purple-A400 text',
                'palette-Deep-Purple-A400 text',
                'palette-Indigo-A400 text',
                'palette-Blue-A400 text',
                'palette-Light-Blue-A400 text',
                'palette-Cyan-A400 text',
                'palette-Teal-A400 text',
                'palette-Green-A400 text',
                'palette-Light-Green-A400 text',
                'palette-Lime-A400 text',
                'palette-Yellow-A400 text',
                'palette-Amber-A400 text',
                'palette-Orange-A400 text',
                'palette-Deep-Orange-A400 text',
                /**/
                'palette-Red-A700 text',
                'palette-Pink-A700 text',
                'palette-Purple-A700 text',
                'palette-Deep-Purple-A700 text',
                'palette-Indigo-A700 text',
                'palette-Blue-A700 text',
                'palette-Light-Blue-A700 text',
                'palette-Cyan-A700 text',
                'palette-Teal-A700 text',
                'palette-Green-A700 text',
                'palette-Light-Green-A700 text',
                'palette-Lime-A700 text',
                'palette-Yellow-A700 text',
                'palette-Amber-A700 text',
                'palette-Orange-A700 text',
                'palette-Deep-Orange-A700 text'
            ];

            context.addPermanentRules([
                {
                    title: 'Font Icons',
                    type: ['FIroot'],
                    icon: {
                        iconClass: 'feather-box'
                    },
                    params: {
                        changePath: {
                            path: 'FI_PATH'
                        }
                    }
                }
            ]);

            this.pushRules = () => {
                context.putLoader('FI_PATH');

                setTimeout(() => {
                    let arrIcons = require('./data_icos_feather_material.js');
                    let packIcons = [];
                    arrIcons.forEach(icon => {
                        colorIdex++;
                        if (colorIdex >= colors.length) {
                            colorIdex = 0;
                        }
                        packIcons.push({
                            title: icon + ' / ' + colors[colorIdex],
                            type: ['string', 'FIroot'],
                            path: 'FI_PATH',
                            icon: {
                                iconClass: 'icon ' + icon,
                                iconClassColor: colors[colorIdex]
                            }
                        });
                    });
                    context.addPermanentRules(packIcons);
                    context.deleteRules(packIcons);
                }, 20);
            };

            context.on('changePath', path => {
                if (path === 'FI_PATH') {
                    this.pushRules();
                    this.pushRules = () => null; /*ONLY ONCE*/
                }
            });
        }
    };
};
