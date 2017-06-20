// http://webdriver.io/api/action/addValue.html
require('./hooks');
const C = require('./inc_const.js');
const Q = require('q');
const assert = require('chai').assert;

describe('Calc tests', function() {
    if (true) {
        it('should do Math', function() {
            this.timeout(120000);

            const EQ = ' = ';
            var win = this.app.client.windowByIndex(0);

            // console.log(global.appSettings);

            var makeMath = (exp, res) => {
                return win
                    .keys(exp)
                    .then(() => Q.delay(C.DELAY_KEY * 1.5))
                    .then(() => win.getText(C.RULE_HIGHLIGHTTED_TITLE).should.eventually.equal(exp + EQ + res))
                    .then(() => Q.delay(C.DELAY_KEY * 1.5));
            };

            return makeMath('1+1', '2')
                .then(() => win.keys(C.ESCAPE_KEY))
                .then(() => Q.delay(C.DELAY_KEY))
                .then(() => makeMath('1+10', '11'))
                .then(() => win.keys(C.ESCAPE_KEY))
                .then(() => Q.delay(C.DELAY_KEY))
                .then(() => makeMath('10*10', '100'));
        });
    }
});
