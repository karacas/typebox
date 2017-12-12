const spawn = require('threads').spawn;

let threadHighlight = null;
const memoizeHighlight = [];
const codeSliceChhar = 420;

const memoizeHighlight_push = (id, result) => {
    if (!id || !result) return;
    id = String(id).slice(0, codeSliceChhar);
    let obj = memoizeHighlight.find(obj => obj.id === id);
    if (!obj) memoizeHighlight.push({ id, result });
};

const memoizeHighlight_get = id => {
    if (!id) return;
    id = String(id).slice(0, codeSliceChhar);
    let obj = memoizeHighlight.find(obj => obj.id === id);
    if (obj) return obj;
    return null;
};

let definethreadHighlight = () => {
    if (threadHighlight) return;
    threadHighlight = spawn((obj, done) => {
        if (!obj || !obj.code || !obj.querySelector) done('');

        let highlight = require('highlight.js');
        let cheerio = require('cheerio');
        let $ = cheerio.load(obj.code);

        $(obj.querySelector).each(function(i, block) {
            $(this).html(highlight.highlightAuto($(this).text()).value);
            $(this).addClass('hljs');
            if (obj && obj.addclass && obj.addclass.length > 0) {
                obj.addclass.forEach(_class => {
                    $(this).addClass(_class);
                });
            }
        });
        done({ result: $.html(), id: obj.code.slice(0, obj.codeSliceChhar) });
        $ = null;
        obj = null;
    });
};

function makehighlight(code, querySelector = 'code', addclass = []) {
    definethreadHighlight();
    let $code = code + '';
    return new Promise((resolve, reject) => {
        let mem = memoizeHighlight_get(querySelector + addclass.join() + $code);

        if (mem) {
            resolve(mem.result);
            return;
        }

        threadHighlight.send({ code: $code, querySelector, addclass, codeSliceChhar }).on('message', response => {
            if ($code.slice(0, codeSliceChhar) == response.id) {
                memoizeHighlight_push(querySelector + addclass.join() + $code, response.result);
                resolve(response.result);
            } else {
                //KERROR: parece que está ok
                //LA DATA ES VIEJA< VUELVE A EJECUTAR
                setTimeout(() => {
                    resolve(makehighlight($code, querySelector, addclass));
                }, 0);
            }
        });
    });
}

module.exports = makehighlight;
