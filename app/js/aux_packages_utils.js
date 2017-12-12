const path = require('path');
const fs = require('fs');

const Inferno = require('inferno');
const InfCreateClass = require('inferno-create-class');
const createElement = require('inferno-create-element');

const aux_getDirName = require('../auxfs.js').aux_getDirName;

const getString = file => {
    if (file) {
        try {
            let string = fs.readFileSync(file, 'utf8');
            if (string) {
                return string;
            }
        } catch (e) {
            console.warn(e);
        }
    }
    console.warn(file, 'not found');
    return '';
};

const getFileBase64 = file => {
    if (file) {
        try {
            let bitmap = fs.readFileSync(file);
            if (bitmap) {
                return new Buffer(bitmap).toString('base64');
            }
        } catch (e) {
            console.warn(e);
        }
    }
    console.warn(file, 'not found');
    return null;
};

const iconFile2icontype = file => {
    let fileBase = getFileBase64(file);
    let icon = fileBase ? 'data:image/png;base64,' + fileBase : '';
    if (fileBase) {
        return {
            type: 'iconSrc',
            iconData: icon
        };
    } else {
        return null;
    }
};

const inferno_svelete = opt => {
    //KTODO: https://github.com/jihchi/react-svelte-components/blob/master/index.js
    return InfCreateClass({
        initialize: function(node) {
            if (!node || !opt || !opt.component) return;
            var App = opt.component;
            this._instance = new App({
                target: node,
                data: Object.assign({}, this.props, opt.data || {})
            });
            if (opt.onInstance) opt.onInstance(this._instance);
        },
        componentWillUnmount: function() {
            this._instance.teardown();
            this._instance.destroy();
        },
        componentWillReceiveProps(nextProps) {
            this._instance.set(nextProps);
        },
        shouldComponentUpdate: function() {
            return false;
        },
        render: function() {
            return createElement('div', { ref: this.initialize });
        }
    });
};

module.exports = { getString, aux_getDirName, getFileBase64, iconFile2icontype, inferno_svelete };
