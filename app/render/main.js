'use strict';

const realFs = require('fs');
const gracefulFs = require('graceful-fs');
gracefulFs.gracefulify(realFs);

const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const auxBabel = require('@aux/aux_babel.js');

auxBabel.init();

const start = async () => {
   const emit = require('@render/shared_data.js').app_window_and_systray.windowEvent.emit;

   const { makeRules, makeRulesUser } = require('@render/rules_maker.js');
   const { makePackages, makePackagesExternal } = require('@render/packages_manager.js');
   const listViewInit = require(auxBabel.replaceJSX('@mainview/main_view.jsx')).init;
   Logger.logTime('First requires: rulesMaker, packagesManager, emit, listView');

   require('@render/history_manager.js').loadHistory();
   require('@render/fav_manager.js').loadfav();
   require('@render/last_rules_manager.js').loadlast();
   require('@render/hidden_rules_manager.js').loadHiddenRules();
   require('@render/news_manager.js').loadnews();
   require('@render/expander_manager.js').init();

   Logger.logTime('Load & requires internal modules');

   /*listView INIT*/
   await listViewInit();
   Logger.logTime('listView_react init ok');

   await makePackages();
   Logger.logTime('makePackages');

   makeRules();
   Logger.logTime('makeRules');

   emit('mainWindowReady');
   Logger.logTime('MAIN WINDOW READY');

   makeRulesUser();
   Logger.logTime('makeRules User');

   makePackagesExternal();
   Logger.logTime('makePackages external');

   emit('mainEnds');
   Logger.logTime('main END');
};

module.exports.start = start;
