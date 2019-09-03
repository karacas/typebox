const { get, cloneDeep } = require('@aux/aux_global.js');
const isurl = require('is-url');
const fs = require('fs');
let detectLang = null;

const NOTE_TYPES = [
   { value: 'auto', label: 'Auto' },
   { value: 'text', label: 'Text' },
   { value: 'snippet', label: 'Snippet' },
   { value: 'markdown', label: 'Markdown', ext: 'md' },
   { value: 'html', label: 'Html', ext: 'html' },
   { value: 'file', label: 'File' },
   { value: 'url', label: 'Url' },
   { value: 'command', label: 'Command' },
   { value: 'jscommand', label: 'JS Script', ext: 'js' },
   { value: 'jsx', label: 'JSX', ext: 'jsx' },
];

const get_note_type = ($value = 'auto') => {
   if ($value && $value.value) $value = $value.value;
   if (typeof $value !== 'string') return get_note_type();

   return cloneDeep(NOTE_TYPES.find(e => e.value === $value.toLowerCase()) || get_note_type());
};

//KTODO simplificar con NOTE_TYPES
const set_mode_by_type = $type => {
   if (!$type) return 'null';
   if ($type.value) $type = $type.value;
   if (typeof $type !== 'string') return 'null';

   $type = $type.toLowerCase();

   if ($type === 'auto') return 'null';
   if ($type === 'text') return 'null';
   if ($type === 'markdown') return 'markdown';
   if ($type === 'html') return 'htmlmixed';
   if ($type === 'file') return 'null';
   if ($type === 'url') return 'null';
   if ($type === 'command') return 'shell';
   if ($type === 'jscommand') return 'javascript';
   if ($type === 'jsx') return 'jsx';

   return 'null';
};

//KTODO simplificar con NOTE_TYPES
const set_linewrapping_by_type = $type => {
   if (!$type) return null;
   if ($type.value) $type = $type.value;
   if (typeof $type !== 'string') return null;

   $type = $type.toLowerCase();

   if ($type === 'auto') return true;
   if ($type === 'text') return true;
   if ($type === 'markdown') return true;
   if ($type === 'html') return null;
   if ($type === 'snippet') return null;
   if ($type === 'file') return true;
   if ($type === 'url') return true;
   if ($type === 'command') return true;
   if ($type === 'jscommand') return true;
   if ($type === 'jsx') return true;

   return null;
};

const check_auto_type = data => {
   let _type_value = 'auto';
   let haveData = true;
   let finded = false;
   let isOneLine = false;
   let superLengthData = data && data.length > 250 * 1024;
   let medLengthData = false;
   let lowLengthData = false;
   let superLowLengthData = false;
   let forceMode = null;
   let firstLine = '';

   if (!data || typeof data !== 'string' || data.length < 2 || superLengthData) {
      haveData = false;
      finded = true;
   }

   if (haveData) {
      firstLine = data.split('\n')[0];
      isOneLine = firstLine && firstLine === data;
      medLengthData = data.length > 128;
      lowLengthData = data.length > 32;
      superLowLengthData = data.length < 12;

      //CHECK URL
      if (!finded && isOneLine && isurl(data)) {
         _type_value = 'url';
         forceMode = 'null';
         finded = true;
      }

      //CHECK FILE
      if (!finded && isOneLine && fs.existsSync(data)) {
         _type_value = 'file';
         forceMode = 'null';
         finded = true;
      }

      //CHECK COMMAND
      if (!finded && isOneLine && (data.indexOf('start') === 0 || data.indexOf('cmd') === 0)) {
         _type_value = 'command';
         forceMode = 'shell';
         finded = true;
      }

      //CHECK JSON
      try {
         if (!finded && JSON.parse(data)) {
            _type_value = 'snippet';
            forceMode = 'javascript';
            finded = true;
         }
      } catch (e) {}

      //CHECK JS CODE
      if (!finded && firstLine.indexOf('use strict') !== -1) {
         _type_value = 'snippet';
         forceMode = 'javascript';
         finded = true;
      }

      //CHECK MINI TEXT
      if (superLowLengthData) {
         _type_value = 'text';
         forceMode = 'null';
         finded = true;
      }

      //TXT - RATIO OF VALID CHARS
      if (!finded) {
         const validChars = (data.match(/[0-9A-Za-z\s\-]/g) || []).length || 1;
         let ratio = validChars / data.length;
         if (ratio > 0.94) {
            _type_value = 'text';
            forceMode = 'null';
            finded = true;
         }
      }

      //CHECK MD
      if (!finded && medLengthData) {
         let testMD = false;

         try {
            testMD = testMD || /(#+)(.*)/g.test(firstLine); /*TITLE MD*/
            testMD = testMD || /`(.*?)`/g.test(data); /*CODE MD*/
            testMD = testMD || (data.indexOf('```') != -1 && data.split('```').length > 2); /*CODE snippet*/
            testMD = testMD || /\[(.+)\]\(([^ ]+)( "(.+)")?\)/g.test(data); /*LINK MD*/
            testMD = testMD || /((\[[ x]].*?(\r\n|\r|\n)){1})\[[ x]](.*)/g.test(data); /*LINK2 MD*/
            testMD = testMD || /(\|[^\n]+\|\r?\n)((?:\|:?[-]+:?)+\|)(\n(?:\|[^\n]+\|\r?\n?)*)/g.test(data); /*TABLE MD*/

            if (testMD) {
               _type_value = 'markdown';
               forceMode = 'markdown';
               finded = true;
            }
         } catch (e) {}
      }

      //CHECK JS CODE 1
      if (!finded && lowLengthData) {
         let lang = null;

         try {
            detectLang = detectLang || require('lang-detector');
            lang = detectLang(data);
            if (lang) lang = lang.toLowerCase();
         } catch (e) {}

         if (lang && lang !== 'unknown') {
            if (!finded && lang === 'javascript') {
               _type_value = 'snippet';
               forceMode = 'javascript';
               finded = true;
            }
            if (!finded && lang === 'python') {
               _type_value = 'snippet';
               forceMode = 'python';
               finded = true;
            }
            if ((!finded && lang === 'c') || lang === 'c++' || lang === 'java') {
               _type_value = 'snippet';
               forceMode = 'clike';
               finded = true;
            }
            if (!finded && lang === 'html') {
               _type_value = 'snippet';
               forceMode = 'htmlmixed';
               finded = true;
            }
            if (!finded && lang === 'css') {
               _type_value = 'snippet';
               forceMode = 'css';
               finded = true;
            }
            if (!finded && lang === 'php') {
               _type_value = 'snippet';
               forceMode = 'php';
               finded = true;
            }
            if (false && lang === 'go') {
               _type_value = 'snippet';
               forceMode = 'go';
               finded = true;
            }
            if (false && lang === 'ruby') {
               _type_value = 'snippet';
               forceMode = 'ruby';
               finded = true;
            }
         }
      }

      //NO DETECT: PLAIN TEXT
      if (!finded) {
         _type_value = 'text';
         forceMode = 'null';
         finded = true;
      }
   }

   let _type = get_note_type(_type_value);
   let _mode = forceMode || set_mode_by_type(_type);

   return { type: _type, mode: _mode };
};

module.exports.list_types = cloneDeep(NOTE_TYPES);
module.exports.get_note_type = get_note_type;
module.exports.check_auto_type = check_auto_type;
module.exports.set_mode_by_type = set_mode_by_type;
module.exports.set_linewrapping_by_type = set_linewrapping_by_type;
