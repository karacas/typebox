'use strict';

let scoreKrc = function(str, word) {
    if (word === str) {
        return 1;
    }

    if (word === '') {
        return 0;
    }

    let runningScore = 0;
    let charScore = 0;
    let wordLength = word.length;
    let idxOf;
    let i = 0;
    let startAt = 0;
    let lasStr;
    let cont = 0;

    for (i; i < wordLength; i++) {
        if (-1 === (idxOf = str.indexOf(word[i], startAt))) {
            return 0;
        }

        if (0 === idxOf) {
            if (0 === i) {
                //FIRST LETTER
                cont = 1;
                charScore += 0.5;
            } else {
                // NORMAL
                cont = 0;
                charScore += 0.1;
            }
        } else {
            lasStr = str[idxOf - 1];
            if (' ' === lasStr) {
                //ANT IS SPACE
                cont = 0;
                charScore += 0.3;
            } else if (0 !== i && lasStr === word[i - 1]) {
                //MACH CARACTER ANTERIOR
                cont++;
                charScore += Math.min(0.1 * cont, 0.6);
                //MACH 2nd CARACTER ANTERIOR
            } else {
                // NORMAL
                cont = 0;
                charScore += 0.1;
            }
        }

        runningScore += charScore;
        startAt = idxOf + 1;
    }

    return Math.min((runningScore / str.length + runningScore / wordLength) / 4, 0.99);
};

module.exports = scoreKrc;
