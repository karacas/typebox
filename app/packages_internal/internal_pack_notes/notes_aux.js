const { normalicePath, removeDiacritics, get } = require('@aux/aux_global.js');
const fs = require('fs');
const humanizeUrl = require('humanize-url');
const filenamify = require('filenamify');
const sanitizefilename = require('sanitize-filename');
const path = require('path');

const data2icon = _note_icon => {
   if (!_note_icon || _note_icon === 'null') return null;
   let data_icon = null;

   if (typeof _note_icon === 'string' && _note_icon.length > 0 && _note_icon != 'null') {
      const FileTmp = normalicePath(_note_icon, true);
      const isFile = fs.existsSync(FileTmp);
      _note_icon = !isFile
         ? {
              type: 'iconFont',
              value: _note_icon,
           }
         : {
              type: 'iconSrc',
              value: FileTmp,
           };
   }

   if (!_note_icon.value || _note_icon.value == 'null') {
      data_icon = null;
   } else {
      if (_note_icon.type === 'iconSrc') {
         data_icon = normalicePath(_note_icon.value, true);
      } else if (_note_icon.type === 'auto' || _note_icon.type === 'iconAdv') {
         data_icon = _note_icon.value;
      } else if (!_note_icon.type || _note_icon.type === 'iconFont') {
         data_icon = {
            type: 'iconFont',
            iconClass: _note_icon.value,
            styleColor: _note_icon.styleColor || null,
            placedby: _note_icon.placedby || null,
         };

         if (!data_icon.styleColor) {
            data_icon.iconClassColor = _note_icon.iconClassColor || 'accentColor';
         }
      }
   }

   return data_icon;
};

const data2tags = (_note_icon, internaltags) => {
   let noteTags = get(_note_icon, 'params.mode') || [];

   if (!_note_icon) return noteTags;

   let modeTag = get(_note_icon, 'params.mode').toLowerCase();
   if (modeTag === 'htmlmixed') modeTag = 'html';

   let typeTag = get(_note_icon, 'params.mode').toLowerCase();

   internaltags = [...internaltags, ...[typeTag, modeTag, 'note']];

   let sumTags = [...new Set([...(internaltags || []), ...noteTags])].filter(Boolean && String);

   sumTags = sumTags
      .filter(tag => {
         return tag && tag.length > 2 && tag !== 'auto' && tag !== 'null' && tag !== 'text';
      })
      .map(tag => {
         return `#${tag.toLowerCase()}`;
      })
      .join(' ');

   return sumTags;
};

const normaliceFile = fileName => {
   if (!fileName) return;
   return fileName
      .replace(/[.]{2,}/g, '.')
      .replace(/\s/g, '_')
      .replace(/[_]{2,}/g, '_')
      .toLowerCase();
};

const title2file = $title => {
   if (!$title) return;

   let _file = removeDiacritics($title)
      .replace(/[&\/\\#,+$~%'":*?<>{}\[\]]/g, '_')
      .replace(/\./g, '_');
   _file = filenamify(_file);
   _file = sanitizefilename(_file);
   _file = normaliceFile(_file);

   if (!_file || _file.length < 1 || _file === '_') _file = NEW_NOTE_STR;

   return _file.toLowerCase();
};

const compactUrl = _url => {
   if (!_url) return;
   _url = humanizeUrl(_url).replace(/(\?|\&)([^=]+)\=([^&]+)/g, '');
   return _url;
};

module.exports.data2icon = data2icon;
module.exports.data2tags = data2tags;
module.exports.normaliceFile = normaliceFile;
module.exports.title2file = title2file;
module.exports.compactUrl = compactUrl;
