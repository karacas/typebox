'use strict';

const _ = require('lodash');
const path = require('path');
const Config = require('../../config.js');
const { bindKet2actualOs, getKeyFromConfig } = require('../../../auxfs.js');

let driveManager;

//KTODO: Usar fontIcons con colores
let iconFolder = {
    type: 'iconFont',
    iconClass: 'mdi-folder palette-Amber-A200 text'
};
let iconFile = {
    type: 'iconFont',
    iconClass: 'mdi-file small_ico text'
};
let iconArchive = {
    type: 'iconFont',
    iconClass: 'mdi-harddisk palette-Cyan-A700 text'
};

module.exports = context => {
    return {
        config: {},
        init() {
            this.driveManager = context.getDriveManager();

            this.returnPathsFromItem = item => {
                let pathItem = _.result(item, 'rule.params.drive_path');

                if (!pathItem) return;

                context.setPath({
                    path: 'typebox-path' + pathItem,
                    icon: iconArchive,
                    name: pathItem.replace(/\\/g, '/')
                });
            };

            //Print Path rules
            this.returnPaths = currentPath => {
                if (!this.driveManager) return;

                let pathRoute = 'typebox-path' + currentPath;

                context.putLoader(pathRoute);

                this.driveManager.getPathRules(currentPath).then(resp => {
                    context.setRules(
                        resp.map(file => {
                            let ruleFile = {
                                persistFuzzy: false,
                                path: pathRoute,
                                params: {
                                    isDir: file.isDir,
                                    drive_path: file.path,
                                    string: file.path
                                }
                            };

                            if (file.isDir) {
                                ruleFile.title = String(file.path).split(path.sep).slice(-1)[0] || file.path;
                                ruleFile.searchField = ruleFile.title;
                                ruleFile.icon = iconFolder;
                                ruleFile.type = ['path', 'string'];
                            }

                            if (file.isFile) {
                                ruleFile.title = path.parse(file.path).base;
                                ruleFile.searchField = ruleFile.title;
                                ruleFile.icon = iconFile;
                                ruleFile.type = ['file', 'string'];
                            }

                            if (file.iconType === 'dataURL' && file.iconUrl) {
                                ruleFile.type = ['file', 'string'];
                                ruleFile.icon = {
                                    type: 'iconSrc',
                                    iconData: file.iconUrl
                                };
                            }
                            if (file.iconType == 'iconFont' && file.iconClass) {
                                ruleFile.icon = {
                                    type: 'iconFont',
                                    iconClass: file.iconClass
                                };
                            }
                            return ruleFile;
                        })
                    );
                });
            };

            context.on('changePath', path => {
                if (_.startsWith(path, 'typebox-path')) {
                    this.returnPaths(path.replace('typebox-path', ''));
                }
            });

            //On "/" key
            context.on('changeQuery', txt => {
                if (context.getPath().path === '/' && txt === '/') {
                    context.setPath({
                        path: 'typebox-path' + '/',
                        icon: iconArchive,
                        name: ' '
                    });
                }
            });
        },
        defineTypeExecutors() {
            return [
                {
                    title: 'Explore Path',
                    id: 'fspaths_explorepath',
                    type: 'path',
                    icon: {
                        iconClass: 'feather-disc small_ico text'
                    },
                    exectFunc: this.returnPathsFromItem
                },
                {
                    title: 'Navigate Path',
                    id: 'fspaths_navigatepath',
                    type: 'path',
                    icon: {
                        iconClass: 'mdi-window-maximize  small_ico text'
                    },
                    exectFunc: this.driveManager.openFile
                },
                {
                    title: 'Open Path in Terminal',
                    id: 'fspaths_opentermpath',
                    description: '[ shortcut: ' + getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'OPEN_IN_TERMINAL') + ' ]',
                    type: 'path',
                    icon: {
                        iconClass: 'mdi-console  small_ico text'
                    },
                    exectFunc: this.driveManager.openTerminal
                },
                {
                    title: 'Open File',
                    id: 'fspaths_openfile',
                    type: 'file',
                    icon: {
                        iconClass: 'mdi-play-circle-outline  small_ico text'
                    },
                    exectFunc: obj => {
                        this.driveManager.openFile(obj);
                    }
                },
                {
                    title: 'Open File Path in Terminal',
                    id: 'fspaths_file_opentermpath',
                    description: '[ shortcut: ' + getKeyFromConfig(Config.get('here_are_dragons.bindKeys'), 'OPEN_IN_TERMINAL') + ' ]',
                    type: 'file',
                    icon: {
                        iconClass: 'mdi-console  small_ico text'
                    },
                    exectFunc: this.driveManager.openTerminal
                },
                {
                    title: 'Navigate File Path Container',
                    id: 'fspaths_opentermpath',
                    type: 'file',
                    icon: {
                        iconClass: 'mdi-window-maximize  small_ico text'
                    },
                    exectFunc: obj => {
                        let objPath = path.parse(obj.rule.params.drive_path).dir;
                        this.driveManager.openFile(objPath);
                    }
                }
            ];
        }
    };
};
