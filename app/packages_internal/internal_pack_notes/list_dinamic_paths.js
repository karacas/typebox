const Logger = require('@render/logger.js');
const Config = require('@render/config.js');
const { textToHTML, escapeCodeHTML, get, cloneDeep, debounce, mergeObj } = require('@aux/aux_global.js');
const fs = require('fs');
const nanoid = require('nanoid');
const { promisify } = require('util');
const { data2icon } = require('./notes_aux.js');

const TB_NOTES_PATH_PREFIX = 'TB_NOTES_PATH';
let initiated = false;
let path_notes = null;
let packageConfig = null;
let userDB = null;
let cacheDB = null;
let cachePaths = null;

const DIN_PATHS = [{ value: 'null', label: 'None', id: 'null', internal: true }];
const PATH_ROOT = [{ value: '/', label: 'Root', id: 'ROOT', internal: true }];

const resetCaches = () => {
   cacheDB = null;
   cachePaths = null;
};

const get_note_paths = () => {
   if (!initiated) return;
   if (!cacheDB) cacheDB = cloneDeep([...new Set([...(userDB && userDB.length ? userDB : []), ...DIN_PATHS, ...PATH_ROOT])]);
   return cacheDB;
};

const get_note_paths_by_id = ($id = 'null') => {
   if (!initiated) return;

   if ($id.id) $id = $id.id;
   if (typeof $id !== 'string') $id = 'null';

   return get_note_paths().find(fol => $id === fol.id) || get_note_paths_by_id('null');
};

const get_note_value_paths_by_id = ($id = 'null') => {
   if (!initiated) return;
   return get_note_paths_by_id($id).value;
};

const loadUserPaths = async $path_notes => {
   if (!$path_notes) return false;

   let data = null;
   try {
      data = await promisify(fs.readFile)($path_notes, 'utf8');
      if (data) data = (JSON.parse(data) || {}).paths;
      if (data)
         data = data.map(obj => {
            return {
               ...obj,
               value: TB_NOTES_PATH_PREFIX + obj.id,
            };
         });
   } catch (e) {
      logger.warn('[internal_pack_notes] path_notes readFile fail', e, $path_notes);
   }

   userDB = data && data.length ? data : [];
};

const getPaths = () => {
   if (!initiated) return;
   if (!cachePaths) {
      cachePaths = userDB.map(obj => {
         let icon = data2icon(obj.icon) || packageConfig.defaultIconDinPath;
         let label = obj.label;
         return {
            title: label,
            icon: icon,
            type: [TB_NOTES_PATH_PREFIX],
            viewer: false,
            params: {
               changePath: {
                  name: label,
                  path: TB_NOTES_PATH_PREFIX + obj.id,
                  icon: icon,
                  // sortByNoRules: 'params._note_creationDate',
                  // sortReverseNoRules: true,
                  checkNews: true,
               },
            },
            new_permit: false,
            last_permit: false,
         };
      });
   }
   return cachePaths;
};

const noteIsOnPath = (note, $path) => {
   if (!note || !$path) return false;
   let folders = getRuleFolders(note);
   if (!folders || !folders.length) return false;
   return folders.map(get_note_value_paths_by_id).includes($path);
};

const getRuleFolders = noteRule => {
   let folders = null;
   if (!noteRule) return folders;

   const note_folder = get(noteRule, 'params._note_folder');
   if (!note_folder || note_folder == 'null' || note_folder === 'default') return folders;

   if (Array.isArray(note_folder)) {
      folders = note_folder;
   } else if (typeof note_folder === 'string') {
      if (note_folder.indexOf(',') === -1) {
         folders = [note_folder];
      } else {
         folders = note_folder.replace(/[.,\s]/g, ',').split(',');
      }
   }

   return folders;
};

const init = async $packageConfig => {
   if (initiated || !$packageConfig) return;
   packageConfig = cloneDeep($packageConfig);
   path_notes = packageConfig.path_notes + packageConfig.file_dinamic_paths; //C:/Users/der2/AppData/Roaming/typebox/_data/typebox_notes/
   resetCaches();
   await loadUserPaths(path_notes);
   initiated = true;
   return true;
};

module.exports.get_note_paths = get_note_paths;
module.exports.get_note_paths_by_id = get_note_paths_by_id;
module.exports.get_note_value_paths_by_id = get_note_value_paths_by_id;
module.exports.getPaths = getPaths;
module.exports.noteIsOnPath = noteIsOnPath;
module.exports.getRuleFolders = getRuleFolders;
module.exports.TB_NOTES_PATH_PREFIX = TB_NOTES_PATH_PREFIX;
module.exports.PATH_ROOT = PATH_ROOT;
module.exports.init = init;
