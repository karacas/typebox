'use strict';

//WIP
const React = require('react');
const CreateReactClass = require('create-react-class');
const themeManager = require('@render/theme_manager.js');
const Config = require('@render/config.js');
const { get, cloneDeep, debounce, mergeObj, equal } = require('@aux/aux_global.js');

let codeMirror = null;
let mapModes = new Map();
let mapThemes = new Map();

//COMPONENTE DE NOTAS
const NoteComponentEdit = CreateReactClass({
   getInitialState() {
      return {
         data: this.props.data || '',
         readOnly: !!this.props.readOnly,
         focus: !!this.props.focus,
         mode: this.props.mode || 'null',
         theme: this.getTheme(),
         options: cloneDeep(this.props.options) || {},
         cursorPosition: this.props.cursorPosition || null,
      };
   },
   getTheme() {
      let themeClases = 'containter __noAutofocus';
      let theme = cloneDeep(this.props.theme) || null;
      if (!theme) {
         //no theme, use default
         themeClases += themeManager.isDark() ? ' overwritesDark' : ' overwritesLight';
         theme = themeManager.isDark() ? 'material' : 'mdn-like';
      }

      let themePath;
      if (!mapThemes.get(theme)) {
         themePath = `../../node_modules/codemirror/theme/${theme}.css`;
         try {
            themeManager.loadCodemirrorTheme(themePath);
         } catch (e) {}
         mapThemes.set(theme, themePath);
      } else {
         themePath = mapThemes.get(theme);
      }

      return { name: theme, className: themeClases };
   },
   setMode($mode) {
      if (this.deleted) return;
      if (!mapModes.get($mode)) {
         try {
            require(`codemirror/mode/${$mode}/${$mode}`);
         } catch (e) {}
         mapModes.set($mode, true);
      }
      if ($mode !== this.state.mode) {
         this.setState({ mode: $mode });
      }
   },
   setStateTheme() {
      if (this.deleted) return;
      this.setState({ theme: this.getTheme() });
   },
   onChange(editor, data, value) {
      if (this.deleted || !this.props.onchange) return;

      if (this.props.data !== value) {
         this.props.onchange({ data: value || '', cursorPosition: editor.getCursor() || null });
      }
   },
   componentDidMount() {
      if (!codeMirror) {
         if (this.state.options.emmet) {
            require('@emmetio/codemirror-plugin')(require('codemirror'));
         }

         codeMirror = require('react-codemirror2').Controlled;

         if (this.state.options.placeholder) {
            require('codemirror/addon/display/placeholder.js');
         }
         if (this.state.options.keyMap) {
            require(`codemirror/keymap/${this.state.options.keyMap}`);
         }

         themeManager.loadCodemirrorCss('../../node_modules/codemirror/lib/codemirror.css');
      }
      this.CodeMirror = codeMirror;
      this.deleted = false;
      this.setStateTheme();
      this.setMode(this.state.mode);
   },
   componentDidUpdate() {},
   componentWillUnmount() {
      this.props.onLostFocus();
      this.deleted = true;
      this.CodeMirror = null;
   },
   editorDidMount(editor) {
      if (!editor || this.instance) return;

      this.instance = this.instance || editor;
      if (Config.dev) window.codeEditor = this.instance;

      let scrollInfo = this.instance.getScrollInfo() || {};
      let hasScroll = scrollInfo.height > scrollInfo.clientHeight;

      this.state.cursorPosition ? this.instance.setCursor(this.state.cursorPosition) : hasScroll ? editor.setCursor({ line: 0, ch: 0 }) : null;

      setTimeout(() => {
         if (this.deleted || !this.instance) return;
         if (this.instance.refresh) this.instance.refresh();
      }, 0);
   },
   reFocus() {
      if (this.deleted) return;
      this.setState({ focus: true, readOnly: false }, () => {
         if (this.instance && this.state.focus && !this.deleted) {
            this.instance.focus();
            if (this.instance.getSelection().length) {
               this.instance.setCursor(this.instance.getCursor());
            }
         }
      });
   },
   UNSAFE_componentWillReceiveProps(nextProps) {
      if (this.deleted || !this.instance) return;

      if (nextProps.mode && nextProps.mode !== this.state.mode) {
         this.setMode(nextProps.mode);
      }

      if (nextProps.data !== null && nextProps.data !== this.state.data) {
         this.setState({ data: String(nextProps.data || '') });
      }

      if (nextProps.readOnly !== this.state.readOnly) {
         this.setState({ readOnly: nextProps.readOnly });
      }

      if (nextProps.options && !equal(nextProps.options, this.state.options)) {
         this.setState({ options: cloneDeep(nextProps.options) });
      }

      if (nextProps.refocus && (this.state.readOnly || !this.state.focus)) {
         this.reFocus();
      }
   },
   render: function() {
      const $options = cloneDeep(this.state.options);

      $options.mode = this.state.mode;
      $options.theme = this.state.theme.name;
      $options.readOnly = this.state.readOnly;

      if ($options.emmet) {
         $options.extraKeys = {
            Tab: 'emmetExpandAbbreviation',
            Enter: 'emmetInsertLineBreak',
         };
      }

      return (
         <React.Fragment>
            {!this.deleted && this.CodeMirror && (
               <div className="TBN_editor">
                  <this.CodeMirror
                     autoCursor={this.state.autoCursor}
                     autoScroll={this.state.autoScroll}
                     className={this.state.theme.className + (this.state.readOnly ? ' cMirrorReadOnly' : '')}
                     onChange={this.onChange}
                     value={this.state.data}
                     editorDidMount={this.editorDidMount}
                     onBeforeChange={(editor, data, value) => {
                        if (this.deleted) return;
                        if (this.state.data !== value) {
                           this.setState({ data: value, cursorPosition: editor.getCursor() });
                        }
                     }}
                     onKeyUp={(...args) => {
                        if (this.deleted) return;
                        if (this.props.onKeyUp) this.props.onKeyUp(...args);
                     }}
                     onBlur={(...args) => {
                        if (this.deleted) return;
                        this.setState({ focus: false }, () => {
                           if (!this.deleted && this.props.onLostFocus) this.props.onLostFocus(...args);
                        });
                     }}
                     onFocus={(...args) => {
                        if (this.deleted) return;
                        if (this.props.onFocus) this.props.onFocus(...args);
                     }}
                     onDblClick={(...args) => {
                        if (this.deleted) return;
                        if (this.props.onDblClick) this.props.onDblClick(...args);
                     }}
                     onCursor={(...args) => {
                        if (this.deleted) return;
                        if (this.props.onCursor) this.props.onCursor(...args);
                     }}
                     onScroll={(...args) => {
                        if (this.deleted) return;
                        if (this.props.onScroll) this.props.onScroll(...args);
                     }}
                     options={$options}
                  />
               </div>
            )}
         </React.Fragment>
      );
   },
});

module.exports = NoteComponentEdit;
