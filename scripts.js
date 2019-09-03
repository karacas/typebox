const _package = require('./package.json');
const argv = require('yargs').argv;
const child_process = require('child_process');

const _auxMakeGit = (param = '-auto') => {
   const version = _package.version;
   const msg = version + ' ' + param;

   let command = '(git add . -A || true) && (git status) && (git commit -m "{(msg}}" || true)';
   command = command.replace('{(msg}}', msg);

   let result;

   try {
      result = child_process.execSync(command, ['init'], { stdio: 'inherit' }).toString();
      console.log('\n', msg, '\n', result, '\n');
      return true;
   } catch (e) {
      return false;
      console.log('\n', e, '\n');
   }
};

let command = argv._[0];
let param1 = argv._[1];
let param2 = argv._[2];

if (!true) {
   console.log(command);
   console.log(param1);
}

if (command === 'autoGit') {
   _auxMakeGit(param1);
}
