'use strict';
const Inferno = require('inferno');

module.exports = context => {
    const InfCreateClass = context.require('inferno-create-class');
    const EventEmitter = context.require('events');
    const mousetrap = context.require('mousetrap');
    const changeColorEvent = new EventEmitter().setMaxListeners(100);

    var robot = null;
    try {
        robot = context.require('robotjs');
    } catch (e) {}

    const generateColorIcon = hex => {
        return {
            type: 'iconSvg',
            iconData: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><circle cx="200" cy="200" r="200" fill="' + hex + '"/></svg>'
        };
    };

    const COLOR_PATH_OBJ = {
        path: 'COLOR_PATH',
        icon: { iconClass: 'mdi-eyedropper-variant' },
        name: 'Color picker',
        ephemeral: true
    };

    //KTODO: Usar esta funcion también par createColorTitle.render
    const generateStaticRule = rule => {
        return {
            title: rule.title,
            icon: generateColorIcon(rule.params.hex),
            path: 'COLOR_PATH',
            type: ['string']
        };
    };

    const createColorTitle = params => {
        return InfCreateClass({
            getInitialState: function() {
                return {
                    hex: null
                };
            },
            componentDidMount: function() {
                if (!changeColorEvent) return;
                changeColorEvent.on('change_color', hex => {
                    this.setState(prevState => ({ hex: hex }));
                    this.props.rule.title = '#' + hex;
                    this.props.rule.params.hex = '#' + hex;
                });
            },
            render: function() {
                this.colorStyle = function(options) {
                    return {
                        display: 'inline-block',
                        width: '32px',
                        height: '32px',
                        border: 'solid 1px rgba(128,128,128,0.3)',
                        transform: 'translateY(-2%)',
                        background: '#' + this.state.hex,
                        'margin-right': '8px',
                        'vertical-align': 'middle',
                        'border-radius': '100%',
                        'box-shadow': '0 1px 1px rgba(0,0,0,0.2)'
                    };
                };
                return (
                    <span>
                        <span style={this.colorStyle()} className="avoidCache-1" />
                        <span>{'#' + this.state.hex}</span>
                    </span>
                );
            }
        });
    };

    const createCompColor = config => {
        return InfCreateClass({
            getInitialState: function() {
                return {
                    hex: null
                };
            },
            nextFrame: function() {
                if (!robot) {
                    return;
                }
                this.mouse = robot.getMousePos();
                this.setState(prevState => ({ hex: robot.getPixelColor(this.mouse.x, this.mouse.y) }));
                if (changeColorEvent) {
                    changeColorEvent.emit('change_color', this.state.hex);
                }
            },
            moveMouseDown: function() {
                if (!robot) return;
                robot.moveMouse(this.mouse.x, this.mouse.y + 1);
                this.nextFrame();
            },
            moveMouseUp: function() {
                if (!robot) return;
                robot.moveMouse(this.mouse.x, this.mouse.y - 1);
                this.nextFrame();
            },
            componentDidMount: function() {
                if (!Mousetrap || !changeColorEvent) return;
                this.mousetrap = new Mousetrap(document.querySelector('mousetrapColor'));
                this.mousetrap.bind(['down'], this.moveMouseDown);
                this.mousetrap.bind(['up'], this.moveMouseUp);
                this.interval = setInterval(() => this.nextFrame(), config.interval);
            },
            componentWillUnmount: function() {
                if (!this.mousetrap) return;

                clearInterval(this.interval);

                if (changeColorEvent) {
                    changeColorEvent.removeAllListeners('change_color');
                }

                this.mousetrap.reset();
                this.mousetrap = null;
            },
            render: function() {
                this.colorStyle = function(options) {
                    return {
                        display: 'block',
                        width: 'calc(100% - 2px)',
                        height: 'calc(100% - 2px)',
                        border: 'solid 1px rgba(128,128,128,0.3)',
                        background: '#' + this.state.hex
                    };
                };
                return (
                    <colorWrapp>
                        <span style={this.colorStyle()} />
                        <span name="message" class="mousetrap mousetrapColor" />
                    </colorWrapp>
                );
            }
        });
    };

    return {
        config: { interval: 64 },
        init() {
            if (!robot) {
                context.logger.error('No robot.js');
                return;
            }

            //ROOT RULE
            context.addPermanentRules([
                {
                    title: 'Color Picker',
                    type: ['obj'],
                    icon: { iconClass: 'mdi-eyedropper-variant' },
                    params: { changePath: COLOR_PATH_OBJ }
                }
            ]);

            //DYNAMIC RULE
            context.on('changePath', path => {
                if (path === 'COLOR_PATH') {
                    context.setRules([
                        //KTODO: No paint Highligh
                        {
                            title: 'Color',
                            persistFuzzy: true,
                            icon: { type: 'noIcon' },
                            path: 'COLOR_PATH',
                            type: ['colorPick', 'string'],
                            component: createColorTitle({ time: this.config.interval }),
                            generateStaticRule: generateStaticRule
                        }
                    ]);
                }
            });
        },
        defineTypeViewers() {
            return [
                {
                    type: 'colorPick',
                    title: 'Viewer color pick',
                    useBlend: false,
                    viewerComp: createCompColor(this.config)
                }
            ];
        }
    };
};
