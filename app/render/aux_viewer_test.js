'use strict';

const { debounce } = require('lodash');
const Config = require('@render/config.js');
const { textToHTML, escapeCodeHTML, get, cloneDeep } = require('@aux/aux_global.js');

const React = require('react');
const CreateReactClass = require('create-react-class');
const createElement = React.createElement;

const Logger = require('@render/logger.js');

/*https://electron.atom.io/docs/api/webview-tag/*/
function createViewerWebView(params) {
   return CreateReactClass({
      getInitialState: function() {
         return {
            compo: createElement('div', { className: 'loading_nop' }),
         };
      },
      componentDidMount: function() {
         params.webviewConfig = params.webviewConfig || {};
         this.options = cloneDeep(params.webviewConfig);
         this.options.id = 'iFrameViewFrame';
         this.options.className = 'withTrans';
         this.options.partition = this.options.partition || 'viewer'; //KTODO: persist y el nombre del plugin

         this.fetchHtml = debounce(rule => {
            this.options.src = params.geturl(this.props.rule);
            // this.options.baseURLForDataURL = params.geturl(this.props.rule);

            if (_ruleIsDeleted(this, rule)) {
               this.removeWebView(document.querySelector('webview'));
               return;
            }

            this.setState(prevState => {
               return {
                  compo: createElement(
                     'span',
                     { id: 'iFrameView', className: 'frameInLoad __ForceNoAutofocus', allowtransparency: 'false' },
                     createElement('webview', this.options)
                  ),
               };
            });
         }, params.debounceTime_viewer || Config.get('here_are_dragons.debounceTime_viewer') * 0.5);

         this.fetchHtml(cloneDeep(this.props.rule));
      },
      _componentDidMount: function() {
         //para cambiar el user agent:
         // mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
         //    console.log(details.requestHeaders);
         //   details.requestHeaders['User-Agent'] = '"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11) AppleWebKit/601.1.27 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/601.1.27"';
         //   callback({ cancel: false, requestHeaders: details.requestHeaders });
         // });

         params.webviewConfig = params.webviewConfig || {};
         this.options = cloneDeep(params.webviewConfig);
         this.options.id = 'iFrameViewFrame';
         this.options.style = { opacity: 1 };
         delete this.options.useragent;
         delete this.options.partition;

         this.fetchHtml = debounce(rule => {
            this.options.src = params.geturl(this.props.rule);

            if (_ruleIsDeleted(this, rule)) {
               this.removeWebView(document.querySelector('webview'));
               return;
            }

            this.setState(prevState => {
               return {
                  compo: createElement(
                     'span',
                     { id: 'iFrameView', className: 'frameInLoad', allowtransparency: 'false' },
                     createElement('iframe', this.options)
                  ),
               };
            });
         }, params.debounceTime_viewer || Config.get('here_are_dragons.debounceTime_viewer') * 0.5);

         this.fetchHtml(cloneDeep(this.props.rule));
      },
      UNSAFE_componentWillReceiveProps: function(nextProps) {
         if (nextProps.rule && this.props.rule && nextProps.rule.id === this.props.rule.id) return;
         this.removeWebView(document.querySelector('webview'));
         this.setState(prevState => ({
            compo: this.getInitialState().compo,
         }));
         this.fetchHtml(cloneDeep(nextProps.rule));
      },
      componentWillUnmount: function() {
         this.deleted = true;
         this.removeWebView(this.webview);
      },
      removeWebView: function($webview) {},
      componentDidUpdate: function(props) {
         this.webview = document.querySelector('webview');
         this.iFrameView = document.getElementById('iFrameView');

         let timeInit = new Date();

         if (this.webview) {
            this.webview.addEventListener('did-start-loading', () => {
               if (this.deleted) return;
               if (params.openDevTools) this.webview.openDevTools();
               timeInit = new Date();
               //if (this.iFrameView) this.iFrameView.className = this.iFrameView.className.replace('frameLoaded', 'frameInLoad');
            });

            this.webview.addEventListener('dom-ready', () => {
               setTimeout(() => {
                  if (!this.webview || this.deleted) return;

                  //this.webview.openDevTools();

                  // this.webview.executeJavaScript('document.querySelector("h1.window-title").textContent', result => {
                  //    if (result && result.includes('Chrome 36')) {
                  //       console.log('Chrome 36, reload!');
                  //       // this.webview.reload();
                  //    }
                  // });

                  //const devtools = this.webview.getWebContents();
                  //let script = 'WebInspector.settings.createSetting("bypassServiceWorker", true)';

                  // this.webview.webContents.devToolsWebContents.executeJavaScript(script, result => {
                  //    console.log(1, result);
                  // });

                  // devtools.executeJavaScript(script, name => {
                  //    console.log(2, name);
                  // });
               }, 1);
               if (this.iFrameView) this.iFrameView.classList.remove('frameInLoad');
               if (this.iFrameView) this.iFrameView.classList.add('frameLoaded');
            });
         }
      },
      render: function() {
         return this.state.compo;
      },
   });
}

function _ruleIsDeleted(obj, rule) {
   try {
      return obj.deleted || rule.id !== obj.props.rule.id;
   } catch (e) {
      return true;
   }
}

module.exports.createViewerWebView = createViewerWebView;
