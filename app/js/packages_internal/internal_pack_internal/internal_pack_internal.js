'use strict';

const _ = require('lodash');
const isUrl = require('is-url');
const sharedData = require('../../sharedData.js');
const Config = require('../../config.js');
const { bindKet2actualOs, getKeyFromConfig } = require('../../../auxfs.js');
const Logger = require('../../logger.js');
const aux_webManager = require('../../aux_webManager.js');

let robot = null;

try {
    robot = require('robotjs');
} catch (e) {}

function textToHTML(text) {
    return ((text || '') + '') // make sure it is a string;
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\t/g, '    ')
        .replace(/ /g, '&#8203;&nbsp;&#8203;')
        .replace(/\r\n|\r|\n/g, '<br />');
}

function escapeCodeHTML(text) {
    return ((text || '') + '') // make sure it is a string;
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\t/g, '    ')
        .replace(/ /g, '&#8203;&nbsp;&#8203;');
}

function ruleIfCode(rule) {
    if (!rule) return false;
    return !!(
        _.get(rule, 'type').includes('snippet') ||
        _.get(rule, 'type').includes('plain_code') ||
        _.get(rule, 'params.codeclass') ||
        _.get(rule, 'params.snippet') ||
        _.get(rule, 'params.plain_code')
    );
}

module.exports = context => {
    return {
        init() {
            context.on('quit', txt => {
                context.logger.info('      App QUIT OK', txt);
                context.logger.info('\r\n\r\n\r\n', '   _____________________________________________   ', '\r\n\r\n\r\n');
            });
        },
        defineTypeExecutors() {
            return [
                {
                    title: 'Place Text',
                    type: 'string',
                    id: 'internal_pack_place_string',
                    description: '[ shortcut: ' + getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'ENTER') + ' ]',
                    icon: {
                        iconClass: 'mdi-pencil-box small_ico'
                    },
                    enabled: obj => {
                        return Boolean(robot);
                    },
                    exectFunc: obj => {
                        if (!Boolean(robot)) {
                            context.copyToClipboard(
                                _.get(obj, 'rule.params.string') ||
                                    _.get(obj, 'rule.params.snippet') ||
                                    _.get(obj, 'rule.params.plain_code') ||
                                    _.get(obj, 'rule.title'),
                                !(obj.event && obj.event.shiftKey)
                            );
                            return;
                        }
                        context.writeString(
                            _.get(obj, 'rule.params.string') ||
                                _.get(obj, 'rule.params.snippet') ||
                                _.get(obj, 'rule.params.plain_code') ||
                                _.get(obj, 'rule.title')
                        );
                    }
                },
                {
                    title: 'Copy to clipboard',
                    type: 'string',
                    description: '[ shortcut: ' + getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'COPY_STRING') + ' ]',
                    id: 'internal_pack_copy_text',
                    icon: {
                        iconClass: 'mdi-paperclip small_ico'
                    },
                    exectFunc: obj => {
                        context.copyToClipboard(
                            _.get(obj, 'rule.params.string') ||
                                _.get(obj, 'rule.params.snippet') ||
                                _.get(obj, 'rule.params.plain_code') ||
                                _.get(obj, 'rule.title'),
                            !(obj.event && obj.event.shiftKey)
                        );
                    }
                },
                {
                    title: 'Open in browser',
                    id: 'internal_pack_open_in_browser',
                    icon: {
                        iconClass: 'mdi-web small_ico'
                    },
                    type: 'object',
                    enabled: obj => {
                        return obj && obj.params && obj.params.openUrl && isUrl(obj.params.openUrl);
                    },
                    exectFunc: aux_webManager.openUrl
                }
            ];
        },
        defineTypeViewers() {
            const viewerComp = context.createViewerHtml({}, (resolve, reject, rule) => {
                let isCode = ruleIfCode(rule);
                let codeClass = 'noBack word-wrap';

                let str = _.get(rule, 'params.plain_code') || _.get(rule, 'params.snippet') || _.get(rule, 'params.string') || rule.title;
                let html = '';

                if (isCode) {
                    codeClass = codeClass + ' ' + (_.get(rule, 'params.codeclass') || '');
                    codeClass = codeClass + ' ' + 'preWhiteSpace';
                    codeClass = codeClass + ' ' + 'formatCode';
                    codeClass = codeClass + ' ' + 'big';
                    str = escapeCodeHTML(str);
                    html = '<pre class="noBack"><code class="' + codeClass + '">' + str + '</code></pre>';
                } else {
                    str = textToHTML(str);
                    html = '<span class="' + codeClass + '"><code>' + str + '</code></span>';
                }

                let html_res = '<div class="">' + html + '</"div">';

                resolve({ component: context.createComponentFromHtml(html_res) });
            });
            return [
                {
                    type: 'string',
                    title: 'String Viewer',
                    enabled: obj => {
                        return (
                            _.get(obj, 'params.snippet') ||
                            _.get(obj, 'params.plain_code') ||
                            (obj.type[0] === 'string' && _.get(obj, 'params.string') && _.get(obj, 'params.string') !== obj.title)
                        );
                    },
                    viewerComp: viewerComp
                },
                {
                    type: 'snippet',
                    title: 'snippet Viewer',
                    viewerComp: viewerComp
                },
                {
                    type: 'plain_code',
                    title: 'code Viewer',
                    viewerComp: viewerComp
                }
            ];
        }
    };
};
