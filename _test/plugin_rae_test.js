// http://webdriver.io/api/action/addValue.html
require('./hooks');
const C = require('./inc_const.js');
const Q = require("q");
const assert = require('chai').assert;


describe('RAE tests', function() {

    if (true) {
        it('should do RAE', function() {

            this.timeout(120000)

            const RAE_TEXT = "rae"

            var win = this.app.client.windowByIndex(0)
            var init = false
            var timeLoading = 3000

            var RAE = (exp, res, $del = true) => {
                // console.log(exp, res);
                return win.keys(exp)
                    .then(() => Q.delay(C.DELAY_KEY))
                    .then(() => win.getText(C.RULE_HIGHLIGHTTED_TITLE).should.eventually.equal(res))
                    .then(() => $del ? win.keys(C.ESCAPE_KEY) : Q.delay(1))
                    .then(() => $del ? Q.delay(2000) : Q.delay(1))
                    .then(() => win.getText("#totalTime"))
                    .then((totalTime) => console.log("       ", exp, res, totalTime))
            }

            return win.keys(RAE_TEXT)
                .then(() => Q.delay(C.DELAY_KEY)).then(() => win.keys(C.ENTER_KEY))
                .then(() => Q.delay(timeLoading))
                .then(() => RAE('c', 'c'))
                .then(() => RAE('ca', 'ca'))
                .then(() => RAE('camino', 'camino'))
                .then(() => RAE('c', 'c', false))
                .then(() => RAE('a', 'ca', false))
                .then(() => RAE('m', 'cama', false))
                .then(() => RAE('i', 'camio', false))
                .then(() => RAE('n', 'camino', false))
                .then(() => RAE('o', 'camino', false))
        });
    }

});