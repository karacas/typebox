'use strict';

module.exports.replaceJSX = $file => {
   return $file.replace('.jsx', '_tb_transpiled.js');
};
