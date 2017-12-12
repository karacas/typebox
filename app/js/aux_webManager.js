'use strict';

const _ = require('lodash');
const isUrl = require('is-url');
const opn = require('opn');
const cheerio = require('cheerio');
const sanitizeHtml = require('sanitize-html');
const sharedData = require('../js/sharedData.js');
const Logger = require('../js/logger.js');
const Config = require('../js/config.js');
const ListViewStore = require('../js/listViewStore.js');

function openUrl(item, close = true) {
    let pathItem = _.get(item, 'rule.params.openUrl') || item;

    if (!(pathItem && isUrl(pathItem))) {
        Logger.warn('Not have url', item);
        return;
    }

    opn(pathItem).then(() => {
        if (Config.get('here_are_dragons.gotoRootOnExec') && close) {
            sharedData.app_window_and_systray.unpopWin();
            ListViewStore.storeActions.backRootRulesPath();
        }
    });
}

function replaceHrefs(i, elem, base) {
    let href = elem.attribs.href;
    if (href && base && !String(href).includes('://')) {
        href = base + String('/' + href).replace('//', '/');
    }
    if (href) {
        //KTODO: Armar otra función que centralice la generación de onclick
        elem.attribs.onclick = "require('../app/js/aux_webManager.js').openUrl('" + href + "', false)";
    }
    delete elem.attribs['href'];
}

function replaceHtmlHrefs(html, base) {
    let $ = cheerio.load(html);
    $('[href]').each((i, elem) => replaceHrefs(i, elem, base));
    return $.html();
}

function replaceSrc(i, elem, base) {
    let src = elem.attribs.src;
    if (src && base && !String(src).includes('://')) {
        src = base + String('/' + src).replace('//', '/');
        elem.attribs.src = src;
    }
}

function replaceHtmlSrc(html, base) {
    let $ = cheerio.load(html);
    $('[src]').each((i, elem) => replaceSrc(i, elem, base));
    return $.html();
}

module.exports.openUrl = openUrl;
module.exports.replaceHtmlHrefs = replaceHtmlHrefs;
module.exports.replaceHrefs = replaceHrefs;
module.exports.replaceHtmlSrc = replaceHtmlSrc;
module.exports.replaceSrc = replaceSrc;
module.exports.sanitizeHtml = sanitizeHtml;
