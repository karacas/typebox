const uniqueElementsBy = (arr, fn) =>
   arr.reduce((acc, v) => {
      if (!acc.some(x => fn(v, x))) acc.push(v);
      return acc;
   }, []);

class gist {
   constructor(user, token, baseUrl) {
      this.baseUrl = baseUrl || 'https://api.github.com/';
      this.token = token;
      this.user = user || 'karacas';
   }

   Authorization() {
      return { Authorization: `token ${this.token}` };
   }

   async createGist(data) {
      if (!this.token) return null;

      let gist = null;
      const got = require('got');

      try {
         gist = await got.post(`gists`, {
            headers: this.Authorization(),
            body: JSON.stringify(data),
            baseUrl: this.baseUrl,
         });
      } catch (e) {
         console.warn(e);
      }

      console.log(gist);

      return gist;
   }

   async fetchGists() {
      if (!this.token) return null;

      const got = require('got');

      let finsih = false;
      let perpage = 100;
      let gist = [];
      let page = 0;

      const getPage = async ($page = 0) => {
         let gist = null;
         try {
            gist = await got(`users/${this.user}/gists?per_page=${perpage}&page=${$page}`, {
               json: true,
               headers: this.Authorization(),
               baseUrl: this.baseUrl,
            });
         } catch (e) {
            console.warn(e);
         }
         gist = (gist || {}).body || [];
         return gist;
      };

      while (!finsih) {
         let res = await getPage(page);
         if (res && res.length && res.length > 0) {
            gist = [...gist, ...res];
            page++;
         } else {
            finsih = true;
         }
      }

      gist = uniqueElementsBy(gist, (a, b) => a.id == b.id);

      // console.log(gist, gist.length);
      console.log(gist[4]);

      return gist;
   }
}

let testGist = new gist('karacas', 'cf591c2b4ec6b9cd4af3df88a747f643f8864031');

// testGist.fetchGists();

testGist.createGist({
   description: '[TYPEBOX] New note 2',
   files: {
      content: {
         content: 'console.log("")',
      },
      metadata: {
         content: '{test:1}',
      },
   },
});
