'use strict';

const _ = require('lodash');
const Config = require('../js/config.js');
const aux_webManager = require('../js/aux_webManager.js');
const linkEvent = require('inferno').linkEvent;
const InfCreateClass = require('inferno-create-class');
const createElement = require('inferno-create-element');

/*https://electron.atom.io/docs/api/webview-tag/*/
function createViewerWebView(params) {
    return InfCreateClass({
        getInitialState: function() {
            return {
                compo: createElement('Loading')
            };
        },
        onClickRule: function(obj) {
            if (!params || !params.geturl) return;
            let html = params.geturl(this.props.rule);
            if (html) aux_webManager.openUrl(html, false);
        },
        componentWillMount: function() {
            this.removeWebView(document.querySelector('webview'));
        },
        componentDidMount: function() {
            params.webviewConfig = params.webviewConfig || {};
            this.options = _.cloneDeep(params.webviewConfig);
            this.options.id = 'iFrameViewFrame';
            this.options.className = 'withTrans';
            this.options.src = params.geturl(this.props.rule);
            this.options.disableguestresize = true;
            this.options.partition = 'viewer';
            this.options.audiomute = true;
            this.options.zoom = 1;
            if (_.result(params, 'webviewConfig.audiomute') !== undefined) this.options.audiomute = params.webviewConfig.audiomute;
            if (_.result(params, 'webviewConfig.zoom') !== undefined) this.options.zoom = params.webviewConfig.zoom;

            this.fetchHtml = _.debounce(rule => {
                if (rule.id !== this.props.rule.id || this.deleted) {
                    this.removeWebView(document.querySelector('webview'));
                    return;
                }

                let createButton = null;
                if ((params && params.geturl && params.geturl(this.props.rule)) || (obj && obj.openUrl)) {
                    createButton = createElement(
                        'buttonsViewer',
                        {},
                        createElement('a', { className: 'feather-stack-2', onClick: linkEvent(null, this.onClickRule) })
                    );
                }

                this.setState(prevState => ({
                    compo: createElement(
                        'span',
                        { id: 'iFrameView', className: 'frameInLoad', allowtransparency: 'false' },
                        createElement('Loading', {}),
                        createElement('webview', this.options),
                        createButton
                    )
                }));
            }, Config.get('here_are_dragons.debounceTime_viewer'));

            this.fetchHtml(_.cloneDeep(this.props.rule));
        },
        componentWillReceiveProps: function(nextProps) {
            if (nextProps.rule && this.props.rule && nextProps.rule.id === this.props.rule.id) return;
            this.removeWebView(document.querySelector('webview'));
            this.setState(prevState => ({
                compo: this.getInitialState().compo
            }));
            this.fetchHtml(_.cloneDeep(nextProps.rule));
        },
        componentWillUnmount: function() {
            this.deleted = true;
            this.removeWebView(this.webview);
            this.webview = null;
            this.iFrameView = null;
        },
        removeWebView: function($webview) {
            if ($webview) {
                try {
                    if ($webview.closeDevTools) $webview.closeDevTools();
                } catch (e) {}
                try {
                    if ($webview.stop) $webview.stop();
                } catch (e) {}
                if ($webview.src) $webview.src = 'about:blank';
                $webview = null;
            }
        },
        componentDidUpdate: function(props) {
            this.webview = document.querySelector('webview');
            this.iFrameView = document.getElementById('iFrameView');

            if (this.webview) {
                this.webview.addEventListener('did-frame-finish-load', () => {
                    if (!this.webview || this.deleted) return;

                    this.openUrl = this.webview.getURL();

                    let accentColor = window.getComputedStyle(document.querySelector('body')).getPropertyValue('--accentColor');
                    if (!accentColor.includes('#')) {
                        accentColor = '#ccc';
                    }

                    if (params && params.insertCSS) this.webview.insertCSS(params.insertCSS);

                    this.webview.insertCSS(
                        String(
                            '::-webkit-scrollbar {width: 4px !important; height: 4px !important; background-color: transparent !important;} ::-webkit-scrollbar-thumb {background: {{accentColor}} !important; border-top: solid 8px transparent !important; border-bottom: solid 8px transparent !important;}'
                        ).replace('{{accentColor}}', accentColor)
                    );

                    this.webview.setAudioMuted(Boolean(this.options.audiomute));
                    this.webview.setZoomFactor(Number(this.options.zoom));

                    if (this.iFrameView) this.iFrameView.className = this.iFrameView.className.replace('frameInLoad', 'frameLoaded');
                });

                this.webview.addEventListener('did-start-loading', () => {
                    if (this.deleted) return;
                    if (this.iFrameView) this.iFrameView.className = this.iFrameView.className.replace('frameLoaded', 'frameInLoad');
                });
            }
        },
        render: function() {
            return this.state.compo;
        }
    });
}

function createViewerHtml(params, htmlPromiseComponent) {
    return InfCreateClass({
        getInitialState: function() {
            return {
                compo: createElement('Loading')
            };
        },
        onClickRule: function(obj) {
            let html = null;
            if (params && params.geturl) {
                html = params.geturl(this.props.rule);
            }
            if (!html && obj && obj.openUrl) {
                html = obj.openUrl;
            }
            if (html) aux_webManager.openUrl(html, false);
        },
        componentDidMount: function() {
            this.fetchHtml = _.debounce(rule => {
                if (this.deleted || rule.id !== this.props.rule.id) return;
                new Promise((resolve, reject) => htmlPromiseComponent(resolve, reject, this.props.rule)).then(obj => {
                    if (this.deleted) return;
                    if (rule.id !== this.props.rule.id) return;

                    let createButton = null;
                    if ((params && params.geturl && params.geturl(this.props.rule)) || (obj && obj.openUrl)) {
                        createButton = createElement(
                            'buttonsViewer',
                            {},
                            createElement('a', { className: 'feather-stack-2', onClick: linkEvent(obj, this.onClickRule) })
                        );
                    }

                    this.setState(prevState => ({
                        compo: createElement('span', {}, obj.component, createButton)
                    }));
                });
            }, Config.get('here_are_dragons.debounceTime_viewer'));

            this.fetchHtml(_.cloneDeep(this.props.rule));
        },
        componentWillUnmount: function() {
            this.deleted = true;
        },
        componentWillReceiveProps: function(nextProps) {
            if (nextProps.rule && this.props.rule && nextProps.rule.id === this.props.rule.id) return;
            this.setState(prevState => ({
                compo: this.getInitialState().compo
            }));
            this.fetchHtml(_.cloneDeep(nextProps.rule));
        },
        render: function() {
            return this.state.compo;
        }
    });
}

function createComponentFromHtml(html) {
    return createElement('div', { dangerouslySetInnerHTML: { __html: html } });
}

function createComponentFromMarkDown(md, baseHref, baseImg) {
    let html = marked(md);

    if (baseHref) {
        html = aux_webManager.replaceHtmlSrc(html, baseImg || baseHref);
        html = aux_webManager.replaceHtmlHrefs(html, baseHref);
    }

    return createComponentFromHtml("<div class='markdownView'>" + html + '</div>');
}

module.exports.createViewerHtml = createViewerHtml;
module.exports.createViewerWebView = createViewerWebView;
module.exports.createComponentFromHtml = createComponentFromHtml;
module.exports.createComponentFromMarkDown = createComponentFromMarkDown;
