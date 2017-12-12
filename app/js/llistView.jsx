'use strict';

const { webFrame, clipboard, remote } = require('electron');
const _ = require('lodash');
const Moment = require('moment');
const Mousetrap = require('mousetrap');
const Inferno = require('inferno');
const linkEvent = require('inferno').linkEvent;
const Component = require('inferno-component');
const InfCreateClass = require('inferno-create-class');

const Executor = require('../js/executor.js');
const ListViewStore = require('../js/listViewStore.js');
const PackagesManager = require('../js/packagesManager.js');
const Logger = require('../js/logger.js');
const driveManager = require('../js/aux_driveManager.js');
const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');
const favManager = require('../js/favManager.js');
const themeManager = require('../js/themeManager.js');
const lastRulesManager = require('../js/lastRulesManager.js');
const resetScore = require('../js/historyManager.js').remove;
const togleHidden = require('../js/hiddenRulesManager.js').toggle;
const { bindKet2actualOs, getKeyFromConfig } = require('../auxfs.js');

const store = ListViewStore.store;
const window_and_systray = sharedData.app_window_and_systray;

let labelToolTipContext = '';
let labelToolTipFav = '';

let _dev = !!Config.get('dev');
let _animations = !!Config.get('animations') || false;
let _gotoRootAfterAction = !!Config.get('gotoRootAfterAction') || false;
let _toolTips = !!Config.get('toolTips');
let _icons = !!Config.get('icons');
let _showRuleScore = !!Config.get('here_are_dragons.showRuleScore');
let _maxItemsVisible = Config.get('maxItemsVisible') || 8;
let _def_maxItemsVisible = Config.getDeafult('maxItemsVisible') || 8;
let _def_width = Config.getDeafult('width') || 960;

let _doubleClickTime = Config.get('here_are_dragons.doubleClickTime') || 500;
let _disableKeys = Config.get('here_are_dragons.disableKeysOnSearchBox') || [];
let _debounceTime_searchKeys = Config.get('here_are_dragons.debounceTime_searchKeys') || 0;
let _version = Config.get('here_are_dragons.report.version') || '';
let _debounceTime_actionsKeys = Config.get('here_are_dragons.debounceTime_actionsKeys') || 0;
let _bindKeys = Config.get('here_are_dragons.bindKeys') || [];
let _throttleTime_moveList = Config.get('here_are_dragons.throttleTime_moveList') || 0;
let _showRuleScoreDebug = Config.get('here_are_dragons.debug.showRuleScore');
let _defaultExecForTypes_string_copy = Config.get('here_are_dragons.defaultExecForTypes.string_copy');
let _deleteSearchOnFire = Config.get('here_are_dragons.deleteSearchOnFire');

function init() {
    if (!document) {
        Logger.error('no document element');
        return;
    }

    themeManager.init(document);

    if (_dev) {
        window.clearCaches = clearCaches;
    }

    sharedData.idleTime.onIdleTimeInterval(() => {
        clearCaches();
    }, 15 * 60 * 1000);

    const render = () => Inferno.render(<ReactContent store={store.getState()} storeDispatch={store.dispatch} />, document.getElementById('contentReact'));

    store.subscribe(() => setTimeout(render));

    setTimeout(render);

    if (_dev) {
        window.store = store;
    }

    Logger.info(
        '      > TOTAL INIT TIME:',
        '[' + Moment(new Date()).format('HH:mm:ss.SSS') + ']',
        Moment(new Date()) - Moment(Config.get('here_are_dragons.report.backgroundStartDate') || 0)
    );

    themeManager.removeLoader();
}

//NO ZOOM
if (webFrame && webFrame.setZoomLevelLimits) webFrame.setZoomLevelLimits(1, 1);

function clearCaches() {
    if (remote && remote.getCurrentWindow) remote.getCurrentWindow().webContents.session.clearCache(clear => {});
    if (webFrame && webFrame.clearCache) webFrame.clearCache();
    try {
        if (gc) gc();
    } catch (e) {}
    if (_dev) {
        Logger.log('clear caches');
    }
}

//MAIN REACT COMPONENT
class ReactContent extends Component {
    render() {
        let version = _version;

        let classes = [_dev ? 'dev_version' : 'prod_version'];
        if (this.props.store && this.props.store.rulesPath && this.props.store.rulesPath.path === '/') classes.push('level_root');

        classes = classes.join(' ');

        return (
            <div id="content" className={classes}>
                <div className="dragWindow" />
                <div id="inner-content">
                    <FilterList store={this.props.store} storeDispatch={this.props.storeDispatch} version={version} />
                </div>
            </div>
        );
    }
}

//SEARCH + LIST + ETC
let FilterList = InfCreateClass({
    componentDidMount: function() {
        let debounceTime = _debounceTime_actionsKeys;

        //If settings chage > update view
        if (Config.getChangeSettingsEvent) {
            Config.getChangeSettingsEvent().on('changeSettings', (path, dif) => {
                _dev = !!Config.get('dev');
                _animations = !!Config.get('animations') || false;
                _gotoRootAfterAction = !!Config.get('gotoRootAfterAction') || false;
                _toolTips = !!Config.get('toolTips');
                _icons = !!Config.get('icons');
                _showRuleScore = !!Config.get('here_are_dragons.showRuleScore');
                _maxItemsVisible = Config.get('maxItemsVisible') || 8;
                _def_maxItemsVisible = Config.getDeafult('maxItemsVisible') || 8;
                _def_width = Config.getDeafult('width') || 960;
                setTimeout(this.forceUpdate, 1);
            });
        }

        labelToolTipContext = '';
        labelToolTipFav = '';
        if (_toolTips) {
            labelToolTipContext = 'Options [ ' + getKeyFromConfig(_bindKeys, 'CONTEXT_MENU') + ' ]';
            labelToolTipFav = 'Toggle Fav [ ' + getKeyFromConfig(_bindKeys, 'TOGGLE_FAVORITE') + ' ]';
        }

        //ON HIDE
        window_and_systray.windowEvent.on('BEFORE_HIDE', () => {
            if (_gotoRootAfterAction && this.props.storeDispatch && window_and_systray) {
                this.props.storeDispatch(ListViewStore.backRootRulesPath());
            }
        });

        //ON SHOW
        window_and_systray.windowEvent.on('SHOW', () => {
            if (false && _gotoRootAfterAction && this.props.storeDispatch && this.props.store && window_and_systray) {
                this.props.storeDispatch(ListViewStore.backRootRulesPath());
            }
        });

        //ON FAVS
        window_and_systray.windowEvent.on('GO_TO_FAVS', () => {
            if (PackagesManager.getPluginByName('internal_pack_favorites')) {
                this.props.storeDispatch(ListViewStore.changeRulesPath(favManager.getPath()));
            }
        });

        //Keys Actions
        this.debounceMouseTrap = _.debounce((event, $action) => {
            if (!event) return;

            if (!this.props.storeDispatch || !this.props.store || !window_and_systray) {
                Logger.info('No this.props.storeDispatch / No this.props.store / window_and_systray');
                return;
            }

            //KTODO: Pasar todo a Executor.js (?)
            if ($action === 'ESCAPE') {
                if (event.target && event.target.id !== 'mainSearch') {
                    if (document.getElementById('mainSearch')) {
                        document.getElementById('mainSearch').focus();
                        return;
                    }
                }
                if (this.props.store.executors !== null) {
                    this.props.storeDispatch(ListViewStore.removeSubExecutors());
                } else if (!this.props.store.search_text_is_empty) {
                    this.props.storeDispatch(ListViewStore.deleteSearchBox());
                } else if (this.props.store.rulesPath.path !== '/') {
                    this.props.storeDispatch(ListViewStore.backRulesPath());
                } else {
                    window_and_systray.unpopWin(); //HIDE WIN
                }
            }

            if ($action === 'ENTER') {
                this.ruleExecutor(this.props.store.lastExcutorSelected || this.props.store.lastRuleSelected);
                return;
            }

            if ($action === 'OPEN_IN_TERMINAL') {
                driveManager.openTerminal(this.props.store.lastRuleSelected);
                return;
            }

            if ($action === 'RESET_SCORE') {
                let $id = _.get(this.props.store, 'lastRuleSelected', 'id');
                if ($id) {
                    resetScore($id);
                    ListViewStore.storeActions.updateFilterlist(true);
                }
                return;
            }

            if ($action === 'HISTORY') {
                if (PackagesManager.getPluginByName('internal_pack_last_rules')) {
                    this.props.storeDispatch(ListViewStore.changeRulesPath(lastRulesManager.getPath()));
                }
                return;
            }

            if ($action === 'FAVS') {
                if (PackagesManager.getPluginByName('internal_pack_favorites')) {
                    this.props.storeDispatch(ListViewStore.changeRulesPath(favManager.getPath()));
                }
                return;
            }

            if ($action === 'RESET_SIZE') {
                _def_maxItemsVisible = Config.getDeafult('maxItemsVisible') || 8;
                sharedData.dataManager.setAndSaveSettings('userSettings', {
                    maxItemsVisible: _def_maxItemsVisible
                });
                setTimeout(() => {
                    sharedData.dataManager.setAndSaveSettings('userSettings', {
                        width: _def_width
                    });
                }, 80);
                setTimeout(() => {
                    window_and_systray.setWindowSize(_def_width, null);
                    window_and_systray.centerWin(true);
                }, 340);
                return;
            }

            if ($action === 'FOLDER_FAVS') {
                if (PackagesManager.getPluginByName('internal_pack_paths') && PackagesManager.getPluginByName('internal_pack_favorites')) {
                    this.props.storeDispatch(ListViewStore.changeRulesPath(favManager.getFolderFavsPath()));
                }
                return;
            }

            if ($action === 'PASTE_TO_SEARCH' && /^darwin/.test(process.platform)) {
                let clipboardText = clipboard.readText();
                if (clipboardText) {
                    let change = ListViewStore.changeQuery(clipboardText);
                    this.props.storeDispatch(change);
                }
                return;
            }

            if ($action === 'BACKESCPACE') {
                if (event.target && event.target.id !== 'mainSearch') {
                    if (document.getElementById('mainSearch')) {
                        document.getElementById('mainSearch').focus();
                        return;
                    }
                }
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
                return;
            }

            if ($action === 'CONTEXT_MENU') {
                if (this.props.store.lastRuleSelected) {
                    Executor.auxCallExecutors(this.props.store.lastRuleSelected);
                }
                return;
            }

            if ($action === 'CLOSE_WIN') {
                this.props.storeDispatch(ListViewStore.backRootRulesPath());
                window_and_systray.unpopWin();
                return;
            }

            if ($action === 'DEV_COPY_RULE') {
                clipboard.writeText(JSON.stringify(this.props.store.lastRuleSelected, null, 4));
                if (event.preventDefault) event.preventDefault();
                return;
            }

            if ($action === 'COPY_STRING') {
                if (!this.props.store.lastRuleSelected || !this.props.store.lastRuleSelected.type) return;

                if (this.props.store.lastRuleSelected.type.includes('string') || this.props.store.lastRuleSelected.type === 'string') {
                    Executor.executeRule(this.props.store.lastRuleSelected, this.props.store.search_text, _defaultExecForTypes_string_copy, event);
                } else {
                    //If not string search object.type + _clipboard id
                    //KTODO: Primero checkear que no exista este, después disparar el del string
                    //Llamar solo una vez al executeRule, que el se ocupe de buscar el plugin
                    Executor.executeRule(
                        this.props.store.lastRuleSelected,
                        this.props.store.search_text,
                        this.props.store.lastRuleSelected.type[0] + '_clipboard',
                        event
                    );
                }
                return;
            }

            if ($action === 'SCORE_UP') {
                if (!this.props.store.lastRuleSelected || !this.props.store.lastRuleSelected.type) return;
                Executor.executeRule(this.props.store.lastRuleSelected, this.props.store.search_text, null, event, false);
                ListViewStore.storeActions.updateFilterlist();
                return;
            }

            if ($action === 'TOGGLE_FAVORITE') {
                if (this.props.store.executors === null && this.props.store.lastRuleSelected && this.props.store.lastRuleSelected.fav_permit) {
                    favManager.toggle(this.props.store.lastRuleSelected);
                    ListViewStore.storeActions.updateFilterlist();
                }
                return;
            }

            if ($action === 'TOGGLE_HIDDEN') {
                if (this.props.store.executors === null && this.props.store.lastRuleSelected) {
                    togleHidden(this.props.store.lastRuleSelected);
                    this.ruleSelected(null);
                    ListViewStore.storeActions.updateFilterlist(true);
                }
                return;
            }

            if ($action === 'GOTO_ROOT') {
                this.props.storeDispatch(ListViewStore.backRootRulesPath());
                if (this.props.store.rulesPath.path == '/') {
                    Mousetrap.trigger('home');
                }
                return;
            }
        }, debounceTime);

        //BIND KEYS
        let bindKeysArr = _bindKeys;
        bindKeysArr.forEach(entry => {
            if (entry.level === 'main') {
                Mousetrap.bind(entry.keys, event => {
                    if (!event) return;

                    //Avoid TAB if not focus
                    if (event.key === 'Tab') {
                        if (event.target && event.target.id !== 'mainSearch') {
                            if (document.getElementById('mainSearch')) {
                                document.getElementById('mainSearch').focus();
                                return;
                            }
                        }
                    }

                    //Avoid cttl=c if selectet (windows or webview) text
                    if (event.key === 'c' && (event.ctrlKey || event.metaKey)) {
                        if (window && window.getSelection() && window.getSelection().toString()) return;

                        if (document.querySelector('webview')) {
                            document.querySelector('webview').executeJavaScript('window.getSelection().toString()', null, txt => {
                                if (!txt.length) {
                                    this.debounceMouseTrap(event, entry.action);
                                }
                            });
                            return;
                        }
                    }

                    this.debounceMouseTrap(event, entry.action);
                });
            }
        });

        Mousetrap.bind(getKeyFromConfig(_bindKeys, 'SCROLL_DOWN_WEBVIEW'), e => {
            if (this.componentViewer && this.componentViewerProps && document) {
                if (document.querySelector('webview')) {
                    document.querySelector('webview').sendInputEvent({ type: 'keyDown', keyCode: 'Down' });
                } else if (document.getElementsByClassName('ruleViewerWrapp')[0]) {
                    document.getElementsByClassName('ruleViewerWrapp')[0].scrollTop += 60;
                }
                if (e.preventDefault) {
                    e.preventDefault();
                }
            }
        });
        Mousetrap.bind(getKeyFromConfig(_bindKeys, 'SCROLL_UP_WEBVIEW'), e => {
            if (this.componentViewer && this.componentViewerProps && document) {
                if (document.querySelector('webview')) {
                    document.querySelector('webview').sendInputEvent({ type: 'keyDown', keyCode: 'Up' });
                } else if (document.getElementsByClassName('ruleViewerWrapp')[0]) {
                    document.getElementsByClassName('ruleViewerWrapp')[0].scrollTop -= 60;
                }
                if (e.preventDefault) {
                    e.preventDefault();
                }
            }
        });
        Mousetrap.bind(getKeyFromConfig(_bindKeys, 'SCROLL_LEFT_WEBVIEW'), e => {
            if (this.componentViewer && this.componentViewerProps && document) {
                if (document.querySelector('webview')) {
                    document.querySelector('webview').sendInputEvent({ type: 'keyDown', keyCode: 'Left' });
                } else if (document.getElementsByClassName('ruleViewerWrapp')[0]) {
                    document.getElementsByClassName('ruleViewerWrapp')[0].scrollLeft -= 60;
                }
                if (e.preventDefault) {
                    e.preventDefault();
                }
            }
        });
        Mousetrap.bind(getKeyFromConfig(_bindKeys, 'SCROLL_RIGHT_WEBVIEW'), e => {
            if (this.componentViewer && this.componentViewerProps && document) {
                if (document.querySelector('webview')) {
                    document.querySelector('webview').sendInputEvent({ type: 'keyDown', keyCode: 'Right' });
                } else if (document.getElementsByClassName('ruleViewerWrapp')[0]) {
                    document.getElementsByClassName('ruleViewerWrapp')[0].scrollLeft += 60;
                }
                if (e.preventDefault) {
                    e.preventDefault();
                }
            }
        });
        Mousetrap.bind(getKeyFromConfig(_bindKeys, 'GO_BACK_HIST'), e => {
            ListViewStore.storeEvents.emit('GO_BACK_HIST');
            if (e.preventDefault) {
                e.preventDefault();
            }
        });

        PackagesManager.setMousTrap(Mousetrap.bind);
        PackagesManager.viewIsReady();
    },
    ruleExecutor: function(obj) {
        if (!obj) {
            return;
        }

        let deleteSearchOnFire = true;

        if (obj.exectFunc && this.props.store.lastRuleSelected) {
            deleteSearchOnFire = Executor.executeRule(this.props.store.lastRuleSelected, this.props.store.search_text, obj);
        } else {
            //Normal rule
            deleteSearchOnFire = Executor.executeRule(obj, this.props.store.search_text);
        }

        if (_deleteSearchOnFire && deleteSearchOnFire !== false) {
            ListViewStore.storeActions.deleteSearchBox();
        }
    },
    toggleFav: function(item) {
        if (!item) {
            item = this.props.store.lastRuleSelected;
        } else {
            ListViewStore.changeLastExcutorSelected(item);
        }
        if (item && item.id && !item.exectFunc && item.fav_permit) {
            favManager.toggle(item);
            ListViewStore.storeActions.updateFilterlist();
        }
    },
    contextMenu: function(obj) {
        this.ruleSelected(obj, 0);
        Executor.auxCallExecutors(obj);
    },
    ruleSelected: function(obj, index) {
        //VIEWER
        let types = _.get(obj, 'type');
        let viewers = null;
        let viewer = null;

        if (types && types !== 'object') {
            viewers = PackagesManager.getViewersByType(types);
            if (viewers && viewers.length) viewer = viewers[0];
        }

        if (viewer && viewer.viewerComp && obj.viewer !== false && (!viewer.enabled || viewer.enabled(obj))) {
            this.componentViewer = viewer.viewerComp;
            this.componentViewerBlend = viewer.useBlend;
            this.componentViewerProps = obj;
        } else {
            this.componentViewer = null;
            this.componentViewerBlend = false;
            this.componentViewerProps = null;
        }

        //CHANGE
        if (obj !== this.props.store.lastRuleSelected && this.props.store.executors === null) {
            this.props.storeDispatch(ListViewStore.changeLastRuleSelected(obj, index));
        }
        if (this.props.store.lastExcutorSelected !== obj && this.props.store.executors !== null) {
            this.props.storeDispatch(ListViewStore.changeLastExcutorSelected(obj, index));
        }
    },
    render: function() {
        let contextMenu = this.props.store.executors !== null;
        let items, ruleSelected, size;

        if (contextMenu) {
            items = this.props.store.executors;
            ruleSelected = this.ruleSelected;
        } else {
            items = this.props.store.filteredRules;
            ruleSelected = this.ruleSelected;
        }

        size = 0;
        if (items && items.size) {
            size = items.size;
        }

        let classesWrapp = ['boxContentWrapperList'];
        if (this.componentViewer && this.componentViewerProps) {
            classesWrapp.push('withViewer');
        }
        classesWrapp = classesWrapp.join(' ');

        this.className_ruleViwer = 'ruleViewer';

        //ADD NO BLEND
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
                    <span className="listadoRules">
                        <ListCelds
                            parentRuleExecutor={this.ruleExecutor}
                            parentContextMenu={this.contextMenu}
                            parenttToggleFav={this.toggleFav}
                            actual={this.props.store.statusBar_actual}
                            items={items}
                            ruleSelected={ruleSelected}
                            storeDispatch={this.props.storeDispatch}
                        />
                    </span>
                    <div className={this.className_ruleViwer}>
                        {this.componentViewer &&
                            this.componentViewerProps && (
                                <div className="ruleViewerWrapp" id="ruleViewerWrapp">
                                    {<this.componentViewer rule={this.componentViewerProps} />}
                                </div>
                            )}
                    </div>
                </div>

                {getStatusBar({
                    data: this.props.store,
                    version: this.props.version,
                    dev: _dev,
                    size: size
                })}
            </div>
        );
    }
});

//SEARCHBOX
let MainSearch = InfCreateClass({
    componentDidMount: function() {
        this.searchField = document.getElementById('mainSearch');
        this.txtvalue = '';

        if (this.props && this.props.text) {
            this.searchField.value = this.props.text;
            this.txtvalue = this.props.text;
            this.reFocus();
        } else {
            //Get first list
            store.dispatch(ListViewStore.updateFilterlist());
        }

        //Debounce change
        this.debounceChange = _.debounce(() => {
            let change = ListViewStore.changeQuery(this.searchField.value || '');
            if (change && change.type) this.props.storeDispatch(change);
        }, this.props.debounceTime);

        //Disable Keys
        Mousetrap(this.searchField).bind(this.props.disableKeys, e => {
            if (e.preventDefault) {
                e.preventDefault();
            }
        });

        //ON SHOW
        window_and_systray.windowEvent.on('SHOW', this.reFocus);

        //On sore [text] change
        ListViewStore.storeEvents.on('CHANGE_SEARCH_TEXT', txt => {
            if (this.searchField && txt !== this.searchField.value) {
                this.searchField.value = txt;
                this.txtvalue = this.searchField.value;
                this.reFocus();
            }
        });

        this.forceUpdate();
        this.reFocus();
    },
    componentWillUnmount: function() {
        clearInterval(this.interval);
        this.searchField = null;
    },
    onChange: function(event) {
        this.debounceChange();
        if (this.searchField && this.props.result_text && this.txtvalue !== this.searchField.value) {
            this.txtvalue = this.searchField.value;
            this.forceUpdate();
        }
    },
    reFocus: function() {
        if (this.searchField) this.searchField.focus();
    },
    onblur: function(e) {
        setTimeout(() => {
            if (window && window.getSelection() && window.getSelection().toString()) return;

            //Check webview selected
            if (document.querySelector('webview')) {
                document.querySelector('webview').executeJavaScript('window.getSelection().toString()', null, txt => {
                    if (!txt.length) {
                        this.reFocus();
                    }
                });
                return;
            }

            this.reFocus();
        }, 240);
    },
    render: function() {
        this.reFocus();
        let path = this.props.path;
        if (this.searchField) this.txtvalue = this.searchField.value;
        if (this.txtvalue) this.txtvalue = this.txtvalue.replace(/ /g, '\u00a0');
        return (
            <span>
                <i class="feather-search mainSearchIcon" />
                {path.path !== '/' && (
                    <span className="pathIndicator">
                        {getIcon(path.icon)}
                        {path.name && <span className="pathName">{path.name}</span>}
                    </span>
                )}
                <input className="mousetrap" id="mainSearch" type="text" placeholder="search" onBlur={this.onblur} onInput={this.onChange} />
                <span class="searchResultWrapp">
                    <span id="mainSearchCopy">{this.txtvalue}</span>
                    <span id="searchResult">{this.props.result_text}</span>
                </span>
            </span>
        );
    }
});

//LIST
let ListCelds = InfCreateClass({
    getInitialState: function() {
        return {
            actual: 0,
            actualScrollLine: 0,
            size_items_visible: _maxItemsVisible || 8,
            mouseActivated: false,
            items: null,
            itemsSlice: []
        };
    },
    componentDidMount: function() {
        this.didCenter = false;

        //KEYS
        Mousetrap.bind(['down'], this.next);
        Mousetrap.bind(['up'], this.prev);
        Mousetrap.bind(['pagedown'], (e, type) => this.next(e, type, this.state.size_items_visible - 0));
        Mousetrap.bind(['pageup'], (e, type) => this.prev(e, type, this.state.size_items_visible - 0));
        Mousetrap.bind(['end'], (e, type) => this.next(e, type, 0));
        Mousetrap.bind(['home'], (e, type) => this.prev(e, type, 0));

        //MouseWhell
        setTimeout(() => {
            if (document.getElementsByClassName('ruleList')[0]) {
                document.getElementsByClassName('ruleList')[0].addEventListener('mousewheel', this.mouseWheelHandler, { passive: true });
            }
        }, 0);

        let throttleTime_moveList = _throttleTime_moveList;

        let validate_and_render = () => {
            this.validate();
            this.changeLastHighlighted();
        };

        if (throttleTime_moveList && throttleTime_moveList > 0) {
            this.throttle_validate_and_render = _.throttle(validate_and_render, throttleTime_moveList);
        } else {
            this.throttle_validate_and_render = validate_and_render;
        }

        //EVENTS

        themeManager.themeEvents.on('CHANGE_THEME', this.makeCacheSizes);

        window_and_systray.windowEvent.on('RESIZE', this.mainWinDidResized);

        if (Config.getChangeSettingsEvent) {
            Config.getChangeSettingsEvent().on('changeSettings', (path, dif) => {
                if (path.includes('maxItemsVisible')) {
                    _maxItemsVisible = Config.get('maxItemsVisible');
                    this.state.size_items_visible = _maxItemsVisible;
                    this.remakeList();
                }
            });
        }

        this.scrollOut = () => {
            if (this.scroller) {
                this.scroller.className = this.scroller.className.replace('no-animate-disappear', '').replace('animate-disappear', '') + ' animate-disappear';
            }
            if (this.content) {
                this.content.style.pointerEvents = 'all';
            }
        };

        this.scrollOutThrottle = _.debounce(this.scrollOut, _debounceTime_searchKeys * 4);
    },
    remakeList: function() {
        this.validate();
        this.changeLastHighlighted();
        this.forceUpdate();
    },
    getRangeItemsRender: function() {
        this.state.actualScrollLine = this.state.actual;

        if (this.state.actualScrollLine < 0) {
            this.state.actualScrollLine = 0;
        }

        if (_animations) {
            if (this.state.actualScrollLine > this.state.size_items_visible) {
                this.state.actualScrollLine = this.state.size_items_visible;
            }
        } else {
            if (this.state.actualScrollLine > this.state.size_items_visible - 1) {
                this.state.actualScrollLine = this.state.size_items_visible - 1;
            }
        }

        let actualOffset = this.state.actual - this.state.actualScrollLine;
        let first = actualOffset;
        let last = actualOffset + this.state.size_items_visible;

        if (_animations) {
            last += 3;
        }

        return { first: first, last: last };
    },
    next: function(e, type, val = 1) {
        this.state.mouseActivated = e === false;
        this.state.actual = this.state.actual + val;
        if (val === Infinity) {
            this.state.actual = 0;
        }
        if (val === 0) {
            this.state.actual = this.state.items.size || 0;
        }
        [].slice.call(document.getElementsByClassName('highLightMouse')).map(el => {
            el.classList.remove('highLightMouse');
            el.classList.remove('highLight');
        });
        this.throttle_validate_and_render();
    },
    prev: function(e, type, val = 1) {
        if (val === 0) {
            val = Infinity;
        }
        this.next(e, type, -val);
    },
    mouseWheelHandler: function(e) {
        if (this.isMounted()) {
            if (e.deltaY > 0) {
                this.next(false, null, 1);
            }
            if (e.deltaY < 0) {
                this.prev(false, null, 1);
            }
        }
    },
    validate: function() {
        if (this.state.items && this.state.items.size) {
            if (this.state.actual < 0) {
                this.state.actual = 0;
            }
            if (this.state.actual > this.state.items.size - 1) {
                this.state.actual = this.state.items.size - 1;
            }
        }
    },
    componentWillReceiveProps: function(nextProps, nextState) {
        if (nextProps.items !== this.props.items) {
            this.state.actual = nextProps.actual || 0;
            this.state.actualScrollLine = 0;
            this.state.items = nextProps.items;
            this.changeLastHighlighted();
        }
        //Center Window
        if (!this.didCenter && this.state.items.size) {
            setTimeout(window_and_systray.centerWin, 1);
            this.didCenter = true;
        }
    },
    componentDidUpdate: function(nextProps, nextState) {
        this.manageScrollBarPos();
    },
    onClickRule: function(item, param) {
        if (!param || !param.target) return;
        let itemEl = param.target.closest('.ruleListCelda');
        if (!itemEl) return;
        let index = itemEl.getAttribute('index');
        if (!index) return;

        index = Number(index);

        if (itemEl.classList.contains('highLight')) {
            //CHECK DOUBLE CLICK
            if (this.clickLastTime) {
                let dif = new Moment(new Date()).diff(this.clickLastTime);
                if (dif < _doubleClickTime) {
                    this.props.parentRuleExecutor(item);
                }
            }
        } else {
            try {
                [].slice.call(document.getElementsByClassName('highLight')).map(el => el.classList.remove('highLight'));
                itemEl.className += ' highLight highLightMouse';
                this.props.ruleSelected(item, index);
                this.state.actual = index;
            } catch (e) {
                Logger.warn(e);
            }
        }
        this.clickLastTime = Moment(new Date());
    },
    changeLastHighlighted: function() {
        if (this.state.items && this.state.items.size) {
            let lastRange = this.getRangeItemsRender();
            this.state.itemsSlice = this.state.items
                .slice(lastRange.first, lastRange.last)
                .toOrderedSet()
                .toArray();
            this.props.ruleSelected(this.state.itemsSlice[this.state.actualScrollLine], this.state.actual);
        } else {
            this.props.ruleSelected(null);
        }
    },
    makeCacheSizes: function() {
        this.scroller = document.getElementById('scrollTrackElid');
        this.ruleListado = document.getElementById('ruleListado');
        this.statusBar = document.getElementById('status-bar');
        this.innerContent = document.getElementById('inner-content');
        this.mainSearchWrapper = document.getElementById('mainSearchWrapper');
        this.content = document.getElementById('content');

        if (this.ruleHeight && this.ruleHeight !== this.ruleListado.firstChild.offsetHeight) setTimeout(() => window_and_systray.centerWin(true), 10);

        if (this.ruleListado && this.ruleListado.firstChild) this.ruleHeight = Math.round(this.ruleListado.firstChild.offsetHeight);
        if (this.statusBar) this.statusBarHeight = Math.round(this.statusBar.offsetHeight);
        if (this.mainSearchWrapper) this.mainSearchWrapperHeight = Math.round(this.mainSearchWrapper.offsetHeight);
    },
    manageScrollBarPos: function() {
        let size = 0;
        let changeSize = false;

        if (!this.ruleHeight || !this.statusBarHeight || !this.mainSearchWrapperHeight) {
            this.makeCacheSizes();
        }

        if (this.state.items && this.state.items.size) {
            size = this.state.items.size;
        }

        if (!this.ruleHeight) return;

        let min = Math.min(this.state.size_items_visible, size);

        //SIZES
        if (this.haveViewer) {
            min = this.state.size_items_visible;
        }

        //NEW HEIGHT
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

        //WindowSize
        if (changeSize && this.statusBarHeight && this.mainSearchWrapperHeight) {
            if (!this.newHeight) this.newHeight = 0;

            let deltaObj = Math.round(this.statusBarHeight + this.mainSearchWrapperHeight);
            let $validHeight = this.getValidWinSize(this.newHeight + deltaObj);
            let $maxValidHeight = this.getValidWinSize(this.state.size_items_visible * Math.round(this.ruleHeight) + deltaObj);

            if ($validHeight) {
                this.ruleListado.style.height = $validHeight.height - deltaObj + 'px';
                window_and_systray.setWindowSize(null, $validHeight.height);
            }

            if ($maxValidHeight) {
                window_and_systray.setMaxSize($maxValidHeight.height);
            }
        }

        //this.Scroller
        if (!this.scroller) return;

        if (size <= this.state.size_items_visible) {
            this.scroller.className = this.scroller.className.replace('hidden', '') + ' hidden';
            return;
        }

        this.scroller.className = this.scroller.className.replace('hidden', '');
        this.relScroll = this.state.actual / (size - 1);

        if (!this.scrollerOffsetHeight) {
            this.scrollerOffsetHeight = this.scroller.offsetHeight;
        }

        if (this.newHeight && this.statusBarHeight) {
            this.scrollHeight = Math.round(this.newHeight - 4 * 2 - this.scrollerOffsetHeight);
        }

        if (this.scrollHeight) {
            let top = Math.round(this.scrollHeight * this.relScroll || 0);
            if (top !== this.topLast) {
                this.scroller.style.transform = 'translateY(' + top + 'px' + ')';
                this.content.style.pointerEvents = 'none';
                this.topLast = top;
            }
            let className = this.scroller.className;
            let _className = className + '';
            className = className.replace('no-animate-disappear', '').replace('animate-disappear', '') + ' no-animate-disappear';
            if (className !== _className) {
                this.scroller.className = className;
            }
            this.scrollOutThrottle();
        }
    },
    getValidWinSize: function($height, forceOne = false) {
        if (!this.ruleHeight || this.ruleHeight < 1 || !this.statusBarHeight || !this.mainSearchWrapperHeight || !$height) {
            return null;
        }
        this.ruleHeight = Math.round(this.ruleHeight);
        let deltaObj = Math.round(this.statusBarHeight + this.mainSearchWrapperHeight);
        let rulesH = $height - deltaObj;
        let items = Math.round(rulesH / this.ruleHeight);
        if (items < 0) items = 0;
        if (forceOne && items === 0) items = 1;
        if (items > 25) items = 25;
        return {
            height: items * this.ruleHeight + deltaObj,
            items: items
        };
    },
    mainWinDidResized: function(el) {
        if (!this.state.size_items_visible) return;

        let $validHeight = this.getValidWinSize(el.height);
        if (!$validHeight) return;

        if ($validHeight.maxItems !== this.state.size_items_visible && el.height !== $validHeight.height) {
            //USER CHANGE WINDOW HEIGHT

            $validHeight = this.getValidWinSize(el.height, true);
            this.state.size_items_visible = $validHeight.items;
            this.remakeList();
            window_and_systray.setWindowSize(null, $validHeight.height);

            //SAVE SETTING
            if (sharedData.dataManager.setAndSaveSettings('userSettings', { maxItemsVisible: $validHeight.items })) {
                return true;
            }
        }
    },
    render: function() {
        let animations = _animations;
        let classes = ['ruleList'];

        if (this.state.mouseActivated) {
            classes.push('mouseActivated');
        }
        if (animations) {
            classes.push('animsEnabled');
        }

        classes = classes.join(' ');

        return (
            <div className={classes} id="ruleListado">
                {Boolean(this.state.itemsSlice && this.state.itemsSlice.length) &&
                    this.state.itemsSlice.map((item, i) => {
                        //rule Classes
                        let classesRule = ['ruleListCelda'];

                        if (i === this.state.actualScrollLine && !item.isLoading && !item._noSelect) {
                            let type = _.get(item, 'type[0]');
                            let viewer = null;
                            if (type && type !== 'object') {
                                viewer = PackagesManager.getDefaultViewer(type);
                            }
                            this.haveViewer = viewer && viewer.viewerComp;

                            classesRule.push('highLight');
                        }

                        if (!item.description) {
                            classesRule.push('noDesc');
                        }

                        if (i === 0 && animations && this.state.actualScrollLine > this.state.size_items_visible - 2) {
                            classesRule.push('toDeletedCss');
                        }

                        classesRule = classesRule.join(' ');

                        let clickContext = (item, e) => {
                            this.props.parentContextMenu(item);
                            e.stopPropagation();
                        };

                        let clickToggleFav = (item, e) => {
                            this.props.parenttToggleFav(item);
                            e.stopPropagation();
                        };

                        return (
                            <div
                                key={item.id}
                                index={i}
                                className={classesRule}
                                onClick={linkEvent(item, this.onClickRule)}
                                data-itemselected={i === this.state.actualScrollLine}
                                data-id={item.id}
                            >
                                {getIcon(item.icon)}
                                {getRule(item, clickContext, clickToggleFav)}
                            </div>
                        );
                    })}
                <div className="scrollTrackEl" id="scrollTrackElid" />
            </div>
        );
    }
});

//ICON
let getIcon = icon => {
    if (!icon || !_icons) return;

    let classNameIco = ['main_ico'];

    if (icon.type === 'iconFont') {
        if (icon.iconClassColor) {
            classNameIco.push(icon.iconClassColor);
        } else {
            classNameIco.push('colorDefault');
        }
    }

    if (icon.iconClass) {
        classNameIco.push(icon.iconClass);
    }

    classNameIco = classNameIco.join(' ');

    return (
        <span>
            {icon.type === 'iconFont' && <i className={classNameIco} />}

            {icon.type === 'iconSvg' &&
                icon.iconData && (
                    <i className={classNameIco}>
                        <wrappIcon dangerouslySetInnerHTML={{ __html: icon.iconData }} />
                    </i>
                )}

            {icon.type === 'iconSrc' &&
                icon.iconData && (
                    <i className={classNameIco}>
                        <wrappIcon>
                            <img src={icon.iconData} />
                        </wrappIcon>
                    </i>
                )}
        </span>
    );
};

//GETRULE
let getRule = (item, clickContext, clickToggleFav) => {
    if (!item) return;

    let ruleIconContext = false;

    if (!item._internalAct && item.type.includes('object') && !item.type.includes('null')) {
        ruleIconContext = true;
    }

    item.favorite = favManager.ifFav(item.id);

    let iconFav = 'mdi-star-outline';
    if (item.favorite || (item.path && item.path.includes('FAVS_'))) {
        iconFav = 'mdi-star';
    }

    let infoClassName = 'ruleInfo';

    if (_showRuleScore || _showRuleScoreDebug) {
        infoClassName += ' showRuleScore';
    }

    let rootClass = 'ruleNameAndDesc';
    if (item.isNew) rootClass += ' newRule';

    return (
        <span>
            {!item.component && (
                <span className={rootClass}>
                    <span className="ruleName">{item.title}</span>
                    <span className="ruleDescription">{item.description}</span>

                    {item._score_p !== null && (
                        <span className={infoClassName}>
                            <span className="points">{item._points_p}</span>
                            /
                            <span className="pointsK">{item._points_current_key_p}</span>
                            /
                            {item._score_p}
                        </span>
                    )}
                </span>
            )}

            {item.component && (
                <span className="ruleName dynamicString" data-id={item.id}>
                    {<item.component rule={item} />}
                </span>
            )}

            {ruleIconContext &&
                !item.exectFunc &&
                _icons &&
                clickContext && (
                    <span className="ruleIconContext smallContext small_ico" title={labelToolTipContext} onClick={linkEvent(item, clickContext)}>
                        <i className="mdi-dots-vertical" />
                    </span>
                )}

            {ruleIconContext &&
                !item.exectFunc &&
                _icons &&
                item.fav_permit &&
                clickToggleFav && (
                    <span className="ruleIconContext smallContext small_ico" title={labelToolTipFav} onClick={linkEvent(item, clickToggleFav)}>
                        <i className={iconFav} />
                    </span>
                )}
        </span>
    );
};

//RULESELECTED-CONTEXT
let getRuleSelected = item => {
    if (!item) return;

    this.ruleselected = document.getElementById('ruleselected');

    if (this.ruleselected) {
        this.ruleselected.focus();
    }

    return (
        <span class="ruleContext">
            <input className="mousetrap mousetrapCapture" id="ruleselected" />
            {getIcon(item.icon)}
            <span class="ruleNameAndDesc">
                <span class="contextTitle">{item.title}</span>
                <span className="ruleDescription">{item.description}</span>
            </span>
        </span>
    );
};

//STATUSBAR
let getStatusBar = params => {
    if (!params) return;

    let dev = 'P';
    if (params.dev) {
        dev = 'D';
    }

    let elevatedString = '';
    if (window_and_systray.isElevated()) {
        elevatedString = '^';
    }

    return (
        <div id="status-bar">
            <span>
                {params.data.statusBar_actual + 1 || 0}/
                <span id="levelSize">{params.size}</span>
                {' \xA0-\xA0 '}
                <span id="totalTime">{'time: ' + params.data.statusBar_totalTime + 'ms.'}</span>
                <span className="infoDer">
                    {elevatedString}ver: {params.version} . {dev}{' '}
                </span>
            </span>
        </div>
    );
};

module.exports.init = init;
