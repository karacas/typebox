'use strict';

const originalScore = (str, search) => {
   if (str === search) {
      return 1;
   }

   if (search === '') {
      return 0;
   }

   var runningScore = 0,
      charScore,
      finalScore,
      string = str,
      lString = string,
      strLength = string.length,
      lsearch = search,
      searchLength = search.length,
      idxOf,
      startAt = 0,
      i;

   for (i = 0; i < searchLength; i += 1) {
      idxOf = lString.indexOf(lsearch[i], startAt);
      if (-1 === idxOf) {
         return 0;
      }

      if (startAt === idxOf) {
         charScore = 0.7;
      } else {
         charScore = 0.1;
         if (string[idxOf - 1] === ' ') {
            charScore += 0.8;
         }
      }
      if (string[idxOf] === search[i]) {
         charScore += 0.1;
      }
      runningScore += charScore;
      startAt = idxOf + 1;
   }

   finalScore = 0.5 * (runningScore / strLength + runningScore / searchLength);

   return finalScore;
};

const scoreKrcv2 = (str, search) => {
   //EQUAL
   if (search === str) {
      return 1;
   }

   if (search === '') {
      return 0;
   }

   let strLength = str.length;
   let searchLength = search.length;

   //LENGTH 0 OR SEARCH IS LARGER
   if (searchLength >= strLength) return 0;

   //BREAKS FUZZY BY LENGHT
   if (searchLength >= 100 && str.indexOf(search) === -1) return 0;

   let strHasSpaces = str.indexOf(' ') !== -1;

   let runningScore = 0,
      charScore,
      letter,
      subStrPrev,
      idxOf,
      i = 0,
      subStr = str,
      cont_letter = true,
      cont_space = true,
      finalScore = 0;

   for (i; i < searchLength; i++) {
      letter = search[i];
      idxOf = subStr.slice(i).indexOf(letter);

      if (idxOf === -1) {
         return 0;
      }

      if (idxOf === 0) {
         if (i === 0) {
            charScore = 1;
         } else {
            cont_space = false;
            if (i <= 3) {
               charScore = 0.5;
            } else {
               charScore = 0.7;
            }
         }
      } else {
         subStrPrev = subStr;
         subStr = subStr.slice(idxOf);

         if (strHasSpaces === true && searchLength <= 3 && subStrPrev.indexOf(` ${letter}`) !== -1) {
            if (true === cont_space) {
               charScore = 0.65;
            } else {
               charScore = 0.55;
            }
            cont_space = true;
            cont_letter = false;
         } else if (cont_space === true ? i < 2 : true && subStrPrev.indexOf(search[i - 1] + letter) !== -1) {
            if (true === cont_letter) {
               charScore = 0.4;
            } else {
               charScore = 0.3;
            }
            cont_space = false;
            cont_letter = true;
         } else {
            charScore = 0.1;
            cont_space = false;
            cont_letter = false;
         }
      }

      runningScore += charScore;
   }

   finalScore = 0.5 * (runningScore / strLength + runningScore / searchLength);

   return finalScore;
};

const scoreKrcv3 = (str, search) => {
   //EQUAL
   if (str === search) {
      return 1;
   }

   const strLength = str.length;
   const searchLength = search.length;

   if (0 === strLength) {
      return 0;
   }

   //LENGTH 0 OR SEARCH IS LARGER
   if (searchLength >= strLength) {
      return 0;
   }

   //BREAKS FUZZY BY LENGHT
   if (100 <= searchLength && -1 === str.indexOf(search)) return 0;

   let strHasSpaces = -1 !== str.indexOf(' ');

   let runningScore = 0,
      charScore = 0,
      subStrPrev = '',
      idxOf = 0,
      i = 0,
      subStr = str,
      letter = '',
      cont_letter = true,
      cont_space = true,
      finalScore = 0;

   for (i; searchLength > i; i += 1) {
      letter = search[i];
      idxOf = subStr.slice(i).indexOf(letter);

      if (-1 === idxOf) {
         return 0;
      }

      if (0 === idxOf) {
         if (0 === i) {
            charScore = 1;
         } else {
            cont_space = false;
            if (3 >= i) {
               charScore = 0.5;
            } else {
               charScore = 0.7;
            }
         }
      } else {
         subStrPrev = subStr;
         subStr = subStr.slice(idxOf);
         if (0 < i) {
            if (true === strHasSpaces && searchLength <= 4 && -1 !== subStrPrev.indexOf(` ${letter}`)) {
               if (true === cont_space) {
                  charScore = 0.65;
               } else {
                  charScore = 0.55;
               }
               cont_space = true;
               cont_letter = false;
            } else if (true === cont_space ? 1 === i : true && -1 !== subStrPrev.indexOf(search[i - 1] + letter)) {
               if (true === cont_letter) {
                  charScore = 0.4;
               } else {
                  charScore = 0.3;
               }
               cont_space = false;
               cont_letter = true;
            } else {
               charScore = 0.1;
               cont_space = false;
               cont_letter = false;
            }
         } else {
            charScore = 0.1;
            cont_space = false;
            cont_letter = false;
         }
      }

      runningScore += charScore;
   }

   finalScore = 0.5 * (runningScore / strLength + runningScore / searchLength);

   return finalScore;
};

const scoreKrc = (str, search) => {
   //EQUAL
   if (str === search) {
      return 1;
   }

   const strLength = str.length;
   const searchLength = search.length;

   if (0 === strLength) {
      return 0;
   }

   //LENGTH 0 OR SEARCH IS LARGER
   if (searchLength >= strLength) {
      return 0;
   }

   //BREAKS FUZZY BY LENGHT
   if (100 <= searchLength && -1 === str.indexOf(search)) return 0;

   let strHasSpaces = -1 !== str.indexOf(' ');

   let runningScore = 0,
      charScore = 0,
      subStrPrev = '',
      idxOf = 0,
      i = 0,
      subStr = str,
      letter = '',
      cont_letter = true,
      cont_space = true,
      finalScore = 0;

   for (i; searchLength > i; i += 1) {
      letter = search[i];
      idxOf = subStr.slice(i).indexOf(letter);

      if (-1 === idxOf) {
         return 0;
      }

      if (0 === idxOf) {
         if (0 === i) {
            charScore = 1;
         } else {
            cont_space = false;
            if (3 >= i) {
               charScore = 0.5;
            } else {
               charScore = 0.7;
            }
         }
      } else {
         subStrPrev = subStr;
         subStr = subStr.slice(idxOf);
         if (0 < i) {
            if (true === strHasSpaces && searchLength <= 4 && -1 !== subStrPrev.indexOf(` ${letter}`)) {
               if (true === cont_space) {
                  charScore = 0.65;
               } else {
                  charScore = 0.55;
               }
               cont_space = true;
               cont_letter = false;
            } else if (true === cont_space ? 1 === i : true && -1 !== subStrPrev.indexOf(search[i - 1] + letter)) {
               if (true === cont_letter) {
                  charScore = 0.4;
               } else {
                  charScore = 0.3;
               }
               cont_space = false;
               cont_letter = true;
            } else {
               charScore = 0.1;
               cont_space = false;
               cont_letter = false;
            }
         } else {
            charScore = 0.1;
            cont_space = false;
            cont_letter = false;
         }
      }

      runningScore += charScore;
   }

   finalScore = 0.5 * (runningScore / strLength + runningScore / searchLength);

   return finalScore;
};

const scoreKrc_w_spaces = (str, search) => {
   if (search.indexOf(' ') === -1 || str.indexOf(' ') === -1) return scoreKrc(str, search);

   const searchs = search.split(' ').filter(s => s.length > 0);

   let result = 0;

   searchs.forEach($search => {
      if (result < 0) return 0;
      const partRes = scoreKrc(str, $search);
      if (partRes <= 0) {
         result = -1;
         return 0;
      }
      result += partRes;
   });

   if (result < 0) return 0;
   if (result > 0) result = result / searchs.length;

   return result;
};

// module.exports = originalScore;
// module.exports.score = scoreKrc;
module.exports.originalScore = originalScore;
module.exports.scoreKrcv2 = scoreKrcv2;
module.exports.scoreKrcv3 = scoreKrcv3;
//
module.exports.score = scoreKrc_w_spaces;
module.exports.scoreKrc = scoreKrc;
