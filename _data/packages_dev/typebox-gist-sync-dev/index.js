'use strict';

const GitHub = require('github-api');
const path = require('path');
const fs = require('fs');

const defaultConfig = {
   __getGitTokenIn: 'https://github.com/settings/tokens/new',
   __getGitTokenIn: 'https://github.com/settings/tokens',
   token: null,
   disabled: false,
   syncOnDev: false,
   gapTimePromises: 120,
   gistDescription: 'typebox-config-sync{dev}{terminal}-0.0.6',
   lastKnowHashFile: '.gistsynchash/gsh__{file}.json',
   sizeLaskKnows: '40',
   syncTime: 60 * 60 * 1000,
   startOnInit: true,
   syncFiles: [
      { file: 'user_settings.json', ignore: ['width', 'maxItemsVisible'] },
      {
         path: null,
         type: 'JSON5',
         file: 'typebox-gist-sync-dev_user_settings.json',
         ignore: ['token', 'disabled', 'syncOnDev'],
      },
      { path: null, type: 'JSON', file: 'protected_notes_rules.json' },
   ],
};

//KTODO: #672342
//definir poriero la api, hacerla genérica en un internal, después registrar gist como un sincronizer, luego este plugin q usa el sincronizer
//usar awaits
//Hacer test
//
//el comparator también en un file con wrapp aparte
//el transform, osea json5,json, o plain también en file aparte
//la github-api en el main, que la traiga context, ver de duplicarla y mandarle got
//que por cada sincronizer haya un new Sync, y pasarle como parámetro los wrapps
//el comparator hacerlo por date, eso significa hacer un gist por cada config

module.exports = context => {
   const _get = context.get;

   const hashCode = val => {
      return context.global_aux.makeHash(String(JSON5.stringify(val)));
   };

   const JSON5 = context.require('json5');
   const mkpath = context.require('make-dir');
   const { pick, omit } = context.require('lodash');
   const uniq = arr => [...new Set(arr)];

   let $gistObj;
   let $gh = null;
   let $gistId = null;

   let $init = false;

   let $console = {};
   let $config = {};

   let $saveOnNextIdle = false;

   /***/

   const promiseSerial = funcs =>
      funcs.reduce((promise, func) => promise.then(result => func().then(Array.prototype.concat.bind(result))), Promise.resolve([]));

   const gisAuth = obj => {
      return new Promise((resolve, reject) => {
         if ($init && $gistId) {
            resolve($gistId);
         }
         $gh = new GitHub(obj);
         getConfigGists(true)
            .then(resp => {
               $init = true;
               resolve($gistId);
            })
            .catch(e => {
               reject(e);
            });
      });
   };

   const getConfigGists = (minVersion = false) => {
      return new Promise((resolve, reject) => {
         if (!$gh) {
            reject();
            return;
         }

         getAllGists()
            .then(resp => {
               $gistId = null;
               let resultTmp = null;
               resp.data.map(snip => {
                  if (!$gistId && snip.description === $config.gistDescription) {
                     $gistId = snip.id;
                     resultTmp = snip;
                  }
               });
               if (!resultTmp || !$gistId) {
                  resolve(null);
                  return;
               }
               if (minVersion) {
                  resolve(resultTmp);
                  return;
               }
               $gh.getGist($gistId)
                  .read()
                  .then(dataRead => {
                     resolve(dataRead.data);
                  })
                  .catch(e => {
                     reject(e);
                  });
            })
            .catch(e => {
               reject(e);
            });
      });
   };

   const getAllGists = () => {
      if (!$gh) {
         reject();
         return;
      }
      let me = $gh.getUser();
      return me.listGists();
   };

   const createGist = filesObj => {
      return new Promise((resolve, reject) => {
         if (!$gh) {
            reject();
            return;
         }

         let gist = $gh.getGist();

         gist
            .create({ public: false, description: $config.gistDescription, files: filesObj })
            .then(data => {
               $gistId = _get(data, 'data.id');
               if (!data || !$gistId) {
                  reject(data);
                  return;
               }
               resolve(data);
            })
            .catch(data => {
               reject(data);
            });
      });
   };

   const updateGist = (id, filesObj) => {
      if (!$gh || !$gistId) {
         reject();
         return;
      }

      let gist = $gh.getGist(id);

      return gist.update({
         files: filesObj,
      });
   };

   const saveToGist = files => {
      if (!$gistId) {
         return createGist(files);
      } else {
         return updateGist($gistId, files);
      }
   };

   const saveFileToGist = (name, data) => {
      if (content != null && typeof content == 'object') {
         data = JSON.stringify(data, null, 2);
      }
      return saveToGist({
         [name]: {
            content: data,
         },
      });
   };

   const loadFileFromGist = name => {
      return new Promise((resolve, reject) => {
         getConfigGists(false)
            .then(resp => {
               if (!resp || !resp.files) {
                  resolve(null);
                  return;
               }

               let file = resp.files[name] || null;

               if (file && resp.updated_at) {
                  file.updated_at = new Date(resp.updated_at).valueOf();
               }
               //KTODO: Avoid cache from disk
               resolve(file);
            })
            .catch(e => {
               reject(e);
            });
      });
   };

   const loadlocalObjFile = ($path, $file, type = 'JSON5') => {
      $path = $path || context.getSetting('here_are_dragons.paths.user');
      $file = $file || 'user_settings.json';
      let file2load = path.join($path, $file);
      let fileloaded = context.getFile(file2load, type) || null;

      let date = null;
      if (fileloaded) {
         let stats = fs.statSync(file2load);
         date = +new Date() || null;
      }
      return { fileloaded, date };
   };

   const saveocalObjFile = ($path, $file, $data, type = 'JSON5') => {
      if ($data === null) return;
      $path = $path || context.getSetting('here_are_dragons.paths.user');
      $file = $file || 'user_settings.json';
      let file2save = path.join($path, $file);
      let filesaved = context.setFile(file2save, $data, type);
      return filesaved;
   };

   const loadGistObjFile = ($file, type = 'JSON5') => {
      return new Promise((resolve, reject) => {
         let result = null;
         $gistObj
            .then(() => {
               return loadFileFromGist($file);
            })
            .then(file => {
               if (file) {
                  if (type.toLowerCase() === 'json5') {
                     try {
                        result = JSON5.parse(file.content);
                     } catch (e) {
                        $console.log('[typebox-gist]', 'file no obj', e);
                        result = null;
                     }
                  } else if (type.toLowerCase() === 'json') {
                     try {
                        result = JSON.parse(file.content);
                     } catch (e) {
                        $console.log('[typebox-gist]', 'file no obj', e);
                        result = null;
                     }
                  } else {
                     result = file.content;
                  }
               } else {
                  result = null;
                  $console.log('[typebox-gist]', 'loadGistObjFile noFile', $file, file);
               }
               resolve({ content: result, url: file.raw_url });
            })
            .catch(e => {
               resolve({ content: null, url: null });
            });
      });
   };

   const getContentsPairSync = syncRule => {
      return new Promise((resolve, reject) => {
         let localFileObj = loadlocalObjFile(syncRule.path, syncRule.file, syncRule.type);
         let localFile = localFileObj.fileloaded || null;
         let localFileDate = localFileObj.date || null;

         let gistFile;
         let gistFileUrl;

         loadGistObjFile(syncRule.file)
            .then(file => {
               gistFile = file.content;
               gistFileUrl = file.url;
               resolve({ localFile, localFileDate, gistFile, gistFileUrl });
            })
            .catch(e => {
               resolve({ localFile: null, localFileDate: null, gistFile: null, gistFileUrl: null });
            });
      });
   };

   const normaliceSyncRuleContent = (syncRule, content) => {
      if (content == null) return null;
      if (typeof content != 'object') return content;
      let result = omit(content, syncRule.ignore);
      return result;
   };

   const hashSyncRuleContent = (syncRule, content) => {
      if (!(content !== null && typeof content == 'object')) return null;
      let result = hashCode(content);
      return result;
   };

   const comparator = syncRule => {
      return new Promise(($resolve, reject) => {
         getContentsPairSync(syncRule)
            .then(obj => {
               let _lastKnowHashFile = $config.lastKnowHashFile.replace('{file}', syncRule.file.replace('.json', ''));

               let lastKnowHashes = loadlocalObjFile(context.getSetting('here_are_dragons.paths.user'), _lastKnowHashFile, 'JSON5').fileloaded || {
                  lastKnowHash: null,
                  lastKnowHashes: [],
               };

               let lastKnowHash = lastKnowHashes.lastKnowHash;

               let local = obj.localFile;
               let localDate = obj.localFileDate;

               let localNormalized = normaliceSyncRuleContent(syncRule, obj.localFile);
               let gistNormalized = normaliceSyncRuleContent(syncRule, obj.gistFile);
               let gistUrl = normaliceSyncRuleContent(syncRule, obj.gistFileUrl);

               let localHash = hashSyncRuleContent(syncRule, localNormalized);

               let gistHash = hashSyncRuleContent(syncRule, gistNormalized);

               let localId = `${localHash}@${localDate}`;
               let gistFileId = `${gistHash}@${hashCode(gistUrl)}`;

               let local_isInlastKnowHashes = lastKnowHashes.lastKnowHashes.includes(localId);
               let gist_isInlastKnowHashes = lastKnowHashes.lastKnowHashes.includes(gistFileId);

               $console.log(
                  '[typebox-gist]   ',
                  '\nlocalNormalized:     ',
                  localNormalized,
                  '\ngistNormalized:      ',
                  gistNormalized,
                  '\nlocalHash: ',
                  localHash,
                  '\ngistHash:  ',
                  gistHash,
                  '\nlastKnowHash:  ',
                  lastKnowHash,
                  '\nlastKnowHashes:  ',
                  lastKnowHashes,
                  '\nlocal_isInlastKnowHashes:  ',
                  local_isInlastKnowHashes,
                  '\ngist_isInlastKnowHashes:  ',
                  gist_isInlastKnowHashes,
                  '\nlocalId:  ',
                  localId,
                  'gistFileId:  ',
                  gistFileId
               );

               const _validHash = hash => {
                  return hash && hash !== null && hash.length > 1;
               };

               const _saveHasah2File = hash => {
                  if (!_validHash(hash)) return;

                  let _lastKnowHashes = {
                     lastKnowHash: hash,
                     lastKnowHashes: uniq([gistFileId.replace('null', '-'), localId.replace('null', '-'), ...lastKnowHashes.lastKnowHashes]).slice(
                        0,
                        $config.sizeLaskKnows
                     ),
                  };

                  if (hashCode(lastKnowHashes) === hashCode(_lastKnowHashes)) return;

                  return saveocalObjFile(context.getSetting('here_are_dragons.paths.user'), _lastKnowHashFile, _lastKnowHashes, 'JSON');
               };

               const _savelocal2gist = () => {
                  //KTODO: VER DE PONERLE COMENTS
                  if (localNormalized === null) return $resolve();

                  if (localNormalized === hashCode(obj.gistFile)) {
                     _saveHasah2File(localHash);
                     return $resolve();
                  }

                  $gistObj
                     .then(() => {
                        return saveFileToGist(syncRule.file, localNormalized);
                     })
                     .then(() => {
                        _saveHasah2File(localHash);
                        setTimeout(() => {
                           $resolve();
                        }, $config.gapTimePromises);
                     })
                     .catch(e => {
                        $console.warn('[typebox-gist]', 'Saved gist fail', e);
                        $resolve();
                     });
               };

               const _saveGist2local = () => {
                  //KTODO: VER DE PONERLE COMENTS
                  if (gistNormalized === null || gistNormalized === undefined) $resolve();

                  //KTODO
                  let data = Object.assign({}, pick(local, syncRule.ignore), gistNormalized);

                  _saveHasah2File(gistHash);

                  if (hashCode(data) === hashCode(local)) {
                     return $resolve();
                  }

                  saveocalObjFile(syncRule.path, syncRule.file, data, syncRule.type);
                  setTimeout(() => {
                     $resolve();
                  }, $config.gapTimePromises);
               };

               const _compareInSomeLastsAndSaveNew = () => {
                  let someHashes = uniq(lastKnowHashes.lastKnowHashes.map(hs => hs.split('@')[0]));
                  let localInSomeLash = someHashes.includes(localHash);
                  let gistInSomeLash = someHashes.includes(gistHash);

                  if (localInSomeLash !== gistInSomeLash) {
                     if (!localInSomeLash) {
                        $console.log('[typebox-gist]', '>> COMPARE In some >> local win');
                        return _savelocal2gist();
                     }
                     if (!gistInSomeLash) {
                        $console.log('[typebox-gist]', '>> COMPARE In some >> gist win');
                        return _saveGist2local();
                     }
                  }

                  return false;
               };

               const _compareNoNullAndSaveNew = () => {
                  if (!_validHash(localHash) && _validHash(gistHash)) {
                     $console.log('[typebox-gist]', '>> COMPARE noNull >> gist win');
                     return _saveGist2local();
                  }
                  if (!_validHash(gistHash) && _validHash(localHash)) {
                     $console.log('[typebox-gist]', '>> COMPARE noNull >> local win');
                     return _savelocal2gist();
                  }
                  return false;
               };

               const _compareAndSaveNew = () => {
                  $console.log('[typebox-gist]', '>> COMPARE Save2local');
                  //KTODO: Que gane el no vacio nulo o corrupto
                  if (_compareInSomeLastsAndSaveNew() !== false) return;
                  return _saveGist2local();
               };

               // ERROR NO HASH
               if (!_validHash(localHash)) {
                  $console.warn('[typebox-gist]', 'LOCAL NO HASH', local, localNormalized, localHash);
                  if (_compareNoNullAndSaveNew() == false) return $resolve();
               }

               //NO GIST
               if (!_validHash(gistHash)) {
                  $console.log('[typebox-gist]', '>> NO GIST');
                  if (_compareNoNullAndSaveNew() !== false) return;
               }

               // SECOND INSTANCE, SAVE GIST 2 local
               if (!_validHash(lastKnowHash)) {
                  $console.log('[typebox-gist]', '>> SECOND INSTANCE > Gist 2 local');
                  return _saveGist2local();
               }

               //EQUALS > RETURN
               if (localHash === gistHash) {
                  $console.log('[typebox-gist]', '>> EQUALS > RETURN');
                  _saveHasah2File(localHash);
                  return $resolve();
               }

               //unknouns & differents
               if (!local_isInlastKnowHashes && !gist_isInlastKnowHashes) {
                  $console.log('[typebox-gist]', '>> unknouns & differents: COMPARE');
                  return _compareAndSaveNew();
               }

               //New local
               if (!local_isInlastKnowHashes) {
                  $console.log('[typebox-gist]', '>> NEW LOCAL > Save to gist');
                  return _savelocal2gist();
               }

               //New Gist
               if (!gist_isInlastKnowHashes) {
                  $console.log('[typebox-gist]', '>> NEW GIST > Save to local');
                  return _saveGist2local();
               }

               //knouns but differents
               if (local_isInlastKnowHashes && gist_isInlastKnowHashes) {
                  $console.log('[typebox-gist]', '>> knouns but differents: COMPARE');
                  return _compareAndSaveNew();
               }

               $resolve();
            })
            .catch(e => {
               $console.warn('[typebox-gist] fail get pairs:', syncRule);
               $resolve();
            });
      });
   };

   const sync = () => {
      return new Promise(($resolve, reject) => {
         $console.info('[typebox-gist] Start sync');
         $gistObj = gisAuth({ token: $config.token })
            .then(() => {
               promiseSerial($config.syncFiles.map(obj => () => comparator(obj)))
                  .then(() => {
                     $console.info('[typebox-gist]', 'Sync end ok');
                     $resolve();
                  })
                  .catch(e => {
                     $console.error('[typebox-gist] ', e);
                     reject();
                  });
            })
            .catch(e => {
               $console.error('[typebox-gist] No Gist gisAuth:', e);
               reject();
            });
      });
   };

   return {
      config: defaultConfig,
      init() {
         //KTODO: Usar un setInterval o idle para volver a disparar

         $console = context.logger;
         $config = this.config;

         //KTODO: Si es un obj, no un array insertar directo
         context.addPermanentRules([
            {
               title: 'Sync configs',
               path: 'internal_pack_options',
               type: ['gist-sync-now'],
               icon: {
                  type: 'iconFont',
                  iconClass: 'mdi-cloud-sync',
               },
            },
         ]);

         if ($config.disabled) {
            $console.info('[typebox-gist] disabled in config');
            return;
         }

         if (!$config.token) {
            $console.warn('[typebox-gist] No token: go to https://github.com/settings/tokens/new');
            return;
         }

         $config.dev = context.getSetting('dev');

         if ($config.syncOnDev !== true && $config.dev) {
            $console.info('[typebox-gist] disabled on dev');
            return;
         }

         if (context.getSetting('dev')) {
            $config.gistDescription = $config.gistDescription
               .replace('{dev}', '_dev')
               .replace('{terminal}', `_${context.getSetting('here_are_dragons.terminalName')}_`);
         } else {
            $config.gistDescription = $config.gistDescription.replace('{dev}', '').replace('{terminal}', '');
         }

         //SYNC NOW
         if ($config.startOnInit) {
            sync().then(() => {});
         }

         //ON CHANGE SYNC NEXT IDLE
         //KTODO: que escuche también los changeSettings de los plugins
         context.on('changeSettings', () => {
            $saveOnNextIdle = true;
         });

         context.on('idle', () => {
            if ($saveOnNextIdle) {
               $console.info('[typebox-gist] Start on changeSettings');
               $saveOnNextIdle = false;
               sync().then(() => {});
            }
         });

         //SYNC EVERY syncTime
         if ($config.syncTime && $config.syncTime > 0) {
            context.onIdleTimeInterval(() => {
               $console.info('[typebox-gist] Start on idle');
               sync().then(() => {});
            }, $config.syncTime);
         }
      },
      defineTypeExecutors() {
         //KTODO: Config visual, mínimo para token
         return [
            {
               title: 'Sync configs',
               type: 'gist-sync-now',
               id: 'gist-sync-now' + 'OCP',
               enabled: obj => {
                  return false;
               },
               exectFunc: obj => {
                  let _path = 'internal_pack_options_info';
                  context.setPath(_path);
                  context.putLoader(_path, 'Sync in progress');
                  sync().then(() => {
                     context.putInfo(_path, 'Sync end ok');
                  });
               },
            },
         ];
      },
   };
};
