const React = require('react');
const { Fragment, useEffect, useState } = React;
const CreateReactClass = require('create-react-class');
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const { get, cloneDeep, debounce, mergeObj, krange } = require('@aux/aux_global.js');
const { Flex, Box } = require('@rebass/emotion');
const dayjs = require('dayjs');
const Tooltip = require('@material-ui/core/Tooltip').default;
const Fade = require('@material-ui/core/Fade').default;
const ms = require('ms');

let ReactSelect = null;
let dinamic_paths = null;
let Switch = null;
let classNames = null;
let makeHashpbkdf2 = null;
let auxBabel = null;

let listicons = null;
let zxcvbn = null;
let zxcvbnDeb = null;
let listiconsMap = null;
let SelectIcon = null;

const getNoteIdFormRule = rule => {
   return rule ? rule._internal_id || null : null;
};

const folderIcons = () => {
   if (listiconsMap) return listiconsMap;
   listicons = listicons || require('@aux/aux_list_font_icons_classes.js');
   listiconsMap = listicons.map(ico => {
      return { value: ico, label: ico };
   });
   listiconsMap.unshift({ value: 'null', label: 'no icon' });
   return listiconsMap;
};

const $pause = time => new Promise(res => setTimeout(res, time || 1));

const checkzxcvbn = (pass, callBack) => {
   zxcvbn = zxcvbn || require('zxcvbn');
   if (!zxcvbn) return;
   let $strength = krange(zxcvbn(pass).guesses_log10, 0, 10, 0, 1);
   if ($strength > 1) $strength = 1;
   if ($strength < 0.25) $strength = 0.25;
   if (callBack) callBack($strength);
   setTimeout(function() {
      try {
         zxcvbn = null;
         delete require.cache['zxcvbn'];
      } catch (e) {}
   }, ms('10m'));
   return $strength;
};

const checkzxcvbnDeb = debounce(checkzxcvbn, 128);

function noteOptions(props) {
   ReactSelect = ReactSelect || require('react-select').default;
   dinamic_paths = dinamic_paths || require('./list_dinamic_paths.js');
   Switch = Switch || require('@material-ui/core/Switch').default;
   classNames = classNames || require('classcat');
   makeHashpbkdf2 = makeHashpbkdf2 || require('@aux/aux_crypt.js').makeHashpbkdf2;
   auxBabel = auxBabel || require('@aux/aux_babel.js');
   SelectIcon = SelectIcon || require(auxBabel.replaceJSX('./compo_select_icon.jsx')).SelectIcon;

   const advancedOptions = props.advancedoptions;
   const options = props.options;
   const rule = cloneDeep(props.rule);
   const ruleEdit = props.ruleedit;
   const refreshData = props.refreshData;
   const noteMeta = get(ruleEdit, 'params._meta') || {};
   const noteParams = ruleEdit.params;
   const note_is_new = noteParams._note_is_new;
   const noteID = getNoteIdFormRule(rule);
   const title = ruleEdit.title || '';
   const normaliceBindKeys = props.normaliceBindKeys;
   const openExternal = props.openExternal;
   const deleteNote = props.deleteNote;
   const $save = props.onSave;

   const [_encryptStart, set_encryptStart] = useState(note_is_new ? false : get(ruleEdit, 'params._note_encrypt'));
   const [_encryptTmp, set_encryptTmp] = useState(_encryptStart);
   const [_pass1, set_pass1] = useState('');
   const [_pass2, set_pass2] = useState('');
   const [_expander, set__expander] = useState(note_is_new ? null : get(ruleEdit, 'params._noteExpander'));

   const [_strength, set_strength] = useState(0);
   const [_passIsOk, set_passIsOk] = useState(false);

   const [_confirmEnc, set_confirmEnc] = useState(false);
   const [_confirmDesc, set_confirmDesc] = useState(false);
   const [_pass_inView, set_pass_inView] = useState(true);

   const onChangeFolder = objVal => {
      const tmpObj = { rule: cloneDeep(ruleEdit) };
      tmpObj.rule.params._note_folder = objVal.id;
      ref_selectFolder && ref_selectFolder.blur();
      if (props.onchange) props.onchange(tmpObj);
   };

   const onChangeIcon = (objVal, placedby = 'user') => {
      const tmpObj = { rule: cloneDeep(ruleEdit) };

      tmpObj.rule.params._note_icon = tmpObj.rule.params._note_icon || {};

      if (objVal.styleColor) tmpObj.rule.params._note_icon.styleColor = objVal.styleColor;
      if (objVal.value || objVal.value === null) tmpObj.rule.params._note_icon.value = objVal.value;
      if (objVal.type) tmpObj.rule.params._note_icon.type = objVal.type;

      tmpObj.rule.params._note_icon.placedby = placedby;

      if (props.onchange) props.onchange(tmpObj);
   };

   const onChangeExpander = objVal => {
      let val = event.target.value;
      const tmpObj = { rule: cloneDeep(ruleEdit) };
      tmpObj.rule.params._noteExpander = val;
      set__expander(val);
      if (props.onchange) props.onchange(tmpObj);
   };

   const onChangeCrypt = () => {
      set_encryptTmp(!_encryptTmp);
      if (!_encryptTmp) {
         set_pass1('');
         set_pass2('');
      }
   };

   const onChange_pass1 = event => {
      let val = event.target.value;
      set_pass1(val);
   };

   const onChange_pass2 = event => {
      let val = event.target.value;
      set_pass2(val);
   };

   useEffect(() => {
      check_passIsOk();
   });

   let ref_selectFolder = null;
   let folderPaths = dinamic_paths.get_note_paths() || [];

   let ref_selectIcon = null;

   if (_pass1.length > 0) {
      checkzxcvbnDeb(_pass1, val => {
         if (_strength == val) return;
         set_strength(val);
      });
   } else {
      if (_strength !== 0) set_strength(0);
   }

   const save = async () => {
      let res = await $save();
      if (res && !note_is_new) {
         set_pass1('');
         set_pass2('');
         set_confirmDesc(false);
         set_confirmEnc(false);
         set_passIsOk(false);
      }
      return true;
   };

   const check_passIsOk = async () => {
      if (!props.advancedoptions) return null;

      const __id = getNoteIdFormRule(ruleEdit);
      if (!__id || !props.onchange || !props.setKey) {
         if (Config.isDev) console.log('[check_passIsOk] id is null / is new note / reset status');
         set_pass1('');
         set_pass2('');
         set_encryptTmp(false);
         set_confirmEnc(false);
         set_passIsOk(false);
         return null;
      }

      const tmpObj = { rule: cloneDeep(ruleEdit) };
      const passOk = _encryptTmp && !_encryptStart && !!(_pass1 && _pass1.length > 1 && _pass1 === _pass2);
      let encrypt_hash = null;

      tmpObj.rule.params._note_encrypt = passOk;

      //ALREADY ENCRIPTED
      if (_encryptStart) {
         set_pass1('');
         set_pass2('');
         set_confirmEnc(false);
         set_passIsOk(false);
         if (_confirmDesc && !_encryptTmp) {
            await props.onchange(tmpObj);
            set_encryptStart(false);
            save();
         }
         return null;
      }

      //CHANGE OBJ
      if (passOk) {
         encrypt_hash = await makeHashpbkdf2(_pass1);
         if (!encrypt_hash) {
            Logger.error('[check_passIsOk] fail makeHashpbkdf2');
            return null;
         }

         if (_confirmEnc) {
            if (Config.isDev) console.log('change opt effect', { note_encrypt: tmpObj.rule.params._note_encrypt, _encryptTmp, passOk });

            tmpObj.rule.params._note_encrypt_hash = encrypt_hash;
            await props.onchange(tmpObj);

            props.setKey(__id, _pass1);
            await save();
         }
      }

      if (_passIsOk !== passOk) set_passIsOk(passOk);
   };

   return (
      <Flex id="noteOptions" className="TB-Options-box">
         <Box __colLeft id="noteOptionsLeft">
            <h3 className="hNoBorder noteOptionsH3">
               Options:{' '}
               {Config.isDev && (
                  <Fragment>
                     {title} e: {String(_encryptStart)}
                  </Fragment>
               )}
            </h3>
            <Box>
               <Flex className="TB-Option-celd">
                  <Box __optLeft className="TB-Option-celd-label">
                     Folder:
                  </Box>
                  <Box __optRighlt className="TB-Option-celd-value">
                     <ReactSelect
                        ref={ref => (ref_selectFolder = ref)}
                        onKeyDown={e => {
                           e.persist();
                           if (e && e.key === 'Escape') {
                              if (ref_selectFolder) ref_selectFolder.blur();
                           }
                        }}
                        maxMenuHeight={32 * 4}
                        isSearchable={folderPaths.length > 8}
                        name="Folder"
                        className="TB-select TB-select-mini"
                        classNamePrefix="react-select"
                        placeholder="Folder"
                        value={dinamic_paths.get_note_paths_by_id(ruleEdit.params._note_folder)}
                        options={folderPaths}
                        onChange={onChangeFolder}
                     />
                  </Box>
               </Flex>

               <Flex className="TB-Option-celd">
                  <Box __optLeft className="TB-Option-celd-label">
                     Encrypt:
                  </Box>
                  <Box __optRighlt className="TB-Option-celd-value">
                     <span className="TB-Switch">
                        <Switch checked={_encryptTmp} value={_encryptTmp} onChange={onChangeCrypt} disableRipple={true} color="primary" />
                     </span>

                     {!_encryptTmp && _encryptStart && (
                        <div
                           onClick={async () => {
                              set_confirmDesc(true);
                           }}
                           className={'TB-Button TB-Button-wIcon TB-Button-left TB-Button-autowidth TB-Button-accent TB-Button-no-backhover'}
                           style={{ marginLeft: 8, display: 'inline-flex', verticalAlign: 'middle', width: 100 }}
                        >
                           <i className="mdi-key-minus" /> Remove Key
                        </div>
                     )}

                     {_encryptTmp && !ruleEdit.params._note_encrypt && (
                        <div className={'popOpenAlpha'}>
                           <input
                              spellCheck="false"
                              className="__elNoAutofocus __norefocusMain TB-input-text"
                              style={{ marginTop: 12, marginRight: 4, width: 120 }}
                              id="pass_1"
                              type={_pass_inView ? 'password' : 'text'}
                              name="pass_1"
                              placeholder="key"
                              value={_pass1}
                              onChange={onChange_pass1}
                           />

                           <div
                              onClick={() => set_pass_inView(!_pass_inView)}
                              id="viewPass"
                              style={{ marginLeft: 0, display: 'inline-flex', marginTop: 8, paddingRigth: 2, paddingLeft: 4, opacity: 0.3 }}
                              className={'TB-Button TB-Button-autowidth  TB-Button-left TB-Button-no-backhover'}
                           >
                              {_pass_inView ? (
                                 <i className="mdi-eye" style={{ top: 4, position: 'relative' }} />
                              ) : (
                                 <i className="mdi-eye-off" style={{ top: 4, position: 'relative' }} />
                              )}
                           </div>

                           <br />

                           {_pass1.length > 0 && (
                              <div className={'popOpenAlpha'}>
                                 <input
                                    spellCheck="false"
                                    className="__elNoAutofocus __norefocusMain TB-input-text"
                                    style={{ marginTop: 8, width: 120 }}
                                    id="pass_2"
                                    type={_pass_inView ? 'password' : 'text'}
                                    name="pass_2"
                                    placeholder="confirm key"
                                    value={_pass2}
                                    onChange={onChange_pass2}
                                 />
                                 <br />
                                 <div style={{ width: 120 + 24, marginTop: 12, marginLeft: 1, height: 3, borderRadius: 3, background: 'var(--hoverColor)' }}>
                                    <div
                                       style={{ width: (120 + 24) * _strength, height: 3, borderRadius: 3 }}
                                       id="grad1"
                                       className={`TB-lineGauge ${classNames({
                                          __1: _strength > 0.4,
                                          __2: _strength > 0.6,
                                          __3: _strength > 0.8,
                                          __4: _strength > 0.99,
                                       })}`}
                                    />
                                 </div>
                              </div>
                           )}

                           {_pass1.length > 0 && _pass2.length > 0 && _pass1 !== _pass2 && (
                              <div className={'popOpenAlpha__'}>
                                 <div
                                    className={'TB-Button TB-Button-wIcon TB-Button-left TB-Button-autowidth TB-Button-disabled TB-Button-error'}
                                    style={{ display: 'inline-flex', width: 120, paddingLeft: 1, marginTop: 14, opacity: 0.6 }}
                                 >
                                    <i className="ion-md-alert" style={{ width: 18 }} /> Key not match
                                 </div>
                              </div>
                           )}

                           {_pass1.length > 0 && _pass2.length > 0 && _pass1 === _pass2 && (
                              <Fragment>
                                 {_passIsOk && (
                                    <div className={'popOpenAlpha'}>
                                       <div
                                          onClick={async () => {
                                             set_confirmEnc(true);
                                          }}
                                          className={'TB-Button TB-Button-wIcon TB-Button-left TB-Button-autowidth TB-Button-asert TB-Button-no-backhover '}
                                          style={{ display: 'inline-flex', width: 140, paddingLeft: 1, marginTop: 14 }}
                                       >
                                          <i className="icons8-lock" style={{ width: 18 }} />

                                          {!note_is_new ? <span>Apply Key & Save</span> : <span>Apply Key & Save</span>}
                                       </div>
                                    </div>
                                 )}
                                 {!_passIsOk && (
                                    <div
                                       className={'TB-Button TB-Button-wIcon TB-Button-left TB-Button-autowidth TB-Button-disabled TB-Button-error'}
                                       style={{ display: 'inline-flex', width: 120, paddingLeft: 1, marginTop: 14, opacity: 0.6 }}
                                    />
                                 )}
                              </Fragment>
                           )}
                        </div>
                     )}
                  </Box>
               </Flex>

               <Flex className="TB-Option-celd">
                  <Box __optLeft className="TB-Option-celd-label">
                     icon:
                  </Box>
                  <Box __optRighlt className="TB-Option-celd-value">
                     <SelectIcon options={folderIcons()} icon={ruleEdit.params._note_icon || null} maxMenuHeight={6} onChange={onChangeIcon} />
                  </Box>
               </Flex>

               <Flex className="TB-Option-celd">
                  <Box __optLeft className="TB-Option-celd-label">
                     expander:
                  </Box>
                  <Box __optRighlt className="TB-Option-celd-value">
                     <input
                        spellCheck="false"
                        className="__elNoAutofocus __norefocusMain TB-input-text"
                        style={{}}
                        id="expander"
                        type={'text'}
                        name="expander"
                        placeholder="key"
                        value={_expander || ''}
                        onChange={onChangeExpander}
                     />
                  </Box>
               </Flex>
            </Box>
         </Box>

         <Box __colRight className="noteInfoBox">
            {advancedOptions && !note_is_new && (
               <React.Fragment>
                  <h3 className="hNoBorder noteOptionsH3">Info</h3>
                  <div className="noteInfos">
                     {!!noteParams._note_creationDate && (
                        <div className="noteInfo">
                           <b>Created:</b> {dayjs(noteParams._note_creationDate).format(Config.getDragons('dateFormat'))}
                        </div>
                     )}

                     {!!noteParams._note_modifyDate && (
                        <div className="noteInfo">
                           <b>LastChange:</b> {dayjs(noteParams._note_modifyDate).format(Config.getDragons('dateFormat'))}
                        </div>
                     )}

                     {!!noteMeta.modify_lenght && (
                        <div className="noteInfo">
                           <b>Changes:</b> {noteMeta.modify_lenght}
                        </div>
                     )}

                     {!!true && (
                        <div className="noteInfo">
                           <b>Paste:</b> {noteMeta.paste ? 'Yes' : 'No'}
                        </div>
                     )}

                     {!!noteMeta.user && (
                        <div className="noteInfo">
                           <b>User:</b> {noteMeta.user}
                        </div>
                     )}

                     {!!noteMeta.terminal && (
                        <div className="noteInfo">
                           <b>Terminal:</b> {noteMeta.terminal}
                        </div>
                     )}

                     {deleteNote && (
                        <div style={{ marginTop: 32 }}>
                           <Tooltip
                              title={options.bindKeysDelete ? ` [${normaliceBindKeys(get(options, 'bindKeysDelete[0]'))}]` : ''}
                              open={null}
                              TransitionComponent={Fade}
                              enterDelay={640}
                              TransitionProps={{ timeout: 96 }}
                              placement="top"
                           >
                              <div
                                 onClick={() => {
                                    deleteNote && deleteNote(rule);
                                 }}
                                 id="unlockPassBtn"
                                 style={{ marginLeft: -9, minWidth: 160, justifyContent: 'start', marginBottom: 2, marginTop: 0 }}
                                 className={'TB-Button TB-Button-wIcon TB-Button-accent TB-Button-autowidth TB-Button-no-backhover'}
                              >
                                 <i className="fe-trash" /> {'Delete'}
                              </div>
                           </Tooltip>
                        </div>
                     )}

                     {openExternal && !_encryptStart && (
                        <Tooltip
                           title={options.bindKeysOpen ? ` [${normaliceBindKeys(get(options, 'bindKeysOpen[0]'))}]` : ''}
                           open={null}
                           TransitionComponent={Fade}
                           enterDelay={640}
                           TransitionProps={{ timeout: 96 }}
                           placement="top"
                        >
                           <div
                              onClick={() => {
                                 openExternal && openExternal(rule);
                              }}
                              id="unlockPassBtn"
                              style={{ marginLeft: -9, minWidth: 160, justifyContent: 'start', marginBottom: 4 }}
                              className={'TB-Button TB-Button-wIcon TB-Button-accent TB-Button-autowidth TB-Button-no-backhover'}
                           >
                              <i className="fe-edit-2" />

                              {'Open External'}
                           </div>
                        </Tooltip>
                     )}
                  </div>
               </React.Fragment>
            )}
         </Box>
      </Flex>
   );
}

module.exports.noteOptions = noteOptions;
