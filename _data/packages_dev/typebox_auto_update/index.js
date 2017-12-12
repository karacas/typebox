'use strict';
const path = require('path');

module.exports = context => {
    const remote = context.require('electron').remote;
    const app = context.require('electron').app;
    const autoUpdater = remote.autoUpdater;

    const request = context.require('superagent/superagent');
    const noCache = context.require('superagent-no-cache');
    context.require('superagent-cache')(request);

    return {
        config: {
            autoStart: true,
            autoStratDelay: 10 * 1000,
            autoUpdateOnNew: true,
            enabled: true,
            setFeedURL: 'https://github.com/karacas/typebox/releases/',
            setFeedURL: 'http://127.0.0.1:8080/',
            test: 'test'
        },
        init() {
            let $console = context.logger;
            let $config = this.config;
            $config.dev = context.getSetting('dev');

            const initAutoUpdate = () => {
                $console.log('[typebox_auto_update], Start:', !$config.dev);

                if ($config.dev) {
                    $console.log('[typebox_auto_update], no utoUpdate on dev');
                    return;
                }
                if (process.argv[1] !== '--type=renderer') {
                    $console.log('[typebox_auto_update], no utoUpdate on firstrun', process.argv[1]);
                    return;
                }

                autoUpdater.on('update-availabe', () => {
                    //KTODO: crear rule
                    $console.info('[typebox_auto_update], update available');
                });

                autoUpdater.on('checking-for-update', () => {
                    $console.info('[typebox_auto_update], Start check updates');
                });

                autoUpdater.on('update-not-available', () => {
                    //KTODO: borrar rule
                    $console.info('[typebox_auto_update], update-not-available');
                });

                autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
                    $console.info('[typebox_auto_update], update-downloaded', releaseName);

                    try {
                        //KTODO: Hacer que solo sea en una rule
                        if ($config.autoUpdateOnNew) {
                            setTimeout(() => {
                                $console.info('[typebox_auto_update]', 'quitAndInstall now!');
                                autoUpdater.quitAndInstall();
                            }, $config.autoStratDelay);
                        }
                    } catch (err) {
                        $console.error('[typebox_auto_update]', err);
                    }
                });

                try {
                    autoUpdater.setFeedURL($config.setFeedURL);
                    autoUpdater.checkForUpdates();
                } catch (err) {
                    $console.error('[typebox_auto_update]', err);
                }
            };

            const checkUpdate = () => {
                if ($config.enabled && $config.setFeedURL) {
                    request
                        .get($config.setFeedURL + '/RELEASES')
                        .use(noCache)
                        .then(res => {
                            setTimeout(() => {
                                if (res && res.status === 200) {
                                    initAutoUpdate();
                                } else {
                                    $console.warn('[typebox_auto_update]', 'FeedURL is down');
                                }
                            });
                        })
                        .catch(res => {
                            setTimeout(() => {
                                $console.warn('[typebox_auto_update]', 'FeedURL is down');
                            });
                        });
                }
            };

            if ($config.autoStart) {
                setTimeout(function() {
                    checkUpdate();
                }, $config.autoStratDelay);
            }

            //KTODO: Update on idle
            //KTODO: Update on manual
        }
    };
};
