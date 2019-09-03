const React = require('react');
const { useState, useEffect } = React;
const { requireCompo } = require('@components/get_compo.js');
const { get, debounce, mergeObj, krange, equal } = require('@aux/aux_global.js');
const { clone } = require('lodash');
const { mostReadable } = require('tinycolor2');
const tinycolor = require('tinycolor2');
const { Manager, Reference, Popper } = require('react-popper');
const SelectIcon = requireCompo('compo_superselectfield.jsx').Superselectfield;
const Config = require('@render/config.js');
const ReactSelect = require('react-select').default;
const { fileExists } = require('@render/aux_drive_manager.js');
const { Flex, Box } = require('@rebass/emotion');
const remote = require('electron').remote;
const { dialog, app } = remote;
const Tooltip = require('@material-ui/core/Tooltip').default;
const Fade = require('@material-ui/core/Fade').default;
const Logger = require('@render/logger.js');
const parentWindow = remote.getCurrentWindow();

const ICON_TYPES = [
   { value: 'iconDefault', label: 'Default' },
   { value: 'iconFont', label: 'Normal' },
   { value: 'iconSrc', label: 'File' },
   { value: 'iconAdv', label: 'Advanced' },
];

const default_palette = [
   '#f0db4f',
   '#ffcd39',
   '#ff9547',
   '#ff6859',
   '#ff5a77',
   '#f06ac2',
   '#b46fff',
   '#6f77ff',
   '#4ec1f2',
   '#20efe7',
   '#48ea7b',
   '#34e8ae',
   '#49af96',
   '#eeffff',
   '#282c34',
   '#ffdb9e',
   '#dced6e',
   '#aaff92',
   '#92e5ff',
   '#e5b4ff',
];

let color_palette = [...(Config.get('here_are_dragons.color_palette') || []), ...default_palette].slice(0, 20);
let defaultColor = require('@render/theme_manager.js').getdefaultColor();
let ColorPicker = null;
let lastStyledColor = null;
let lastIconToSavetoCompare = null;
let userPalette = [...color_palette.slice(15, 20)];
userPalette[0] = defaultColor;

const getPalettes = () => {
   return [...color_palette.slice(0, 15), ...userPalette.slice(0, 5)];
};

const _handleCustomDisplaySelections = (values, name) => {
   return (
      <span className="labelIconWrapp">
         {values && values.value && values.value !== 'null' ? (
            <React.Fragment>
               <span className="labelIcon">
                  <i className={values.value} style={lastStyledColor ? { color: lastStyledColor } : null} />
               </span>
               {values.label || values.value || 'no icon'}
            </React.Fragment>
         ) : (
            <span className="labelIcon">no icon</span>
         )}
      </span>
   );
};

const _dataDisplayItem = item => {
   return (
      <span key={item.value} value={item.value} className="optionIcon">
         <i className={item.value} /> {item.label}
      </span>
   );
};

class SelectIconSimple extends React.Component {
   constructor(props) {
      super(props);
   }

   render() {
      let iconVal = get(this.props, 'icon') || null;
      let iconValEnabled = get(iconVal, 'value') || null;
      let buttonWidth = 36;
      return (
         <Flex>
            <Box style={{ width: `calc(100% - ${buttonWidth}px)` }}>
               <SelectIcon
                  {...this.props}
                  value={iconVal}
                  popoverWidth={190}
                  dataDisplayItem={_dataDisplayItem}
                  handleCustomDisplaySelections={_handleCustomDisplaySelections}
               />
            </Box>
            <Box style={{ width: buttonWidth }}>
               <IconColor {...this.props} enabled={iconValEnabled && iconValEnabled !== 'null'} />
            </Box>
         </Flex>
      );
   }
}

const IconColor = props => {
   ColorPicker = ColorPicker || require('react-color').TwitterPicker;

   const icon = get(props, 'icon');
   const scolor = get(icon, 'styleColor') || defaultColor;
   const [openColor, setopenColor] = useState(false);
   const labelReadable = tinycolor(scolor).getBrightness() > 160 ? '#000' : '#fff';

   const swapOpenColor = () => {
      setopenColor(!openColor);
   };

   const clickOutSide = ev => {
      setopenColor(false);
   };

   const onChangeColor = (color, ev) => {
      if (!color || !color.hex) {
         setopenColor(false);
         return;
      }
      let close = get(ev, 'target.title').length > 0;
      if (close) setopenColor(false);
      if (props.onChange) props.onChange({ styleColor: color.hex });
   };

   useEffect(() => {
      if (!openColor && !getPalettes().includes(scolor)) {
         //SAVE USER COLOR
         userPalette.unshift(scolor);
      }
   }, [openColor]);

   return (
      <Manager>
         {openColor && <div id="removeColorOnClick" className="popoverCoverForOutside __clickFirstThisOnEsc zindex1" onClick={clickOutSide} />}
         <span className="colorPickerMini">
            <Reference>
               {({ ref }) => (
                  <Box
                     onClick={swapOpenColor}
                     ref={ref}
                     style={props.enabled ? {} : { pointerEvents: 'none', filter: 'grayscale(100%)', opacity: '.5', mixBlendMode: 'color-dodge' }}
                  >
                     <div
                        className="colorOpener"
                        style={{
                           backgroundColor: scolor || null,
                           color: labelReadable,
                           height: 26,
                           marginTop: 3,
                           marginLeft: 3,
                           width: 'calc(100% - 3px)',
                           lineHeight: '27px',
                           cursor: 'pointer',
                        }}
                     >
                        color
                     </div>
                  </Box>
               )}
            </Reference>
            <Popper placement="top" style={{ zIndex: 1 }}>
               {({ ref, style, placement, arrowProps }) => (
                  <div className={!openColor ? 'hideObjForce' : ''}>
                     <div ref={ref} style={style} data-placement={placement} className="zindex2">
                        <div style={{ width: 'auto', height: 'auto', padding: '16px 0' }}>
                           {(openColor || true) && (
                              <div className="colorPickerWrapper" ref={arrowProps.ref} style={arrowProps.style}>
                                 <ColorPicker
                                    triangle="hide"
                                    colors={getPalettes()}
                                    width={182}
                                    onClick={this.handleClose}
                                    color={scolor || defaultColor}
                                    onChange={onChangeColor}
                                 />
                                 <div
                                    style={{
                                       display: 'flex',
                                       justifyContent: 'flex-end',
                                       margin: 6,
                                       paddingBottom: 6,
                                    }}
                                 >
                                    <div className="TB-Button TB-Button-autowidth" style={{ marginLeft: '0px', transition: 'none' }} onClick={onChangeColor}>
                                       OK
                                    </div>
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
               )}
            </Popper>
         </span>
      </Manager>
   );
};

const SelectIconSrc = props => {
   const icon = get(props, 'icon');
   const [value, setValue] = useState(get(icon, 'value') || '');
   const [isValid, setisValid] = useState(value ? fileExists(value) : false);

   const changeFile = async file => {
      file = file && Array.isArray(file) && file[0] ? file[0] : file;
      file = file ? String(file) : '';
      setValue(file);
      let _fileExist = file && fileExists(file);
      if (_fileExist) {
         setisValid(true);
         props.onChange({ value: file, type: 'iconSrc' });
      } else {
         setisValid(false);
         Logger.warn('[file]', file);
      }
   };

   return (
      <React.Fragment>
         <input
            spellCheck="false"
            onChange={ev => {
               changeFile(get(ev, 'target.value'));
            }}
            className="__elNoAutofocus _norefocusMain TB-input-text"
            id="iconAdvanced"
            type={'text'}
            name="icon"
            value={value}
            placeholder="file src"
         />
         <div className="miniBottonBar" style={{ marginTop: 8 }}>
            <Tooltip title={'select file'} open={null} TransitionComponent={Fade} enterDelay={640} TransitionProps={{ timeout: 96 }}>
               <div
                  id="fileOpenDialog"
                  className="TB-Button TB-Button-accent"
                  onClick={async () => {
                     dialog.showOpenDialog(
                        parentWindow,
                        {
                           properties: ['openFile'],
                           title: 'Select file',
                           buttonLabel: 'select',
                           defaultPath: app.getPath('documents'),
                           filters: [
                              { name: 'Supported Icon Type', extensions: ['jpg', 'jpeg', 'svg', 'png', 'gif', 'exe', 'lnk', 'app', 'ico'] },
                              { name: 'All Files', extensions: ['*'] },
                           ],
                        },
                        changeFile
                     );
                  }}
               >
                  <i className="w-icon-file-add" />
               </div>
            </Tooltip>
            {!isValid && value && value.length > 0 && (
               <div className={'circlePopOpen'}>
                  <div className={'popOpen'}>
                     <Tooltip title={'file not exist'} open={null} TransitionComponent={Fade} enterDelay={640} TransitionProps={{ timeout: 96 }}>
                        <div id="fileWarning" className="TB-Button TB-Button-error">
                           <i className="fe-alert-circle" />
                        </div>
                     </Tooltip>
                  </div>
               </div>
            )}
         </div>
      </React.Fragment>
   );
};

const SelectIconAdvanced = props => {
   const icon = get(props, 'icon');
   const [value, setValue] = useState(get(icon, 'value') || '');

   const changeVal = async value => {
      value = value ? String(value) : '';
      setValue(value);
      props.onChange({ value: value, type: 'iconAdv' });
   };

   return (
      <input
         spellCheck="false"
         onChange={ev => {
            changeVal(get(ev, 'target.value'));
         }}
         className="__elNoAutofocus _norefocusMain TB-input-text"
         id="iconAdvanced"
         type={'text'}
         name="icon"
         value={value}
         placeholder="value"
      />
   );
};

const SelectIconTB = props => {
   const type = get(props, 'icon.type');
   let iconToSave = props.icon || {};
   let selectIcon = <React.Fragment />;
   let ref_selectType = null;

   lastStyledColor = get(props, 'icon.styleColor') || null;

   useEffect(() => {
      const change = equal(lastIconToSavetoCompare, props.icon);
      if (change && document.querySelector('#removeColorOnClick')) document.querySelector('#removeColorOnClick').click();
      lastIconToSavetoCompare = props.icon;
   }, [props]);

   const onChangeIn = val => {
      iconToSave = Object.assign({}, iconToSave, val);
      if (props.onChange) props.onChange(iconToSave);
   };

   const changeType = val => {
      ref_selectType && ref_selectType.blur();
      onChangeIn({ type: val.value, value: null });
   };

   let comboTypeMarg = 8;

   if (!type || type === 'iconDefault') {
      changeType({ value: null, type: 'iconDefault', styleColor: defaultColor });
      selectIcon = <React.Fragment />;
      comboTypeMarg = 0;
   } else {
      if (type === 'iconFont') selectIcon = <SelectIconSimple {...props} onChange={onChangeIn} />;
      if (type === 'iconSrc') selectIcon = <SelectIconSrc {...props} onChange={onChangeIn} />;
      if (type === 'iconAdv') selectIcon = <SelectIconAdvanced {...props} onChange={onChangeIn} />;
   }

   const comboType = (
      <ReactSelect
         onKeyDown={e => {
            e.persist();
            if (e && e.key === 'Escape') {
               if (ref_selectType) ref_selectType.blur();
            }
         }}
         ref={ref => (ref_selectType = ref)}
         maxMenuHeight={32 * 4}
         name="iconType"
         classNamePrefix="react-select"
         menuPlacement={'top'}
         className="TB-select TB-select-mini TB-select-top"
         isSearchable={false}
         isSelected={false}
         options={ICON_TYPES}
         defaultValue={ICON_TYPES[0]}
         placeholder="icon type"
         value={ICON_TYPES.find(obj => obj.value === type) || ICON_TYPES[0]}
         onChange={changeType}
      />
   );

   return (
      <React.Fragment>
         <div style={{ marginBottom: comboTypeMarg }}>{comboType}</div>
         {selectIcon}
      </React.Fragment>
   );
};

module.exports.SelectIcon = SelectIconTB;
