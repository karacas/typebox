'use strict';

//WIP
const React = require('react');
const { Fragment, useEffect, useState } = React;
const CreateReactClass = require('create-react-class');
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const auxBabel = require('@aux/aux_babel.js');
const remote = require('electron').remote;
const { dialog, app } = remote;
const { requireCompo } = require('@components/get_compo.js');
const { _ruleIsDeleted, sanitizeHTMLReact, createComponentFromMarkDown, createComponentFromHtml } = require('@render/aux_viewer.js');
const { get, cloneDeep, debounce, mergeObj, equal } = require('@aux/aux_global.js');
const { makeHashpbkdf2 } = require('@aux/aux_crypt.js');
const NoteComponentEdit = requireCompo('code_editor.jsx');
const $def_options = Config.get('here_are_dragons.codeMirrorEditor');
const { fileExists } = require('@render/aux_drive_manager.js');
const list_modes = require('./list_modes.js');
const { css, ClassNames } = require('@emotion/core');
const $debounce = require('lodash').debounce;
const classNames = require('classcat');
const themeManager = require('@render/theme_manager.js');
const parentWindow = remote.getCurrentWindow();

const { Flex, Box } = require('@rebass/emotion');
const Tooltip = require('@material-ui/core/Tooltip').default;
const Fade = require('@material-ui/core/Fade').default;

const { list_types, get_note_type, set_mode_by_type } = require('./list_types.js');
let listTypes = list_types;

const NEW_NOTE_STR = 'new note';

const InternalPackNoteOptions = require(auxBabel.replaceJSX('./internal_pack_note_options.jsx')).noteOptions;
const dinamic_paths = require('./list_dinamic_paths.js');

let ReactSelect = null;
let spring = null;
let _onUnmountViewer = null;

//COMPONENTE DE NOTAS
const getNoteIdFormRule = rule => {
   return rule ? rule._internal_id || null : null;
};

const InputPassWrapp = props => {
   spring = spring || require('react-spring');
   const { useSpring, animated } = spring;
   const { x } = useSpring({ from: { x: 0 }, x: props.wFail ? 0 : 14, delay: 10, config: { mass: 1, tension: 3200, friction: 8, precision: 0.1 } });
   const interValue = x => `translate3d(${x.toFixed(0)}px, 0, 0)`;
   return (
      <animated.div className={props.className} style={props.wFail ? { transform: x.interpolate(interValue) } : {}}>
         {props.children}
      </animated.div>
   );
};

function noteComponent({
   data,
   rule,
   event,
   codeCss,
   saveRule,
   cancelRule,
   editorOptions,
   openExternal,
   deleteNote,
   cache_session,
   autoFocusEmptyTitle,
   context,
   onEscape,
   onChange,
   refreshData,
   setKey,
   hasKey,
   deleteKeyDeb,
   onUnmountViewer,
   getNewNote,
   getDataFile,
} = {}) {
   if (data === null) {
      Logger.warn('data is null');
      data = '';
   }

   _onUnmountViewer = onUnmountViewer || null;

   const noteID = getNoteIdFormRule(rule);

   if (!noteID) {
      Logger.error('[noteComponent] id is null', rule);
      return null;
   }

   const options = mergeObj($def_options, editorOptions);
   const bindSave = context ? context.normaliceBindKeys(context.get(editorOptions, 'bindKeysSave[0]')) : '';
   const bindOptions = context ? context.normaliceBindKeys(context.get(editorOptions, 'bindKeysOptions[0]')) : '';
   const bindKeysPreview = context ? context.normaliceBindKeys(context.get(editorOptions, 'bindKeysPreview')) : '';
   const bindKeysReLock = context ? context.normaliceBindKeys(context.get(editorOptions, 'bindKeysReLock')) : '';

   ReactSelect = ReactSelect || require('react-select').default;

   //lineWrapping
   const rule_lineWrapping = get(rule, 'params._note_lineWrapping');
   if (rule_lineWrapping === !!rule_lineWrapping) {
      options.lineWrapping = rule_lineWrapping;
   }

   //KTODO: save newnote cache2disk
   let noteIdTmp = get(rule, 'params._note_is_new') ? 'NEW_NOTE' : noteID;
   const cachedSession = cache_session ? cache_session.get(noteIdTmp) : null;

   const _ruleEdit = cachedSession && cachedSession.ruleEdit ? cachedSession.ruleEdit : cloneDeep(rule);
   const _dataEdit = cachedSession && cachedSession.data !== null ? cachedSession.data : data;
   const _cursorPosition = cachedSession ? cachedSession.cursorPosition : null;

   if (_dataEdit === null) {
      Logger.warn('_dataEdit is null!!');
      _dataEdit = '';
   }

   return CreateReactClass({
      getInitialState() {
         return {
            rule: rule,
            ruleEdit: _ruleEdit,
            scrollTop: true,
            id: noteID,
            data: data,
            dataEdit: _dataEdit,
            editMode: true,
            cursorPosition: _cursorPosition,
            preview:
               (editorOptions.previewOnInit || false) &&
               data.length > 0 &&
               (get(rule, 'params._note_type.value') || get(rule, 'params._note_type')) === 'markdown',
            focus: false,
            advancedOptions: false,
            _optionsDeferred: false,
         };
      },
      isUnLockedFile() {
         if (this.deleted || !this.state.id) return false;

         const encrypted = get(this.state.ruleEdit, 'params._note_encrypt');
         if (!encrypted) return true;

         const hasEncryptKey = hasKey(this.state.id);
         if (hasEncryptKey) return true;

         return false;
      },
      _user_wants_edit(e) {
         //KRODO: que con el tab solo haga foco, no edit
         if (this.deleted || !this.state.id) return;
         this._goEdit(e);
      },
      _change_data(data, rule) {
         if (this.deleted || !this.state.id) return;

         if (data === null) {
            Logger.warn('data is null');
            data = '';
         }

         let changeObj = null;

         if (this.state.data !== data) {
            changeObj = {};
            changeObj.data = data;
         }

         if (this.state.dataEdit !== data) {
            changeObj = changeObj || {};
            changeObj.dataEdit = data;
         }

         if (Config.isDev) console.log('[ON CHANGE DATA]', { changeObj, actual_state_data: this.state.data.length, new_data: data.length });

         if (changeObj) this.setState(changeObj);
      },
      _main_viewer_click(e) {
         if (this.deleted || !this.state.id) return;
         this._goEdit(e);
      },
      componentDidMount() {
         if (event) {
            event.on('USER_WANTS_EDIT', this._user_wants_edit);
            event.on('CHANGE_DATA', this._change_data);
         }

         // this.deleted = false;

         if (autoFocusEmptyTitle === true && !this.state.ruleEdit.title) {
            if (options && options.focusTitleOnNew) {
               document.getElementById('noteTitle') && document.getElementById('noteTitle').focus();
            } else {
               setTimeout(this._goEdit, 0);
            }
         }

         let timeToDebounce = options && options.debounceTimeOnChange ? options.debounceTimeOnChange : 128;
         let lengthData = String(this.state.dataEdit).length;

         if (lengthData > 50 * 1024) {
            this._debOnChange = $debounce(this._onChange, timeToDebounce);
         } else {
            this._debOnChange = this._onChange;
         }

         setTimeout(() => {
            if (this.deleted || !this.state.id || this.state._optionsDeferred) return;
            this.setState({ _optionsDeferred: true });
         }, 512);
      },
      componentDidUpdate() {
         const noteIDruleEdit = getNoteIdFormRule(this.state.ruleEdit);

         //KTODO: Refresh on new rule #435346542
         if (!noteIDruleEdit) {
            if (Config.isDev) console.log('[get new note]');

            if (!getNewNote) {
               Logger.error('[noteComponent] id is null && !getNewNote', this.state.ruleEdit);
               return;
            }

            let objNew = getNewNote();

            this.setState({ ruleEdit: cloneDeep(objNew), rule: objNew }, () => {
               if (this.deleted || !this.state.id) return;
               refreshData(this.state.ruleEdit).then(() => {
                  if (Config.isDev) console.log('[get new note], OK');
               });
            });

            return null;
         }
      },
      componentWillUnmount() {
         if (event) {
            try {
               event.removeListener('USER_WANTS_EDIT', this._user_wants_edit);
               event.removeListener('CHANGE_DATA', this._change_data);
            } catch (e) {}
         }

         if (_onUnmountViewer) _onUnmountViewer();

         if (this.state.rule) this.obsoleteId(null, cloneDeep(this.state.rule));

         this.deleted = true;
      },
      _onChange(obj) {
         return new Promise(res => {
            if (this.deleted || !this.state.id) {
               res(null);
               return null;
            }

            if (!obj) {
               Logger.warn('onChange, no data');
               res(null);
               return;
            }

            let objChange = {};

            if (obj.data !== null && obj.data !== undefined && this.state.dataEdit !== obj.data) {
               objChange.dataEdit = obj.data;
            }

            if (obj.cursorPosition && this.state.cursorPosition !== obj.cursorPosition) {
               objChange.cursorPosition = obj.cursorPosition || null;
            }

            if (obj.rule && !equal(this.state.ruleEdit, obj.rule)) {
               objChange.ruleEdit = cloneDeep(obj.rule) || null;
               // objChange.rule = obj.rule || null;
            }

            if (!equal(objChange, {})) {
               this.setState(objChange, () => {
                  if (this.deleted || !this.state.id) return;
                  this._saveSession();
                  if (onChange) onChange(this.state.dataEdit, this.state.ruleEdit);
                  res(true);
                  return;
               });
            }
         });
      },
      setStateAsync(state) {
         return new Promise(resolve => {
            this.setState(state, resolve);
         });
      },
      async _save() {
         if (this.deleted || !this.state.id || !this.isUnLockedFile() || !this._isChanged()) return false;

         const oldRule = cloneDeep(this.state.rule);

         const savedok = await saveRule(this.state.dataEdit, this.state.ruleEdit);

         if (!savedok) {
            Logger.warn('Saving note failed');
            return;
         }

         if (this.deleted || !this.state.id || !this.isUnLockedFile()) return;

         let noteIdTmp = get(this.state.rule, 'params._note_is_new') ? 'NEW_NOTE' : this.state.id;

         if (get(this.state.ruleEdit, 'params._note_is_new')) {
            if (Config.isDev) console.log('[NEW NOTE]');
            if (cache_session) cache_session.del(noteIdTmp);
            const ruleEdit = cloneDeep(this.state.ruleEdit);
            ruleEdit.title = '';
            ruleEdit.params = { _note_is_new: true };
            await this.setStateAsync({ data: '', dataEdit: '', focus: false, rule: cloneDeep(ruleEdit), ruleEdit: ruleEdit });
            this.obsoleteId(this.state.rule, oldRule);
            this._refocusMain();
         } else {
            await this.setStateAsync({ rule: cloneDeep(this.state.ruleEdit), data: this.state.dataEdit });
            if (cache_session && this.state.id) cache_session.del(this.state.id);
         }
         return true;
      },
      _isChanged() {
         if (this.state.dataEdit.length !== this.state.data.length) return true;
         if (this.state.dataEdit !== this.state.data) return true;

         const isDifTitle = this.state.rule.title !== this.state.ruleEdit.title;
         if (isDifTitle) return true;

         const isDifParams = !equal(this.state.rule.params, this.state.ruleEdit.params);
         return isDifParams;
      },
      _lostFocus(editor) {
         if (this.deleted || !this.state.id) return;

         //Avoid lost focus on control
         if (document.activeElement.id && String(document.activeElement.id).includes('react-select')) {
            return;
         }

         if (!this._isChanged()) {
            if (editor) this._cancel(editor);
            return;
         }
      },
      _saveSession() {
         if (this.deleted || !this.state.id || !this.isUnLockedFile()) return;

         if (this.state.dataEdit === null) {
            Logger.warn('dataEdit is null');
         }

         let sessionData = {
            data: this.state.dataEdit,
            ruleEdit: this.state.ruleEdit,
            id: this.state.id,
            cursorPosition: this.state.cursorPosition || null,
         };

         let noteIdTmp = get(sessionData.ruleEdit, 'params._note_is_new') ? 'NEW_NOTE' : sessionData.id;
         if (cache_session) cache_session.set(noteIdTmp, sessionData);
      },
      _cancel(editor) {
         if (this.deleted || !this.state.id || !this.isUnLockedFile()) return;
         if (editor && editor.clearHistory) editor.clearHistory();
         this.setState({ focus: false, dataEdit: this.state.data, cursorPosition: null, ruleEdit: cloneDeep(this.state.rule) }, () => {
            let noteIdTmp = get(this.state.ruleEdit, 'params._note_is_new') ? 'NEW_NOTE' : this.state.id;
            if (cache_session) cache_session.del(noteIdTmp);
            setTimeout(() => {
               if (document.activeElement.id === 'noteTitle') return;
               if (cancelRule) cancelRule(this.state.data, this.state.ruleEdit);
               this._refocusMain();
            }, 0);
         });
      },
      _refocusMain() {
         if (this.deleted || !this.state.id) return;
         if (document.activeElement.classList.contains('__norefocusMain')) return;
         this.setState({ focus: false, advancedOptions: false }, () => {
            setTimeout(() => {
               if (document.getElementById('mainSearch') && document.getElementById('mainSearch').focus) {
                  document.getElementById('mainSearch').focus();
                  return;
               }
            }, 1);
         });
      },
      _goEdit(event) {
         if (this.deleted || !this.state.id) return;

         if (event && event.preventDefault) event.preventDefault();

         if (!this.isUnLockedFile() && this.inputPass) {
            this.inputPass.focus();
            return;
         }

         let noTitle = !this.state.ruleEdit.title || this.state.ruleEdit.title.toLowerCase() === NEW_NOTE_STR;

         if (noTitle) {
            this.setState(
               state => {
                  state.focus = options.focusTitleOnNew ? false : true;
                  state.ruleEdit.title = '';
                  state.preview = false;
                  state.advancedOptions = false;
                  return state;
               },
               () => {
                  if (options.focusTitleOnNew) {
                     document.getElementById('noteTitle') && document.getElementById('noteTitle').focus();
                  }
               }
            );
         } else {
            this.setState({ focus: true, preview: false, advancedOptions: false });
         }
      },
      onKeyUp(editor, event) {
         if (this.deleted || !this.state.id || !this.isUnLockedFile()) return;

         if (editor.keyCode) {
            //input normal
            event = editor;
         }

         // KTODO: #45345345345 // clone event key
         if (false) {
            try {
               var keyboardEvent = document.createEvent('KeyboardEvent');
               var initMethod = typeof keyboardEvent.initKeyboardEvent !== 'undefined' ? 'initKeyboardEvent' : 'initKeyEvent';

               keyboardEvent[initMethod](
                  'keydown', // event type : keydown, keyup, keypress
                  true, // bubbles
                  true, // cancelable
                  window, // viewArg: should be window
                  event.ctrlKey, // ctrlKeyArg
                  false, // altKeyArg
                  false, // shiftKeyArg
                  false, // metaKeyArg
                  event.keyCode, // keyCodeArg : unsigned long the virtual key code, else 0
                  0 // charCodeArgs : unsigned long the Unicode character associated with the depressed key, else 0
               );
               document.getElementById('mainSearch').dispatchEvent(keyboardEvent);
               if (Config.isDev) console.log(keyboardEvent);
            } catch (e) {}
            return;
         }

         // if (Config.isDev) console.log(event.keyCode); //https://keycode.info/

         if (event.keyCode === 27 /*ESC*/) {
            if (this.deleted || !this.state.id) return;
            if (Config.isDev) console.log('note esc', event);
            this._lostFocus(!editor.keyCode ? editor : null);
            if (event && event.preventDefault) event.preventDefault();
            if (onEscape) {
               onEscape(cloneDeep(this.state.ruleEdit));
            }
            if (event.shiftKey || event.metaKey || event.ctrlKey) {
               this._cancel();
            }
            this._refocusMain();
         }

         //KTODO: get from config

         if (event.keyCode === 83 && event.ctrlKey /*Ctrl + S*/) {
            if (this.deleted || !this.state.id) return;
            this._save();
            if (event && event.preventDefault) event.preventDefault();
         }

         if (event.keyCode === 80 && event.ctrlKey /*Ctrl + P*/) {
            if (this.deleted || !this.state.id) return;
            if (Config.isDev) console.log('note preview');
            this.togglePreview();
            if (event && event.preventDefault) event.preventDefault();
         }

         if (event.keyCode === 79 && event.ctrlKey /*Ctrl + 0*/) {
            if (this.deleted || !this.state.id) return;
            try {
               if (openExternal) openExternal(this.state.ruleEdit);
               if (event && event.preventDefault) event.preventDefault();
            } catch (e) {}
         }

         //only input normal
         if (editor.keyCode && event.keyCode === 9 /*tab*/) {
            this._goEdit(event);
            if (event && event.preventDefault) event.preventDefault();
         }
      },
      onDoubleClick(editor, event) {
         if (this.deleted || !this.state.id) return;
         this._goEdit(event);
         if (event && event.preventDefault) event.preventDefault();
      },
      togglePreviewAdvancedOptions(editor, event) {
         let change = {};
         change.advancedOptions = !this.state.advancedOptions;
         if (change.advancedOptions) {
            change.focus = false;
            change._optionsDeferred = true;
         }
         this.setState(change, () => {
            if (this.state.advancedOptions) {
               //KTODO: of advancedOptions [escape] toggle advancedOptions
               // document.activeElement.blur()
            }
         });
      },
      openPreviewAdvancedOptions() {
         if (!this.state.advancedOptions) togglePreviewAdvancedOptions();
      },
      onFocus(editor, event) {
         if (this.deleted || !this.state.id) return;
         let isEmpty = get(editor, 'display.maxLine.text').length === 0;
         this.setState({ focus: true, preview: false, advancedOptions: false });
      },
      togglePreview() {
         if (this.deleted || !this.state.id || !this.isUnLockedFile()) return;
         let change = {};
         change.preview = !this.state.preview;
         if (change.preview) {
            change.focus = false;
         }
         change.advancedOptions = false;
         this.setState(change);
      },
      onScroll(editor, data) {
         if (this.deleted || !this.state.id) return;
         this.setState({ scrollTop: data.top < 1 });
      },
      obsoleteId(newRule, oldRule) {
         if (this.deleted) return;

         let newId = getNoteIdFormRule(newRule);
         let oldId = getNoteIdFormRule(oldRule);

         const oldIsNew = get(oldRule, 'params._note_is_new');
         const oldIsEncripted = get(oldRule, 'params._note_encrypt');
         const oldHasKey = oldIsEncripted && hasKey(oldId);

         if (!oldId) {
            if (Config.isDev && false) console.log('[CHANGE ID] no oldId', { newId, oldId, oldIsNew });
            return;
         }

         if (oldHasKey && deleteKeyDeb) deleteKeyDeb(oldId, null);

         if (Config.isDev) console.log('[CHANGE ID]', { newId, oldId, oldIsNew, time2remove: options.timeToRemoveNotePass, oldIsEncripted });
      },
      UNSAFE_componentWillReceiveProps(nextProps) {
         if (this.deleted || !this.state.id) return;

         if (nextProps.rule) {
            let nextPropsId = getNoteIdFormRule(nextProps.rule);
            if (nextPropsId !== this.state.id) {
               this.obsoleteId(nextProps.rule, cloneDeep(this.state.rule));
            }
         }

         if (nextProps.rule && !equal(nextProps.rule, this.state.rule)) {
            this.setState({ rule: nextProps.rule, ruleEdit: cloneDeep(nextProps.rule) });
         }
      },
      changeRuleTitle(event, val) {
         if (this.deleted || !this.state.id || event.target.value === null || this.state.ruleEdit.title === event.target.value || !this.isUnLockedFile())
            return;
         this.setState({ focus: false });
         const tmpObj = { rule: cloneDeep(this.state.ruleEdit) };
         tmpObj.rule.title = event.target.value;
         tmpObj.rule.params.__changedTitle = true;
         this._onChange(tmpObj);
      },
      unlock() {
         //KTODO: make async
         return new Promise(res => {
            if (this.deleted || !this.state.id || !document) {
               res(null);
               return;
            }

            if (!setKey) {
               Logger.error('[internal_pack_notes unlock] no setKey function');
               res(null);
               return;
            }

            const encrypted = get(this.state.ruleEdit, 'params._note_encrypt');
            if (!encrypted) {
               Logger.log('[internal_pack_notes unlock] no encrypted');
               res(null);
               return;
            }

            const encryptedhash = get(this.state.ruleEdit, 'params._note_encrypt_hash');
            if (!encryptedhash) {
               Logger.warn('[internal_pack_notes unlock] no encryptedhash');
               res(null);
               return;
            }

            //KTODO: ver safe de esto! #54656754
            const unlockPass = this.inputPass;
            if (!unlockPass) {
               Logger.log('[internal_pack_notes unlock] no unlockPass el');
               res(null);
               return;
            }

            const passValue = unlockPass.value;
            if (!passValue) {
               Logger.log('[internal_pack_notes unlock] no passValue');
               res(false);
               return;
            }

            //KTODO hacer esta parte en una funcion en internal_pack_notes.js
            makeHashpbkdf2(passValue).then(encrypt_hash_value => {
               if (!encrypt_hash_value) {
                  Logger.error('[internal_pack_notes unlock] fail makeHashpbkdf2');
                  res(false);
                  return;
               }

               if (encryptedhash !== encrypt_hash_value) {
                  Logger.info('[internal_pack_notes unlock] invalid pass');
                  res(false);
                  return;
               }

               setKey(this.state.id, passValue);

               if (this.deleted || !this.state.id) return;
               refreshData(this.state.ruleEdit).then(() => {
                  Logger.log('[internal_pack_notes unlock] OK');
                  res(true);
               });
            });
         });
      },
      render: function() {
         if (this.deleted) return <span />;

         this.ref_selectType = null;
         this.ref_selectMode = null;
         this.ref_buttonSave = null;

         this.saveBunttonHandler = e => {
            this._save();
            e.preventDefault();
         };

         const mode = get(this.state, 'ruleEdit.params.mode') || 'null';
         const type = get_note_type(get(this.state, 'ruleEdit.params._note_type'));

         const isNew = !!get(this.state, 'ruleEdit.params._note_is_new');
         const modeLabel = get(list_modes.find(obj => obj.value === mode)) || null;

         let noTitle = !this.state.ruleEdit.title || this.state.ruleEdit.title.toLowerCase() === NEW_NOTE_STR;

         //PREVIEW COMPO
         let withPreview =
            !this.state.focus &&
            !this.state.advancedOptions &&
            this.state.preview &&
            this.state.dataEdit &&
            this.state.dataEdit.length &&
            this.state.dataEdit.length > 1;

         const isMarkDown = mode === 'markdown';
         const isHtml = type && type.value === 'html';
         const isJSX = type && type.value === 'jsx';

         const isFile = type.value && type.value.toLowerCase() === 'file';
         let hasPreview = isMarkDown || isHtml || isJSX;

         let PreviewCompo = null;

         if (withPreview && isMarkDown) {
            try {
               PreviewCompo = createComponentFromMarkDown(this.state.dataEdit);
            } catch (e) {}
         }

         if (withPreview && isHtml && editorOptions.advancedPreviews) {
            let textHighColor = themeManager.getRootVar('textHighColor');
            let mainFont = themeManager.getRootVar('mainFont');
            let WebView = context.createViewerWebView({
               geturl: rule => getDataFile(rule),
               debounceTime_viewer: 1,
               avoidCreateButton: true,
               insertCSS: `
                  body {
                     font-family: ${mainFont || 'sans-serif'};
                     color: ${textHighColor || '#fff'};
                     margin:0;
                     padding:0;
                   }
                  `,
            });
            PreviewCompo = () => <WebView rule={cloneDeep(this.state.ruleEdit)} />;
         }

         if (withPreview && isJSX && editorOptions.advancedPreviews) {
            const { transform } = require('sucrase');
            try {
               let compiledCode = transform(this.state.dataEdit, { transforms: ['jsx', 'imports'] }).code;
               PreviewCompo = () => <span>{eval(compiledCode)}</span>;
            } catch (e) {
               Logger.warn(e);
            }
         }

         if ((isHtml || isJSX) && !editorOptions.advancedPreviews) {
            hasPreview = false;
            withPreview = false;
         }

         if (!editorOptions.advancedPreviews) {
            listTypes = listTypes.filter(function(item) {
               return item.value !== 'jsx';
            });
         }

         const isUnLockedFile = this.isUnLockedFile();
         const iLockedFile = !isUnLockedFile;
         const encrypted = isUnLockedFile && get(this.state, 'ruleEdit.params._note_encrypt');

         this._unlockPassBtn_fail = !!this._unlockPassBtn_fail;
         this._unlockPassBtn_load = !!this._unlockPassBtn_load;
         this._unlockPass_inView = !!this._unlockPass_inView;

         const tryUnlock = async () => {
            if (this._unlockPassBtn_load) return;

            this._unlockPassBtn_load = true;
            this._unlockPassBtn_fail = false;
            this.forceUpdate();

            if (await this.unlock()) {
               this._unlockPassBtn_load = false;
               this._unlockPassBtn_fail = false;
               if (this.inputPass) this.inputPass.blur();
               this._refocusMain();
            } else {
               this._unlockPassBtn_load = false;
               this._unlockPassBtn_fail = true;
               if (this.inputPass) this.inputPass.value = '';
               if (this.inputPass) this.inputPass.focus();
            }

            this.forceUpdate();
         };

         const prettierType = () => {
            const mode = get(this.state, 'ruleEdit.params.mode') || null;
            const type = get_note_type(get(this.state, 'ruleEdit.params._note_type'));
            if (!this.state.dataEdit || !this.state.dataEdit.length || !mode) return;

            if (false && Config.isDev) Logger.log('[mode]', mode, '[type]', type);

            let format = null;

            if (mode === 'css' || mode === 'css' || mode === 'scss' || mode === 'less') {
               return { parser: 'css', req: `parser-postcss.js` };
            }

            if (mode === 'json' || mode === 'json5') return { parser: 'json', req: `parser-babylon.js` };
            if (mode === 'js' || mode === 'jsx' || mode === 'javascript') return { parser: 'babel', req: `parser-babylon.js` };
            if (mode === 'flow') format = 'flow';
            if (mode === 'html' || mode === 'htmlmixed' || mode === 'htmlembedded') format = 'html';
            if (mode === 'md' || mode === 'markdown') format = 'markdown';
            if (mode === 'yaml' || mode === 'yaml') format = 'markdown';
            if (format) return { parser: format, req: `parser-${format}.js` };

            return null;
         };

         const canPrettier = () => {
            return (
               editorOptions.prettierOptions && isUnLockedFile && !this.state.preview && this.state.dataEdit && this.state.dataEdit.length > 6 && prettierType()
            );
         };

         const prettier = async () => {
            if (!canPrettier()) return;

            const _prettier = require('prettier-standalone/standalone.js');
            if (!_prettier) return;

            let pType = prettierType();
            let pre = this.state.dataEdit;
            let post = null;
            let opt = editorOptions.prettierOptions || {};
            opt.plugins = [require(`prettier-standalone/${pType.req}`)];
            opt.parser = pType.parser;

            try {
               post = _prettier.format(pre, opt);
            } catch (e) {
               //Print prettier error
               let optionsDiag = {
                  buttons: ['OK'],
                  message: `${e}`,
                  title: 'Prettier SyntaxError',
                  type: 'warning',
                  noLink: true,
               };

               dialog.showMessageBox(parentWindow, optionsDiag, (res, checked) => {
                  context.show();
               });

               Logger.warn('[prettier]', e);
            }

            if (!post) return;

            return this.setState({ dataEdit: post });
         };

         const hasPreviewCompo = withPreview && PreviewCompo;

         return (
            <div id="TBN_main" className={classNames({ _scrolled: !this.state.scrollTop, _preview: hasPreviewCompo, _woptions: this.state.advancedOptions })}>
               <style dangerouslySetInnerHTML={sanitizeHTMLReact(codeCss)} />

               <div className="TBN_main_wrapp">
                  <input
                     spellCheck="false"
                     id="noteTitle"
                     type="text"
                     name="title"
                     tabIndex={noTitle && options.focusTitleOnNew ? '0' : '-1'}
                     onKeyUp={this.onKeyUp}
                     placeholder="Title"
                     value={this.state.ruleEdit.title}
                     readOnly={!isUnLockedFile}
                     onChange={this.changeRuleTitle}
                  />

                  {iLockedFile && (
                     <Fragment>
                        <div id="noteIdBox">
                           <Flex width={1}>
                              <Box width={1}>
                                 <br />
                                 <InputPassWrapp
                                    wLoad={this._unlockPassBtn_load}
                                    wFail={this._unlockPassBtn_fail}
                                    className={classNames({ wLoad: this._unlockPassBtn_load, wFail: this._unlockPassBtn_fail })}
                                 >
                                    <input
                                       spellCheck="false"
                                       onKeyDown={async e => {
                                          if (e && e.key === 'Escape') {
                                             if (this.inputPass) this.inputPass.blur();
                                             this._refocusMain();
                                          }
                                          if (e && (e.key === 'Enter' || e.key === 'Tab')) {
                                             tryUnlock();
                                          }
                                       }}
                                       type={this._unlockPass_inView ? 'text' : 'password'}
                                       placeholder="key"
                                       ref={ref => (this.inputPass = ref)}
                                       className="__elNoAutofocus __norefocusMain TB-input-text"
                                       style={{
                                          marginLeft: 0,
                                          width: 180,
                                          display: 'inline-flex',
                                          verticalAlign: 'middle',
                                          opacity: this._unlockPassBtn_load ? 0.5 : 1,
                                       }}
                                       readOnly={this._unlockPassBtn_load}
                                       onChange={() => {
                                          if (this._unlockPassBtn_fail) {
                                             this._unlockPassBtn_fail = false;
                                             this.forceUpdate();
                                          }
                                       }}
                                    />
                                    {!this._unlockPassBtn_load && (
                                       <div
                                          onClick={tryUnlock}
                                          id="unlockPassBtn"
                                          style={{ marginLeft: 8, display: 'inline-flex', verticalAlign: 'middle' }}
                                          className={'TB-Button TB-Button-wIcon TB-Button-accent TB-Button-autowidth TB-Button-no-backhover'}
                                       >
                                          <i className="icons8-lock" /> {'UnLock'}
                                       </div>
                                    )}

                                    {this._unlockPassBtn_load && (
                                       <div
                                          id="unlockPassBtn"
                                          style={{ marginLeft: 8, display: 'inline-flex', verticalAlign: 'middle' }}
                                          className={'TB-Button TB-Button-wIcon TB-Button-accent TB-Button-autowidth TB-Button-no-backhover'}
                                       >
                                          <i className="mdi-loading spininLoadFast" />
                                       </div>
                                    )}

                                    {!this._unlockPassBtn_load && (
                                       <div
                                          onClick={async () => {
                                             this._unlockPass_inView = !this._unlockPass_inView;
                                             if (this.inputPass) this.inputPass.focus();
                                             this.forceUpdate();
                                          }}
                                          id="viewPass"
                                          style={{ marginLeft: 8, display: 'inline-flex', verticalAlign: 'middle', opacity: 0.5 }}
                                          className={'TB-Button TB-Button-autowidth  TB-Button-left TB-Button-no-backhover'}
                                       >
                                          {this._unlockPass_inView ? <i className="mdi-eye" /> : <i className="mdi-eye-off" />}
                                       </div>
                                    )}
                                 </InputPassWrapp>
                              </Box>
                           </Flex>
                        </div>
                     </Fragment>
                  )}

                  {isUnLockedFile && (
                     <div className={'TBN_code_wrapp'}>
                        <span id="noteComponentEditWrapp" className={hasPreviewCompo ? '_invisible' : ''}>
                           <NoteComponentEdit
                              mode={mode}
                              onchange={this._debOnChange}
                              onSave={this._save}
                              onLostFocus={this._lostFocus}
                              onKeyUp={this.onKeyUp}
                              onFocus={this.onFocus}
                              onScroll={this.onScroll}
                              data={this.state.dataEdit}
                              cursorPosition={this.state.cursorPosition || null}
                              readOnly={hasPreviewCompo || !this.state.editMode}
                              options={options}
                              refocus={this.state.focus && !hasPreviewCompo}
                           />
                        </span>

                        {hasPreviewCompo && (
                           <div className={'TBN_main_viewerPreview'} onDoubleClick={this.onDoubleClick}>
                              <PreviewCompo />
                           </div>
                        )}

                        <div id="noteOptionsWrapp" className={classNames({ _opt_enabled: this.state.advancedOptions })}>
                           {this.state._optionsDeferred && this.state.advancedOptions && (
                              <InternalPackNoteOptions
                                 onchange={this._debOnChange}
                                 advancedoptions={this.state.advancedOptions}
                                 ruleedit={this.state.ruleEdit}
                                 rule={this.state.rule}
                                 refreshData={refreshData}
                                 setKey={setKey}
                                 options={options}
                                 normaliceBindKeys={context.normaliceBindKeys}
                                 openExternal={openExternal}
                                 deleteNote={deleteNote}
                                 onSave={this._save}
                              />
                           )}
                        </div>
                     </div>
                  )}
               </div>

               {isUnLockedFile && (
                  <div className="noteFooterBar">
                     <Flex width={1}>
                        <Box width={1} __colLeft>
                           <Flex width={'auto'}>
                              <Box width={'auto'} mr={'8px'}>
                                 <div className={this.state.advancedOptions ? 'circlePopOpen' : 'null'}>
                                    <Tooltip
                                       title={`Options${bindOptions ? ` [${bindOptions}]` : ''}`}
                                       open={null}
                                       TransitionComponent={Fade}
                                       enterDelay={640}
                                       TransitionProps={{ timeout: 96 }}
                                    >
                                       <div
                                          className="TB-Button TB-Button-no-backhover TB-Button-accent-hover"
                                          onClick={this.togglePreviewAdvancedOptions}
                                          id="noteOptionsBtn"
                                          style={this.state.advancedOptions ? { opacity: 1, marginLeft: '0px' } : { marginLeft: '0px' }}
                                       >
                                          {this.state.advancedOptions ? (
                                             <i className="fe-toggle-right" __style={{ marginTop: '1px' }} />
                                          ) : (
                                             <i className="fe-toggle-left" __style={{ marginTop: '1px' }} />
                                          )}
                                       </div>
                                    </Tooltip>
                                 </div>
                              </Box>

                              {encrypted && !isNew && (
                                 <Tooltip
                                    title={`item encrypted / lock [${bindKeysReLock}]`}
                                    open={null}
                                    TransitionComponent={Fade}
                                    enterDelay={640}
                                    TransitionProps={{ timeout: 96 }}
                                 >
                                    <div
                                       id="noteReLock"
                                       className="TB-Button TB-Button-accent"
                                       style={{ marginLeft: '-5px', marginRight: '3px' }}
                                       onClick={async () => {
                                          setKey(this.state.id, null);
                                          this.forceUpdate();
                                       }}
                                    >
                                       <i className="icons8-lock" />
                                    </div>
                                 </Tooltip>
                              )}

                              {isFile && (
                                 <Fragment>
                                    <div className="hiddenInSmallViewer">
                                       <Tooltip title={'select file'} open={null} TransitionComponent={Fade} enterDelay={640} TransitionProps={{ timeout: 96 }}>
                                          <div
                                             id="fileOpenDialog"
                                             className="TB-Button TB-Button-accent"
                                             style={{ opacity: '1', marginLeft: '0px' }}
                                             onClick={async () => {
                                                dialog.showOpenDialog(
                                                   parentWindow,
                                                   {
                                                      properties: ['openFile'],
                                                      title: 'Select file',
                                                      buttonLabel: 'select',
                                                      defaultPath: app.getPath('documents'),
                                                   },
                                                   file => {
                                                      file = file && Array.isArray(file) && file[0] ? file[0] : file;
                                                      if ((file, fileExists(String(file)))) {
                                                         this.setState({ dataEdit: String(file) });
                                                      } else {
                                                         Logger.warn('[file]', file);
                                                      }
                                                   }
                                                );
                                             }}
                                          >
                                             <i className="w-icon-file-add" />
                                          </div>
                                       </Tooltip>
                                    </div>

                                    {this.state.dataEdit && this.state.dataEdit.length && !fileExists(this.state.dataEdit, true) && (
                                       <div className="hiddenInSmallViewer">
                                          <div className={'circlePopOpen'}>
                                             <div className={'popOpen'}>
                                                <Tooltip
                                                   title={'file not exist'}
                                                   open={null}
                                                   TransitionComponent={Fade}
                                                   enterDelay={640}
                                                   TransitionProps={{ timeout: 96 }}
                                                >
                                                   <div id="fileWarning" className="TB-Button TB-Button-error" style={{ opacity: '1', marginRight: '3px' }}>
                                                      <i className="fe-alert-circle" />
                                                   </div>
                                                </Tooltip>
                                             </div>
                                          </div>
                                       </div>
                                    )}
                                 </Fragment>
                              )}

                              <Box width={'auto'} mr={'4px'}>
                                 <ClassNames>
                                    {({ cx }) => (
                                       <ReactSelect
                                          // menuIsOpen={true}
                                          ref={ref => {
                                             this.ref_selectType = ref;
                                          }}
                                          onKeyDown={e => {
                                             e.persist();
                                             if (e && e.key === 'Escape') {
                                                if (this.ref_selectType) this.ref_selectType.blur();
                                             }
                                          }}
                                          name="type"
                                          menuPlacement={'top'}
                                          className={cx('TB-select TB-select-mini TB-select-top', css('min-width: 105px'))}
                                          classNamePrefix="react-select"
                                          placeholder="Type"
                                          value={type}
                                          isSearchable={listTypes.length > 8}
                                          options={listTypes}
                                          id="noteSelectType"
                                          onChange={(objVal, actionMeta, el) => {
                                             if (this.deleted || !this.state.id || !this.state.ruleEdit) return;
                                             const tmpObj = { rule: cloneDeep(this.state.ruleEdit) };
                                             tmpObj.rule.params._note_type = get(objVal, 'value');
                                             tmpObj.rule.params.mode = set_mode_by_type(tmpObj.rule.params._note_type);
                                             this.ref_selectType && this.ref_selectType.blur();
                                             this._onChange(tmpObj);
                                          }}
                                       />
                                    )}
                                 </ClassNames>
                              </Box>

                              {type && type.value === 'snippet' && (
                                 <Box width={'auto'} mr={'4px'}>
                                    <ReactSelect
                                       // __menuIsOpen={true}
                                       ref={ref => {
                                          this.ref_selectMode = ref;
                                       }}
                                       onKeyDown={e => {
                                          e.persist();
                                          if (e && e.key === 'Escape') {
                                             if (this.ref_selectMode) this.ref_selectMode.blur();
                                          }
                                       }}
                                       name="mode"
                                       menuPlacement={'top'}
                                       className="TB-select TB-select-mini TB-select-top"
                                       classNamePrefix="react-select"
                                       placeholder="Mode"
                                       value={modeLabel}
                                       isSearchable={list_modes.length > 5}
                                       options={list_modes}
                                       onChange={(objVal, actionMeta) => {
                                          if (this.deleted || !this.state.id || !this.state.ruleEdit) return;
                                          const tmpObj = { rule: cloneDeep(this.state.ruleEdit) };
                                          tmpObj.rule.params._note_dataExtension = objVal.ext;
                                          tmpObj.rule.params.mode = objVal.value;
                                          this.ref_selectMode && this.ref_selectMode.blur();
                                          this._onChange(tmpObj);
                                       }}
                                    />
                                 </Box>
                              )}

                              {hasPreview && (
                                 <Box width={'auto'}>
                                    <Tooltip
                                       title={'toggle preview [ctrl+p]'}
                                       open={null}
                                       TransitionComponent={Fade}
                                       enterDelay={640}
                                       TransitionProps={{ timeout: 96 }}
                                    >
                                       <div
                                          id="notePreview"
                                          className="TB-Button TB-Button-accent-hover hiddenInSmallViewer"
                                          style={{ marginLeft: '0px' }}
                                          onClick={() => {
                                             this.togglePreview();
                                          }}
                                       >
                                          {this.state.preview ? 'Edit' : 'Preview'}
                                       </div>
                                    </Tooltip>
                                 </Box>
                              )}

                              {!this.state.advancedOptions && !this.state.preview && this.state.dataEdit && this.state.dataEdit.length > 40 && (
                                 <Tooltip title={'Toggle Word Wrap'} open={null} TransitionComponent={Fade} enterDelay={640} TransitionProps={{ timeout: 96 }}>
                                    <div
                                       id="noteWordWrap"
                                       className="TB-Button "
                                       style={{ marginLeft: '-4px', marginRight: '3px' }}
                                       onClick={() => {
                                          options.lineWrapping = !options.lineWrapping;
                                          return this.setState({ dataEdit: this.state.dataEdit });
                                       }}
                                    >
                                       <i className="mdi-wrap" />
                                    </div>
                                 </Tooltip>
                              )}

                              {!this.state.advancedOptions && canPrettier() && (
                                 <Tooltip title={'Prettier'} open={null} TransitionComponent={Fade} enterDelay={640} TransitionProps={{ timeout: 96 }}>
                                    <div id="noteReLock" className="TB-Button " style={{ marginLeft: '-4px', marginRight: '3px' }} onClick={prettier}>
                                       <i className="fas-parking" />
                                    </div>
                                 </Tooltip>
                              )}
                           </Flex>
                        </Box>
                        <Box __colRight width={'auto'} style={{ flexFlow: 'row-reverse' }}>
                           {this._isChanged() && (
                              <Flex width={'auto'}>
                                 {isNew ? (
                                    <Tooltip title={'discard'} open={null} TransitionComponent={Fade} enterDelay={640} TransitionProps={{ timeout: 96 }}>
                                       <div className={!options.autoSave || isNew ? 'popOpenAlpha' : 'tbhidden'}>
                                          <div className="TB-Button" onClick={this._cancel}>
                                             <i className="fe-trash" />
                                          </div>
                                       </div>
                                    </Tooltip>
                                 ) : (
                                    !options.autoSave && (
                                       <Tooltip title={'undo'} open={null} TransitionComponent={Fade} enterDelay={640} TransitionProps={{ timeout: 96 }}>
                                          <div className={!options.autoSave || isNew ? 'popOpenAlpha' : 'tbhidden'}>
                                             <div className="TB-Button" onClick={this._cancel}>
                                                <i className="mdi-restore" />
                                             </div>
                                          </div>
                                       </Tooltip>
                                    )
                                 )}

                                 {true && (
                                    <Tooltip
                                       title={`save${bindSave ? ` [${bindSave}]` : ''}`}
                                       open={null}
                                       TransitionComponent={Fade}
                                       enterDelay={640}
                                       TransitionProps={{ timeout: 96 }}
                                    >
                                       <div className={!options.autoSave || isNew ? 'circlePopOpen' : 'tbhidden'}>
                                          <div className={!options.autoSave || isNew ? 'popOpenAlpha' : 'tbhidden'}>
                                             <div
                                                className="TB-Button TB-Button-asert"
                                                onClick={this.saveBunttonHandler}
                                                id="noteSave"
                                                style={{ marginRight: '0px', marginLeft: '-2px' }}
                                                ref={ref => {
                                                   this.ref_buttonSave = ref;
                                                }}
                                             >
                                                Save
                                             </div>
                                          </div>
                                       </div>
                                    </Tooltip>
                                 )}
                              </Flex>
                           )}
                        </Box>
                     </Flex>
                  </div>
               )}
            </div>
         );
      },
   });
}

//COMPONENTE BASE, ES EL QUE PONE EL LOADER Y CAMBIA EL COMPONENTE AL MOVERSE POR LAS RULES
//FORMATO SIMLPIFICADO DE aux_viewer.createViewerHtml
function createViewerNotesBase(params, htmlPromiseComponent, makeHighlight = true) {
   if (params.highlight === false) makeHighlight = false;
   if (params.highlight === true) makeHighlight = true;

   return CreateReactClass({
      getInitialState() {
         return {
            compo: <span />,
         };
      },
      componentDidMount() {
         if (this.deleted) return;
         this.fetchHtml = debounce(rule => {
            if (_ruleIsDeleted(this, rule)) return;
            new Promise((resolve, reject) => htmlPromiseComponent(resolve, reject, this.props.rule)).then(obj => {
               if (_ruleIsDeleted(this, rule) || this.deleted) return { compo: <span /> };
               this.setState(prevState => ({
                  compo: (
                     <span id="ruleViewer_child" className="">
                        {obj && obj.component ? <obj.component /> : <span />}
                     </span>
                  ),
               }));
            });
         }, params.debounceTime_viewer || Config.get('here_are_dragons.debounceTime_viewer') * 0.5);

         if (this.props.rule) this.fetchHtml(cloneDeep(this.props.rule));
      },
      componentWillUnmount() {
         this.deleted = true;
      },
      UNSAFE_componentWillReceiveProps: function(nextProps) {
         if (this.deleted) return;
         if (nextProps.rule && this.props.rule && getNoteIdFormRule(nextProps.rule) === getNoteIdFormRule(this.props.rule)) return;
         this.setState(prevState => ({ compo: this.getInitialState().compo }));
         this.fetchHtml(cloneDeep(nextProps.rule));
      },
      render: function() {
         if (this.deleted) return <span />;
         return this.state.compo;
      },
   });
}

module.exports.createViewerNotesBase = createViewerNotesBase;
module.exports.noteComponent = noteComponent;
