'use strict';

const _ = require('lodash');
const isUrl = require('is-url');
const sharedData = require('../../sharedData.js');
const Config = require('../../config.js');
const { bindKet2actualOs, getKeyFromConfig } = require('../../../auxfs.js');
const Logger = require('../../logger.js');
const aux_webManager = require('../../aux_webManager.js');

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
                        return Boolean(context.getRobotJs);
                    },
                    exectFunc: obj => {
                        if (!Boolean(context.getRobotJs)) {
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
        }
    };
};
