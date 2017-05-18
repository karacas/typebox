const Application = require("spectron").Application;
const electron = require("electron");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const rimraf = require("rimraf");
const Q = require("q");
const path = require("path");

const appPath = path.resolve(__dirname, "../."); //require the whole thing
const settings = "--user_settings_file=_test/_data/user/user_settings.json";

var electronPath = path.resolve(__dirname, "../node_modules/.bin/electron");
if(process.platform === 'win32'){
    electronPath += ".cmd"
}

function deleteHistory(done = function() {}) {
    rimraf(path.resolve(__dirname, "../_test/_data/history/*"), () => {
        rimraf(path.resolve(__dirname, "../_test/_data/favorites/*"), done);
    });
}

global.before((done) => {
    chai.should();
    chai.use(chaiAsPromised);
    deleteHistory(done);
});


global.after((done) => {
    deleteHistory(done);
});


beforeEach(function() {

this.timeout(120000);



this.app = new Application({
    path: electronPath,
    args: [appPath, settings]
});

return this.app.start().then(() => {
    return this.app.electron.remote.getGlobal("sharedObj").then((sharedObj) => {
        global.appSettings = sharedObj.settings;
        return this.app.browserWindow.show().then(() => {
            return Q.delay(1000).then(() => {
                chaiAsPromised.transferPromiseness = this.app.transferPromiseness;
                return this.app;
            });
        });
    });

});
});


afterEach(function() {
if (this.app && this.app.isRunning()) {
    return this.app.stop();
}
});