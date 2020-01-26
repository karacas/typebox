'use strict';

const prettier_config = require('./prettier.config.js');
const prettier_config_json = Object.assign({}, prettier_config, { parser: 'json' });
const prettier_config_html = Object.assign({}, prettier_config, { parser: 'html' });
const prettier_config_yaml = Object.assign({}, prettier_config, { parser: 'yaml' });
const { replaceJSX } = require('./app/auxs/aux_replace_jsx.js');
const { normalicePath } = require('./app/auxs/aux_global.js');
const symlinkDir = require('symlink-dir');
const globby = require('globby');

const _auxMakeSucrase = function(file, task) {
   // npx sucrase c:/typebox/app/js/mainView/ -d d:/tmp -t jsx
   let command = 'npx sucrase {$fileIn} -d {$fileOut} -t jsx';
   let fileIn = normalicePath(file.dir, true);
   let fileOut = 'd://tmp//';
   let $command = command.replace('{$fileOut}', fileOut).replace('{$fileIn}', fileIn);
   return task.source(fileIn).shell($command);
};

const _auxMakeBabel = function(file, task) {
   let command = 'npx babel {$fileIn} -o {$fileOut} --config-file ./babel.config.js';
   let fileIn = normalicePath(`${file.dir}/${file.base}`, true);
   let fileOut = normalicePath(replaceJSX(fileIn), true);
   let $command = command.replace('{$fileOut}', fileOut).replace('{$fileIn}', fileIn);
   return task.source(fileIn).shell($command);
};

const _auxMakeYarn = function(file, task) {
   let command = 'yarn install --non-interactive --prod --cwd {$fileIn}';
   let fileIn = normalicePath(`${file.dir}/${file.base}`, true);
   let fileOut = normalicePath(replaceJSX(fileIn), true);
   let $command = command.replace('{$fileIn}', fileIn);
   return task.source(fileIn).shell($command);
};

exports.symPacks = function*(task) {
   yield task.source(['./packages_dev']).run({}, function*(file) {
      // yield _auxMakeSymPacks(file, task)
      let fileIn = normalicePath(`${file.dir}/${file.base}`, true);
      let fileOut = normalicePath(`${'./app/' + '/'}${fileIn}`);
      let fileOut2 = normalicePath(`${'./_data/' + '/'}${fileIn}`);

      // console.log(fileIn, fileOut, fileOut2)
      symlinkDir(fileIn, fileOut2)
         .then(result => {
            // console.log(result)
         })
         .catch(err => console.error(err));

      symlinkDir(fileIn, fileOut)
         .then(result => {
            // console.log(result)
         })
         .catch(err => console.error(err));
   });
};

exports.pruneDevOld = function*(task) {
   let pruneDev = require('./prune_data.js').dev.map(obj => {
      let glob = obj;
      // console.log(glob);
      return glob;
   });

   yield task.clear(pruneDev);
};

exports.pruneDev = function*(task) {
   let pruneDev = globby.sync(require('./prune_data.js').dev, { onlyFiles: false, caseSensitiveMatch: false });
   // console.log(pruneDev);
   yield task.clear(pruneDev);
};

exports.packagesYarn = function*(task) {
   yield task.source(['./packages_dev/*/package.json']).run({}, function*(file) {
      yield _auxMakeYarn(file, task);
   });
};

exports.makeBabel = function*(task) {
   yield task.source(['./app/**/*.jsx', './packages_dev/**/*.jsx']).run({}, function*(file) {
      yield _auxMakeBabel(file, task);
   });
};

exports.uglify = function*(task) {
   yield task
      .source([
         './node_modules/rxjs/bundles/Rx.js',
         './node_modules/lodash/lodash.js',
         './node_modules/react-dom/umd/react-dom-unstable-fire.development.js',
         './node_modules/react-dom/umd/react-dom.development.js',
         './node_modules/react-dom/cjs/react-dom-unstable-fire.development.js',
         './node_modules/react-dom/cjs/react-dom.development.js',
         './node_modules/@fortawesome/free-solid-svg-icons/index.js',
         './node_modules/@fortawesome/free-solid-svg-icons/index.es.js',
         './node_modules/rc-tree-select/dist/rc-tree-select.js',
         './node_modules/stacktrace-js/dist/stacktrace-with-promises-and-json-polyfills.js',
         './node_modules/rc-calendar/dist/rc-calendar.js',
         './node_modules/rc-slider/dist/rc-slider.js',
         './node_modules/rc-table/dist/rc-table.js',
         './node_modules/draft-js/dist/Draft.js',
         './node_modules/gear-lib/build/gear-lib.js',
         './node_modules/codemirror/lib/codemirror.js',
         './node_modules/esprima/dist/esprima.js',
         './node_modules/ajv/dist/ajv.bundle.js',
         './node_modules/stacktrace-js/dist/stacktrace.js',
         './node_modules/simple-plist/node_modules/plist/dist/plist.js',
         './node_modules/codemirror/keymap/vim.js',
         './node_modules/jquery/dist/jquery.js',
         './node_modules/source-map/dist/source-map.debug.js',
         './node_modules/stacktrace-gps/node_modules/source-map/dist/source-map.debug.js',
         './node_modules/jquery/dist/jquery.slim.js',
         './node_modules/acorn/dist/acorn.js',
         './node_modules/css-tree/dist/csstree.js',
         './node_modules/@emmetio/expand-abbreviation/dist/expand-full.js',
         './node_modules/immutable/dist/immutable.js',
         './node_modules/immutable/dist/immutable.es.js',
         // './_local_node_modules/prettier-standalone/parser-angular.js',
         // './_local_node_modules/prettier-standalone/parser-babylon.js',
         // './_local_node_modules/prettier-standalone/parser-flow.js',
         // './_local_node_modules/prettier-standalone/parser-glimmer.js',
         // './_local_node_modules/prettier-standalone/parser-graphql.js',
         // './_local_node_modules/prettier-standalone/parser-html.js',
         // './_local_node_modules/prettier-standalone/parser-markdown.js',
         // './_local_node_modules/prettier-standalone/parser-postcss.js',
         // './_local_node_modules/prettier-standalone/parser-typescript.js',
         // './_local_node_modules/prettier-standalone/parser-yaml.js',
         // './_local_node_modules/prettier-standalone/standalone.js',
      ])

      .shell('npx terser $file -c -m -o $file');
};

exports.makeStylus = function*(task) {
   yield task
      .source('./app/css/style.styl')
      .stylus({ compress: false })
      .target('./app/css/');

   yield task
      .source('./packages_dev/*/*.styl')
      .stylus({ compress: false })
      .target('./packages_dev/');
};

exports.prettierStylus = function*(task) {
   yield task.source('./app/**/*.styl').shell('npx stylus-supremacy format $file -r');
   yield task.source('./packages_dev/*/*.styl').shell('npx stylus-supremacy format $file -r');
};

exports.optimizeCssOld = function*(task) {
   yield task
      .source([
         './app/css/style.css',
         './node_modules/google-material-color/dist/palette.css',
         './node_modules/@mdi/font/css/materialdesignicons.css',
         './node_modules/google-material-color/dist/palette.var.css',
      ])
      .shell('npx postcss $file -r --no-map');

   yield task.source('./packages_dev/*/*.css').shell('npx postcss $file -r --no-map');
};

exports.optimizeCss = function*(task) {
   yield task.source('package.json').shell('npx postcss app/css/style.css -r --no-map');
   yield task.source('package.json').shell('npx postcss node_modules/google-material-color/dist/*.css -r --no-map');
   yield task.source('package.json').shell('npx postcss node_modules/@mdi/font/css/*.css -r --no-map');
   yield task.source('package.json').shell('npx postcss node_modules/google-material-color/dist/*.css -r --no-map');
   yield task.source('package.json').shell('npx postcss packages_dev/*/*.css -r --no-map');
};

exports.prettierApp = function*(task) {
   yield task
      .source('./app/**/*.js')
      .prettier(prettier_config)
      .target('./app/');

   yield task
      .source('./app/**/*.jsx')
      .prettier(prettier_config)
      .target('./app/');

   yield task
      .source('./app/**/*.json')
      .prettier(prettier_config_json)
      .target('./app/');

   yield task
      .source('./app/**/*.html')
      .prettier(prettier_config_html)
      .target('./app/');
};

exports.prettierPackages_dev = function*(task) {
   yield task
      .source('./packages_dev/*/*.js')
      .prettier(prettier_config)
      .target('./packages_dev/');

   yield task
      .source('./_data_capture/packages_dev/typebox-capture/*.js')
      .prettier(prettier_config)
      .target('./_data_capture/packages_dev/typebox-capture/');

   yield task
      .source('./packages_dev/*/*.jsx')
      .prettier(prettier_config)
      .target('./packages_dev/');

   yield task
      .source('./packages_dev/*/*.html')
      .prettier(prettier_config_html)
      .target('./packages_dev/');

   yield task
      .source('./packages_dev/*/*.json')
      .prettier(prettier_config_json)
      .target('./packages_dev/');

   yield task
      .source('./_data/user_rules/*.yaml')
      .prettier(prettier_config_yaml)
      .target('./_data/user_rules/');
};

exports.prettierRoot = function*(task) {
   yield task
      .source('./*.json')
      .prettier(prettier_config_json)
      .target('./');

   yield task
      .source('./*.js')
      .prettier(prettier_config)
      .target('./');
};

exports.prettierAll = function*(task) {
   yield task.serial(['prettierApp', 'prettierPackages_dev', 'prettierRoot', 'prettierStylus']);
};

exports.prettierFast = function*(task) {
   yield task.serial(['prettierApp', 'prettierRoot']);
};

exports.default = function*(task) {
   yield task.serial(['makeBabel', 'makeStylus', 'prettierAll', 'optimizeCss']);
};
