'use strict';

const isUrl = require('is-url');
const DOMPurify = require('dompurify');

const sharedData = require('@render/shared_data.js');
const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const ListViewStore = require('@render/list_view_store.js');
const shell = require('electron').remote.shell;
const aux_viewer = require('@render/aux_viewer.js');
const { aux_getDirName, normalicePath, get, cloneDeep } = require('@aux/aux_global.js');
const { gotoRootOnExec } = require('@render/aux_executor.js');

let cheerio = null;

function openUrl(item, close = true) {
   let pathItem = get(item, 'rule.params.openUrl') || item;

   if (!(pathItem && isUrl(pathItem))) {
      Logger.warn('Not have url', cloneDeep(!!item ? get(item, 'rule') : null));
      return;
   }

   shell.openExternal(pathItem, () => {});

   gotoRootOnExec(close);

   return;
}

function replaceHrefs(i, elem, base) {
   let href = elem.attribs.href;
   if (href && base && !String(href).includes('://')) {
      href = base + String(`/${href}`).replace('//', '/');
   }
   if (href) {
      //KTODO: Armar otra función que centralice la generación de onclick
      elem.attribs.onclick = `require('@main/app/js/aux_web_manager.js').openUrl('${href}', false)`;
   }
   delete elem.attribs['href'];
}

function replaceHtmlHrefs(html, base) {
   let $ = require('cheerio').load(html);
   $('[href]').each((i, elem) => replaceHrefs(i, elem, base));
   const result = $.html();
   $ = null;
   return result;
}

function replaceSrc(i, elem, base) {
   let src = elem.attribs.src;
   if (src && base && !String(src).includes('://')) {
      src = base + String(`/${src}`).replace('//', '/');
      elem.attribs.src = src;
   }
}

function replaceHtmlSrc(html, base) {
   let $ = require('cheerio').load(html);
   $('[src]').each((i, elem) => replaceSrc(i, elem, base));
   const result = $.html();
   $ = null;
   return result;
}

module.exports.openUrl = openUrl;
module.exports.isUrl = isUrl;
module.exports.replaceHtmlHrefs = replaceHtmlHrefs;
module.exports.replaceHrefs = replaceHrefs;
module.exports.replaceHtmlSrc = replaceHtmlSrc;
module.exports.replaceSrc = replaceSrc;
module.exports.sanitizeHtml = aux_viewer.sanitizeHTML;
