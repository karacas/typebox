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
                            context.copyToClipboard(obj.rule.params.string || obj.rule.title, !(obj.event && obj.event.shiftKey));
                            return;
                        }
                        context.writeString(obj.rule.params.string || obj.rule.title);
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
                        context.copyToClipboard(obj.rule.params.string || obj.rule.title, !(obj.event && obj.event.shiftKey));
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
                let str = textToHTML(_.result(rule, 'params.plain_code') || _.result(rule, 'params.snippet') || _.result(rule, 'params.string') || rule.title);
                resolve({
                    component: context.createComponentFromHtml('<div class="extraMargin"><code class="noBack word-wrap big">' + str + '</code></"div">')
                });
            });
            return [
                {
                    type: 'string',
                    title: 'String Viewer',
                    enabled: obj => {
                        return obj.type[0] === 'string' && _.result(obj, 'params.string') && _.result(obj, 'params.string') !== obj.title;
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
