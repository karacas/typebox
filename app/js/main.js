'use strict';

const Logger = require('../js/logger.js');
const sharedData = require('../js/sharedData.js');

require('../js/rulesMaker.js').makeRules();
require('../js/packagesManager.js').makePackages().then(() => {
    // Logger.info('PackagesManager init ok');

    require('babel-core/register')({
        plugins: ['inferno'],
        extensions: ['.jsx']
    });

    require('../js/llistView.jsx').init();
    require('../js/historyManager.js').loadHistory();
    require('../js/favManager.js').loadfav();
    require('../js/lastRulesManager.js').loadlast();

    sharedData.app_window_and_systray.windowEvent.emit('mainWindowReady');
});
