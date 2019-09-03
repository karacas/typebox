let InlineWorker = null;
let worker = null;

const parseData = _data => {
   InlineWorker = InlineWorker || require('inline-worker');

   worker =
      worker ||
      new InlineWorker(function(self) {
         self.onmessage = function(e) {
            postMessage(self._parse(e.data));
         };
         self._parse = function(msg) {
            return JSON.parse(msg);
         };
      }, {});

   return new Promise(res => {
      worker.onmessage = function(e) {
         res(e.data);
      };
      worker.postMessage(_data);
   });
};

module.exports = parseData;
