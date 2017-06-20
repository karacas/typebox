'use strict';

const _ = require('lodash');
const Config = require('../js/config.js');
const aux_webManager = require('../js/aux_webManager.js');
const linkEvent = require('inferno').linkEvent;
const InfCreateClass = require('inferno-create-class');
const createElement = require('inferno-create-element');

/*https://electron.atom.io/docs/api/webview-tag/*/
function createViewerWebView() {
    return InfCreateClass({
        getInitialState: function() {
            return {
                compo: createElement('Loading')
            };
        },
        onClickRule: function(obj) {
            let html = _.result(this, 'props.rule.params.openUrl');
            if (obj.openUrl) {
                html = obj.openUrl;
            }
            if (html) aux_webManager.openUrl(html, false);
        },
        componentWillMount: function() {
            this.removeWebView(document.querySelector('webview'));
        },
        componentDidMount: function() {
            //KTODO: Que se puedan extender los settings
            this.options = {
                useragent: 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) like Gecko',
                useragent: 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0',
                partition: 'viewer',
                audiomute: true,
                zoom: 1
            };

            this.fetchHtml = _.debounce(rule => {
                if (rule.id !== this.props.rule.id || this.deleted) {
                    this.removeWebView(document.querySelector('webview'));
                    return;
                }
                this.setState(prevState => ({
                    compo: createElement(
                        'span',
                        { id: 'iFrameView', className: 'frameInLoad', allowtransparency: 'false' },
                        createElement('Loading', {}),
                        createElement('webview', {
                            id: 'iFrameViewFrame',
                            className: 'withTrans',
                            src: _.result(this, 'props.rule.params.openUrl'),
                            disableguestresize: true,
                            useragent: this.options.useragent,
                            __guestinstance: 'test',
                            __partition: this.options.partition
                        }),
                        createElement('buttonsViewer', {}, createElement('a', { className: 'feather-stack-2', onClick: linkEvent(null, this.onClickRule) }))
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

                    //KTODO: Que se pueda setear directo como opcion del plugin
                    this.webview.insertCSS(String('.logo{display:none!important} h1.lemma {margin: 15px 0 0 0!important;} #footer{display:none!important;}}'));

                    this.webview.insertCSS(
                        String(
                            '::-webkit-scrollbar {width: 4px !important; height: 4px !important; background-color: transparent !important;} ::-webkit-scrollbar-thumb {background: {{accentColor}} !important; border-top: solid 8px transparent !important; border-bottom: solid 8px transparent !important;}'
                        ).replace('{{accentColor}}', accentColor)
                    );

                    //KTODO: Que se pueda setear directo como opcion del plugin
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

function createViewerHtml(htmlPromiseComponent) {
    return InfCreateClass({
        getInitialState: function() {
            return {
                compo: createElement('Loading')
            };
        },
        onClickRule: function(obj) {
            let html = _.result(this, 'props.rule.params.openUrl');
            if (obj.openUrl) {
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
                    this.setState(prevState => ({
                        compo: createElement(
                            'span',
                            {},
                            obj.component,
                            createElement('buttonsViewer', {}, createElement('a', { className: 'feather-stack-2', onClick: linkEvent(obj, this.onClickRule) }))
                        )
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

module.exports.createViewerHtml = createViewerHtml;
module.exports.createViewerWebView = createViewerWebView;
module.exports.createComponentFromHtml = createComponentFromHtml;
