'use strict';

const _ = require('electron').remote.require('lodash');
const mathjs = require('mathjs');

var generateStaticRule = rule => {
    return {
        title: rule.title,
        icon: rule.icon,
        path: rule.path,
        params: rule.params,
        type: ['string']
    };
};

module.exports = {
    init() {
        this.app.on('changeQuery', txt => {
            var rulesPath = this.app.getPath().path;

            var calcIcon = {
                type: 'iconSvg',
                iconData: "<svg xmlns='http://www.w3.org/2000/svg' version='1' viewBox='0 0 48 48'><path fill='#616161' d='M40 16H8v24c0 2.2 1.8 4 4 4h24c2.2 0 4-1.8 4-4V16z'/><path fill='#424242' d='M36 4H12C9.8 4 8 5.8 8 8v9h32V8c0-2.2-1.8-4-4-4z'/><path fill='#9CCC65' d='M36 14H12c-.6 0-1-.4-1-1V8c0-.6.4-1 1-1h24c.6 0 1 .4 1 1v5c0 .6-.4 1-1 1z'/><path fill='#33691E' d='M33 10h2v2h-2zm-4 0h2v2h-2z'/><path fill='#FF5252' d='M36 23h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1z'/><path fill='#E0E0E0' d='M15 23h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1zm7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1zm7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1zm-14 6h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1zm7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1zm7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1zm-14 6h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1zm7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1zm7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1zm-14 6h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1zm7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1zm7 0h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1z'/><path fill='#BDBDBD' d='M36 29h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1zm0 6h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1zm0 6h-3c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1z'/></svg>"
            };

            if (txt.length > 2 && (rulesPath === '/' || rulesPath === this.name)) {
                let exp = null;
                try {
                    exp = mathjs.eval(txt);
                    if (String(exp).includes('function')) {
                        exp = null;
                    }
                } catch (e) {}

                if (exp !== null && exp !== Number(txt)) {
                    this.app.setRules([
                        {
                            title: txt + ' = ' + exp,
                            addInHistory: false,
                            hidden_permit: false,
                            persistFuzzy: true,
                            path: this.name,
                            icon: calcIcon,
                            generateStaticRule: generateStaticRule,
                            params: {
                                string: String(exp)
                            }
                        }
                    ]);
                    //Hystory Rules
                    this.app.addRules(
                        this.app.getlastItemsPath(this.name).map($last => {
                            let last = _.clone($last);
                            last.title = '[ Hystory ] ' + last.title;
                            last.persistFuzzy = true;
                            last.addInHistory = false;
                            last.fav_permit = false;
                            last.favorite = false;
                            last.path = this.name;
                            return last;
                        })
                    );
                    this.app.setPath({
                        path: this.name,
                        icon: calcIcon,
                        name: 'calc',
                        keepQueryValue: true
                    });
                } else {
                    this.app.deleteRules();
                }
            }

            if (!txt.length && rulesPath === this.name) {
                this.app.deleteRules();
                this.app.setPath('/');
            }
        });
    }
};
