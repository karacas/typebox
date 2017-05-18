'use strict';

const _ = require('lodash');
const path = require('path');

var driveManager;

//KTODO: Usar fontIcons con colores
var iconFolder = {
    type: 'iconFont',
    iconClass: 'mdi-folder palette-Amber-A200 text'
};
var iconFile = {
    type: 'iconFont',
    iconClass: 'mdi-file palette-Light-Blue-A100 small_ico text'
};
var iconArchive = {
    type: 'iconFont',
    iconClass: 'mdi-harddisk palette-Cyan-A700 text'
};

module.exports = {
    config: {},
    init() {
        this.driveManager = this.app.getDriveManager();

        this.returnPathsFromItem = item => {
            let pathItem = _.result(item, 'rule.params.drive_path');

            if (!pathItem) return;

            this.app.setPath({
                path: 'fs-path' + pathItem,
                icon: iconArchive,
                name: pathItem.replace(/\\/g, '/')
            });
        };

        //Print Path rules
        this.returnPaths = currentPath => {
            if (!this.driveManager) return;

            let pathRoute = 'fs-path' + currentPath;

            this.app.putLoader(pathRoute);

            this.driveManager.getPathRules(currentPath).then(resp => {
                this.app.setRules(
                    resp.map(file => {
                        let ruleFile = {
                            persistFuzzy: false,
                            path: pathRoute,
                            params: {
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

                        return ruleFile;
                    })
                );
            });
        };

        this.app.on('changePath', path => {
            if (_.startsWith(path, 'fs-path')) {
                var path = path.replace('fs-path', '');
                this.returnPaths(path);
            }
        });

        //On "/" key
        this.app.on('changeQuery', txt => {
            if (this.app.getPath().path === '/' && txt === '/') {
                this.app.setPath({
                    path: 'fs-path' + '/',
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
            }
        ];
    }
};
