'use strict';

const { makeHash } = require('@aux/aux_global.js');
const { debounce } = require('lodash');

const lrucache = require('lru-cache');
const Logger = require('@render/logger.js');
const ms = require('ms');
let $highlight = null;
let spawn = null;

const cache_Highlight = new lrucache({ max: 32, maxAge: ms('1h') });

let threadHighlight = null;

let threadHighlightKill = () => {
   if (threadHighlight && threadHighlight.kill) {
      try {
         if (true) Logger.log('[makehighlight] kill');
         threadHighlight.kill();
      } catch (e) {}
      threadHighlight = null;
   }
};

let devounceKill = debounce(threadHighlightKill, ms('30s'));

const definethreadHighlight = () => {
   if (threadHighlight) return;

   Logger.log('[makehighlight] definethreadHighlight');

   spawn = spawn || require('threads').spawn;

   threadHighlight = spawn((obj, done) => {
      if (!obj || !obj.code || !obj.querySelector) done('');

      const highlight = require('highlight.js');
      let $ = require('cheerio').load(obj.code);

      $(obj.querySelector).each(function(i, block) {
         $(this).html(highlight.highlightAuto($(this).text()).value);
         $(this).addClass('hljs');
         if (obj && obj.addclass && obj.addclass.length > 0) {
            obj.addclass.forEach(_class => {
               $(this).addClass(_class);
            });
         }
      });

      done({ html: $.html(), id: obj.id });
      $ = null;
   });
};

function makehighlightSpawn($code, idCode, querySelector = 'code', addclass = []) {
   return new Promise((resolve, reject) => {
      definethreadHighlight();
      setTimeout(() => {
         threadHighlight.send({ code: $code, querySelector, addclass, id: idCode }).on('message', response => {
            if (response && response.id === idCode) {
               if (true) Logger.log('[makehighlight] ok', idCode);
               resolve(response);
            } else {
               resolve('');
            }
            devounceKill();
         });
      });
   });
}

const HighlightNormal = obj => {
   if (!obj || !obj.code || !obj.querySelector) return '';

   $highlight = $highlight || require('highlight.js');
   let $ = require('cheerio').load(obj.code);

   $(obj.querySelector).each(function(i, block) {
      $(this).html($highlight.highlightAuto($(this).text()).value);
      $(this).addClass('hljs');
      if (obj && obj.addclass && obj.addclass.length > 0) {
         obj.addclass.forEach(_class => {
            $(this).addClass(_class);
         });
      }
   });
   let html = $.html();
   $ = null;
   return { html: html, id: obj.id };
};

function makehighlight(code, querySelector = 'code', addclass = []) {
   const $code = code;

   return new Promise((resolve, reject) => {
      if (!$code) {
         resolve($code);
         return;
      }

      const $resolve = response => {
         if (response && response.id && response.html) {
            cache_Highlight.set(response.id, response.html);
            resolve(response.html);
         } else {
            resolve(code);
         }
      };

      const idCode = makeHash(querySelector + addclass.join() + $code);
      const mem = cache_Highlight.get(idCode);

      if (mem) {
         resolve(mem);
         return;
      }
      //Si el código es chiquito no usar spawn
      if ($code.length < 32000) {
         Logger.log('[makehighlight] no spawn');
         $resolve(HighlightNormal({ code: $code, querySelector, addclass, id: idCode }));
         return;
      } else {
         Logger.log('[makehighlight] spawn');
         makehighlightSpawn(code, idCode, querySelector, addclass).then(response => {
            $resolve(response);
         });
      }
   });
}

module.exports = makehighlight;
