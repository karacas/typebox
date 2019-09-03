module.exports = context => {
   return require(context.replaceJSX('./package.jsx'))(context);
};
