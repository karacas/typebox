'use strict';

// const htm = require('htm');
// const html = htm.bind(React.createElement);

const React = require('react');
const { useState, useRef, useEffect } = React;
const ReactDOM = require('react-dom');
const CreateReactClass = require('create-react-class');
const useComponentSize = require('@rehooks/component-size');
const numeral = require('numeral');
const Config = require('@render/config.js');
const Logger = require('@render/logger.js');
const { webFrame, remote } = require('electron');
const { throttle, debounce, has } = require('lodash');
const Mousetrap = require('mousetrap');
const ms = require('ms');
const classNames = require('classcat');
const Tooltip = require('@material-ui/core/Tooltip').default;
const Fade = require('@material-ui/core/Fade').default;
const { getKeyFromConfig, get, cloneDeep, equal, $timeout } = require('@aux/aux_global.js');
const Executor = require('@render/executor.js');
const stats = require('@render/stats.js');
const ListViewStore = require('@render/list_view_store.js');
const PackagesManager = require('@render/packages_manager.js');
const driveManager = require('@render/aux_drive_manager.js');
const sharedData = require('@render/shared_data.js');
const favManager = require('@render/fav_manager.js');
const themeManager = require('@render/theme_manager.js');
const newsManager = require('@render/news_manager.js');
const lastRulesManager = require('@render/last_rules_manager.js');
const resetScore = require('@render/history_manager.js').remove;
const toggleHidden = require('@render/hidden_rules_manager.js').toggle;
const ruleManager = require('@render/rule_manager.js');
const copyToClipboard = require('@render/place_text.js').copyToClipboard;
const getIconDelayed = require('@render/icon.js').getIconDelayed;
const getIconDelayedCache = require('@render/icon.js').getIconDelayedCache;
const { sanitizeSVGReact } = require('@render/aux_viewer.js');
const { Provider } = require('unstated');
const diff = require('deep-object-diff').diff;

const auxBabel = require('@aux/aux_babel.js');
const MrDoobStats = require(auxBabel.replaceJSX('@mainview/mrdoob_stats.jsx'));

const store = ListViewStore.store;
const window_and_systray = sharedData.app_window_and_systray;
const viewEvents = sharedData.viewEvents;
const status = sharedData.status;
const getStatus = status.get;
const setStatus = status.set;

const _doubleClickTime = Config.get('here_are_dragons.doubleClickTime') || 500;
const _debounceTime_viewer_init = Config.get('here_are_dragons.debounceTime_viewer') || 150;
const _debounceTime_viewer_slow = 0;
const _disableKeys = Config.get('here_are_dragons.disableKeysOnSearchBox') || [];
const _debounceTime_searchKeys = Config.get('here_are_dragons.debounceTime_searchKeys') || 0;
const _version = Config.get('here_are_dragons.report.version') || '';
const _debounceTime_actionsKeys = Config.get('here_are_dragons.debounceTime_actionsKeys') || 0;
const _bindKeys = Config.get('here_are_dragons.bindKeys') || [];
const _throttleTime_moveList = Config.get('here_are_dragons.throttleTime_moveList') || 0;
const _defaultExecForTypes_string_copy = Config.get('here_are_dragons.defaultExecForTypes.string_copy');
const _deleteSearchOnFire = !!Config.get('here_are_dragons.deleteSearchOnFire');
const _lazyIconsEnabled = !!Config.get('here_are_dragons.lazyIcons');
const _canListenKeyboard = !!Config.get('here_are_dragons.canListenKeyboard');
const _canChangeThemeDarkLight = !!Config.get('here_are_dragons.canChangeThemeDarkLight');
const initStatus = status.get();
const TOOLTIP_DEF_PROPS = {
   TransitionComponent: Fade,
   enterDelay: 640,
   TransitionProps: { timeout: 96 },
};

const NOICON = '__NOICON__';

let labelToolTipContext = '';
let labelToolTipFav = '';

let _dev = !!Config.get('dev');
let _toolTips = !!Config.get('toolTips');
let _icons = !!Config.get('icons');
let _breakPointSmallViewer = Config.get('here_are_dragons.breakPointSmallViewer') || 420;
let _breakPointBigViewer = Config.get('here_are_dragons.breakPointBigViewer') || 980;
let _avoidResizeHeigth = !!Config.get('avoidResizeHeigth');
let _def_maxItemsVisible = Config.get('maxItemsVisible') || _def_maxItemsVisible;
let _def_width = Config.get('width') || _def_width;

let _status_showRuleScore = initStatus.show_rule_score;
let _status_alwaysOnTop = initStatus.always_on_top;
let _status_ioHook = initStatus.ioHook;
let _status_isMaximized = initStatus.maximized;
let _status_isFocus = initStatus.focused;

let eventObject = {};
let mainSearchEl = null;
let didCenter = false;
let _disableTmpAnims = true;
let _isVisible = false;
let _debounceTime_viewer = _debounceTime_viewer_init;

let _in_test = getStatus('in_test');
let _emitRender = _dev || _in_test;

// NO ZOOM
try {
   if (webFrame && webFrame.setZoomLevelLimits) webFrame.setZoomLevelLimits(1, 1);
} catch (e) {}

const d_root = document ? document.getElementById('root') : null;

const getinnerHtml = () => {
   return d_root.innerHTML || '';
};

const mainSearchFocus = () => {
   if (!mainSearchEl || !mainSearchEl.parentNode || !mainSearchEl.focus) {
      mainSearchEl = document.getElementById('mainSearch');
   }
   if (mainSearchEl && mainSearchEl.focus) {
      mainSearchEl.focus();
      return;
   }
};

function clearCaches(force) {
   try {
      if (remote && remote.getCurrentWindow) remote.getCurrentWindow().webContents.session.clearCache(clear => {});
      if (webFrame && webFrame.clearCache) webFrame.clearCache();
      Logger.log('[clearCaches]');
   } catch (e) {}
   try {
      if (gc) gc();
      Logger.log('gc');
   } catch (e) {}
}

const debounce_maximized = debounce(() => status.switch('maximized'), 4);
const resetSize = async props => {
   if (!status) return;

   if (_status_isMaximized) {
      await debounce_maximized();
      await $timeout(128);
   }

   let changeMaxItemVisible = getStatus('maxItemsVisible') !== _def_maxItemsVisible;
   let changeWidth = getStatus('width') !== _def_width;

   if (changeWidth || changeMaxItemVisible) {
      let changeObj = {};
      if (changeWidth) changeObj.width = _def_width;
      if (changeMaxItemVisible) changeObj.maxItemsVisible = _def_maxItemsVisible;
      await status.set(changeObj);
      await $timeout(8);
   }

   window_and_systray.centerWin(true);
};

`

8888888 888b    888 8888888 88888888888
  888   8888b   888   888       888
  888   88888b  888   888       888
  888   888Y88b 888   888       888
  888   888 Y88b888   888       888
  888   888  Y88888   888       888
  888   888   Y8888   888       888
8888888 888    Y888 8888888     888

`;

const init = async () => {
   if (!d_root) {
      Logger.error('[main_view] no document');
      return null;
   }

   _isVisible = true;

   const render = () => ReactDOM.render(<MainComponent store={store.getState()} storeDispatch={store.dispatch} />, d_root);

   Logger.logTime('[main_view] @init ...');
   stats.init();

   sharedData.app_window_and_systray.windowEvent.once('mainWindowReady', () => {
      store.subscribe(() => setTimeout(render));
      themeManager.init(document);
      themeManager.removeLoader();
      Logger.logTime('[main_view] First Render');
   });

   sharedData.app_window_and_systray.windowEvent.once('mainEnds', () => {
      PackagesManager.setMousTrap(Mousetrap.bind);
      sharedData.idleTime.onIdleTimeInterval(clearCaches, Config.get('here_are_dragons.report.clearCachesInerval'));

      if (_dev && window) {
         window.store = store;
         window.render = render;
         window._statusGet = getStatus;
         window._statusAction = status.actions;
         window.clearCaches = clearCaches;
      }
   });

   return true;
};

`

888b     d888        d8888 8888888 888b    888
8888b   d8888       d88888   888   8888b   888
88888b.d88888      d88P888   888   88888b  888
888Y88888P888     d88P 888   888   888Y88b 888
888 Y888P 888    d88P  888   888   888 Y88b888
888  Y8P  888   d88P   888   888   888  Y88888
888   "   888  d8888888888   888   888   Y8888
888       888 d88P     888 8888888 888    Y888

`;

const MainComponent = CreateReactClass({
   getInitialState() {
      return {
         upTime: stats.get.upTime || 1,
      };
   },
   componentDidUpdate() {
      if (_emitRender) {
         setTimeout(() => {
            eventObject = {
               search_text: this.props.store.search_text,
               result_text: this.props.store.result_text,
               lastRuleSelected: this.props.store.lastRuleSelected,
               queryTime: this.props.store.statusBar_totalTime,
               _isVisible: _isVisible,
               _disableTmpAnims: _disableTmpAnims,
               _document: null,
            };

            if (_in_test) eventObject._document = String(getinnerHtml());
            sharedData.lastviewEvent = eventObject;
            if (viewEvents && viewEvents.emit) viewEvents.emit('RENDER', sharedData.lastviewEvent);
         }, 0);
      }
   },
   componentDidMount() {
      this.searchField = document.getElementById('mainSearch');

      const delayforceUpdate = () => setTimeout(() => this.forceUpdate && this.forceUpdate(), 1);

      viewEvents.once('APP_IS_USABLE', () => {
         if (this.deleted) return;
         if (Logger) Logger.log('[APP_IS_USABLE]');
         _disableTmpAnims = false;
      });

      viewEvents.on('MAIN_FORCE_UPDATE', () => {
         if (this.deleted) return;
         if (Logger) Logger.log('[MAIN_VIEW [FORCE_UPDATE]');
         if (this.forceUpdate) this.forceUpdate();
      });

      viewEvents.on('FORCE_UPDATE_NO_ANIM', () => {
         if (this.deleted) return;
         if (Logger) Logger.log('[main_view] [FORCE_UPDATE with NO_ANIM]');
         _disableTmpAnims = true;
         if (this.forceUpdate) this.forceUpdate();
      });

      viewEvents.on('TMP_NO_ANIM', () => {
         if (this.deleted) return;
         if (_disableTmpAnims) return;
         if (Logger) Logger.log('[main_view] [TMP_NO_ANIM]');
         _disableTmpAnims = true;
      });

      viewEvents.on('RESET_SIZE', () => {
         if (this.deleted) return;
         resetSize();
      });

      // If settings chage > update view
      if (Config.getChangeSettingsEvent) {
         if (this.deleted) return;
         Config.getChangeSettingsEvent().on('changeSettings', (path, dif) => {
            _dev = !!Config.get('dev');
            _toolTips = !!Config.get('toolTips');
            _icons = !!Config.get('icons');
            _breakPointSmallViewer = Config.get('here_are_dragons.breakPointSmallViewer') || 420;
            _breakPointBigViewer = Config.get('here_are_dragons.breakPointBigViewer') || 980;
            _avoidResizeHeigth = !!Config.get('avoidResizeHeigth');

            let needResize = false;

            if (path === 'width' && Config.get('width') && Config.get('width') > 100) {
               _def_width = Config.get('width');
               needResize = true;
            }

            if (path === 'maxItemsVisible' && Config.get('maxItemsVisible')) {
               _def_maxItemsVisible = Config.get('maxItemsVisible');
               needResize = true;
            }

            if (needResize) status.set({ maxItemsVisible: _def_maxItemsVisible, width: _def_width });

            delayforceUpdate();
         });
      }

      // If status chage > update view
      status.on('change', async objPath => {
         if (this.deleted) return;
         let needUpdate = false;

         if (has(objPath, 'in_test')) {
            _in_test = getStatus('in_test');
            _emitRender = _dev || _in_test;
         }

         if (has(objPath, 'show_rule_score')) {
            _status_showRuleScore = get(objPath, 'show_rule_score');
            needUpdate = true;
         }

         if (has(objPath, 'always_on_top')) {
            _status_alwaysOnTop = get(objPath, 'always_on_top');
            needUpdate = true;
         }

         if (has(objPath, 'ioHook')) {
            _status_ioHook = get(objPath, 'ioHook');
            needUpdate = true;
         }

         if (has(objPath, 'focused')) {
            _status_isFocus = get(objPath, 'focused');
            _isVisible = _status_isFocus && document.visibilityState == 'visible';

            if (_disableTmpAnims && _isVisible) {
               setTimeout(() => {
                  if (_status_isFocus) _disableTmpAnims = false;
               }, _debounceTime_viewer_init);
            }

            needUpdate = true;
         }

         if (needUpdate) delayforceUpdate();
      });
   },
   componentWillUnmount() {
      this.deleted = true;
   },
   render() {
      let classes = _dev ? 'dev_version' : 'prod_version';

      if (_disableTmpAnims) classes += ' ' + 'disableTmpAnims';

      if (this.props.store && this.props.store.rulesPath && this.props.store.rulesPath.path === '/') classes += ' ' + 'level_root';

      if (_status_isFocus) classes += ' ' + 'isFocus';

      if (_status_alwaysOnTop) classes += ' ' + 'onTop';

      return (
         <div id="content" className={classes}>
            <MrDoobStatsWrapp />
            <div id="dragWindow" />
            <div id="inner-content">
               <FilterList store={this.props.store} storeDispatch={this.props.storeDispatch} version={_version} upTime={this.state.upTime} />
            </div>
         </div>
      );
   },
});

// MrDoobStatsWrapp
const getStatusUseEffect = (objPath, set) => {
   return () => {
      set(get(status.get(), objPath));
      const changeStats = path => {
         if (has(path, objPath)) set(get(path, objPath));
      };
      status.on('change', changeStats);
      return () => status.off('change', changeStats);
   };
};
const MrDoobStatsWrapp = props => {
   const [stats, setStats] = useState(false);
   useEffect(getStatusUseEffect('mrdoob_stats', setStats), []);
   return <MrDoobStats enabled={stats} />;
};

`

8888888888 8888888 888    88888888888 8888888888 8888888b.  888      8888888 .d8888b. 88888888888
888          888   888        888     888        888   Y88b 888        888  d88P  Y88b    888
888          888   888        888     888        888    888 888        888  Y88b.         888
8888888      888   888        888     8888888    888   d88P 888        888   "Y888b.      888
888          888   888        888     888        8888888P"  888        888      "Y88b.    888
888          888   888        888     888        888 T88b   888        888        "888    888
888          888   888        888     888        888  T88b  888        888  Y88b  d88P    888
888        8888888 88888888   888     8888888888 888   T88b 88888888 8888888 "Y8888P"     888

`;

const FilterList = CreateReactClass({
   componentDidMount() {
      const debounceTime = _debounceTime_actionsKeys;

      this.cacheLastRuleSelected = null;

      labelToolTipContext = '';
      labelToolTipFav = '';
      if (_toolTips) {
         labelToolTipContext = `Options [ ${getKeyFromConfig(_bindKeys, 'CONTEXT_MENU')} ]`;
         labelToolTipFav = `Toggle Fav [ ${getKeyFromConfig(_bindKeys, 'TOGGLE_FAVORITE')} ]`;
      }

      // ON FAVS
      window_and_systray.windowEvent.on('GO_TO_FAVS', (noAnims = false) => {
         if (PackagesManager.getPluginByName('internal_pack_favorites')) {
            if (noAnims) _disableTmpAnims = true;
            this.props.storeDispatch(ListViewStore.changeRulesPath(favManager.getPath()));
         }
      });

      window_and_systray.windowEvent.on('GO_TO_LAST', (noAnims = false) => {
         if (PackagesManager.getPluginByName('internal_pack_last_rules')) {
            if (noAnims) _disableTmpAnims = true;
            this.props.storeDispatch(ListViewStore.changeRulesPath(lastRulesManager.getPath()));
         }
         return;
      });

      window_and_systray.windowEvent.on('GO_TO_PATH', ($path, noAnims = false) => {
         if (noAnims) _disableTmpAnims = true;
         this.props.storeDispatch(ListViewStore.changeRulesPath($path));
         return;
      });

      window_and_systray.windowEvent.on('UNPOP_AND_BACK', async () => {
         _disableTmpAnims = true;
         this.props.storeDispatch(ListViewStore.deleteSearchBox());
         this.props.storeDispatch(ListViewStore.backRulesPath());
         await $timeout(1);
         Mousetrap.trigger('home');
         await $timeout(32);
         window_and_systray.unpopWin();
         return;
      });

      // Keys Actions
      // KTODO: Todo este choclo meterlo en una función auxiliar
      // //KTODO: mover a módulo auz
      this.debounceMouseTrap = debounce((event, $action) => {
         if (!event) return;

         if (!this.props.storeDispatch || !this.props.store || !window_and_systray) {
            Logger.info('No this.props.storeDispatch / No this.props.store / window_and_systray');
            return;
         }

         // KTODO: Pasar todo a Executor.js (?)
         if ($action === 'ESCAPE') {
            if (document.querySelector('.__clickFirstThisOnEsc')) {
               document.querySelector('.__clickFirstThisOnEsc').click();
               return;
            }
            if (event.target && event.target.id !== 'mainSearch') {
               mainSearchFocus();
            }
            if (this.props.store.executors !== null) {
               this.props.storeDispatch(ListViewStore.removeSubExecutors());
            } else if (!this.props.store.search_text_is_empty) {
               this.props.storeDispatch(ListViewStore.deleteSearchBox());
            } else if (this.props.store.rulesPath.path !== '/') {
               this.props.storeDispatch(ListViewStore.backRulesPath());
            } else {
               window_and_systray.unpopWin(); // HIDE WIN
            }
            if (event && event.preventDefault) event.preventDefault();
            return;
         }

         if ($action === 'ENTER') {
            if (document.querySelector('.__clickFirstThisOnEnter')) {
               document.querySelector('.__clickFirstThisOnEnter').click();
               return;
            }
            if (event && event.preventDefault) event.preventDefault();
            this.ruleExecutor(this.props.store.lastExcutorSelected || this.props.store.lastRuleSelected, event);
            Logger.log('\n');
            return;
         }

         if ($action === 'ENTER_LEVEL') {
            if (
               get(this.props.store.lastRuleSelected, 'params.changePath') ||
               get(this.props.store.lastRuleSelected, 'params.isDir') ||
               get(this.props.store.lastRuleSelected, 'type')[0] === 'TB_NOTES_OBJ'
            ) {
               if (event && event.preventDefault) event.preventDefault();
               this.ruleExecutor(this.props.store.lastRuleSelected, event);
               Logger.log('\n');
               return;
            }
         }

         if ($action === 'OPEN_IN_TERMINAL') {
            if (event && event.preventDefault) event.preventDefault();
            driveManager.openTerminal(this.props.store.lastRuleSelected);
            Logger.log('\n');
            return;
         }

         if ($action === 'RESET_SCORE') {
            const $id = get(this.props.store, 'lastRuleSelected', 'id');
            if ($id) {
               if (event && event.preventDefault) event.preventDefault();
               resetScore($id);
               ListViewStore.storeActions.updateFilterlist(true);
               Logger.log('\n');
            }
            return;
         }

         if ($action === 'HISTORY') {
            if (PackagesManager.getPluginByName('internal_pack_last_rules')) {
               if (event && event.preventDefault) event.preventDefault();
               this.props.storeDispatch(ListViewStore.changeRulesPath(lastRulesManager.getPath()));
            }
            return;
         }

         if ($action === 'FAVS') {
            if (PackagesManager.getPluginByName('internal_pack_favorites')) {
               if (event && event.preventDefault) event.preventDefault();
               this.props.storeDispatch(ListViewStore.changeRulesPath(favManager.getPath()));
            }
            return;
         }

         if ($action === 'RESET_SIZE') {
            if (event && event.preventDefault) event.preventDefault();
            resetSize();
            return;
         }

         if ($action === 'FOLDER_FAVS') {
            if (PackagesManager.getPluginByName('internal_pack_paths') && PackagesManager.getPluginByName('internal_pack_favorites')) {
               if (event && event.preventDefault) event.preventDefault();
               this.props.storeDispatch(ListViewStore.changeRulesPath(favManager.getFolderFavsPath()));
            }
            return;
         }

         if ($action === 'PASTE_TO_SEARCH' && /^darwin/.test(process.platform)) {
            const clipboardText = clipboard.readText();
            if (clipboardText) {
               if (event && event.preventDefault) event.preventDefault();
               const change = ListViewStore.changeQuery(clipboardText);
               this.props.storeDispatch(change);
               Logger.log('\n');
               return;
            }
         }

         if ($action === 'REFOCUS__SEARCH') {
            mainSearchFocus();
            if (event.target && event.target.id !== 'mainSearch') {
               mainSearchFocus();
               event.preventDefault();
            }
            return;
         }

         if ($action === 'BACKESCPACE') {
            if (this.props.store.executors !== null) {
               this.props.storeDispatch(ListViewStore.removeSubExecutors());
               return;
            }
            if (this.props.store.search_text_is_empty) {
               this.props.storeDispatch(ListViewStore.backRulesPath());
            }
            if (this.props.store.rulesPath.path == '/') {
               Mousetrap.trigger('home');
            }
            if (event.target && event.target.id !== 'mainSearch') {
               mainSearchFocus();
               event.preventDefault();
            }
            return;
         }

         if ($action === 'CONTEXT_MENU') {
            if (this.props.store.lastRuleSelected) {
               if (event && event.preventDefault) event.preventDefault();
               Executor.auxCallExecutors(this.props.store.lastRuleSelected);
            }
            return;
         }

         if ($action === 'CLOSE_WIN') {
            if (event && event.preventDefault) event.preventDefault();
            Executor.unpopWin(true);
            return;
         }

         if ($action === 'COPY_STRING') {
            if (!this.props.store.lastRuleSelected || !this.props.store.lastRuleSelected.type) return;

            let continueExec = null;

            if (this.props.store.lastRuleSelected.type.includes('string') || this.props.store.lastRuleSelected.type === 'string') {
               continueExec = Executor.executeRule(this.props.store.lastRuleSelected, this.props.store.search_text, _defaultExecForTypes_string_copy, event);
            } else {
               // If not string search object.type + _clipboard id
               // KTODO: Primero checkear que no exista este, después disparar el del string
               // Llamar solo una vez al executeRule, que el se ocupe de buscar el plugin
               continueExec = Executor.executeRule(
                  this.props.store.lastRuleSelected,
                  this.props.store.search_text,
                  `${this.props.store.lastRuleSelected.type[0]}_clipboard`,
                  event
               );

               if (!continueExec) {
                  if (event && event.preventDefault) {
                     event.preventDefault();
                  }
               }
            }

            Logger.log('continueExec', continueExec);

            if (continueExec) {
               Logger.log('emit ON_CTRL_C', '[main_view]', event);
               viewEvents.emit('ON_CTRL_C', { copyEventManual: true, shiftKey: event.shiftKey });
            }

            Logger.log('\n');

            return;
         }

         if ($action === 'SCORE_UP') {
            if (!this.props.store.lastRuleSelected || !this.props.store.lastRuleSelected.type) return;
            if (event.target && event.target.id !== 'mainSearch') {
               mainSearchFocus();
               event.preventDefault();
            }
            Executor.executeRule(this.props.store.lastRuleSelected, this.props.store.search_text, null, event, false);
            ListViewStore.storeActions.updateFilterlist();
            return;
         }

         if ($action === 'TOGGLE_FAVORITE') {
            if (event.target && event.target.id !== 'mainSearch') {
               mainSearchFocus();
               event.preventDefault();
            }
            if (this.props.store.executors === null && this.props.store.lastRuleSelected && this.props.store.lastRuleSelected.fav_permit) {
               const _item = this.props.store.lastRuleSelected;
               favManager.toggle(_item);
               _item.__changeFav = true;
               setTimeout(() => {
                  if (this.props.store.rulesPath.path == 'FAVS_PATH') {
                     ListViewStore.storeActions.updateFilterlist();
                  } else {
                     this.forceUpdate();
                  }
               }, 1);
               setTimeout(() => {
                  if (_item && _item.__changeFav) {
                     _item.__changeFav = false;
                     this.forceUpdate();
                  }
               }, 600);
            }
            return;
         }

         if ($action === 'TOGGLE_HIDDEN') {
            if (this.props.store.executors === null && this.props.store.lastRuleSelected) {
               if (event.target && event.target.id !== 'mainSearch') {
                  event.preventDefault();
               }
               toggleHidden(this.props.store.lastRuleSelected);
               this.ruleSelected(null);
               ListViewStore.storeActions.updateFilterlist(true);
            }
            return;
         }

         if ($action === 'GOTO_ROOT') {
            if (event && event.preventDefault) event.preventDefault();
            this.props.storeDispatch(ListViewStore.backRootRulesPath());
            if (this.props.store.rulesPath.path == '/') {
               Mousetrap.trigger('home');
            }
            return;
         }

         if ($action === 'CLEAR_QUERY') {
            if (event && event.preventDefault) event.preventDefault();
            this.props.storeDispatch(ListViewStore.deleteSearchBox());
            return;
         }

         if ($action === 'GO_BACK') {
            if (this.props.store.executors !== null) {
               this.props.storeDispatch(ListViewStore.removeSubExecutors());
            } else if (this.props.store.rulesPath.path !== '/') {
               this.props.storeDispatch(ListViewStore.backRulesPath());
            }
            if (event.target && event.target.id !== 'mainSearch') {
               mainSearchFocus();
            }
            return;
         }

         if ($action === 'GO_BACK_HIST') {
            if (event && event.preventDefault) event.preventDefault();
            ListViewStore.storeEvents.emit('GO_BACK_HIST');
            return;
         }

         if ($action === 'GO_FORWARD_HIST') {
            if (event && event.preventDefault) event.preventDefault();
            ListViewStore.storeEvents.emit('GO_FORWARD_HIST');
            return;
         }
      }, debounceTime);

      // BIND KEYS
      const bindKeysArr = _bindKeys;

      bindKeysArr.forEach(entry => {
         if (entry.level === 'main') {
            Mousetrap.bind(entry.keys, event => {
               if (!event) return;

               // Avoid TAB if not focus
               if (event.key === 'Tab') {
                  if (event.target && event.target.id !== 'mainSearch') {
                     mainSearchFocus();
                  }
               }

               // Avoid cttl=c if selectet (windows or webview) text
               if (event.key === 'c' && (event.ctrlKey || event.metaKey)) {
                  if (window && window.getSelection() && window.getSelection().toString() && window.getSelection().toString().length) {
                     const str = window.getSelection().toString();
                     copyToClipboard(str, false, true, false);
                     if (event.preventDefault) event.preventDefault();
                     return;
                  }

                  if (document.querySelector('webview')) {
                     document.querySelector('webview').executeJavaScript('window.getSelection().toString()', null, txt => {
                        if (txt && txt.length) {
                           copyToClipboard(String(txt), false, true, false);
                           if (event.preventDefault) event.preventDefault();
                        }
                     });
                  }
               }
               this.debounceMouseTrap(event, entry.action);
            });
         }
      });

      Mousetrap.bind(getKeyFromConfig(_bindKeys, 'SCROLL_DOWN_WEBVIEW'), e => {
         // KTODO: Unificar en una función, que esté en un file aparte
         if (this.componentViewer && this.componentViewerProps && document) {
            if (document.querySelector('webview')) {
               document.querySelector('webview').sendInputEvent({ type: 'keyDown', keyCode: 'Down' });
            } else if (document.getElementById('ruleViewerWrapp')) {
               document.getElementById('ruleViewerWrapp').scrollTop += 60;
            }
            if (e && e.preventDefault) {
               e.preventDefault();
            }
         }
      });

      Mousetrap.bind(getKeyFromConfig(_bindKeys, 'SCROLL_UP_WEBVIEW'), e => {
         if (this.componentViewer && this.componentViewerProps && document) {
            if (document.querySelector('webview')) {
               document.querySelector('webview').sendInputEvent({ type: 'keyDown', keyCode: 'Up' });
            } else if (document.getElementById('ruleViewerWrapp')) {
               document.getElementById('ruleViewerWrapp').scrollTop -= 60;
            }
            if (e && e.preventDefault) {
               e.preventDefault();
            }
         }
      });

      Mousetrap.bind(getKeyFromConfig(_bindKeys, 'SCROLL_LEFT_WEBVIEW'), e => {
         if (this.componentViewer && this.componentViewerProps && document) {
            if (document.querySelector('webview')) {
               document.querySelector('webview').sendInputEvent({ type: 'keyDown', keyCode: 'Left' });
            } else if (document.getElementById('ruleViewerWrapp')) {
               document.getElementById('ruleViewerWrapp').scrollLeft -= 60;
            }
            if (e && e.preventDefault) {
               e.preventDefault();
            }
         }
      });

      Mousetrap.bind(getKeyFromConfig(_bindKeys, 'SCROLL_RIGHT_WEBVIEW'), e => {
         if (this.componentViewer && this.componentViewerProps && document) {
            if (document.querySelector('webview')) {
               document.querySelector('webview').sendInputEvent({ type: 'keyDown', keyCode: 'Right' });
            } else if (document.getElementById('ruleViewerWrapp')) {
               document.getElementById('ruleViewerWrapp').scrollLeft += 60;
            }
            if (e && e.preventDefault) {
               e.preventDefault();
            }
         }
      });

      PackagesManager.viewIsReady();
   },
   ruleExecutor(obj, event) {
      if (!obj) {
         return;
      }

      let deleteSearchOnFire = true;

      if (obj.exectFunc && this.props.store.lastRuleSelected) {
         deleteSearchOnFire = !Executor.executeRule(this.props.store.lastRuleSelected, this.props.store.search_text, obj, event);
      } else {
         // Normal rule
         deleteSearchOnFire = !Executor.executeRule(obj, this.props.store.search_text, null, event);
      }

      if (_deleteSearchOnFire && deleteSearchOnFire !== false) {
         // OJO EL deleteSearchOnFire esta dado vuelta por que devuelve true si puede seguir ejecutando o false si ejecuto
         ListViewStore.storeActions.deleteSearchBox();
      }
   },
   toggleFav(item) {
      let togleFavAnimMaxDuration = 320;

      if (!item) {
         item = this.props.store.lastRuleSelected;
      } else {
         ListViewStore.changeLastExcutorSelected(item);
      }

      if (item && item.id && !item.exectFunc && item.fav_permit) {
         favManager.toggle(item);
         item.__changeFav = true;
         setTimeout(() => {
            if (this.props.store.rulesPath.path == 'FAVS_PATH') {
               ListViewStore.storeActions.updateFilterlist();
            } else {
               this.forceUpdate();
            }
         }, 1);
         setTimeout(() => {
            if (item && item.__changeFav) {
               item.__changeFav = false;
               this.forceUpdate();
            }
         }, togleFavAnimMaxDuration);
      }
   },
   contextMenu($rule) {
      this.ruleSelected($rule, 0);
      Executor.auxCallExecutors($rule);
   },
   async ruleSelected($rule, index) {
      if (!$rule || !$rule.id) return;

      _debounceTime_viewer = !_disableTmpAnims ? _debounceTime_viewer_init : _debounceTime_viewer_slow;

      //CHECK CACHES
      if (this.cacheLastRuleSelected && this.cacheLastRuleSelected.rule.id === $rule.id && this.cacheLastRuleSelected.index === index) {
         // (cache && no need check viewer)
         if (this.cacheLastRuleSelected.avoidCheckViewer) return;
      } else {
         // CHANGE
         if ($rule !== this.props.store.lastRuleSelected && this.props.store.executors === null) {
            this.props.storeDispatch(ListViewStore.changeLastRuleSelected($rule, index));
         }
         if (this.props.store.lastExcutorSelected !== $rule && this.props.store.executors !== null) {
            this.props.storeDispatch(ListViewStore.changeLastExcutorSelected($rule, index));
         }
      }

      let viewers = null;
      let viewer = null;

      const types = get($rule, 'type');
      if (types && types !== 'object') {
         viewers = PackagesManager.getViewersByType(types);
         if (viewers && viewers.length) viewer = viewers[0];
      }

      //HAS VIEWER
      const hasViewer = viewer && viewer.viewerComp && $rule.viewer !== false;

      const hasViewerWithEnabledBool = hasViewer && viewer.enabled === !!viewer.enabled;
      const hasViewerWithEnabledFunc = hasViewer && !hasViewerWithEnabledBool && typeof viewer.enabled === 'function';
      const hasViewerWithEnabledFuncAsync = hasViewerWithEnabledFunc && viewer.enabled.constructor.name === 'AsyncFunction';

      const hasViewerEnabled = (hasViewerWithEnabledBool && viewer.enabled) || (hasViewerWithEnabledFunc && (await viewer.enabled($rule)));

      if (hasViewerEnabled) {
         this.componentViewer = viewer.viewerComp;
         this.componentViewerBlend = viewer.useBlend;
         this.componentViewerProps = $rule;

         // delay OPEN
         if (!this.componentViewerInit) {
            this.componentViewerInit = +new Date();
            setTimeout(() => {
               this.forceUpdate();
            }, _debounceTime_viewer);
         }
      } else {
         this.componentViewer = null;
         this.componentViewerBlend = false;
         this.componentViewerProps = null;

         // delay CLOSE
         if (this.componentViewerInit) {
            setTimeout(() => {
               if (!this.componentViewer) {
                  this.componentViewerInit = null;
                  this.forceUpdate();
               }
            }, _debounceTime_viewer);
         }
      }

      this.cacheLastRuleSelected = { rule: $rule, index: index, avoidCheckViewer: !(hasViewer && hasViewerWithEnabledFunc) };
   },
   render() {
      const contextMenu = this.props.store.executors !== null;
      const dateDif = this.componentViewerInit ? new Date() - this.componentViewerInit : null;

      let items, ruleSelected, size;

      if (contextMenu) {
         items = this.props.store.executors;
         ruleSelected = this.ruleSelected;
      } else {
         items = this.props.store.filteredRules;
         ruleSelected = this.ruleSelected;
      }

      size = items && items.size ? items.size : 0;

      let classesWrapp = 'boxContentWrapperList';

      //DEBOUNCE VIEWER
      this.withViewer = this.withViewer || false;

      if (this.componentViewerInit === null) this.withViewer = false;

      if (dateDif > _debounceTime_viewer * 0.9 && this.componentViewer && this.componentViewerProps) {
         this.withViewer = true;
         classesWrapp += ' ' + 'withViewer';
      }

      this.className_ruleViwer = '';

      // ADD NO BLEND
      if (this.componentViewer) {
         if (this.componentViewerBlend === false) {
            this.className_ruleViwer += ' noBlend';
         }
      }

      return (
         <div id="boxContentWrapper">
            <div id="mainSearchWrapper">
               {!contextMenu && (
                  <MainSearch
                     path={this.props.store.rulesPath}
                     text={this.props.store.search_text}
                     result_text={this.props.store.result_text}
                     storeDispatch={this.props.storeDispatch}
                     disableKeys={_disableKeys}
                     debounceTime={_debounceTime_searchKeys}
                  />
               )}
               {contextMenu && getRuleSelected(this.props.store.lastRuleSelected)}
            </div>
            <div className={classesWrapp}>
               <span id="listadoRules">
                  <ListCelds
                     parentRuleExecutor={this.ruleExecutor}
                     parentContextMenu={this.contextMenu}
                     parenttToggleFav={this.toggleFav}
                     actual={this.props.store.statusBar_actual}
                     items={items}
                     withViewer={!!this.withViewer}
                     ruleSelected={ruleSelected}
                     storeDispatch={this.props.storeDispatch}
                  />
               </span>
               <div className={this.className_ruleViwer} id="ruleViewer">
                  {this.withViewer && (
                     <div id="ruleViewerWrapp">
                        {this.componentViewerProps && this.componentViewer && <WrappViwerCompo compo={this.componentViewer} rule={this.componentViewerProps} />}
                     </div>
                  )}
               </div>
            </div>

            <StatusBar data={this.props.store} version={this.props.version} dev={_dev} size={size} />
         </div>
      );
   },
});

function WrappViwerCompo(props) {
   const ref = useRef(null);
   const size = useComponentSize(ref);

   const wrappViwerCompoClass = classNames({
      smallViewer: size.width < _breakPointSmallViewer,
      BigViewer: size.width > _breakPointBigViewer,
   });

   return (
      <div id="ruleViewerWrappSize" ref={ref} className={wrappViwerCompoClass}>
         <props.compo rule={props.rule} />
      </div>
   );
}

`

 .d8888b.  8888888888        d8888 8888888b.   .d8888b.  888    888 888888b.    .d88888b. Y88b   d88P
d88P  Y88b 888              d88888 888   Y88b d88P  Y88b 888    888 888  "88b  d88P" "Y88b Y88b d88P
Y88b.      888             d88P888 888    888 888    888 888    888 888  .88P  888     888  Y88o88P
 "Y888b.   8888888        d88P 888 888   d88P 888        8888888888 8888888K.  888     888   Y888P
    "Y88b. 888           d88P  888 8888888P"  888        888    888 888  "Y88b 888     888   d888b
      "888 888          d88P   888 888 T88b   888    888 888    888 888    888 888     888  d88888b
Y88b  d88P 888         d8888888888 888  T88b  Y88b  d88P 888    888 888   d88P Y88b. .d88P d88P Y88b
 "Y8888P"  8888888888 d88P     888 888   T88b  "Y8888P"  888    888 8888888P"   "Y88888P" d88P   Y88b

`;

const MainSearch = CreateReactClass({
   getInitialState() {
      return {
         mainSearchOnFocus: stats.get.upTime || 1,
      };
   },
   componentDidMount() {
      this.searchField = document.getElementById('mainSearch');
      this.txtvalue = '';

      if (this.props && this.props.text) {
         this.searchField.value = this.props.text;
         this.txtvalue = this.props.text;
         this.reFocus();
      } else {
         // Get first list
         store.dispatch(ListViewStore.updateFilterlist());
      }

      // Debounce change
      this.debounceChange = debounce(() => {
         const change = ListViewStore.changeQuery(this.searchField.value || '');
         if (change && change.type) this.props.storeDispatch(change);
      }, this.props.debounceTime);

      // Disable Keys
      Mousetrap(this.searchField).bind(this.props.disableKeys, e => {
         if (e && e.preventDefault) {
            e.preventDefault();
         }
      });

      // ON SHOW
      window_and_systray.windowEvent.on('SHOW', this.reFocus);
      window_and_systray.windowEvent.on('FOCUS', this.reFocus);

      // On sore [text] change
      ListViewStore.storeEvents.on('CHANGE_SEARCH_TEXT', txt => {
         if (this.searchField && txt !== this.searchField.value) {
            this.searchField.value = txt;
            this.txtvalue = this.searchField.value;
            this.reFocus();
         }
      });

      document.querySelector('BODY').onfocus = this.reFocus;

      this.forceUpdate();
      this.reFocus();
   },
   componentWillUnmount() {
      clearInterval(this.interval);
      this.searchField = null;
   },
   onChange(event) {
      this.debounceChange();
      if (this.searchField && this.props.result_text && this.txtvalue !== this.searchField.value) {
         this.txtvalue = this.searchField.value;
         this.forceUpdate();
      }
   },
   reFocus(force = true) {
      if (_disableTmpAnims) {
         setTimeout(() => {
            if (_disableTmpAnims && _status_isFocus) _disableTmpAnims = false;
         }, _debounceTime_viewer_init);
      }

      setTimeout(this.checkisFocus);

      if (!this.searchField || !_status_isFocus || document.activeElement === this.searchField) return;
      if (force === false && document.activeElement !== document.body && document.querySelector('.__noAutofocus')) {
         return;
      }
      if (force === false && document.activeElement.classList.contains('__elNoAutofocus')) {
         return;
      }
      if (document.querySelector('.__ForceNoAutofocus')) {
         return;
      }
      if (this.searchField.focus) this.searchField.focus();
   },
   onblur(e) {
      setTimeout(() => {
         if (window && window.getSelection() && window.getSelection().toString()) {
            //ON STATIC TEXT SELECTION
            return;
         }

         // CHECK WEBVIEW SELECTED
         const $webView = document.querySelector('webview');

         if ($webView && $webView.executeJavaScript) {
            $webView.executeJavaScript('window.getSelection().toString()', null, txt => {
               if (!txt.length) {
                  this.reFocus();
               }
            });
            return;
         }
         this.reFocus(false);
      }, 160);
   },
   onfocus(e) {
      this.checkisFocus();
   },
   checkisFocus() {
      if (this.searchField && document) {
         const _focus = document.activeElement === this.searchField;
         if (this.state.mainSearchOnFocus !== _focus) this.setState({ mainSearchOnFocus: _focus });
      }
   },
   componentDidUpdate() {
      this.reFocus(false);
   },
   render() {
      const path = this.props.path;
      const icon = path.icon;

      if (this.searchField) this.txtvalue = this.searchField.value;
      if (this.txtvalue) this.txtvalue = this.txtvalue.replace(/ /g, '\u00a0');

      return (
         <div id="searchInputBox" className={_status_isFocus && this.state.mainSearchOnFocus ? 'mainSearchOnFocus' : void 0}>
            <div id="mainSearchIcon">
               <i className="fe-search" />
            </div>
            <span id="pathIndicator">
               {icon && <IconCompo icondata={icon} />}
               {path.name && <span className="pathName">{path.name}</span>}
            </span>
            <input
               spellCheck="false"
               className="mousetrap"
               id="mainSearch"
               type="text"
               placeholder="search"
               onFocus={this.onfocus}
               onBlur={this.onblur}
               onInput={this.onChange}
            />
            {this.props.result_text && (
               /*when have result, ej: calc*/
               <React.Fragment>
                  <span id="mainSearchCopy">{this.txtvalue}</span>
                  <span id="searchResult">{this.props.result_text}</span>
               </React.Fragment>
            )}
         </div>
      );
   },
});

`

888      8888888 .d8888b. 88888888888 .d8888b.  8888888888 888      8888888b.   .d8888b.
888        888  d88P  Y88b    888    d88P  Y88b 888        888      888  "Y88b d88P  Y88b
888        888  Y88b.         888    888    888 888        888      888    888 Y88b.
888        888   "Y888b.      888    888        8888888    888      888    888  "Y888b.
888        888      "Y88b.    888    888        888        888      888    888     "Y88b.
888        888        "888    888    888    888 888        888      888    888       "888
888        888  Y88b  d88P    888    Y88b  d88P 888        888      888  .d88P Y88b  d88P
88888888 8888888 "Y8888P"     888     "Y8888P"  8888888888 88888888 8888888P"   "Y8888P"

`;

const ListCelds = CreateReactClass({
   getInitialState() {
      return {
         actual: 0,
         actualScrollLine: 0,
         size_items_visible: initStatus.maxItemsVisible || _def_maxItemsVisible,
         items: null,
         itemsSlice: [],
         _lastactual: 0,
      };
   },
   componentDidMount() {
      // KEYS
      Mousetrap.bind(['down'], () => this.next(1));
      Mousetrap.bind(['up'], () => this.prev(1));
      Mousetrap.bind(['pagedown'], () => this.next(this.state.size_items_visible - 1));
      Mousetrap.bind(['pageup'], () => this.prev(this.state.size_items_visible - 1));
      Mousetrap.bind(['end'], () => this.next(0));
      Mousetrap.bind(['home'], () => this.prev(0));

      // MouseWhell
      setTimeout(() => {
         document.getElementById('ruleListado') && document.getElementById('ruleListado').addEventListener('mousewheel', this.mouseWheelHandler);
      });

      const throttleTime_moveList = _throttleTime_moveList;

      const validate_and_render = () => {
         this.validate();
         this.changeLastHighlighted();
      };

      if (throttleTime_moveList && throttleTime_moveList > 0) {
         this.throttle_validate_and_render = throttle(validate_and_render, throttleTime_moveList);
      } else {
         this.throttle_validate_and_render = validate_and_render;
      }

      themeManager.themeEvents.on('CHANGE_THEME', this.makeCacheSizes);

      window_and_systray.windowEvent.on('RESIZE', this.mainWinDidResized);

      status.on('change', objPath => {
         if (has(objPath, 'maximized')) {
            _status_isMaximized = get(objPath, 'maximized');

            const body = document.querySelector('BODY');

            if (body) {
               if (_status_isMaximized) {
                  body.classList.add('maximized');
               } else {
                  body.classList.remove('maximized');
               }
            }

            this.mainWinDidResized();
         }
         if (!get(objPath, 'maximized') && has(objPath, 'maxItemsVisible') && get(objPath, 'maxItemsVisible')) {
            this.state.size_items_visible = get(objPath, 'maxItemsVisible');
            this.remakeList(true);
         }
      });

      this.scrollOut = () => {
         if (this.scroller && this.scroller.classList) {
            this.scroller.classList.remove('no-animate-disappear');
            this.scroller.classList.add('animate-disappear');
         }
      };

      this.scrollOutThrottle = debounce(this.scrollOut, _debounceTime_searchKeys * 4);

      this.timerMakeCacheSizes = setInterval(this.makeCacheSizes, 32);

      this.timerCheckNoEmpty = setInterval(() => {
         if (!this.state) return;
         if (this.state.items && this.state.items.size >= 0) {
            if (this.timerCheckNoEmpty) clearInterval(this.timerCheckNoEmpty);
            this.timerCheckNoEmpty = null;
         } else {
            ruleManager.forceRefreshRules();
         }
      }, 32);

      this.deleted = false;
   },
   remakeList(forceupdate = false) {
      this.validate();
      this.changeLastHighlighted(forceupdate);
      this.forceUpdate();
   },
   next(val = 1, forceVal = -1) {
      if (this.deleted) return;

      if (forceVal === -1) {
         if (val === Infinity) {
            this.state.actual = 0;
         } else if (val === 0) {
            this.state.actual = this.state.items.size || 0;
         } else {
            this.state.actual = (this.state.actual || 0) + Number(val || 1);
         }
      } else {
         this.state.actual = forceVal;
      }

      this.throttle_validate_and_render();
   },
   prev(val = 1) {
      if (this.deleted) return;
      if (val === 0) {
         val = Infinity;
      }
      this.next(-val);
   },
   mouseWheelHandler(e) {
      if (this.deleted) return;

      if (!e) return;

      if (e.deltaY > 0) {
         this.next(1);
      }
      if (e.deltaY < 0) {
         this.prev(1);
      }
   },
   validate() {
      if (this.deleted) return;

      this.state.actual = Number(this.state.actual || 0);

      if (this.state.actual < 0) {
         this.state.actual = 0;
      }

      if (this.state && this.state.items && this.state.items.size && this.state.actual > this.state.items.size - 1) {
         this.state.actual = this.state.items.size - 1;
      }
   },
   async UNSAFE_componentWillReceiveProps(nextProps, nextState) {
      if (this.deleted || nextProps.items === this.props.items) return;

      if (!nextProps.items.equals(this.props.items)) {
         this.state.actual = nextProps.actual || 0;
         if (this.state.actual > nextProps.items.size) this.state.actual = 0;
         this.state.actualScrollLine = 0;
         this.state._lastactual = 0;
         this.state.items = nextProps.items;
         this.state.itemsSlice = [];
      }

      this.changeLastHighlighted();
   },
   async componentDidUpdate(nextProps, nextState) {
      if (this.deleted) return;

      //LAZY ICONS
      let vis = this.state.size_items_visible;
      this._lazyIcons = false;

      if (_lazyIconsEnabled) {
         if (this._lastFrame == undefined) {
            this._lastFrame = new Date();
            this._fastFrameCount = 0;
         } else {
            new Date() - this._lastFrame < 80 && this.state.items.size > vis * 4 ? this._fastFrameCount++ : (this._fastFrameCount = 0);
            this._lastFrame = new Date();
            this._lazyIcons = this._fastFrameCount >= vis * 1.5;
         }
      }

      // Center Window
      if (!didCenter && !initStatus.win_user_X && !initStatus.win_user_Y && this.ruleHeight && this.state && this.state.items && this.state.items.size > 0) {
         didCenter = true;
         await $timeout(64);
         window_and_systray.centerWin(true);
      }

      this.manageScrollBarPos();
   },
   onClickRule(item, param) {
      if (this.deleted || !this.state.items || !param || !param.target) return;

      const itemEl = param.target.closest('.ruleListCelda');

      if (!itemEl) return;

      if (itemEl.classList.contains('highLight')) {
         // CHECK DOUBLE CLICK
         if (this.clickLastTime) {
            const dif = new Date() - this.clickLastTime;
            if (dif < _doubleClickTime) {
               this.props.parentRuleExecutor(item);
            }
         }
      } else {
         const index = this.state.items.valueSeq().findIndex(obj => obj.id === item.id);
         this.next(null, index);
      }
      this.clickLastTime = new Date();
   },
   getRangeItemsRender() {
      if (this.deleted) return;

      if ((this.state._lastactual || 0) >= (this.state.actual || 0)) {
         //UP
         this.state.actualScrollLine = 0;
      } else {
         //DOWN
         this.state.actualScrollLine = this.state.actual;
         if (this.state.actualScrollLine > this.state.size_items_visible - 1) {
            this.state.actualScrollLine = this.state.size_items_visible - 1;
         }
      }

      this.state._lastactual = this.state.actual;
      const actualOffset = this.state.actual - this.state.actualScrollLine;
      return { first: actualOffset, last: actualOffset + this.state.size_items_visible };
   },
   changeLastHighlighted(forceupdate = false) {
      if (this.deleted || !this.props.ruleSelected || !(this.state && this.state.items)) return;

      let index = -1;
      let actual = null;

      if (this.state.itemsSlice && this.state.itemsSlice.length > 0) {
         actual = this.state.items.valueSeq().get(this.state.actual);
         if (actual) index = this.state.itemsSlice.findIndex(obj => obj.id === actual.id);
      }

      if (index !== -1 && !forceupdate) {
         this.state.actualScrollLine = index;
         this.state._lastactual = this.state.actual;
      } else {
         const { first, last } = this.getRangeItemsRender();
         this.state.itemsSlice = this.state.items
            .slice(first, last)
            .toOrderedSet()
            .toArray();
         if (!actual) {
            actual = this.state.itemsSlice[this.state.actualScrollLine || 0];
         }
      }

      this.props.ruleSelected(actual, this.state.actual);
   },
   makeCacheSizes() {
      if (this.deleted) return;

      if (this.ruleHeight) {
         //DELAY REFRESH
         setTimeout(() => {
            this.ruleHeight = 0;
            this.makeCacheSizes();
         }, 64);
         return;
      }

      // KTODO: mover a módulo aux
      if (this.state && this.state.items && document.getElementById('ruleListado')) {
         this.scroller = document.getElementById('scrollTrackElid');
         this.ruleListado = document.getElementById('ruleListado');
         this.statusBar = document.getElementById('status-bar');
         this.mainSearchWrapper = document.getElementById('mainSearchWrapper');
         this.content = document.getElementById('content');

         if (this.ruleListado && this.ruleListado.firstChild) {
            this.ruleHeight = Math.round(this.ruleListado.firstChild.offsetHeight);
         }

         if (this.statusBar) this.statusBarHeight = Math.round(this.statusBar.offsetHeight);

         if (this.mainSearchWrapper) this.mainSearchWrapperHeight = Math.round(this.mainSearchWrapper.offsetHeight);

         if (this.timerMakeCacheSizes) {
            clearInterval(this.timerMakeCacheSizes);
            this.timerMakeCacheSizes = null;
            viewEvents.emit('APP_IS_USABLE');
            sharedData.app_window_and_systray.windowEvent.emit('VIEW_IS_USABLE');
            Logger.logTime('[main_view] APP_IS_USABLE');
         }
      }
   },
   manageScrollBarPos() {
      if (this.deleted) return;
      if (!this.ruleHeight) return;

      if (!this.ruleHeight || !this.statusBarHeight || !this.mainSearchWrapperHeight) {
         this.makeCacheSizes();
      }

      let size = 0;
      let changeSize = false;

      if (this.state && this.state.items && this.state.items.size) {
         size = this.state.items.size;
      }

      let min = Math.min(this.state.size_items_visible, size);

      // SIZE IS HAS VIEWER
      if (this.hasViewer) min = this.state.size_items_visible;

      // NEW HEIGHT
      this.newHeight = min * Math.round(this.ruleHeight);

      if (this.lastHeight !== this.newHeight) {
         this.lastHeight = this.newHeight;
         changeSize = true;
      }

      if (size === 0) {
         this.newHeight = 0;
         this.lastHeight = 0;
         changeSize = true;
      }

      // WindowSize
      if (changeSize) {
         this.newHeight = this.newHeight || 0;

         const deltaObj = Math.round(this.statusBarHeight + this.mainSearchWrapperHeight);
         const $validHeight = this.getValidWinSize(this.newHeight + deltaObj);
         const $maxValidHeight = this.getValidWinSize(this.state.size_items_visible * Math.round(this.ruleHeight) + deltaObj);

         this.ruleListado.style.height = `${$validHeight.height - deltaObj}px`;

         if (_status_isMaximized) return;

         if ($validHeight && !_avoidResizeHeigth) {
            window_and_systray.setWindowSize(null, $validHeight.height);
         } else {
            window_and_systray.setWindowSize(null, $maxValidHeight.height);
         }

         if ($maxValidHeight) {
            window_and_systray.setMaxSize($maxValidHeight.height);
         }
      }

      // this.Scroller
      if (!this.scroller) return;

      if (size <= this.state.size_items_visible && this.scroller.classList) {
         this.scroller.classList.add('tbhidden');
         return;
      }

      this.scroller.classList.remove('tbhidden');
      this.relScroll = this.state.actual / (size - 1);

      if (!this.scrollerOffsetHeight) {
         this.scrollerOffsetHeight = this.scroller.offsetHeight;
      }

      if (this.newHeight && this.statusBarHeight) {
         this.scrollHeight = Math.round(this.newHeight - 4 * 2 - this.scrollerOffsetHeight);
      }

      if (this.scrollHeight) {
         let top = this.scrollHeight * this.relScroll || 0;
         if (top === this.topLast) return;

         this.topLast = top;

         top = Math.round(top);
         this.scroller.style.transform = `translateY(${top}px` + ')';

         if (this.scroller.classList) {
            this.scroller.classList.remove('animate-disappear');
            this.scroller.classList.add('no-animate-disappear');
         }

         if (this.scrollOutThrottle) this.scrollOutThrottle();
      }
   },
   getValidWinSize($height, forceOne = false) {
      if (this.deleted) return;
      if (!$height || !this.ruleHeight || this.ruleHeight < 1 || !this.statusBarHeight || !this.mainSearchWrapperHeight) {
         return null;
      }

      this.ruleHeight = Math.round(this.ruleHeight);
      const deltaObj = Math.round(this.statusBarHeight + this.mainSearchWrapperHeight);
      const rulesH = $height - deltaObj;

      let items = Math.round(rulesH / this.ruleHeight);
      if (items < 0) forceOne ? (items = 0) : (items = 1);
      if (items > 25) items = 25;

      let height = items * this.ruleHeight + deltaObj;

      return { items, height };
   },
   async mainWinDidResized() {
      if (this.deleted || !this.state.size_items_visible || !document.documentElement) return;

      let _height = document.documentElement.clientHeight;
      let $validHeight = this.getValidWinSize(_height, true);

      // USER CHANGE WINDOW HEIGHT
      if ($validHeight && (this.state.size_items_visible !== $validHeight.items || Math.abs(_height - $validHeight.height) > 0)) {
         if (!$validHeight.items || $validHeight.items < 1) $validHeight.items = 1;
         let maxItems = $validHeight.items;
         this.state.size_items_visible = maxItems;
         this.remakeList();
         $timeout(0);
         if (status) status.set({ maxItemsVisible: maxItems });
      }
   },
   componentWillUnmount() {
      this.deleted = true;
      if (document.getElementById('ruleListado')) {
         try {
            document.getElementById('ruleListado').removeEventListener('mousewheel', this.mouseWheelHandler);
         } catch (e) {}
      }
   },
   render() {
      return (
         <div className={`ruleList ${this._lazyIcons ? 'lazyLoadIcons' : ''}`} id="ruleListado">
            {this.state &&
               this.state.itemsSlice &&
               this.state.itemsSlice.length > 0 &&
               this.state.itemsSlice.map((item, i) => {
                  // rule Classes
                  let classesRule = 'ruleListCelda';

                  if (i === this.state.actualScrollLine && !item.isLoading && !item._noSelect) {
                     const type = get(item, 'type[0]');
                     let viewer = null;
                     if (type && type !== 'object') {
                        viewer = PackagesManager.getDefaultViewer(type);
                     }

                     this.hasViewer = this.props.withViewer;
                     classesRule += ' ' + 'highLight';
                  }

                  if (!item.description) classesRule += ' ' + 'noDesc';

                  const clickContext = (item, e) => {
                     this.props.parentContextMenu(item);
                     if (e) e.stopPropagation();
                  };

                  const clickToggleFav = (item, e) => {
                     this.props.parenttToggleFav(item);
                     if (e) e.stopPropagation();
                  };

                  return (
                     <div className="ruleListCeldaWrapp" key={item.id}>
                        <div
                           key={item.id}
                           index={i}
                           className={classesRule}
                           onClick={e => this.onClickRule(item, e)}
                           data-itemselected={i === this.state.actualScrollLine}
                           data-id={item.id}
                        >
                           <IconCompo icondata={item.icon} />
                           {getRule(item, clickContext, clickToggleFav)}
                        </div>
                     </div>
                  );
               })}
            <div className="scrollTrackEl" id="scrollTrackElid" />
         </div>
      );
   },
});

`

8888888 .d8888b.   .d88888b.  888b    888
  888  d88P  Y88b d88P" "Y88b 8888b   888
  888  888    888 888     888 88888b  888
  888  888        888     888 888Y88b 888
  888  888        888     888 888 Y88b888
  888  888    888 888     888 888  Y88888
  888  Y88b  d88P Y88b. .d88P 888   Y8888
8888888 "Y8888P"   "Y88888P"  888    Y888

`;

const IconCompo = CreateReactClass({
   getInitialState() {
      let iconData = this.props.icondata;
      this.resolvedDelayed = false;
      if (_icons && iconData && iconData.delayed) {
         const icoCached = getIconDelayedCache(this.props.icondata.dataDelayedFile);
         if (icoCached) {
            this.resolvedDelayed = true;
            return { iconData: icoCached, inLoad: false };
         }
      }
      return { iconData: iconData, inLoad: false };
   },
   componentDidMount() {
      this.mounted = true;
      this.checkDelay();
   },
   UNSAFE_componentWillReceiveProps(nextProps) {
      if (!this.mounted) return;
      if (nextProps.icondata && !equal(nextProps.icondata, this.state.iconData)) {
         if (nextProps.icondata.delayed) this.resolvedDelayed = false;
         this.setState({ iconData: nextProps.icondata, inLoad: false }, this.checkDelay);
      }
   },
   __shouldComponentUpdate(nextProps, nextState) {
      if (!this.mounted) false;
      if (nextState.inLoad !== this.state.inLoad) {
         return true;
      }
      if (equal(nextState.iconData, this.state.iconData)) {
         return false;
      }
      return true;
   },
   checkDelay() {
      if (!this.mounted || this.resolvedDelayed) return;

      let $iconData = this.state.icondata || this.props.icondata;

      if (!(_icons && $iconData && $iconData.delayed)) return;

      const icoCached = getIconDelayedCache($iconData.dataDelayedFile);
      if (icoCached) {
         this.resolvedDelayed = true;
         this.setState({ iconData: icoCached, inLoad: false });
      } else {
         this.setState({ inLoad: true });
         getIconDelayed($iconData).then(_iconData => {
            this.resolvedDelayed = true;
            if (this.mounted && _iconData) {
               this.setState({ iconData: _iconData, inLoad: false });
            }
         });
      }
   },
   componentWillUnmount() {
      this.mounted = false;
   },
   render() {
      if (!_icons) {
         return <span className={'__no_ico'} />;
      }

      const icon = this.state.iconData || this.props.icondata;

      if (!icon) {
         if (true && _dev) Logger.log('[render icon] fail, no data', this.state);
         return <i className={'main_ico __fail_ico'} />;
      }

      let classNameIco = 'main_ico';

      let styleColor,
         _style = null;
      if (icon.type === 'iconFont') {
         if (icon.styleColor && icon.styleColor.length > 2 && icon.styleColor.length < 10) styleColor = icon.styleColor;
         if (styleColor && styleColor.indexOf('#') !== 0) styleColor = `#${styleColor}`;

         if (!styleColor) {
            if (icon.iconClassColor) {
               classNameIco += ` ${icon.iconClassColor}`;
            } else {
               classNameIco += ' ' + 'colorDefault';
            }
         } else {
            _style = { color: styleColor };
         }
      }

      if (icon.iconClass) classNameIco += ` ${icon.iconClass}`;
      if (!icon.iconData && icon.delayed) classNameIco += ' ' + 'delayed';

      // if (icon.iconDataDelayed && typeof icon.iconDataDelayed === 'string') icon.iconData = 'file://' + icon.iconDataDelayed.replace(/\\/g, '/');
      if (icon.iconDataDelayed && typeof icon.iconDataDelayed === 'string') icon.iconData = icon.iconDataDelayed.replace(/\\/g, '/');

      if (icon.type === 'iconChar') classNameIco += ' text iconChar';

      return (
         <React.Fragment>
            {icon.type === 'iconFont' && <i className={classNameIco} style={_style} />}

            {icon.type === 'iconChar' && icon.iconData && (
               <i className={classNameIco}>
                  <span className="wrappicon"> {icon.iconData} </span>
               </i>
            )}

            {icon.type === 'iconSvg' && icon.iconData && (
               <i className={classNameIco}>{<span className="wrappicon" dangerouslySetInnerHTML={sanitizeSVGReact(icon.iconData)} />}</i>
            )}

            {icon.type === 'iconSrc' && !icon.iconData && (!this.state.inLoad || !this.mounted) && <i className={'main_ico __null_ico'} />}
            {icon.type === 'iconSrc' && !icon.iconData && this.mounted && this.state.inLoad && <i className={'main_ico mdi-loading text iconRuleInLoad'} />}

            {icon.type === 'iconSrc' && icon.iconData && icon.iconData == NOICON && <i className={'main_ico mdi-circle-double text'} />}

            {icon.type === 'iconSrc' && icon.iconData && icon.iconData !== NOICON && (
               <i className={classNameIco}>
                  <span className="wrappicon">
                     <img src={icon.iconData} />
                  </span>
               </i>
            )}
         </React.Fragment>
      );
   },
});

`
 .d8888b.  8888888888 88888888888      8888888b.  888     888 888      8888888888
d88P  Y88b 888            888          888   Y88b 888     888 888      888
888    888 888            888          888    888 888     888 888      888
888        8888888        888          888   d88P 888     888 888      8888888
888  88888 888            888          8888888P"  888     888 888      888
888    888 888            888          888 T88b   888     888 888      888
Y88b  d88P 888            888          888  T88b  Y88b. .d88P 888      888
 "Y8888P88 8888888888     888          888   T88b  "Y88888P"  88888888 8888888888

`;

const getRule = (item, clickContext, clickToggleFav) => {
   if (!item || !item.id) return <span />;

   let ruleIconContext = false;

   if (!item._internalAct && item.type.includes('object') && !item.type.includes('null')) {
      ruleIconContext = true;
   }

   item.favorite = favManager.ifFav(item);

   let iconFav = 'w-icon-star-off';
   if (item.favorite || (item.path && item.path.includes('FAVS_'))) {
      iconFav = 'w-icon-star-on painted';
   }

   let infoClassName = 'ruleInfo';

   if (_status_showRuleScore) infoClassName += ' showRuleScore';

   let rootClass = 'ruleNameAndDesc';
   // if (item.isNew) rootClass += ' newRule';

   return (
      <React.Fragment>
         {!item.component && (
            <span className={rootClass}>
               <span className="ruleName">{item.title}</span>
               <span className="ruleDescription">{item.description}</span>
               {(item._score_p || item._score_p == '0') && (
                  <span className={infoClassName}>
                     <span className="points">{item._points_p}</span>/<span className="pointsK">{item._points_current_key_p}</span>/{item._score_p}
                  </span>
               )}
            </span>
         )}

         {item.component && (
            <span className={rootClass}>
               <span className="ruleName dynamicString" data-id={item.id}>
                  {<item.component rule={item} />}
               </span>
               <span className="ruleDescription">{item.description}</span>
               {(item._score_p || item._score_p == '0') && (
                  <span className={infoClassName}>
                     <span className="points">{item._points_p}</span>/<span className="pointsK">{item._points_current_key_p}</span>/{item._score_p}
                  </span>
               )}
            </span>
         )}

         {ruleIconContext && !item.exectFunc && _icons && clickContext && (
            <span className="ruleIconContext smallContext small_ico" title={labelToolTipContext} onClick={e => clickContext(item, e)}>
               <i className="mdi-dots-vertical" />
            </span>
         )}

         {ruleIconContext && !item.exectFunc && _icons && item.fav_permit && clickToggleFav && (
            <span className="ruleIconContext smallContext small_ico" title={labelToolTipFav} onClick={e => clickToggleFav(item, e)}>
               <FavWrapp change={item.__changeFav} favorite={item.favorite}>
                  <i className={iconFav} />
               </FavWrapp>
            </span>
         )}

         {item.isNew && (
            <Tooltip {...TOOLTIP_DEF_PROPS} title={'Remove New Status'} enterDelay={240} open={null} placement="top">
               <div className={'ruleIconContext newRule'} onClick={e => newsManager.resetItemById(item)}>
                  new
               </div>
            </Tooltip>
         )}
      </React.Fragment>
   );
};

const FavWrapp = props => {
   return (
      <div className={props.change ? (props.favorite ? 'circlePopOpen-Max' : 'circlePopOpen-Max') : ''}>
         <div className={props.change ? (props.favorite ? 'iconFavAnimIn' : 'iconFavAnimOut') : ''} style={{ marginTop: -1 }}>
            {props.children}
         </div>
      </div>
   );
};

`

8888888b.  888     888 888      8888888888 .d8888b.  8888888888 888      8888888888 .d8888b.
888   Y88b 888     888 888      888       d88P  Y88b 888        888      888       d88P  Y88b
888    888 888     888 888      888       Y88b.      888        888      888       888    888
888   d88P 888     888 888      8888888    "Y888b.   8888888    888      8888888   888
8888888P"  888     888 888      888           "Y88b. 888        888      888       888
888 T88b   888     888 888      888             "888 888        888      888       888    888
888  T88b  Y88b. .d88P 888      888       Y88b  d88P 888        888      888       Y88b  d88P
888   T88b  "Y88888P"  88888888 8888888888 "Y8888P"  8888888888 88888888 8888888888 "Y8888P"

`;

const getRuleSelected = item => {
   if (!item) return;

   // this.ruleselected = document.getElementById('ruleselected');
   // if (this.ruleselected && this.ruleselected.focus) {
   //    this.ruleselected.focus();
   // }

   return (
      <span id="ruleContext">
         <input spellCheck="false" className="mousetrap mousetrapCapture" id="ruleselected" />
         <IconCompo icondata={item.icon} />
         <span className="ruleNameAndDesc">
            <span className="contextTitle">{item.title}</span>
            <span className="ruleDescription">{item.description}</span>
         </span>
      </span>
   );
};

// STATUSBAR / KTODO COMPO APARTE
const elevatedString = Config.get('here_are_dragons.report.isElevated') ? '^' : '';
const getTimeStartStr = () => {
   const timeStartStatStr = `startUpTime: ${stats.get.timeToStart || 0} s`;
   const upTime = `UpTime: ${ms(Number(Math.ceil(stats.get.upTime || 1) || 0) * 1000)}`;
   return `${timeStartStatStr} - ${upTime}`;
};

`
 .d8888b. 88888888888     d8888 88888888888 888     888  .d8888b.  888888b.         d8888 8888888b.
d88P  Y88b    888        d88888     888     888     888 d88P  Y88b 888  "88b       d88888 888   Y88b
Y88b.         888       d88P888     888     888     888 Y88b.      888  .88P      d88P888 888    888
 "Y888b.      888      d88P 888     888     888     888  "Y888b.   8888888K.     d88P 888 888   d88P
    "Y88b.    888     d88P  888     888     888     888     "Y88b. 888  "Y88b   d88P  888 8888888P"
      "888    888    d88P   888     888     888     888       "888 888    888  d88P   888 888 T88b
Y88b  d88P    888   d8888888888     888     Y88b. .d88P Y88b  d88P 888   d88P d8888888888 888  T88b
 "Y8888P"     888  d88P     888     888      "Y88888P"   "Y8888P"  8888888P" d88P     888 888   T88b

`;

function StatusBar(params) {
   const [_title, _setTitle] = useState('');
   return (
      <div id="status-bar">
         <span>
            {_status_alwaysOnTop && (
               <div className={'circlePopOpen  __alwaysontop-circlePopOpen'}>
                  <Tooltip
                     {...TOOLTIP_DEF_PROPS}
                     title={'Always on top / ' + `Toggle [ ${getKeyFromConfig(_bindKeys, 'TOGGLE_ALWAYS_ON_TOP').toUpperCase()} ]`}
                     open={null}
                  >
                     <i className={'icons8-pin-3 status-bar-icon alwaysontop-icon'} onClick={() => status.switch('always_on_top')} />
                  </Tooltip>
               </div>
            )}
            {params.size ? params.data.statusBar_actual + 1 || 0 : 0}/<span id="levelSize">{params.size}</span>
            {_canListenKeyboard && (
               <React.Fragment>
                  {_status_ioHook ? (
                     <div className={'circlePopOpen  status-bar-icon-wrapp'}>
                        <Tooltip {...TOOLTIP_DEF_PROPS} title={'Listener Keys ON | ' + ` ${Config.get('mainShortcut_StopKeyListener').toLowerCase()} `}>
                           <i className={'mdl2-keyboard-classic status-bar-icon'} onClick={() => status.switch('ioHook')} />
                        </Tooltip>
                     </div>
                  ) : (
                     <div className={'circlePopOpenAlt  status-bar-icon-wrapp'}>
                        <Tooltip {...TOOLTIP_DEF_PROPS} title={'Listener Keys OFF | ' + ` ${Config.get('mainShortcut_StartKeyListener').toLowerCase()} `}>
                           <i className={'mdl2-keyboard-classic status-bar-icon iohook-disabled'} onClick={() => status.switch('ioHook')} />
                        </Tooltip>
                     </div>
                  )}
               </React.Fragment>
            )}
            {_canChangeThemeDarkLight && themeManager && (
               <React.Fragment>
                  {themeManager.isDarkTheme() ? (
                     <div className={'status-bar-icon-wrapp'}>
                        <Tooltip {...TOOLTIP_DEF_PROPS} title={'switch to light theme | ' + ` ${getKeyFromConfig(_bindKeys, 'TOGGLE_COLOR_MODE')} `}>
                           <i
                              className={'mdi-white-balance-sunny status-bar-icon'}
                              onClick={() => {
                                 themeManager.setThemeLight();
                              }}
                           />
                        </Tooltip>
                     </div>
                  ) : (
                     <div className={'status-bar-icon-wrapp'}>
                        <Tooltip {...TOOLTIP_DEF_PROPS} title={'switch to dark theme | ' + ` ${getKeyFromConfig(_bindKeys, 'TOGGLE_COLOR_MODE')} `}>
                           <i
                              className={'fas-moon status-bar-icon'}
                              onClick={() => {
                                 themeManager.setThemeDark();
                              }}
                           />
                        </Tooltip>
                     </div>
                  )}
               </React.Fragment>
            )}
            <span id="totalTime">{` time: ${params.data.statusBar_totalTime}ms.`}</span>
            <Tooltip {...TOOLTIP_DEF_PROPS} title={_title} className={'_refreshStats'} id="tooltipUptime" onOpen={() => _setTitle(getTimeStartStr())}>
               <span className="infoDer">
                  {elevatedString} ver: {params.version} . {!params.dev ? 'P' : 'D'}
               </span>
            </Tooltip>
         </span>
      </div>
   );
}

module.exports.init = init;
