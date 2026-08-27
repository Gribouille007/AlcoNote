// Bascule de thème : TOUT repeint, y compris derrière un React.memo.
//
// Régression visée : `T` est un objet MUTÉ en place par setTheme(). Un
// composant memoïsé dont les props n'ont pas bougé ne se re-rend pas et garde
// les couleurs de l'ancien thème — d'où des « éléments clairs » qui survivent
// au passage en mode sombre (et inversement).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./helpers/boot-app');

let ctx;
const pad2 = (n) => String(n).padStart(2, '0');
const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

test.before(async () => {
  ctx = await bootApp();
  await ctx.waitFor(() => ctx.text().includes('Bière'), { label: 'seed' });
  // Quelques boissons : sans données, l'onglet Stats n'affiche qu'un état
  // vide — donc aucune figure à repeindre.
  await ctx.act(async () => {
    await ctx.window.addDrink({
      name: 'Bière test', category: 'Bière', quantity: 33, unit: 'cL',
      alcoholContent: 5, date: isoToday(), time: '18:00',
    });
    await ctx.window.addDrink({
      name: 'Vin test', category: 'Vin', quantity: 12, unit: 'cL',
      alcoholContent: 13, date: isoToday(), time: '20:30',
    });
    await ctx.sleep(350);
  });
});
test.after(() => ctx && ctx.cleanup());

const setTheme = async (name) => {
  await ctx.act(async () => { ctx.window.applyTheme(name); await ctx.sleep(180); });
};
// Un élément memoïsé et repérable : la carte de catégorie (React.memo).
const categoryCard = () => ctx.qa('[role="button"], button')
  .find((el) => /^Ouvrir la catégorie Bière/.test(el.getAttribute('aria-label') || ''));

test('carte de catégorie (React.memo) : repeinte dans les DEUX sens', async () => {
  await setTheme('dark');
  const card = categoryCard();
  assert.ok(card, 'carte de catégorie présente');
  const dark = card.getAttribute('style');

  await setTheme('light');
  const light = categoryCard().getAttribute('style');
  assert.notEqual(light, dark, 'sombre → clair : la carte se repeint');

  await setTheme('dark');
  const backToDark = categoryCard().getAttribute('style');
  assert.notEqual(backToDark, light, 'clair → sombre : la carte se repeint aussi');
  assert.equal(backToDark, dark, 'retour exact au thème d’origine (aucun résidu)');
});

test('charts (React.memo) : les SVG suivent le thème', async () => {
  await ctx.clickAria(/^Stats$/, 600);
  await ctx.waitFor(() => ctx.qa('svg[role="img"]').length > 0, { label: 'charts montés' });
  await setTheme('dark');
  const before = ctx.qa('svg[role="img"]').map((s) => s.innerHTML).join('|');
  await setTheme('light');
  const after = ctx.qa('svg[role="img"]').map((s) => s.innerHTML).join('|');
  assert.notEqual(after, before, 'les couleurs des figures changent avec le thème');
});

test('document : data-theme, classe body et <meta theme-color> suivent', async () => {
  const doc = ctx.document;
  await setTheme('light');
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(doc.body.className, 'theme-light');
  const metaLight = doc.querySelector('meta[name="theme-color"]');
  assert.ok(metaLight, '<meta name="theme-color"> posé');
  const light = metaLight.getAttribute('content');
  assert.equal(light, ctx.window.T.metaColor, 'couleur système = fond du thème courant');

  await setTheme('dark');
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(doc.body.className, 'theme-dark');
  const dark = doc.querySelector('meta[name="theme-color"]').getAttribute('content');
  assert.notEqual(dark, light, 'la barre système ne reste pas sur l’ancien thème');
  assert.equal(dark, ctx.window.T.metaColor);
  assert.match(dark, /^#[0-9a-f]{6}$/i, 'valeur sRGB : lisible par tout parseur');
  // Un seul meta, pas un par bascule.
  assert.equal(doc.querySelectorAll('meta[name="theme-color"]').length, 1);
});

test('aucun composant memoïsé ne garde de couleur figée (balayage du DOM)', async () => {
  // Filet large : on compare l'intégralité des styles inline de l'arbre entre
  // les deux thèmes. Un sous-arbre resté identique alors qu'il peint des
  // tokens signalerait un memo non abonné.
  const themeish = /oklch\(|rgba?\(/;
  await setTheme('dark');
  // On garde les MÊMES nœuds d'un thème à l'autre (comparaison alignée même
  // si l'arbre grossit entre-temps : tick BAC, animations d'entrée…).
  const nodes = ctx.qa('[style]').filter((el) => themeish.test(el.getAttribute('style') || ''));
  const darkStyles = nodes.map((el) => el.getAttribute('style'));
  await setTheme('light');
  const lightStyles = nodes.map((el) => el.getAttribute('style'));

  let compared = 0, identical = 0;
  for (let i = 0; i < darkStyles.length; i++) {
    compared++;
    if (darkStyles[i] === lightStyles[i]) identical++;
  }
  assert.ok(compared > 20, `assez d’éléments colorés balayés (${compared})`);
  // Quelques styles sont volontairement identiques dans les deux thèmes
  // (couleurs de catégorie à teinte fixe, dangerBg/dangerBtn partagés,
  // ombre du toast) : on tolère une minorité, pas un sous-arbre entier.
  assert.ok(identical / compared < 0.5,
    `trop de styles figés d’un thème à l’autre : ${identical}/${compared}`);
  await setTheme('dark');
});
