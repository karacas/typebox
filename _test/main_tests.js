'use strict';

// http://webdriver.io/api/action/addValue.html
require('./hooks');
const C = require('./inc_const.js');
const Q = require('q');
const assert = require('chai').assert;

describe('Main tests', () => {
    if (true) {
        it('opens a app window', function() {
            this.timeout(120000);
            return this.app.client
                .waitUntilWindowLoaded()
                .getWindowCount()
                .should.eventually.equal(1);
        });
    }

    if (true) {
        it('app window is visible', function() {
            this.timeout(120000);
            return this.app.browserWindow.show().then(() => {
                return this.app.browserWindow.isVisible().should.eventually.equal(true);
            });
        });
    }

    if (true) {
        it('should type something', function() {
            this.timeout(120000);
            const TEXT_SEARCH = 'algo';
            return this.app.client
                .windowByIndex(0)
                .keys(TEXT_SEARCH)
                .then(() => {
                    return Q.delay(C.DELAY_KEY).then(() => {
                        var search = this.app.client.windowByIndex(0).getValue('#mainSearch');
                        return search.then(val => {
                            return assert.equal(val, TEXT_SEARCH);
                        });
                    });
                });
        });
    }

    if (true) {
        it('should change searchbox', function() {
            this.timeout(120000);
            return this.app.client
                .windowByIndex(0)
                .keys('c!')
                .then(() => {
                    return Q.delay(C.DELAY_KEY * 3).then(() => {
                        var search = this.app.client.windowByIndex(0).getValue('#mainSearch');
                        return search.then(val => {
                            return assert.equal(val, 'CHANGE_OK');
                        });
                    });
                });
        });
    }

    if (true) {
        it('should do change paths', function() {
            this.timeout(120000);

            const TXT_PATH_LEVEL3 = 'Path3 Ok';

            var win = this.app.client.windowByIndex(0);

            var levels = () => {
                return (
                    win
                        .getText('#levelSize')
                        .then(() => win.keys('change1'))
                        .then(() => Q.delay(C.DELAY_KEY))
                        .then(() => win.keys(C.ENTER_KEY))
                        .then(() => Q.delay(C.DELAY_KEY))
                        .then(() => win.keys('change2'))
                        .then(() => Q.delay(C.DELAY_KEY))
                        .then(() => win.keys(C.ENTER_KEY))
                        .then(() => Q.delay(C.DELAY_KEY))
                        .then(() => win.keys('change3'))
                        .then(() => Q.delay(C.DELAY_KEY))
                        .then(() => win.keys(C.ENTER_KEY))
                        .then(() => Q.delay(C.DELAY_KEY))
                        .then(() => this.app.client.windowByIndex(0).getText(C.RULE_HIGHLIGHTTED_TITLE))
                        /**/
                        .then(val => assert.equal(val, TXT_PATH_LEVEL3)) //PATH 3 OK
                        .then(() => win.keys(C.BACKSPACE_KEY))
                        .then(() => Q.delay(C.DELAY_KEY))
                        .then(() => win.keys(C.ESCAPE_KEY))
                        .then(() => Q.delay(C.DELAY_KEY))
                        .then(() => win.keys(C.ESCAPE_KEY))
                        .then(() => Q.delay(C.DELAY_KEY))
                        .getHTML('.level_root')
                        .then(val => assert.equal(val.length > 0, true))
                        .then(() => win.keys(C.ESCAPE_KEY))
                        .then(() => Q.delay(C.DELAY_KEY))
                        .then(() => this.app.browserWindow.isVisible())
                        .then(val => assert.equal(val, false))
                ); //ESCAPE OK
            };

            return levels()
                .then(() => this.app.browserWindow.show()) //Vuelve a prender
                .then(() => Q.delay(C.DELAY_KEY))
                .then(() => levels());
        });
    }

    if (true) {
        it('should do history', function() {
            this.timeout(120000);

            var win = this.app.client.windowByIndex(0);

            var history = (type, exp, exp2) => {
                return win
                    .keys(type)
                    .then(() => Q.delay(C.DELAY_KEY))
                    .then(() => this.app.client.windowByIndex(0).getText(C.RULE_HIGHLIGHTTED_POINTS))
                    .then(val => assert.equal(val, exp))
                    .then(() => this.app.client.windowByIndex(0).getText(C.RULE_HIGHLIGHTTED_POINTSK))
                    .then(val => assert.equal(val, exp2))
                    .then(() => Q.delay(C.DELAY_KEY))
                    .then(() => win.keys(C.ENTER_KEY))
                    .then(() => Q.delay(C.DELAY_KEY))
                    .then(() => win.keys(C.BACKSPACE_KEY))
                    .then(() => Q.delay(C.DELAY_KEY));
            };

            var firePoints = 2; //Ya se disparó la rule dos veces en "levels"

            return history('chang', 0 + firePoints, 0)
                .then(() => history('chang', 1 + firePoints, 1))
                .then(() => history('chang', 2 + firePoints, 2))
                .then(() => history('chang', 3 + firePoints, 3));
        });
    }

    if (true) {
        it('should do get conext menú & hidden search', function() {
            this.timeout(120000);

            var win = this.app.client.windowByIndex(0);

            var conext = (text, expect1, expect2) => {
                return win
                    .then(() => Q.delay(C.DELAY_KEY))
                    .then(() => win.keys(text))
                    .then(() => Q.delay(C.DELAY_KEY))
                    .then(() => win.keys(C.CTRL_KEY))
                    .then(() => win.keys(C.ENTER_KEY))
                    .then(() => Q.delay(C.DELAY_KEY))
                    .then(() => this.app.client.windowByIndex(0).getText(C.RULE_HIGHLIGHTTED_TITLE))
                    .then(val => assert.equal(val, expect1))
                    .then(() => Q.delay(C.DELAY_KEY))
                    .then(() => win.keys(C.CTRL_KEY))
                    .then(() => Q.delay(C.DELAY_KEY))
                    .then(() => (expect2 ? win.keys(C.DOWN_KEY) : Q.delay(1)))
                    .then(() => Q.delay(C.DELAY_KEY)) //KTODO: Revisar el clipboard directo
                    .then(() => this.app.client.windowByIndex(0).getText(C.RULE_HIGHLIGHTTED_TITLE))
                    .then(val => (expect2 ? assert.equal(val, expect2) : Q.delay(1)));
            };

            return conext('XXX', 'Place Text', 'Copy to clipboard') //Test in hidden search
                .then(() => Q.delay(C.DELAY_KEY))
                .then(() => win.keys(C.ESCAPE_KEY))
                .then(() => Q.delay(C.DELAY_KEY))
                .then(() => win.keys(C.ESCAPE_KEY))
                .then(() => conext('change1', 'Change to Path1')); //Test in no conext
        });
    }

    if (true) {
        it('should do go to root & empty', function() {
            this.timeout(120000);

            var win = this.app.client.windowByIndex(0);

            var goroot = () => {
                return win
                    .getText('#levelSize')
                    .then(() => win.keys('asynctest'))
                    .then(() => Q.delay(C.DELAY_KEY))
                    .then(() => win.keys(C.ENTER_KEY))
                    .then(() => Q.delay(C.DELAY_KEY))
                    .then(() => Q.delay(3000))
                    .then(() => win.keys('loa'))
                    .then(() => Q.delay(C.DELAY_KEY * 2))
                    .then(() => win.keys('Shift'))
                    .then(() => win.keys('Backspace'))
                    .then(() => Q.delay(C.DELAY_KEY * 2))
                    .getHTML('.level_root')
                    .then(val => assert.equal(val.length > 0, true));
            };

            return goroot();
        });
    }
});
