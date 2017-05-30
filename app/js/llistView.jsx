'use strict';

const _ = require('lodash');
const Moment = require('moment');
const Mousetrap = require('mousetrap');
const Executor = require('../js/executor.js');
const ListViewStore = require('../js/listViewStore.js');
const PackagesManager = require('../js/packagesManager.js');
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const sharedData = require('../js/sharedData.js');
const favManager = require('../js/favManager.js');
const themeManager = require('../js/themeManager.js');
const lastRulesManager = require('../js/lastRulesManager.js');

const Inferno = require('inferno');
const linkEvent = require('inferno').linkEvent;
const Component = require('inferno-component');
const InfCreateClass = require('inferno-create-class');

const store = ListViewStore.store;
const window_and_systray = sharedData.app_window_and_systray;

//START COMPONENT
function init() {
    if (document) {
        themeManager.init(document);
    } else {
        Logger.error('no document element');
        return;
    }

    const render = () => Inferno.render(<ReactContent store={store.getState()} storeDispatch={store.dispatch} />, document.getElementById('contentReact'));

    store.subscribe(() => setTimeout(render));

    setTimeout(render);

    if (Config.get('dev')) {
        window.store = store;
    }

    Logger.info(
        '      > TOTAL INIT TIME:',
        '[' + Moment(new Date()).format('HH:mm:ss.SSS') + ']',
        Moment(new Date()) - Moment(Config.get('here_are_dragons.report.backgroundStartDate'))
    );

    themeManager.removeLoader();
}

//MAIN REACT COMPONENT
class ReactContent extends Component {
    render() {
        let version = Config.get('here_are_dragons.report.version');

        let classes = [Config.get('dev') ? 'dev_version' : 'prod_version'];
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
var FilterList = InfCreateClass({
    componentDidMount: function() {
        let debounceTime = Config.get('here_are_dragons.debounceTime_actionsKeys');

        //If settings chage > update view
        Config.getChangeSettingsEvent().on('changeSettings', (path, dif) => {
            setTimeout(this.forceUpdate, 1);
        });

        //ON SHOW
        if (Config.get('here_are_dragons.gotoRootOnShow') && this.props.storeDispatch && this.props.store && window_and_systray) {
            window_and_systray.windowEvent.on('SHOW', () => {
                this.props.storeDispatch(ListViewStore.backRootRulesPath());
            });
        }

        //Keys Actions
        this.debounceMouseTrap = _.debounce((event, $action) => {
            if (!this.props.storeDispatch || !this.props.store || !window_and_systray) {
                Logger.info('No this.props.storeDispatch / No this.props.store / window_and_systray');
                return;
            }

            //KTODO: Pasar todo a Executor.js (?)
            if ($action === 'ESCAPE') {
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

            if ($action === 'BACKESCPACE') {
                if (this.props.store.executors !== null) {
                    this.props.storeDispatch(ListViewStore.removeSubExecutors());
                    return;
                }
                if (this.props.store.search_text_is_empty) {
                    this.props.storeDispatch(ListViewStore.backRulesPath());
                }
            }

            if ($action === 'CONTEXT_MENU') {
                if (this.props.store.lastRuleSelected) {
                    Executor.auxCallExecutors(this.props.store.lastRuleSelected);
                }
            }

            if ($action === 'CLOSE_WIN') {
                this.props.storeDispatch(ListViewStore.backRootRulesPath());
                window_and_systray.unpopWin();
            }

            if ($action === 'COPY_STRING') {
                Executor.executeRule(
                    this.props.store.lastRuleSelected,
                    this.props.store.search_text,
                    Config.get('here_are_dragons.defaultExecForTypes.string_copy'),
                    event
                );
            }

            if ($action === 'TOGGLE_FAVORITE') {
                if (this.props.store.executors === null && this.props.store.lastRuleSelected && this.props.store.lastRuleSelected.fav_permit) {
                    favManager.toggle(this.props.store.lastRuleSelected);
                    ListViewStore.storeActions.updateFilterlist();
                }
            }

            if ($action === 'GOTO_ROOT') {
                this.props.storeDispatch(ListViewStore.backRootRulesPath());
            }
        }, debounceTime);

        //BIND KEYS
        let bindKeysArr = Config.get('here_are_dragons.bindKeys');
        bindKeysArr.forEach(entry => {
            Mousetrap.bind(entry.keys, event => {
                this.debounceMouseTrap(event, entry.action);
            });
        });

        //BIND KEYS VIEWER
        Mousetrap.bind(['shift+down'], e => {
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
        Mousetrap.bind(['shift+up'], e => {
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
    },
    ruleExecutor: function(obj) {
        if (!obj) {
            return;
        }
        if (obj.exectFunc && this.props.store.lastRuleSelected) {
            Executor.executeRule(this.props.store.lastRuleSelected, this.props.store.search_text, obj);
        } else {
            //Normal rule
            Executor.executeRule(obj, this.props.store.search_text);
        }

        if (Config.get('here_are_dragons.deleteSearchOnFire')) {
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
        let types = _.result(obj, 'type');
        let viewers = null;
        let viewer = null;

        if (types && types !== 'object') {
            viewers = PackagesManager.getViewersByType(types);
            if (viewers && viewers.length) viewer = viewers[0];
        }

        if (viewer && viewer.viewerComp) {
            this.componentViewer = viewer.viewerComp;
            this.componentViewerProps = obj;
        } else {
            this.componentViewer = null;
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

        return (
            <div id="boxContentWrapper">
                <div id="mainSearchWrapper">
                    {!contextMenu &&
                        <MainSearch
                            path={this.props.store.rulesPath}
                            text={this.props.store.search_text}
                            storeDispatch={this.props.storeDispatch}
                            disableKewys={Config.get('here_are_dragons.disableKeysOnSearchBox')}
                            debounceTime={Config.get('here_are_dragons.debounceTime_searchKeys')}
                        />}
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
                    <div className="ruleViewer">
                        {this.componentViewer &&
                            this.componentViewerProps &&
                            <div className="ruleViewerWrapp" id="ruleViewerWrapp">
                                {<this.componentViewer rule={this.componentViewerProps} />}
                            </div>}
                    </div>
                </div>

                {getStatusBar({
                    data: this.props.store,
                    version: this.props.version,
                    dev: Config.get('dev'),
                    size: size
                })}
            </div>
        );
    }
});

//SEARCHBOX
var MainSearch = InfCreateClass({
    componentDidMount: function() {
        //KTODO: Deacoplar el store directo

        this.searchField = document.getElementById('mainSearch');

        if (this.props && this.props.text && this.props.text.length) {
            this.searchField.value = this.props.text;
            this.reFocus();
        } else {
            //Get first list
            store.dispatch(ListViewStore.updateFilterlist());
        }

        //Debounce change
        this.debounceChange = _.debounce(() => {
            let change = ListViewStore.changeQuery(this.searchField.value || '');
            if (change && change.type) {
                this.props.storeDispatch(change);
            }
        }, this.props.debounceTime);

        //Disable Keys
        Mousetrap(this.searchField).bind(this.props.disableKewys, e => {
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
                this.reFocus();
            }
        });
    },
    componentWillUnmount: function() {
        clearInterval(this.interval);
        this.searchField = null;
    },
    onChange: function(event) {
        this.debounceChange();
    },
    reFocus: function() {
        window.focus();
        if (this.searchField) {
            this.searchField.focus();
        }
    },
    onblur: function(e) {
        //Always focus
        this.reFocus();
    },
    render: function() {
        this.reFocus();
        let path = this.props.path;
        return (
            <span>
                <i class="feather-search mainSearchIcon" />
                {path.path !== '/' &&
                    <span className="pathIndicator">
                        {getIcon(path.icon)}
                        {path.name && <span className="pathName">{path.name}</span>}
                    </span>}
                <input className="mousetrap" id="mainSearch" type="text" placeholder="search" onBlur={this.onblur} onInput={this.onChange} />
            </span>
        );
    }
});

//LIST
var ListCelds = InfCreateClass({
    //KTODO: Modificar todo con set
    getInitialState: function() {
        return {
            actual: 0,
            actualScrollLine: 0,
            size_items_visible: Config.get('maxItemsVisible') || 8,
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
                document.getElementsByClassName('ruleList')[0].addEventListener('mousewheel', this.mouseWheelHandler, false);
            }
        }, 0);

        let throttleTime_moveList = Config.get('here_are_dragons.throttleTime_moveList');

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

        Config.getChangeSettingsEvent().on('changeSettings', (path, dif) => {
            if (path.includes('maxItemsVisible') && Config.get('maxItemsVisible') !== this.state.size_items_visible) {
                this.state.size_items_visible = Config.get('maxItemsVisible');
                this.remakeList();
            }
        });
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

        if (Config.get('animations')) {
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

        if (Config.get('animations')) {
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
            this.props.parentRuleExecutor(item);
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
    },
    changeLastHighlighted: function() {
        if (this.state.items) {
            let lastRange = this.getRangeItemsRender();
            this.state.itemsSlice = this.state.items.slice(lastRange.first, lastRange.last).toArray();
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
                //KTODO: PASAR A VAR el style
                this.ruleListado.style.height = $validHeight.height - deltaObj + 'px';
                window_and_systray.setWindowSize(null, $validHeight.height);
            }

            if ($maxValidHeight) {
                window_and_systray.setMaxSize($maxValidHeight.height);
            }
        }

        //this.Scroller
        if (!this.scroller) return;

        //KTODO: Change 4 Class
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

        if (!this.debounceTime_searchKeys) {
            this.debounceTime_searchKeys = Config.get('here_are_dragons.debounceTime_searchKeys') || 16;
        }

        if (this.scrollHeight) {
            let top = Math.round(this.scrollHeight * this.relScroll || 0);
            if (top !== this.topLast) {
                this.scroller.style.top = top + 'px';
                this.topLast = top;
            }
            this.scroller.className = this.scroller.className.replace('no-animate-disappear', '').replace('animate-disappear', '') + ' no-animate-disappear';
            setTimeout(() => {
                this.scroller.className = this.scroller.className.replace('no-animate-disappear', '').replace('animate-disappear', '') + ' animate-disappear';
            }, this.debounceTime_searchKeys);
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
        let animations = Config.get('animations');
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
                            let type = _.result(item, 'type[0]');
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
var getIcon = icon => {
    if (!icon) return;

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
                icon.iconData &&
                <i className={classNameIco}>
                    <wrappIcon dangerouslySetInnerHTML={{ __html: icon.iconData }} />
                </i>}

            {icon.type === 'iconSrc' &&
                icon.iconData &&
                <i className={classNameIco}>
                    <wrappIcon>
                        <img src={icon.iconData} />
                    </wrappIcon>
                </i>}
        </span>
    );
};

//GETRULE
var getRule = (item, clickContext, clickToggleFav) => {
    if (!item) return;

    let ruleIconContext = false;

    if (_.includes(item.type, 'object') && !_.includes(item.type, 'null') && !item._internalAct) {
        ruleIconContext = true;
    }

    item.favorite = favManager.ifFav(item.id);

    let iconFav = 'mdi-star-outline';
    if (item.favorite || item.path === 'FAVS_PATH') {
        iconFav = 'mdi-star';
    }

    let infoClassName = 'ruleInfo';

    if (Config.get('here_are_dragons.printRulePoints') || Config.get('here_are_dragons.debug.printRulePoints')) {
        infoClassName += ' show';
    }

    return (
        <span>
            {!item.component &&
                <span className="ruleNameAndDesc">
                    <span className="ruleName">
                        {item.title}
                    </span>
                    <span className="ruleDescription">
                        {item.description}
                    </span>

                    {item._score_p !== null &&
                        <span className={infoClassName}>
                            <span className="points">{item._points_p}</span>
                            /
                            <span className="pointsK">{item._points_current_key_p}</span>
                            /
                            {item._score_p}
                        </span>}

                </span>}

            {item.component &&
                <span className="ruleName dynamicString" data-id={item.id}>
                    {<item.component rule={item} />}
                </span>}

            {ruleIconContext &&
                !item.exectFunc &&
                clickContext &&
                <span className="ruleIconContext smallContext small_ico" onClick={linkEvent(item, clickContext)}>
                    <i className="mdi-dots-vertical" />
                </span>}

            {ruleIconContext &&
                !item.exectFunc &&
                item.fav_permit &&
                clickToggleFav &&
                <span className="ruleIconContext smallContext small_ico" onClick={linkEvent(item, clickToggleFav)}>
                    <i className={iconFav} />
                </span>}

        </span>
    );
};

//RULESELECTED-CONTEXT
var getRuleSelected = item => {
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
var getStatusBar = params => {
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
                <span id="levelSize">
                    {params.size}
                </span>
                {' \xA0-\xA0 '}
                <span id="totalTime">{'time: ' + params.data.statusBar_totalTime + 'ms.'}</span>
                <span className="infoDer">{elevatedString}ver: {params.version} . {dev} </span>
            </span>
        </div>
    );
};

module.exports.init = init;
