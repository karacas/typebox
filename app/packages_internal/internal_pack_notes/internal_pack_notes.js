'use strict';

const EventEmitter = require('eventemitter3');
const remote = require('electron').remote;
const { globalShortcut, dialog, clipboard } = remote;
const dataExternalEvents = new EventEmitter();
const auxBabel = require('@aux/aux_babel.js');
const { moveFile } = require('@aux/aux_fs.js');
const $debounce = require('lodash').debounce;
const $memoizeDebounce = require('@aux/aux_global.js').memoizeDebounce;
const nanoid = require('nanoid');
const { promisify } = require('util');
const ms = require('ms');
const $pause = time => new Promise(res => setTimeout(res, time || 1));
const parentWindow = remote.getCurrentWindow();

const createRule = require('@render/rule.js').getNewRule;
const { addExpander } = require('@render/expander_manager.js');
const { str2notevil } = require('@render/aux_executor.js');

const favManager = require('@render/fav_manager.js');
const lastRulesManager = require('@render/last_rules_manager.js');
const hiddenRulesManager = require('@render/hidden_rules_manager.js');
const HistoryManager = require('@render/history_manager.js');
const sharedData = require('@render/shared_data.js');
const aux_viewer = require('@render/aux_viewer.js');
const aux_driveManager = require('@render/aux_drive_manager.js');
const aux_webManager = require('@render/aux_web_manager.js');
const aux_crypt = require('@aux/aux_crypt.js');
const isUrl = require('is-url');

const { JSON_parse_async, extendObj, equal } = require('@aux/aux_global.js');
const { list_types, get_note_type, check_auto_type, set_mode_by_type, set_linewrapping_by_type } = require('./list_types.js');
const dinamic_paths = require('./list_dinamic_paths.js');
const { data2icon, data2tags, normaliceFile, title2file, compactUrl } = require('./notes_aux.js');
const viewEvents = sharedData.viewEvents;

let $lrucache = null;
let $path = null;
let $fs = null;
let $getFiles = null;
let $getFile = null;
let $makeHash = null;
let $setRules = null;
let $get = null;
let $watcher = null;
let $isFunction = null;
let $openFile = null;
let $context = null;
let $cloneDeep = null;
let $setFile = null;
let $unusedfilename = null;
let $realClock = null;
let $relativeTime = null;
let $dayjs = null;
let $cache_session = null;
let cache_data_file = null;
let initiated = false;
let logger = null;
let Config = null;
let thisConfig = null;
let defaulticon = null;
let notesDataDb = [];
let fixedOptions = 0;
let _fileWatched = null;
let _watcher = null;
let saveRule = () => {};
let debSaveRule = () => {};
let updateRuleInDB = () => {};
let setRulesFromFiles = () => {};
let registerNewGlobalNote = () => {};
let registerNewGlobalPaste = () => {};
let lastRegisterNewGlobalPaste = null;
let activeWin = null;
let avoidSavedFileTmp = null;
let forceEditViewer = null;

let NEW_NOTE_STR = 'New note';
const TB_NOTES_OBJ = 'TB_NOTES_OBJ';
const USER_WANTS_EDIT = 'USER_WANTS_EDIT';
const TB_NOTES_PATH_PREFIX = dinamic_paths.TB_NOTES_PATH_PREFIX;

let NOTES_PATH_OBJ = {
   name: 'Notes & snippets',
   sortByNoRules: 'params._note_creationDate',
   sortReverseNoRules: true,
   checkNews: true,
};

let NOTES_PATH_OBJ_NEW_ONLY = {
   name: 'Typebox new item',
   checkNews: false,
   avoidHistory: true,
};

const genNewNoteId = () => {
   return `TB_NOTE_v2_${nanoid()}`;
};

const __key_store_map = new Map();
const __setKey = (id, key) => {
   if (!initiated) return null;
   if (!id) {
      logger.warn('[internal_pack_notes] fail store key, no id');
      return null;
   }

   if (key === null) {
      __deletetKey(id);
      return true;
   }

   __key_store_map.set(id, { key });

   return true;
};
const __getKey = id => {
   if (!initiated) return null;
   if (!id) {
      logger.warn('[internal_pack_notes] fail stored key, no id');
      return null;
   }
   const objKey = __key_store_map.get(id);
   if (!objKey || !objKey.key) return null;
   return objKey.key;
};
const __deletetKey = id => {
   if (!initiated) return null;
   if (!id) {
      logger.warn('[internal_pack_notes] fail reset key, no id');
      return null;
   }
   __key_store_map.delete(id);
   return true;
};
let __deleteKeyDeb = null;
let __deleteKeyDebLarge = null;
const __hasKey = id => {
   if (!initiated) return null;
   if (!id) {
      logger.warn('[internal_pack_notes] fail have key, no id');
      return null;
   }
   if (__deleteKeyDebLarge) __deleteKeyDebLarge(id);
   return !!__getKey(id);
};

const getNoteIdFormRule = rule => {
   return rule ? rule._internal_id || null : null;
};

const _encriptAndKey = $rule => {
   if (!$rule) return false;
   const encrypted = !!$get($rule, 'params._note_encrypt');
   if (!encrypted) return true;
   const hasEncryptKey = encrypted && __hasKey(getNoteIdFormRule($rule));
   return hasEncryptKey;
};

const dataStr2title = data => {
   if (!initiated || !data) return;
   let title = data.split('\n')[0];

   if (isUrl(title)) {
      title = compactUrl(title);
   } else {
      title = aux_viewer.html2txt(title);
   }

   let maxAutoTitleSize = thisConfig.maxAutoTitleSize || 20;

   title = title.slice(0, maxAutoTitleSize);

   if (!title || !title.length) title = NEW_NOTE_STR;

   if (title.length >= maxAutoTitleSize) title += '...';

   return title;
};

const getBaseFile = fileName => {
   if (!initiated || !fileName) return;
   fileName = String(fileName);
   fileName = $path.parse(fileName).name;
   fileName = String(fileName)
      .replace(thisConfig.notes_prefix, '')
      .replace(thisConfig.notes_prefix_datafile, '');
   return fileName;
};

const getFileRulePath = (fileName, ext = 'json') => {
   if (!initiated || !fileName) return;

   const pathNotes = thisConfig.path_notes;

   fileName = normaliceFile(fileName);
   fileName = getBaseFile(fileName);

   if (ext[0] === '.') ext = ext.slice(1);

   return $context.normalicePath(`${pathNotes}/${thisConfig.notes_prefix}${fileName}.${ext}`);
};

const getFileDataPath = (fileName, ext) => {
   if (!initiated || !fileName) return;

   const pathNotes = thisConfig.path_notes;

   let _fileName = normaliceFile(fileName);
   fileName = getBaseFile(fileName);

   if (!ext) {
      let $ext = $path.parse(_fileName).ext || 'txt';
      ext = $ext;
   }

   if (ext[0] === '.') ext = ext.slice(1);

   return $context.normalicePath(`${pathNotes}/${thisConfig.notes_prefix_datafile}${fileName}.${ext}`);
};

const __encryptData = async (data, key, type = 'aes256gcm' /*'aes256gcm','triplesec'*/) => {
   if (!initiated || !key) return null;

   if (data === null) {
      logger.warn('[__encryptData] data is null');
      return false;
   }
   data = String(data || '');

   let res = await aux_crypt.encrypt(data, key, type);
   return res;
};

const __decryptData = async (data, key, type = 'aes256gcm' /*'aes256gcm','triplesec'*/) => {
   if (!initiated || !key) return null;

   if (data === null) {
      logger.warn('[__encryptData] data is null');
      return false;
   }

   data = String(data || '');

   let res = await aux_crypt.decrypt(data, key, type);
   return res;
};

const processNotevil = async ($rule, $data, $note_type, param) => {
   if (!$data) return $data;
   if (!$note_type) $note_type = $get($rule, 'params._note_type');

   if ($note_type === 'jscommand') {
      return await str2notevil($rule, $data, param);
   }

   return String($data);
};

const processNoteStr = processNotevil;

const getDataNewRuleRaw = () => {
   return { _internal_id: genNewNoteId(), params: { _note_is_new: true, _note_encrypt: false } };
};

const getDataNewRule = () => {
   return makeRuleFromObj(getDataNewRuleRaw());
};

const saveDataRule = async ($rule, data, async = true) => {
   if (!initiated || $get($rule, 'params._note_is_new')) return;

   if (Config.isDev) console.log('[NTEST] saveDataRule ...');

   let rule = $cloneDeep($rule);

   if (data === null) {
      logger.warn('[internal_pack_notes] saveDataRule / data is null');
      return false;
   }

   data = String(data || '');

   let $file = getDataFile(rule);
   let $fileHash = $makeHash($file);

   const encrypted = !!$get(rule, 'params._note_encrypt');
   const idNote = getNoteIdFormRule(rule);

   if (!idNote) {
      logger.warn('[internal_pack_notes] saveDataRule / no id');
      return false;
   }

   let hasEncryptKey = encrypted && __hasKey(idNote);

   if (hasEncryptKey) {
      let datares = await __encryptData(data, __getKey(idNote));
      if (datares === null) {
         logger.warn('[internal_pack_notes] fail encrypt');
         return false;
      }
      datares = String(datares || '');
      if (Config.isDev) console.log('[NTEST] saveDataRule __encryptData ok ...', 'data.length:', data.length, 'datares.length:', datares.length);
      data = datares;
   } else {
      if (encrypted) {
         logger.warn('[internal_pack_notes] saveDataRule, no key, no save');
         return false;
      }
   }

   if ($file) {
      try {
         avoidSavedFileTmp = $context.normalicePath($file);

         await $setFile($file, data, 'plain', async);

         setTimeout(() => {
            if (avoidSavedFileTmp === $context.normalicePath($file)) avoidSavedFileTmp = null; /*avoid fire fileChange*/
         }, 128);

         if (Config.isDev) console.log('[NTEST] saveDataRule', { id: idNote, 'data size': data.length, async: async, $file });
      } catch (e) {
         logger.warn('[internal_pack_notes] saveDataRule, fail setFile', e);
         return false;
      }

      if (data !== null && $fileHash && !encrypted) {
         cache_data_file.set($fileHash, String(data || ''));
      }
   } else {
      logger.warn('[internal_pack_notes] saveDataRule, no file', $file, rule);
      return false;
   }

   if (Config.isDev) console.log('[NTEST] saveData ok', { hasEncryptKey, encrypted });

   return true;
};

const saveRuleObj = async ($rule, async = true) => {
   const rule = $cloneDeep($rule);
   if (!initiated || $get(rule, 'params._note_is_new')) return;
   let $fileName = getFileRulePath(rule.params._note_rulefile);

   const encrypted = !!$get(rule, 'params._note_encrypt');
   const hasEncryptKey = encrypted && __hasKey(getNoteIdFormRule(rule));

   if (encrypted && !hasEncryptKey) {
      logger.warn('[internal_pack_notes] no key, no save');
      return false;
   }

   let $data = {
      title: rule.title,
      params: rule.params,
      _internal_id: rule._internal_id,
   };

   try {
      await $setFile($fileName, $data, 'JSON', async);
      return true;
   } catch (e) {
      logger.warn('[internal_pack_notes] no file', $fileName);
      return false;
   }
};

const noteAccessRule = () => {
   if (!initiated) return;
   return {
      title: NOTES_PATH_OBJ.name,
      icon: NOTES_PATH_OBJ.icon,
      initSort: 6,
      posFixed: fixedOptions * 6,
      type: [`${TB_NOTES_OBJ}_root`],
      viewer: false,
      params: { changePath: NOTES_PATH_OBJ },
      new_permit: false,
      last_permit: false,
   };
};

const addNewRule = () => {
   if (!initiated) return;
   return {
      title: NEW_NOTE_STR,
      icon: {
         type: 'iconFont',
         iconClass: 'ion-md-create',
         iconClass: 'w-icon-plus-square',
         iconClassColor: 'text accentColor2',
      },
      description: `Global Shortcut: ${$context.normaliceBindKeys($context.get(thisConfig, 'bindKeysNew[0]'))}`,
      path: NOTES_PATH_OBJ.path,
      initSort: 0,
      posFixed: 1,
      type: [`${TB_NOTES_OBJ}_MAKE`, 'internal', 'null'],
      viewer: true,
      searchField: '☻' /*No Search*/,
      new_permit: false,
      hidden_permit: false,
      last_permit: false,
      fav_permit: false,
   };
};

const forceRefresh = () => {
   if (!initiated || !$context) return;
   if ($context.forceRefreshRules) $context.forceRefreshRules();
};

const debForceRefresh = $debounce(forceRefresh, 8);

const addNewRuleOnly = () => {
   if (!initiated) return;
   const _rule = $cloneDeep(addNewRule());
   _rule.title = NEW_NOTE_STR;
   _rule.path = NOTES_PATH_OBJ_NEW_ONLY.path;
   _rule.description = '';
   _rule.persistFuzzy = true;
   return _rule;
};

const makeRuleFromFile = async fileName => {
   if (!initiated) return;

   let data = null;
   try {
      data = await promisify($fs.readFile)(fileName, 'utf8');
   } catch (e) {
      logger.warn('[internal_pack_notes] loadNotesIntoDB readFile fail', e, fileName);
      return null;
   }

   try {
      data = await JSON_parse_async(data);
   } catch (e) {
      logger.warn('[internal_pack_notes] loadNotesIntoDB parse fail', e, fileName);
      return null;
   }

   if (!data || typeof data !== 'object') {
      logger.warn('[internal_pack_notes] loadNotesIntoDB fail', fileName);
      return;
   }

   if ($get(data, 'params._note_deleted')) return;

   return makeRuleFromObj(data, $context.normalicePath(fileName));
};

const makeRuleFromObj = (obj, fileName = '') => {
   if (!initiated) return;

   let data = $cloneDeep(obj);

   if (!data._internal_id && $get(data, 'params._internal_id')) {
      data._internal_id = data.params._internal_id;
      delete data.params._internal_id;
   }

   if (!data._internal_id || $get(data, 'params._note_is_new')) {
      data._internal_id = getDataNewRuleRaw()._internal_id;
      logger.info('[internal_pack_notes] create new item', $cloneDeep(data));
   }

   if ($get(data, 'params._note_datafile')) {
      fileName = data.params._note_datafile;
   }

   data._id = `${NOTES_PATH_OBJ.path}-${data._internal_id}`;

   //TITLE
   if (!data.title) {
      data.title = String(
         String($path.basename(fileName) || '')
            .replace(thisConfig.notes_prefix, '')
            .replace($path.extname(fileName), '')
            .replace(/-/, ' ')
            .replace(/_/, ' ')
      );

      if (data.title.length > 1) data.title = data.title[0].toUpperCase() + data.title.slice(1);
   }

   data.title = data.title || '';

   data.params._note_original_description = data.params._note_original_description || '[TAB] to edit';

   data.description = data.params._note_original_description || '';

   data.params._note_encrypt = !!data.params._note_encrypt;

   if (data.params._note_is_new) {
      data.new_permit = false;
      data.hidden_permit = false;
      data.last_permit = false;
      data.fav_permit = false;
   }

   if (data.params._noteExpander && data.params._noteExpander.length > 0) {
      data.expander = data.params._noteExpander.indexOf(';') === -1 ? data.params._noteExpander : data.params._noteExpander.split(';');
   }

   data.params._note_creationDate = data.params._note_creationDate || $realClock.getTime();
   data.initSort = data.params._note_creationDate;
   data.description = `[${$dayjs(data.params._note_creationDate).fromNow()}] ${data.params._note_original_description || ''}`;

   //DATA TYPE
   data.params._note_type = (data.params._note_type && data.params._note_type.value ? data.params._note_type.value : data.params._note_type) || get_note_type();
   data.type = data.type || null;

   if (data.type === null) {
      data.type = [TB_NOTES_OBJ, `${TB_NOTES_OBJ}_SRTRING`, 'object'];
   }

   if (Array.isArray(data.type)) {
      if (!data.type.includes(TB_NOTES_OBJ)) data.type.unshift(TB_NOTES_OBJ);
      if (!data.type.includes('object')) data.type.push('object');
   } else {
      if (typeof data.type === 'string') data.type = [TB_NOTES_OBJ, data.type[0], 'object'];
   }

   //PATH
   data.path = data.path || NOTES_PATH_OBJ.path;

   //ICONS
   data.icon = data2icon(data.params._note_icon);

   if (!data.icon || (data.icon || {}).placedby === 'default') {
      // No icon or default, try folder
      let folder = dinamic_paths.getRuleFolders(data);
      folder = folder && folder[0] ? folder[0] : null;

      if (folder) {
         let icon = data2icon((dinamic_paths.get_note_paths_by_id(folder) || {}).icon);
         if (icon) data.icon = icon;
      }

      if (!data.icon) data.icon = defaulticon;
   }

   //RULEFILE
   data.params._note_rulefile = data.params._note_rulefile || $path.basename(fileName);

   //MODES
   data.params.mode = data.params.mode || set_mode_by_type($get(data, 'params._note_type'));
   data.params._note_lineWrapping = set_linewrapping_by_type(data.params._note_type);

   //FORCE EXTENCION
   if (!data.params._note_dataExtension || data.params._note_dataExtension === 'txt' || data.params.mode === 'null') {
      let autoExtension = data.params._note_type ? list_types.find(l => l.value === data.params._note_type) : null;
      if ((autoExtension || {}).ext) data.params._note_dataExtension = autoExtension.ext;
   }

   if (!data.params._note_dataExtension) {
      data.params._note_dataExtension = String(fileName ? $path.parse(fileName).ext : 'txt');
   }

   if (data.params._note_dataExtension[0] === '.') data.params._note_dataExtension = data.params._note_dataExtension.slice(1);

   let tmpDataFile = $get(data, 'params._note_datafile');
   let tmpExtension = data.params._note_dataExtension;

   data.params._note_datafile =
      tmpDataFile && typeof tmpDataFile === 'string'
         ? tmpDataFile.replace($path.parse(tmpDataFile).ext, `.${tmpExtension}`)
         : (data.params._note_rulefile || '').replace(thisConfig.notes_prefix, thisConfig.notes_prefix_datafile).replace('.json', `.${tmpExtension}`);

   //MAKING searchField
   const $title = data.title;
   let internaltags = [`.${tmpExtension}`.replace('..', '.')];
   let sumTags = data2tags(data, internaltags);
   data.searchField = `${$title} ${sumTags}`;

   return data;
};

let getDataFromRuleLastId = null;
const getDataFromRule = async ($rule, useBackUp = true, useDebounce = true) => {
   if (!initiated || !$rule) return null;

   const rule = $cloneDeep($rule);
   let hasEncryptKey = false;
   let encrypted = false;
   let file = getDataFile(rule);
   let fileHash = $makeHash(file);
   let fileBackup = `${file}.bak`;
   let rule_title = $get(rule, 'title');
   let rule_id = getNoteIdFormRule(rule);

   if (!rule_id) {
      logger.error('[internal_pack_notes] rule no id', rule_id);
      return null;
   }

   //CHECK ENCRYPTED
   if (typeof $rule === 'object') {
      encrypted = !!$get(rule, 'params._note_encrypt');
      hasEncryptKey = encrypted && __hasKey(rule_id);
   } else {
      logger.error('rule is string', rule);
      return null;
   }

   if (encrypted && !hasEncryptKey) {
      logger.info('[internal_pack_notes] no key, no load');
      return null;
   }

   //NO FILE
   if (!file) {
      if (Config.isDev) console.log('[internal_pack_notes] no data file', { rule, file });
      return null;
   }

   //MEM CACHE
   let cacheData = cache_data_file.get(fileHash);
   if (!encrypted && cacheData) {
      if (Config.isDev) console.log('[NTEST] data from [cache LRU]');
      return cacheData;
   }

   //UNDEBOUNCE
   if (useDebounce) {
      getDataFromRuleLastId = fileHash;
      await $pause(64);
      if (!fileHash || getDataFromRuleLastId !== fileHash) {
         return null;
      }
   }

   //IF FILE CHANGE
   if (!encrypted) {
      debCheckDataChange(file);
   }

   //LOAD DATA
   let _data = null;
   let _exist = await promisify($fs.exists)(file);
   if (thisConfig.useBackUp === !!thisConfig.useBackUp) useBackUp = thisConfig.useBackUp;
   if (encrypted) useBackUp = null;

   if (_exist) {
      _data = await promisify($fs.readFile)(file, 'utf8');
      if (!true && Config.isDev) console.log('[NTEST] data from [readFile]', { file, encrypted, hasEncryptKey });
      if (useBackUp && _data !== null) {
         $setFile(fileBackup, _data, 'plain', true);
      }
   } else {
      if (useBackUp && (await promisify($fs.exists)(fileBackup))) {
         _data = await promisify($fs.readFile)(fileBackup, 'utf8');
         if (Config.isDev) logger.log('[internal_pack_notes] getDataFromRule no exist, use backup', fileBackup);
      }
      if (_data === null || _data === undefined) {
         _data = '';
      }
      saveDataRule(file, _data, true);
      if (Config.isDev) logger.log('[internal_pack_notes] getDataFromRule no exist, create', file);
   }

   //DECRYPT
   if (encrypted && hasEncryptKey && _data !== null) {
      let _datatmp = await __decryptData(_data, __getKey(rule_id));
      if (_datatmp === null) {
         logger.warn('[internal_pack_notes] fail decrypt', { _data, _datatmp });
         return null;
      }
      if (Config.isDev) console.log('[NTEST] decrypt OK', _datatmp.length, _data.length);
      _data = _datatmp;
   }

   if (_data === null) {
      logger.error('[internal_pack_notes] data is null', { file, rule });
      return null;
   }

   _data = String(_data || '');

   //SET CACHE
   if (_data !== null && fileHash && !encrypted) {
      cache_data_file.set(fileHash, _data);
   }

   if (Config.isDev) console.log('[NTEST] load data OK');

   return String(_data || '');
};

let lastsetRulesFromDbCache = {};
const setRulesFromDb = rules => {
   if (!initiated || !rules || !typeof rules === 'object') return;

   const $actualPath = $context.getPath().path;

   let hashrules = null;
   let lastsetRulesFromDbCacheID = null;
   let isInNotePath = $actualPath == NOTES_PATH_OBJ.path;

   if (!isInNotePath) {
      hashrules = $makeHash(JSON.stringify(rules));
      lastsetRulesFromDbCacheID = $actualPath + hashrules;
      if (
         lastsetRulesFromDbCache &&
         lastsetRulesFromDbCache.id === lastsetRulesFromDbCacheID &&
         lastsetRulesFromDbCache.value &&
         lastsetRulesFromDbCache.value.length
      ) {
         $setRules([...lastsetRulesFromDbCache.value, ...dinamic_paths.getPaths()]);
         return;
      }
   }

   let $rules = rules.filter(noteRule => noteRule && typeof noteRule.params === 'object' && !noteRule.params._note_deleted && !noteRule.params._note_is_new);

   $rules = $rules
      .map(noteRule => {
         if (noteRule.expander && noteRule.expander.length > 0) {
            addExpander(createRule(noteRule));
         }

         if (isInNotePath) {
            //ALL NOTES
            noteRule.path = $actualPath;
            return noteRule;
         }

         if (dinamic_paths.noteIsOnPath(noteRule, $actualPath)) {
            const $noteRule = $cloneDeep(noteRule);
            $noteRule.path = $actualPath;
            delete $noteRule.initSort;
            return $noteRule;
         }

         return null;
      })
      .filter(value => value !== null);

   if (lastsetRulesFromDbCacheID) lastsetRulesFromDbCache = { id: lastsetRulesFromDbCacheID, value: $rules };
   $setRules([...$rules, ...dinamic_paths.getPaths()]);
};

const loadNotesIntoDB = async () => {
   if (!initiated) return;

   const pathNotes = thisConfig.path_notes;

   const files = await $context.global_aux.getFilesAsync(
      pathNotes,
      file => file.indexOf(thisConfig.notes_prefix) === 0 && file.indexOf(thisConfig.notes_delete_sufix) === -1
   );

   if (files && Array.isArray(files)) {
      notesDataDb = await Promise.all(files.map(makeRuleFromFile));
      notesDataDb = notesDataDb.filter(data => data && !$get(data, 'params._note_deleted') && !$get(data, 'params._note_is_new'));
      if (Config.isDev) console.log('[NTEST] LOAD_NOTES_INTO_DB ', files.length);
      return true;
   } else {
      logger.warn('[internal_pack_notes] loadNotesIntoDB fail', pathNotes, files);
   }

   return false;
};

const getDataFile = (rule, checkExist = false) => {
   if (!initiated) return null;

   let file = null;

   if (typeof rule === 'string') {
      file = rule;
      if (checkExist && !$fs.existsSync(file)) return null;
   }
   if (typeof rule === 'object') {
      file = $get(rule, 'rule.params._note_datafile') || $get(rule, 'params._note_datafile');
      if (checkExist && !$fs.existsSync(file)) return null;
      file = getFileDataPath(file, $get(rule, 'params._note_dataExtension'));
   }

   return $context.normalicePath(file);
};

const fileChange = async name => {
   if (!initiated || !_watcher || !name) return;

   const $name = $context.normalicePath(name);

   //Internal save, avoid emit change
   if (avoidSavedFileTmp === $name) return;

   if (_fileWatched !== $name) {
      if (Config.isDev) console.log('fileChange / Diferent file', _fileWatched, $name);
      return;
   }

   const lastRule = $context.getLastRuleSelected();
   const lastRuleDataFile = $get(lastRule, 'params._note_datafile');
   if (!lastRule || !lastRuleDataFile) return;

   const lastRuleDataFileFull = $context.normalicePath(getFileDataPath(lastRuleDataFile));
   if (lastRuleDataFileFull !== $name) return;

   const encrypted = !!$get(lastRule, 'params._note_encrypt');

   if (encrypted) {
      if (Config.isDev) console.log('fileChange / encrypted file');
   }

   cache_data_file.del($makeHash($name));

   let data = await getDataFromRule(lastRule);

   if (data === null) {
      logger.warn('No data / fileChange', { lastRule, data });
      return;
   }

   data = String(data || '');

   dataExternalEvents.emit('CHANGE_DATA', data, lastRule);
   if (Config.isDev) console.log('[NTEST]', '%s changed!', $path.basename($name), '_fileWatched:', _fileWatched, 'data:', data.length);
};

const debFileChange = $debounce(fileChange, 32);

const checkDataChange = $file => {
   if (!initiated || !$file) return;
   if (_fileWatched === $file) return;

   const file = getDataFile($file, true);
   if (!file) return;

   if (!_watcher) {
      _watcher = $watcher.watch([], { awaitWriteFinish: false, ignoreInitial: true, disableGlobbing: true, useFsEvents: false });
      _watcher.on('change', debFileChange);
   }

   if (_fileWatched === file) return;
   if (_fileWatched && _fileWatched && _watcher.unwatch) {
      _watcher.unwatch(_fileWatched);
      _fileWatched = null;
   }

   _watcher.add(file);
   _fileWatched = file;

   if (Config.isDev) console.log('[NTEST] watching:', file);
};

const debCheckDataChange = $debounce(checkDataChange, 1024);

const openExternal = (obj, goBack = false) => {
   const encrypted = !!$get(obj, 'params._note_encrypt');
   if (encrypted) return;
   let dataFile = getDataFile(obj);
   if (!dataFile) return;
   $openFile(dataFile, false, true, goBack);
};

const _deleteNote = async obj => {
   obj.params = obj.params || {};

   lastRulesManager.remove(obj);
   obj.params._note_deleted = true;

   // await saveRuleObj(obj, false);
   updateRuleInDB(obj);

   let fileName = $get(obj, 'params._note_rulefile');
   if (fileName) fileName = getFileRulePath(fileName);

   await $pause(1);

   const rimraf = require('rimraf');

   try {
      if (thisConfig.moveOnDelete) {
         await moveFile(fileName, $context.normalicePath(`${thisConfig.path_notes}/trash/${$path.basename(fileName)}`));
      } else {
         rimraf(fileName);
      }
   } catch (e) {
      logger.warn('[internal_pack_notes] delete note:', e, fileName);
   }

   let dataFile = $get(obj, 'params._note_datafile');
   if (dataFile) dataFile = getFileDataPath(dataFile);

   if (dataFile) {
      try {
         if (thisConfig.moveOnDelete) {
            await moveFile(dataFile, $context.normalicePath(`${thisConfig.path_notes}/trash/${$path.basename(dataFile)}`));
         } else {
            rimraf(dataFile);
         }
      } catch (e) {
         logger.warn('[internal_pack_notes] delete data:', e, dataFile);
      }
   }

   logger.info('[internal_pack_notes] delete note:', fileName, dataFile);

   return;
};

const deleteNote = obj => {
   if (!initiated || !obj || !obj.title) return;
   let _title = obj.title;

   const encrypted = !!$get(obj, 'params._note_encrypt');
   const hasEncryptKey = encrypted && __hasKey(getNoteIdFormRule(obj));

   if (encrypted && !hasEncryptKey) {
      logger.warn('[internal_pack_notes] no key, no remove');
      return false;
   }

   let options = {
      buttons: !Config.isWin ? ['Cancel', 'Delete'] : ['&Cancel', '&Delete'],
      message: `Are you sure you want to delete this item:\n${_title}\n`,
      title: 'Typebox delete confirmation',
      type: 'question',
      noLink: true,
   };

   dialog.showMessageBox(parentWindow, options, (res, checked) => {
      if (res === 1) _deleteNote(obj);
      $context.show();
   });

   return;
};

module.exports = context => {
   $lrucache = context.require('lru-cache');
   $path = context.require('path');
   $fs = context.require('fs');
   $watcher = context.require('chokidar');
   $realClock = context.require('@main/real_clock.js');
   $cache_session = new $lrucache({ max: 64, maxAge: ms('1000h') });
   $relativeTime = context.require('dayjs/plugin/relativeTime');
   $dayjs = context.require('dayjs');
   $dayjs.extend($relativeTime);
   $getFiles = context.global_aux.getFiles;
   $get = context.global_aux.get;
   $getFile = context.getFile;
   $makeHash = context.global_aux.makeHash;
   $setRules = context.setRules;
   $openFile = context.openFile;
   $isFunction = context.global_aux.isFunction;
   $cloneDeep = context.global_aux.cloneDeep;
   $context = context;
   $setFile = context.setFile;
   Config = context.config;
   logger = context.logger;
   fixedOptions = Number(Config.get('fixedTypeBoxOptions'));

   //KTODO: Mover a otro file
   updateRuleInDB = $rule => {
      if (!initiated) return;
      if (!$rule) return;

      const rule = $cloneDeep($rule);
      const deleted = $get(rule, 'params._note_deleted');
      const ruleID = rule._internal_id;

      if (!ruleID) return;

      let found = false;

      notesDataDb = notesDataDb.map(itemDB => {
         if (itemDB && itemDB.params) {
            if (itemDB._internal_id === ruleID) {
               itemDB = rule;

               const findObj = r => r._internal_id === ruleID;

               //refresh favs
               const fav = favManager.getFavItems().find(findObj);
               if (fav) {
                  const ruleFav = $cloneDeep(rule);
                  ruleFav.id = fav.id;
                  deleted ? favManager.remove(ruleFav) : favManager.push(ruleFav);
               }

               //refresh hiddens
               const hidden = hiddenRulesManager.gethiddenItems().find(findObj);
               if (hidden) {
                  const ruleHidden = $cloneDeep(rule);
                  ruleHidden.id = hidden.id;
                  deleted ? hiddenRulesManager.remove(ruleHidden) : hiddenRulesManager.push(ruleHidden);
               }

               //LAST
               const last = lastRulesManager.getlastItems().find(findObj);
               if (last) {
                  const rulelast = $cloneDeep(rule);
                  rulelast.id = last.id;
                  deleted ? lastRulesManager.remove(rulelast) : lastRulesManager.push(rulelast);
               }

               found = true;
               return rule;
            }
            return itemDB;
         }
      });

      const isNew = !found;
      const updated = !isNew && !deleted;

      if (isNew) notesDataDb.push(rule);

      lastsetRulesFromDbCache = {};

      if (updated) {
         const findupdateRule = $context.updateRule(rule);
         if (!findupdateRule) {
            setRulesFromDb(notesDataDb);
            debForceRefresh();
         }
      } else {
         if (deleted) HistoryManager.remove(rule);
         setRulesFromDb(notesDataDb);
         debForceRefresh();
      }
   };

   saveRule = async (data, $rule) => {
      if (!initiated || !$rule || !$rule.params) return false;
      if (!$rule.title && !data) return false;

      if (Config.isDev) console.log('[NTEST] saveRule/data :', $rule.title);

      let rule = $rule;
      let checkAuto = null;
      let isNew = false;
      let ischangedTitle = false;

      rule.params._meta = rule.params._meta || {};

      //DataStr2Title (code)
      if (!rule.title && data && data.length) {
         ischangedTitle = true;
         rule.title = dataStr2title(data);
      }

      if (!rule.title || rule.title.length < 1) {
         ischangedTitle = true;
         rule.title = NEW_NOTE_STR;
      }

      if (($get(rule, 'params._note_type.value') || $get(rule, 'params._note_type')) === 'auto') {
         checkAuto = check_auto_type(data);
         if (checkAuto && checkAuto.type) rule.params._note_type = checkAuto.type;
         if (checkAuto && checkAuto.mode) rule.params.mode = checkAuto.mode;
      }

      if (rule.params.__titlesufix) {
         rule.title = rule.title + rule.params.__titlesufix;
         delete rule.params.__titlesufix;
         rule.params._meta.paste = true;
      }

      if (rule.params._note_is_new) {
         isNew = true;

         if (checkAuto) {
            //PONER NOMBRE SEGUN EL MODO DETECTADO #3453452
            // rule.title = rule.title || rule.title
         }

         let titleFile = title2file(rule.title);
         if (aux_driveManager.fileExists(getFileDataPath(titleFile)) || getFileRulePath(getFileDataPath(titleFile))) {
            titleFile = `${titleFile}_${nanoid()}`;
         }

         rule.params._note_rulefile = $path.basename(getFileRulePath(titleFile));
         rule.params._note_datafile = $path.basename(getFileDataPath(titleFile));

         rule.params._note_originalTitle = rule.title;
         rule.params._note_creationDate = rule.params._note_creationDate || $realClock.getTime();
         rule.params._meta.paste = !!(rule.params._meta.paste || false);
         rule.params._meta.terminal = Config.get('here_are_dragons.report.__termname');
         rule.params._meta.user = Config.get('here_are_dragons.report.__os_userInfo');
      }

      if (rule.params.__changedTitle) {
         ischangedTitle = true;
      }

      delete rule.params.__changedTitle;

      if ((!rule.params._meta.modify_lenght && rule.params._meta.modify_lenght !== 0) || !Number.isInteger(rule.params._meta.modify_lenght)) {
         rule.params._meta.modify_lenght = -1;
      }

      rule.params._meta.modify_lenght = rule.params._meta.modify_lenght + 1;

      rule = makeRuleFromObj(rule);

      if (!rule) {
         if (Config.isDev) console.log('[NTEST] saveRule fail, no rule:', { $rule, rule });
         return false;
      }

      rule.params._note_modifyDate = $realClock.getTime();

      rule.new_permit = true;
      rule.params._note_is_new = false;
      rule.hidden_permit = true;
      rule.last_permit = true;
      rule.fav_permit = true;

      if ($rule.params._noteExpander) {
         rule.expander = $rule.params._noteExpander.indexOf(';') === -1 ? $rule.params._noteExpander : $rule.params._noteExpander.split(';');
      }
      if ($rule.params._noteExpander === '') {
         rule.expander = null;
      }

      if (isNew && rule.params._note_type === 'file' && aux_driveManager.fileExists($context.normalicePath(data))) {
         let valueIcon = $get(rule, 'params._note_icon.value');
         if (!valueIcon) {
            rule.params._note_icon = {
               type: 'iconSrc',
               value: $context.normalicePath(data, true),
               placedby: 'note',
            };
            rule.icon = rule.params._note_icon.value;
         }
      }

      const markNewRulesTimeOld = Config.get('here_are_dragons.markNewRulesTimeOld') || 5 * 60 * 1000;
      if (rule.params._note_creationDate && $realClock.getTime() - 100 >= rule.params._note_creationDate + markNewRulesTimeOld) {
         rule.new_permit = false;
      }

      if (!rule.params._note_deleted) lastRulesManager.push(rule);

      let savedRule = await saveRuleObj(rule, true);
      let savedData = await saveDataRule(rule, data, true);

      logger.log('[NTEST] saveRule/data', { ok: savedRule && savedData });

      updateRuleInDB(rule);

      return savedRule && savedData;
   };

   setRulesFromFiles = async () => {
      if (!initiated) return;

      await loadNotesIntoDB();
      lastsetRulesFromDbCache = {};

      if (notesDataDb && notesDataDb.length) {
         logger.info('[internal_pack_notes] loadNotes ok / size', notesDataDb.length);
         return setRulesFromDb(notesDataDb);
      } else {
         logger.info('[internal_pack_notes] loadNotes no notes');
      }
   };

   registerNewGlobalNote = async () => {
      if (!initiated) return;
      $context.show();
      $context.setPath(NOTES_PATH_OBJ_NEW_ONLY, true);
      return true;
   };

   //SUPERPASTE / GLOBAL PASTE
   registerNewGlobalPaste = async (data, rule, sufix) => {
      if (!initiated) return;

      let dataClipboard = null;

      try {
         dataClipboard = clipboard.readText();
         if (Config.isDev) console.log('\n[paste]', dataClipboard);
      } catch (e) {
         logger.error('\n[paste] Fail', e);
         return false;
      }

      let actWin = {};

      try {
         activeWin = activeWin || require('active-win');
         actWin = await activeWin();
      } catch (e) {}

      let actWinTitle = $get(actWin, 'title');
      let actWinOwner = $get(actWin, 'owner');
      let actWinIsThis = actWinTitle === 'Typebox';

      let _data = data || dataClipboard;

      if (!_data || String(_data).length === 0) {
         if (Config.isDev) console.log('\n[paste] no data', _data, '\n formats:', clipboard.availableFormats());
         return false;
      }

      if (_data.length > thisConfig.PasteNoteTextMaxSize) {
         logger.warn('[paste] note is too long');
         return;
      }

      if (lastRegisterNewGlobalPaste === _data) {
         if (Config.isDev) console.log('[paste] note alreadyPaste');
         return;
      }

      lastRegisterNewGlobalPaste = _data;

      let _rule = makeRuleFromObj(extendObj(getDataNewRule(), $cloneDeep(rule || {})));

      _rule.params.__titlesufix = _rule.params.__titlesufix || sufix || thisConfig.sufixPasteNote;
      _rule.params._note_is_new = true;
      _rule.params._note_encrypt = false;

      _rule.params._meta = {
         paste: true,
         pasteWinTitle: actWinTitle,
         pasteWinOwner: actWinOwner,
         pasteWinIsThis: actWinIsThis,
      };

      let res = await saveRule(_data, _rule);

      if (!res) {
         logger.warn('[paste] save error', res);
         return;
      }

      if (Config.isDev) console.log('\n[paste] OK', _data);
      if (thisConfig.toastOnPasteNote) sharedData.toaster.notify(thisConfig.toastPasteNoteText);
      return true;
   };

   const forceRefreshData = async $rule => {
      if (!initiated || !$rule) {
         logger.warn('forceRefreshData', { initiated, $rule });
         return;
      }

      let $data = await getDataFromRule($rule);

      if ($data === null) {
         if (Config.isDev) console.warn('No data / forceRefreshData', { $rule, $data });
         return $data;
      }

      $data = String($data || '');

      if (Config.isDev) console.log('CHANGE_DATA');
      dataExternalEvents.emit('CHANGE_DATA', $data, $rule);
      return $data;
   };

   /*JSX*/
   const { createViewerNotesBase, noteComponent } = require(auxBabel.replaceJSX('./internal_pack_notes_viewer.jsx'));

   `
    .d8888b.   .d88888b.  888b    888 8888888888 8888888 .d8888b.
   d88P  Y88b d88P" "Y88b 8888b   888 888          888  d88P  Y88b
   888    888 888     888 88888b  888 888          888  888    888
   888        888     888 888Y88b 888 8888888      888  888
   888        888     888 888 Y88b888 888          888  888  88888
   888    888 888     888 888  Y88888 888          888  888    888
   Y88b  d88P Y88b. .d88P 888   Y8888 888          888  Y88b  d88P
    "Y8888P"   "Y88888P"  888    Y888 888        8888888 "Y8888P88
   `;
   /*PACKAGE*/
   return {
      config: {
         title: 'Notes & snippets',
         titleItem: 'Add new item',
         bindKeysOpen: ['f4', 'mod+o'],
         bindKeysEdit: ['mod+e'],
         bindKeysSave: ['mod+s'],
         bindKeysOptions: ['mod+k'],
         bindKeysPreview: ['mod+p'],
         bindKeysReLock: ['mod+shift+l'],
         bindKeysNew: ['mod+n', 'shift+f4'],
         bindKeysDelete: [Config.isMac ? 'mod+backspace' : 'mod+del', 'f8'],
         bindKeysGlobalNew: 'super+alt+n',
         bindKeysGlobalPaste: 'super+alt+v',
         bindKeysGlobalPasteAndView: 'shift+super+alt+v',
         notes_prefix: 'note-',
         notes_prefix_datafile: 'data-',
         sufixPasteNote: ' [paste]',
         toastOnPasteNote: true,
         toastPasteNoteText: 'New note from clipboard',
         PasteNoteTextMaxSize: 250 * 1024,
         maxAutoTitleSize: 18,
         typesWithHiddenViewer: ['file', 'url', 'jscommand', 'command'],
         notes_delete_sufix: '_notedeleted',
         path_notes: $context.normalicePath(`${Config.get('here_are_dragons.paths.rootDataStored')}/typebox_notes/`),
         file_dinamic_paths: 'path_notes.json',
         maxAgeCacheData: ms('10s'),
         maxSizeCacheData: 10,
         moveOnDelete: true,
         useBackUp: false,
         autoSave: false,
         delayLoadNotes: 128,
         debounceAutoSaveRule: 1024,
         previewOnInit: true,
         advancedPreviews: false,
         timeToRemoveNotePass: ms('1m'),
         prettierOptions: {
            printWidth: 80,
            tabWidth: 2,
            useTabs: false,
            singleQuote: false,
            trailingComma: 'none',
            arrowParens: 'avoid',
            bracketSpacing: true,
            htmlWhitespaceSensitivity: 'css',
            insertPragma: false,
            jsxBracketSameLine: false,
            jsxSingleQuote: false,
            proseWrap: 'preserve',
            quoteProps: 'as-needed',
            requirePragma: false,
            semi: true,
         },
         defaulticon: {
            type: 'iconFont',
            iconClass: 'mdi-cards',
            iconClassColor: 'text accentColor2',
            placedby: 'default',
         },
         defaultIconDinPath: {
            type: 'iconFont',
            iconClass: 'fas-sticky-note',
            iconClassColor: 'text accentColor2',
            placedby: 'default_path',
         },
         editorOptions: {
            test: true,
            focusTitleOnNew: false,
            placeholder: 'Type here',
            debounceTimeOnChange: 128,
         },
      },
      init() {
         if (initiated) return;
         initiated = true;

         thisConfig = this.config;

         NOTES_PATH_OBJ.name = thisConfig.title;
         NEW_NOTE_STR = thisConfig.titleItem;
         NOTES_PATH_OBJ_NEW_ONLY.name = NEW_NOTE_STR;

         thisConfig.editorOptions.bindKeysSave = thisConfig.bindKeysSave;
         thisConfig.editorOptions.bindKeysOptions = thisConfig.bindKeysOptions;
         thisConfig.editorOptions.bindKeysPreview = thisConfig.bindKeysPreview;
         thisConfig.editorOptions.bindKeysReLock = thisConfig.bindKeysReLock;
         thisConfig.editorOptions.bindKeysDelete = thisConfig.bindKeysDelete;
         thisConfig.editorOptions.bindKeysOpen = thisConfig.bindKeysOpen;
         thisConfig.editorOptions.autoSave = thisConfig.autoSave;
         thisConfig.editorOptions.previewOnInit = thisConfig.previewOnInit;
         thisConfig.editorOptions.timeToRemoveNotePass = thisConfig.timeToRemoveNotePass;
         thisConfig.editorOptions.advancedPreviews = thisConfig.advancedPreviews;
         thisConfig.editorOptions.prettierOptions = thisConfig.prettierOptions;

         cache_data_file = new $lrucache({ max: thisConfig.maxSizeCacheData, maxAge: thisConfig.maxAgeCacheData });

         defaulticon = thisConfig.defaulticon;
         debSaveRule = $debounce(saveRule, thisConfig.debounceAutoSaveRule || 1024);

         NOTES_PATH_OBJ.icon = defaulticon;
         NOTES_PATH_OBJ_NEW_ONLY.icon = defaulticon;
         NOTES_PATH_OBJ.path = (this.name || '').replace(/\s/g, '_').toUpperCase();
         NOTES_PATH_OBJ_NEW_ONLY.path = `${(this.name || '').toUpperCase().replace(/\s/g, '_')}_NEW`;

         __deleteKeyDeb = $memoizeDebounce(__deletetKey, thisConfig.timeToRemoveNotePass);
         __deleteKeyDebLarge = $memoizeDebounce(__deletetKey, thisConfig.timeToRemoveNotePass * 2.5);

         context.on('ON_CTRL_C', async e => {
            try {
               const lastRule = context.getLastRuleSelected();
               if (!($get(lastRule, 'type') || []).includes(TB_NOTES_OBJ)) return false;
               if (!getDataFile(lastRule)) return false;

               if (!_encriptAndKey(lastRule)) {
                  dataExternalEvents.emit(USER_WANTS_EDIT, e);
                  return false;
               }

               if (Config.isDev) console.log('ON_CTRL_C1', e);

               let str = await getDataFromRule(lastRule, false, false);
               let param = context.get(e, 'detail.paramRegex');
               str = await processNoteStr(lastRule, str, undefined, param);
               if (!str) return;

               await $pause(1);
               if (typeof str === 'string') context.copyToClipboard(str, !(e && e.shiftKey));
               return true;
            } catch (e) {
               logger.warn(e);
               return false;
            }
         });

         context.keyboard_bind(this.config.bindKeysOpen, (e, b) => {
            const lastRule = context.getLastRuleSelected();
            if (!getDataFile(lastRule) || !($get(lastRule, 'type') || []).includes(TB_NOTES_OBJ)) return false;
            if (e && e.preventDefault) e.preventDefault();
            if (!_encriptAndKey(lastRule)) {
               dataExternalEvents.emit(USER_WANTS_EDIT, e);
               return false;
            }
            openExternal(lastRule);
            return true;
         });

         context.keyboard_bind(this.config.bindKeysSave, (e, b) => {
            const lastRule = context.getLastRuleSelected();
            if (!getDataFile(lastRule) || !($get(lastRule, 'type') || []).includes(TB_NOTES_OBJ)) return false;
            if (!_encriptAndKey(lastRule)) {
               dataExternalEvents.emit(USER_WANTS_EDIT, e);
               return false;
            }
            const noteSave = document.getElementById('noteSave');
            if (noteSave && noteSave.click) {
               noteSave.click();
               if (e && e.preventDefault) e.preventDefault();
               return true;
            }
            return false;
         });

         context.keyboard_bind(this.config.bindKeysPreview, (e, b) => {
            const lastRule = context.getLastRuleSelected();
            if (!getDataFile(lastRule) || !($get(lastRule, 'type') || []).includes(TB_NOTES_OBJ)) return false;
            const notePreview = document.getElementById('notePreview');
            if (notePreview && notePreview.click) {
               notePreview.click();
               if (e && e.preventDefault) e.preventDefault();
               return true;
            }
            return false;
         });

         context.keyboard_bind(this.config.bindKeysReLock, (e, b) => {
            const lastRule = context.getLastRuleSelected();
            if (!getDataFile(lastRule) || !($get(lastRule, 'type') || []).includes(TB_NOTES_OBJ)) return false;
            const noteReLock = document.getElementById('noteReLock');
            if (noteReLock && noteReLock.click) {
               noteReLock.click();
               if (e && e.preventDefault) e.preventDefault();
               return true;
            }
            return false;
         });

         context.keyboard_bind(this.config.bindKeysOptions, (e, b) => {
            const lastRule = context.getLastRuleSelected();
            if (!getDataFile(lastRule) || !($get(lastRule, 'type') || []).includes(TB_NOTES_OBJ)) return false;
            const noteOptions = document.getElementById('noteOptionsBtn');
            if (noteOptions && noteOptions.click) {
               noteOptions.click();
               if (e && e.preventDefault) e.preventDefault();
               return true;
            }
            return false;
         });

         context.keyboard_bind(this.config.bindKeysDelete, (e, b) => {
            const lastRule = context.getLastRuleSelected();
            if (!($get(lastRule, 'type') || []).includes(TB_NOTES_OBJ)) return false;
            deleteNote(lastRule);
            return true;
         });

         context.keyboard_bind(this.config.bindKeysEdit, (e, b) => {
            const lastRule = context.getLastRuleSelected();
            if (!getDataFile(lastRule) || !($get(lastRule, 'type') || []).includes(TB_NOTES_OBJ)) return false;
            dataExternalEvents.emit(USER_WANTS_EDIT, e);
            if (e && e.preventDefault) e.preventDefault();
            return true;
         });

         context.keyboard_bind(this.config.bindKeysNew, async (e, b) => {
            context.setPath(NOTES_PATH_OBJ_NEW_ONLY, true);
            return true;
         });

         context.on('changePath', path => {
            if (path === '/' || path === NOTES_PATH_OBJ.path || path.indexOf(TB_NOTES_PATH_PREFIX) === 0) {
               setRulesFromDb(notesDataDb);
            }
         });

         //GLOBAL NEW
         if (thisConfig.bindKeysGlobalNew && registerNewGlobalNote && globalShortcut && globalShortcut.register) {
            if (globalShortcut.isRegistered(thisConfig.bindKeysGlobalNew)) {
               globalShortcut.unregister(thisConfig.bindKeysGlobalNew);
            }
            globalShortcut.register(thisConfig.bindKeysGlobalNew, registerNewGlobalNote);
         }

         //GLOBAL PASTE
         if (thisConfig.bindKeysGlobalPaste && registerNewGlobalPaste && globalShortcut && globalShortcut.register) {
            if (globalShortcut.isRegistered(thisConfig.bindKeysGlobalPaste)) {
               globalShortcut.unregister(thisConfig.bindKeysGlobalPaste);
            }
            globalShortcut.register(thisConfig.bindKeysGlobalPaste, registerNewGlobalPaste);
         }

         //GLOBAL PASTE & VIEW
         if (thisConfig.bindKeysGlobalPasteAndView && registerNewGlobalPaste && globalShortcut && globalShortcut.register) {
            if (globalShortcut.isRegistered(thisConfig.bindKeysGlobalPasteAndView)) {
               globalShortcut.unregister(thisConfig.bindKeysGlobalPasteAndView);
            }
            globalShortcut.register(thisConfig.bindKeysGlobalPasteAndView, async () => {
               let res = await registerNewGlobalPaste();
               if (res) {
                  $context.show();
                  $context.setPath(NOTES_PATH_OBJ, true);
               }
            });
         }

         //ONCE viewIsReady
         let viewIsReadyOnce = false;
         context.on('viewIsReady', () => {
            if (viewIsReadyOnce) return;
            viewIsReadyOnce = true;
            context.addPermanentRules([noteAccessRule(), addNewRule(), addNewRuleOnly()]);
            setTimeout(async () => {
               await dinamic_paths.init(thisConfig);
               if (Config.isDev) console.log('[NTEST] start setRulesFromFiles');
               await setRulesFromFiles();
               if (Config.isDev) console.log('[NTEST] start setRulesFromFiles');
            }, thisConfig.delayLoadNotes);
         });
      },
      defineTypeExecutors() {
         //EXECUTOR ON TAB/ENTER

         function _waitforElCreatAsync($id1, $id2, $timeOut = 1000) {
            return new Promise((resolve, reject) => {
               if (document.getElementById($id2)) {
                  resolve(true);
                  return;
               }

               let obs = null;
               let found = null;

               const res = () => {
                  if (obs && obs.disconnect) {
                     resolve(found);
                     obs.disconnect();
                     obs = null;
                  }
               };

               obs = new MutationObserver((mutationsList, observer) => {
                  found =
                     Object.entries(mutationsList).filter(
                        l => l && l[1] && l[1].addedNodes && Object.entries(l[1].addedNodes).filter(n => n && n[1] && n[1].id === $id2).length > 0
                     ).length > 0;

                  if (found) res();
               });
               obs.observe(document.getElementById($id1), { childList: true, subtree: true });
               setTimeout(() => res(), $timeOut);
            });
         }

         const gotoEditNote = async (obj, $rule, event) => {
            if (event && event.persist) event.persist();
            if (event && event.preventDefault) event.preventDefault();
            let fireEvent = true;

            if (!forceEditViewer) {
               forceEditViewer = true;
               fireEvent = false;
               forceRefresh();
               fireEvent = await _waitforElCreatAsync('ruleViewer', 'TBN_main', 1500);
            }

            if (fireEvent) dataExternalEvents.emit(USER_WANTS_EDIT, event);
            return !fireEvent;
         };

         const placeNote = async (obj, $rule, event) => {
            if (event && event.persist) event.persist();
            if (event && event.preventDefault) event.preventDefault();

            let permitClose = event && event.type === 'expander' ? false : undefined;

            if (!_encriptAndKey($rule)) {
               gotoEditNote(obj, $rule, event);
               return false;
            }

            //ON TAB
            if (event && event.key && event.key.toLowerCase() === 'tab') {
               gotoEditNote(obj, $rule, event);
               return true;
            }

            //ON ENTER
            if (!getDataFile($rule)) return true;

            const $note_type = $get($rule, 'params._note_type');
            let $data = await getDataFromRule($rule, false, false);

            if (Config.isDev) console.log('$note_type:', $note_type, '$data:', $data);

            let param = context.get(event, 'detail.paramRegex');
            $data = await processNoteStr($rule, $data, $note_type, param);
            if (!$data) return;

            //[subTipos]
            if ($note_type === 'url' && aux_webManager.isUrl($data)) {
               aux_webManager.openUrl($data);
               return false;
            }

            if ($note_type === 'url' && !aux_webManager.isUrl($data)) {
               gotoEditNote(obj, $rule, event);
               return true;
            }

            if ($note_type === 'file' && aux_driveManager.fileExists($data)) {
               aux_driveManager.openFile($data);
               return false;
            }

            if ($note_type === 'file' && !aux_driveManager.fileExists($data)) {
               gotoEditNote(obj, $rule, event);
               return true;
            }

            if ($note_type === 'command' && !Config.get('here_are_dragons.disableExecCommand')) {
               aux_driveManager.execCommand($data);
               return false;
            }

            if (Config.isDev) console.log('TODO place iem', { permitClose });
            context.writeString($data, undefined, permitClose, permitClose);
            return false;
         };

         return [
            {
               title: 'Type item',
               type: TB_NOTES_OBJ,
               id: `${TB_NOTES_OBJ}_place_string`,
               description: 'Shortcut: ENTER',
               icon: {
                  iconClass: 'mdi-textbox-password small_ico',
               },
               enabled: $rule => {
                  return true;
               },
               exectFunc: placeNote,
            },
            {
               title: 'Edit item',
               type: TB_NOTES_OBJ,
               id: `${TB_NOTES_OBJ}edit_note`,
               description: 'Shortcut: TAB',
               icon: {
                  iconClass: 'mdi-pencil small_ico',
               },
               enabled: $rule => {
                  return _encriptAndKey($rule);
               },
               async exectFunc(...args) {
                  if (event && event.preventDefault) event.preventDefault();
                  gotoEditNote(...args);
                  return true;
               },
            },
            {
               title: 'Copy to clipboard',
               type: TB_NOTES_OBJ,
               id: `${TB_NOTES_OBJ}_copy_string`,
               description: `Shortcut: ${context.getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'COPY_STRING')}`,
               icon: {
                  iconClass: 'mdi-paperclip small_ico',
               },
               enabled: $rule => {
                  return true;
                  return _encriptAndKey($rule);
               },
               async exectFunc(obj, $rule) {
                  if (Config.isDev) console.log('ON_CTRL_C2');
                  try {
                     await $pause(1);

                     if (!_encriptAndKey($rule)) {
                        return false;
                     }

                     const $note_type = $get($rule, 'params._note_type');
                     let $data = await getDataFromRule($rule, false, false);

                     let param = context.get(obj, 'event,detail.paramRegex');
                     $data = await processNoteStr($rule, $data, $note_type, param);
                     if (!$data) return;

                     context.copyToClipboard($data, !(obj.event && obj.event.shiftKey));
                  } catch (e) {
                     logger.warn(e);
                  }
               },
            },
            {
               title: 'Open item in external editor',
               type: `${TB_NOTES_OBJ}_SRTRING`,
               id: `${TB_NOTES_OBJ}_edit_string`,
               description: `Shortcut: ${context.normaliceBindKeys(context.get(this, 'config.bindKeysOpen[0]'))}`,
               icon: {
                  iconClass: 'mdi-lead-pencil small_ico',
               },
               enabled: $rule => {
                  return _encriptAndKey($rule);
               },
               exectFunc: (obj, $rule) => {
                  openExternal($rule);
               },
            },
            {
               title: 'Delete item',
               type: TB_NOTES_OBJ,
               id: `${TB_NOTES_OBJ}_delete`,
               description: `Shortcut: ${context.normaliceBindKeys(context.get(this, 'config.bindKeysDelete[0]'))}`,
               icon: {
                  iconClass: 'mdi-delete small_ico',
               },
               enabled: $rule => {
                  return _encriptAndKey($rule);
               },
               exectFunc: (obj, $rule) => {
                  deleteNote($rule);
               },
            },
            {
               title: NEW_NOTE_STR,
               type: `${TB_NOTES_OBJ}_MAKE`,
               enabled: $rule => {
                  return false;
               },
               id: `${TB_NOTES_OBJ}_make_item`,
               async exectFunc(obj, $rule, event) {
                  gotoEditNote(obj, $rule, event);
               },
            },
         ];
      },
      defineTypeViewers() {
         const viewerComp = createViewerNotesBase({}, async (resolve, reject, $rule) => {
            let data = (await getDataFromRule($rule)) || '';
            if (Config.isDev) console.log('[NTEST] first get data, size:', data.length);
            resolve({
               component: noteComponent({
                  data,
                  rule: $cloneDeep($rule),
                  event: dataExternalEvents,
                  saveRule: saveRule,
                  openExternal: openExternal,
                  deleteNote: deleteNote,
                  editorOptions: thisConfig.editorOptions,
                  cache_session: $cache_session,
                  context: context,
                  refreshData: forceRefreshData,
                  onUnmountViewer: () => (forceEditViewer = false),
                  setKey: __setKey,
                  hasKey: __hasKey,
                  deleteKeyDeb: __deleteKeyDeb,
                  getDataFile: getDataFile,
                  onChange(data, rule) {
                     if (thisConfig.autoSave === true) {
                        debSaveRule(data, rule);
                     }
                  },
               }),
            });
         });

         const newNoteComp = createViewerNotesBase({}, (resolve, reject, $rule) => {
            let dataNewRule = getDataNewRule();

            lastsetRulesFromDbCache = {};
            setRulesFromDb(notesDataDb.concat([dataNewRule]));

            resolve({
               component: noteComponent({
                  data: '',
                  rule: dataNewRule,
                  event: dataExternalEvents,
                  openExternal: openExternal,
                  context: context,
                  saveRule: async (data, rule) => {
                     let res = await saveRule(data, rule);
                     if ($context.getPath().path === NOTES_PATH_OBJ_NEW_ONLY.path) {
                        $context.setPath(NOTES_PATH_OBJ);
                     }
                     return res;
                  },
                  cancelRule: (data, rule) => {
                     if (Config.isDev) console.log('CANCEL ITEM', rule.params);
                     if ($get(rule, 'params._note_is_new')) {
                        if ($context.getPath().path === NOTES_PATH_OBJ_NEW_ONLY.path) {
                           $context.setPath('/');
                        }
                     }
                  },
                  editorOptions: thisConfig.editorOptions,
                  cache_session: $cache_session,
                  autoFocusEmptyTitle: $context.getPath().path === NOTES_PATH_OBJ_NEW_ONLY.path,
                  refreshData: forceRefreshData,
                  setKey: __setKey,
                  hasKey: __hasKey,
                  deleteKeyDeb: __deleteKeyDeb,
                  getNewNote: getDataNewRule,
                  getDataFile: getDataFile,
                  onEscape: $rule => {
                     if (!$rule || ($context.getPath().path === NOTES_PATH_OBJ_NEW_ONLY.path && !$rule.title)) {
                        $context.setPath('/');
                     }
                     return false;
                  },
               }),
            });
         });

         return [
            {
               type: TB_NOTES_OBJ,
               title: 'Note niewer',
               async enabled($rule) {
                  if (forceEditViewer) return true;

                  const type = $get($rule, 'params._note_type');
                  const path = $get($context.getPath(), 'path');

                  //FOR FILES, ONLY VIEWER IN INTERNAL
                  if (thisConfig.typesWithHiddenViewer.includes(type) && path.indexOf('INTERNAL_PACK_NOTES') !== 0) {
                     return false;
                  }

                  return true;
               },
               viewerComp: viewerComp,
            },
            {
               type: `${TB_NOTES_OBJ}_MAKE`,
               title: 'New item',
               async enabled($rule) {
                  return true;
               },
               viewerComp: newNoteComp,
            },
         ];
      },
   };
};
