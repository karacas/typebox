'use strict';
module.exports = context => {
   return {
      init() {
         let colorIdex = -1;

         context.addPermanentRules([
            {
               title: 'Icon Fonts',
               type: ['FIroot'],
               icon: {
                  iconClass: 'mdi-emoticon accentColor2',
               },
               params: {
                  changePath: {
                     path: 'FI_PATH',
                  },
               },
            },
         ]);

         this.pushRules = () => {
            context.putLoader('FI_PATH');

            setTimeout(() => {
               const arrIcons = context.require('@aux/aux_list_font_icons_classes.js');
               let packIcons = [];
               arrIcons.forEach(icon => {
                  let $title = icon;
                  let $searchField = $title;

                  if ($searchField.indexOf('mdi-') !== -1) {
                     $searchField = `${$searchField.replace('mdi-', '')} mdi material`;
                  }

                  if ($searchField.indexOf('fe-') !== -1) {
                     $searchField = `${$searchField.replace('fe-', '')} feather`;
                  }

                  if ($searchField.indexOf('fab-') !== -1) {
                     $searchField = `${$searchField.replace('fab-', '')} fab awesome`;
                  }

                  if ($searchField.indexOf('far-') !== -1) {
                     $searchField = `${$searchField.replace('far-', '')} far awesome`;
                  }

                  if ($searchField.indexOf('fas-') !== -1) {
                     $searchField = `${$searchField.replace('fas-', '')} fas awesome`;
                  }

                  if ($searchField.indexOf('ion-ios-') !== -1) {
                     $searchField = `${$searchField.replace('ion-ios-', '')} ion-ios ionic`;
                  }

                  if ($searchField.indexOf('ion-logo-') !== -1) {
                     $searchField = `${$searchField.replace('ion-logo-', '')} ion-logo ionic`;
                  }

                  if ($searchField.indexOf('ion-md-') !== -1) {
                     $searchField = `${$searchField.replace('ion-md-', '')} ion-md ionic`;
                  }

                  if ($searchField.indexOf('octicon-') !== -1) {
                     $searchField = `${$searchField.replace('octicon-', '')} octicon`;
                  }

                  if ($searchField.indexOf('mdl2-') !== -1) {
                     $searchField = `${$searchField.replace('mdl2-', '')} mdl2`;
                  }

                  if ($searchField.indexOf('w-icon-') !== -1) {
                     $searchField = `${$searchField.replace('w-icon-', '')} uiw`;
                  }

                  if ($searchField.indexOf('icons8-') !== -1) {
                     $searchField = `${$searchField.replace('icons8-', '')} w10 icons8`;
                  }

                  $searchField = $searchField.replace('palette-', '').replace(' / ', ' ');

                  packIcons.push({
                     title: $title,
                     searchField: $searchField,
                     type: ['string', 'FIroot'],
                     path: 'FI_PATH',
                     icon: {
                        iconClass: `icon ${icon}`,
                        iconClassColor: ' textLowColor',
                     },
                  });
               });
               context.addPermanentRules(packIcons);
               context.deleteRules(packIcons);
            }, 20);
         };

         context.on('changePath', path => {
            if (path === 'FI_PATH') {
               this.pushRules();
               this.pushRules = () => null; /*ONLY ONCE*/
            }
         });
      },
   };
};
