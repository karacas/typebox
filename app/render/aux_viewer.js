'use strict';

//KTODO: pasar a JSX

const React = require('react');
const createElement = React.createElement;
const CreateReactClass = require('create-react-class');

const { debounce } = require('lodash');
const { sanitize } = require('dompurify');
const Config = require('@render/config.js');
const lrucache = require('lru-cache');
const ms = require('ms');

const aux_webManager = require('@render/aux_web_manager.js');
const highlight = require('@render/aux_highlight.js');
const Logger = require('@render/logger.js');
const { textToHTML, escapeCodeHTML, get, cloneDeep, makeHash } = require('@aux/aux_global.js');

const cache_sanitizeHTML = new lrucache({ max: 64, maxAge: ms('1h') });
const cache_sanitizeSVG = new lrucache({ max: 64, maxAge: ms('1h') });
const cache_marked = new lrucache({ max: 64, maxAge: ms('1h') });

let marked = null;
let htmlToText = null;
let $highlight = null;
let highlightReact = null;

const a_html_tag = /<a[\s]+([^>]+)>/g;
function target2blank(str, repl = '<a target="_blank" data-open="defaultBrowser" $1>') {
   return str.replace(a_html_tag, repl);
}

const sanitizeHTML = content => {
   if (!content) return content;

   const idCode = makeHash(content);

   const mem = cache_sanitizeHTML.get(idCode);
   if (mem) return mem;

   const result = { __html: sanitize(content, { ADD_ATTR: ['target'] }) };
   cache_sanitizeHTML.set(idCode, result);

   return result;
};

const sanitizeSVG = content => {
   if (!content) return content;

   const idCode = makeHash(content);

   const mem = cache_sanitizeSVG.get(idCode);
   if (mem) return mem;

   const result = { __html: sanitize(content, { ADD_TAGS: ['use'], USE_PROFILES: { svg: true } }) };
   cache_sanitizeSVG.set(idCode, result);
   return result;
};

/*https://electron.atom.io/docs/api/webview-tag/*/
function createViewerWebView(params) {
   return CreateReactClass({
      getInitialState() {
         if (params.loader && params.loader === !!params.loader) {
            return {
               compo: createElement('span', { className: 'loading' }),
            };
         }
         return {
            compo: createElement(React.Fragment),
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
         this.options = cloneDeep(params.webviewConfig);
         this.options.id = 'iFrameViewFrame';
         this.options.className = 'withTrans __noBackground __ForceNoAutofocus';
         this.options.partition = this.options.partition || 'viewer';
         this.options.zoom = 1;

         if (get(params, 'webviewConfig.audiomute') !== undefined) this.options.audiomute = params.webviewConfig.audiomute;
         if (get(params, 'webviewConfig.zoom') !== undefined) this.options.zoom = params.webviewConfig.zoom;

         this.fetchHtml = debounce(rule => {
            this.options.src = params.geturl(this.props.rule);

            //KTODO: Ver seguridad de esto
            this.options.disablewebsecurity = 1;

            if (Config.isDev) Logger.info('[webview] url:', this.options.src);

            if (_ruleIsDeleted(this, rule)) {
               this.removeWebView(document.querySelector('webview'));
               return;
            }

            let createButton = null;
            if (!params.avoidCreateButton) {
               if ((params && params.geturl && params.geturl(this.props.rule)) || (obj && obj.openUrl)) {
                  createButton = createElement(
                     'div',
                     { className: 'buttonsviewer' },
                     createElement('a', { className: 'fe-link tb-icon', onClick: e => this.onClickRule(null) })
                  );
               }
            }

            this.setState(prevState => {
               return {
                  compo: createElement(
                     'span',
                     { id: 'iFrameView', className: 'frameInLoad', allowtransparency: 'false' },
                     params.loader && params.loader === !!params.loader ? createElement('span', { className: 'loading' }) : createElement(React.Fragment),
                     createElement('webview', this.options),
                     createButton
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

         let timeInit = new Date();

         if (this.webview) {
            this.webview.addEventListener('did-start-loading', () => {
               if (this.deleted) return;
               if (Config.isDev) Logger.info('dom-start-loading:', new Date() - timeInit);
               if (params.openDevTools) this.webview.openDevTools();
               timeInit = new Date();
            });
            this.webview.addEventListener('dom-ready', () => {
               if (!this.webview || this.deleted) return;

               this.openUrl = this.webview.getURL();

               if (Config.isDev) Logger.info('dom-ready:', new Date() - timeInit);

               let accentColor = window.getComputedStyle(document.querySelector('body')).getPropertyValue('--accentColor');
               if (!accentColor.includes('#')) {
                  accentColor = '#ccc';
               }

               if (params && params.insertCSS) this.webview.insertCSS(params.insertCSS);
               if (params && params.executeJavaScript) this.webview.executeJavaScript(params.executeJavaScript);

               this.webview.insertCSS(
                  String(
                     `::-webkit-scrollbar {
                         width: 4px !important;
                         height: 4px !important;
                         background-color:
                         transparent !important;
                     }
                     ::-webkit-scrollbar-thumb {
                         background: {{accentColor}} !important;
                         border-top: solid 8px transparent !important;
                         border-bottom: solid 8px transparent !important;
                     }
                    `
                  ).replace('{{accentColor}}', accentColor)
               );

               this.webview.setAudioMuted(Boolean(this.options.audiomute));
               this.webview.setZoomFactor(Number(this.options.zoom));

               setTimeout(() => {
                  if (this.iFrameView) this.iFrameView.classList.remove('frameInLoad');
                  if (this.iFrameView) this.iFrameView.classList.add('frameLoaded');
                  if (params.onDomReady) params.onDomReady();
               }, 10);
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

function _getUrlButtonFromRule(params, rule, $this) {
   try {
      let html = null;
      if (params && params.geturl) {
         html = params.geturl($this.props.rule);
      }
      if (!html && rule && rule.openUrl) {
         html = rule.openUrl;
      }
      return html;
   } catch (e) {
      return null;
   }
}

function _highlightCode($document, makeHighlight) {
   //KTODO: que el querySelectorAll se pueda hacer a traves de params.querySelectorAll
   // let codePre = $document.querySelectorAll('#ruleViewer_child pre code.formatCode');
   let codePre = $document.getElementsByClassName('formatCode');
   let code = $document.querySelector('#ruleViewer_child');
   if (makeHighlight && code && codePre.length && code.innerHTML) {
      highlight(String(code.innerHTML), 'pre code.formatCode').then(response => {
         if ($document.querySelector('#ruleViewer_child') && response) {
            $document.querySelector('#ruleViewer_child').innerHTML = response;
            let codeHide = $document.querySelector('#ruleViewer_child.hideObj');
            if (codeHide) codeHide.classList.remove('hideObj');
         }
      });
   } else {
      let codeHide = $document.querySelector('#ruleViewer_child.hideObj');
      if (codeHide) codeHide.classList.remove('hideObj');
   }
}

//COMPONENTE BASE, ES EL QUE PONE EL LOADER Y CAMBIA EL COMPONENTE AL MOVERSE POR LAS RULES
function createViewerHtml(params, htmlPromiseComponent, makeHighlight = true) {
   if (params.highlight === false) makeHighlight = false;
   if (params.highlight === true) makeHighlight = true;
   return CreateReactClass({
      getInitialState() {
         if (params.loader) {
            return {
               compo: createElement('span', { className: 'loading' }),
            };
         }
         return {
            compo: createElement(React.Fragment),
         };
      },
      onClickRule(rule) {
         let html = _getUrlButtonFromRule(params, rule, this);
         if (html) aux_webManager.openUrl(html, false);
      },
      componentDidMount() {
         this.fetchHtml = debounce(rule => {
            if (_ruleIsDeleted(this, rule)) return;

            this.setState(prevState => ({
               compo: params.loader === !!params.loader && !params.loader ? createElement(React.Fragment) : createElement('span', { className: 'loading' }),
            }));

            new Promise((resolve, reject) => htmlPromiseComponent(resolve, reject, this.props.rule)).then(obj => {
               if (_ruleIsDeleted(this, rule)) return;

               let createButton = null;
               if (_getUrlButtonFromRule(params, obj, this)) {
                  createButton = createElement(
                     'div',
                     { className: 'buttonsviewer' },
                     createElement('a', {
                        title: 'Open in browser',
                        className: 'fe-link tb-icon',
                        onClick: e => this.onClickRule(obj),
                     })
                  );
               }

               this.setState(prevState => ({
                  compo: createElement(
                     'span',
                     { id: 'ruleViewer_child', className: `hideObj${params.extraClass}` ? ` ${params.extraClass}` : '' },
                     obj.component,
                     createButton
                  ),
               }));

               setTimeout(() => {
                  if (_ruleIsDeleted(this, rule)) return;
                  if (obj.executeJavaScript) obj.executeJavaScript();
                  if (params.onDomReady) params.onDomReady();
               }, 1);
            });
         }, params.debounceTime_viewer || Config.get('here_are_dragons.debounceTime_viewer') * 0.5);

         if (this.props.rule) this.fetchHtml(cloneDeep(this.props.rule));
      },
      componentDidUpdate() {
         _highlightCode(document, makeHighlight);
      },
      componentWillUnmount() {
         this.deleted = true;
      },
      UNSAFE_componentWillReceiveProps: function(nextProps) {
         if (nextProps.rule && this.props.rule && nextProps.rule.id === this.props.rule.id) return;
         this.setState(prevState => ({
            compo: this.getInitialState().compo,
         }));
         this.fetchHtml(cloneDeep(nextProps.rule));
      },
      render: function() {
         return this.state.compo;
      },
   });
}

function createComponentFromHtml(html, opt = {}) {
   let extraClass = opt.extraClass;
   return createElement('div', { className: extraClass, dangerouslySetInnerHTML: sanitizeHTML(html) });
}

function md2html(md, baseHref, baseImg, { makeHighlight = true, target_blank = true } = {}) {
   const idCode = makeHash(md + baseHref + baseImg + makeHighlight);
   const mem = cache_marked.get(idCode);
   if (mem) return mem;

   //KTODO: Gloabal
   let options = {
      baseHref: baseHref,
      breaks: true,
      xhtml: true,
   };

   if (makeHighlight) {
      $highlight = $highlight || require('highlight.js');

      options.highlight = function(code, lang) {
         if (lang) {
            try {
               return $highlight.highlight(lang, code).value;
            } catch (e) {}
         }
         return $highlight.highlightAuto(code).value;
      };
   }

   marked = marked || require('marked');
   let html = marked(md, options);

   if ((baseImg || baseHref) && html) {
      html = aux_webManager.replaceHtmlSrc(html, baseImg || baseHref);
   }

   //Replace target
   if (false && target_blank) html = target2blank(html);

   html = html || '';

   cache_marked.set(idCode, html);

   return html;
}

function html2txt(html, options) {
   htmlToText = htmlToText || require('html-to-text');
   return htmlToText.fromString(html, options);
}

function createComponentFromMarkDownElement(md, baseHref, baseImg) {
   return createComponentFromHtml(`<div class='markdownView'>${md2html(md, baseHref, baseImg)}</div>`);
}

function createComponentFromMarkDownKrc(
   md,
   baseHref,
   baseImg,
   { debounceTime_viewer = null, makeHighlight = true, target_blank = true, mdAutoHighSize = 20 * 1024 } = {}
) {
   return CreateReactClass({
      getInitialState() {
         return {
            html: md2html(md, baseHref, baseImg, { makeHighlight: md.length < mdAutoHighSize }),
         };
      },
      componentDidMount() {
         if (!makeHighlight || md.length < mdAutoHighSize) return;
         let timeHighlight = debounceTime_viewer || Config.get('here_are_dragons.debounceTime_viewer') || 256;
         setTimeout(() => {
            if (this.deleted) return;
            this.setState({ html: md2html(md, baseHref, baseImg, { makeHighlight: true }) });
         }, timeHighlight);
      },
      componentWillUnmount() {
         this.deleted = true;
      },
      render() {
         return createElement('div', { className: 'markdownView', dangerouslySetInnerHTML: sanitizeHTML(this.state.html) });
      },
   });
}

function createComponentFromMarkDownCompo(md, baseHref, baseImg, { makeHighlight = true, target_blank = true, mdAutoHighSize = 20 * 1024 } = {}) {
   return CreateReactClass({
      render() {
         let _html = md2html(md, baseHref, baseImg, { makeHighlight: false, target_blank }) || '';

         if (makeHighlight) {
            highlightReact = highlightReact || require('react-highlight').default;
            return createElement(highlightReact, { innerHTML: true, className: 'markdownView markdownViewCompo' }, sanitizeHTML(_html).__html);
         } else {
            return createElement('div', { className: 'markdownView', dangerouslySetInnerHTML: sanitizeHTML(_html) });
         }
      },
   });
}

function ruleIfCode(rule) {
   if (!rule || typeof rule !== 'object') return false;
   return !!(
      (get(rule, 'type') && get(rule, 'type').includes('snippet')) ||
      (get(rule, 'type') && get(rule, 'type').includes('plain_code')) ||
      get(rule, 'params.codeclass') ||
      get(rule, 'params.snippet') ||
      get(rule, 'params.plain_code')
   );
}

function getHtmlCodeDataFromRule(rule, forceCode = false, wordwrap = true) {
   let html_res = '';
   let isCode = ruleIfCode(rule) || forceCode;
   let codeClass = 'noBack';

   if (wordwrap && !get(rule, 'params.no-word-wrap')) codeClass += ' word-wrap';

   let str = '';
   if (typeof rule === 'string') str = rule;
   if (typeof content === 'object')
      str = get(rule, 'plain_code') || get(rule, 'params.plain_code') || get(rule, 'params.snippet') || get(rule, 'params.string') || rule.title || '';

   let html = '';

   if (isCode) {
      codeClass = `${codeClass} ${get(rule, 'params.codeclass') || ''}`;
      codeClass = `${codeClass} ` + `preWhiteSpace`;
      codeClass = `${codeClass} ` + `formatCode`;

      str = escapeCodeHTML(str);
      html = `<pre class="noBack"><code class="${codeClass}">${str}</code></pre>`;
   } else {
      str = textToHTML(str);
      html = `<span class="${codeClass}"><code>${str}</code></span>`;
   }

   html_res = `<div class="">${html}</"div">`;

   return html_res;
}

function string2HtmlCode(text, forceCode = false) {
   if (typeof text !== 'string') {
      logger.warn('[string2HtmlCode]', text, 'is no string  / ', typeof text);
      text = String(text);
   }
   return getHtmlCodeDataFromRule({ plain_code: text }, forceCode);
}

module.exports.createViewerHtml = createViewerHtml;
module.exports.createViewerWebView = createViewerWebView;
module.exports.createComponentFromHtml = createComponentFromHtml;
module.exports.createComponentFromMarkDown = createComponentFromMarkDownKrc;
module.exports.createComponentFromMarkDownElement = createComponentFromMarkDownElement;
module.exports.getHtmlCodeDataFromRule = getHtmlCodeDataFromRule;
module.exports.md2html = md2html;
module.exports.html2txt = html2txt;
module.exports.target2blank = target2blank;
module.exports.string2HtmlCode = string2HtmlCode;
module.exports.textToHTML = textToHTML;
module.exports.escapeCodeHTML = escapeCodeHTML;
module.exports.ruleIfCode = ruleIfCode;
module.exports._ruleIsDeleted = _ruleIsDeleted;
module.exports._getUrlButtonFromRule = _getUrlButtonFromRule;
module.exports._highlightCode = _highlightCode;
module.exports.sanitizeHTMLReact = sanitizeHTML;
module.exports.sanitizeSVGReact = sanitizeSVG;
module.exports.sanitizeHTML = sanitize;
