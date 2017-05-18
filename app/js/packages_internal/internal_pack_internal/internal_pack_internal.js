'use strict';

const _ = require('lodash');
const isUrl = require('is-url');
const sharedData = require('../../sharedData.js');
const Logger = require('../../logger.js');
const aux_webManager = require('../../aux_webManager.js');

module.exports = {
    init() {
        this.app.on('quit', txt => {
            this.app.logger.info('      App quit ok', txt, '\r\n');
        });
    },
    defineTypeExecutors() {
        return [
            {
                title: 'Place Text',
                type: 'string',
                id: 'internal_pack_place_string',
                icon: {
                    iconClass: 'mdi-pencil-box small_ico'
                },
                exectFunc: obj => {
                    this.app.writeString(obj.rule.params.string || obj.rule.title);
                }
            },
            {
                title: 'Copy to clipboard',
                type: 'string',
                id: 'internal_pack_copy_text',
                icon: {
                    iconClass: 'mdi-paperclip small_ico'
                },
                exectFunc: obj => {
                    this.app.copyToClipboard(obj.rule.params.string || obj.rule.title, !(obj.event && obj.event.shiftKey));
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
