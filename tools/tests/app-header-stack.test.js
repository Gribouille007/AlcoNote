// LE test de la refonte header : les deux pastilles BAC (mienne + ami favori)
// vivent dans un slot à hauteur FIXE de 38px → la hauteur du header ne change
// JAMAIS quand le favori apparaît/disparaît. jsdom ne layoute pas : les
// assertions sont structurelles (styles inline + arbre DOM).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./helpers/boot-app');

let ctx;
const header = () => ctx.q('header');
const stack = () => [...header().querySelectorAll('div')]
  .find((d) => d.style.height === '38px' && d.style.flexDirection === 'column');
const headerPills = () => [...header().querySelectorAll('[aria-label^="Taux"], [aria-label^="Alcoolémie"]')];

test.before(async () => {
  ctx = await bootApp();
  await ctx.waitFor(() => ctx.text().includes('Bière'), { label: 'seed' });
});
test.after(() => ctx && ctx.cleanup());

let childrenBefore;
let pillNormalPadding;

test('état initial : slot fixe 38px, une pastille taille normale', () => {
  const s = stack();
  assert.ok(s, 'slot de pile présent avec height: 38px');
  assert.equal(s.style.flexShrink, '0');
  const pills = headerPills();
  assert.equal(pills.length, 1, 'une seule pastille (la mienne)');
  assert.equal(pills[0].getAttribute('aria-label'), "Taux d'alcoolémie");
  assert.ok(s.contains(pills[0]), 'la pastille vit DANS le slot');
  pillNormalPadding = pills[0].style.padding;
  assert.equal(pillNormalPadding, '6px 10px 6px 8px', 'padding taille normale');
  childrenBefore = header().children.length;
});

test('favori ajouté : 2 pastilles compactes DANS le slot, header inchangé', async () => {
  await ctx.act(async () => {
    await ctx.window.shareEngine.setDisplayName('Moi');
    await ctx.window.shareEngine.setEnabled(true);
    await ctx.window.shareEngine.createGroup();
    await ctx.sleep(400);
  });
  await ctx.act(async () => {
    await ctx.window.shareEngine.toggleFavorite('mock-lea');
    await ctx.sleep(200);
  });

  // La structure du header n'a PAS changé : aucune rangée ajoutée.
  assert.equal(header().children.length, childrenBefore, 'pas de 2e rangée dans le header');
  const s = stack();
  assert.ok(s, 'slot toujours présent');
  assert.equal(s.style.height, '38px', 'hauteur du slot STRICTEMENT inchangée');

  const pills = headerPills();
  assert.equal(pills.length, 2, 'deux pastilles');
  assert.ok(s.contains(pills[0]) && s.contains(pills[1]), 'les deux DANS le slot');
  // Ordre : la mienne (ambre) au-dessus, l'ami favori (vert) en dessous.
  assert.equal(pills[0].getAttribute('aria-label'), "Taux d'alcoolémie");
  assert.equal(pills[1].getAttribute('aria-label'), 'Alcoolémie de Léa');
  // Les deux en variante compacte.
  for (const p of pills) {
    assert.equal(p.style.padding, '2px 8px 2px 6px', 'padding compact');
    const span = p.querySelector('span');
    assert.equal(span.style.fontSize, '10px', 'fontSize compact');
    assert.equal(span.style.lineHeight, '1', 'lineHeight compact');
  }
  // alignItems stretch → même largeur pour les deux pastilles.
  assert.equal(s.style.alignItems, 'stretch');
  // La pastille de Léa affiche un taux numérique (elle partage son BAC) —
  // le calcul useFriendsBac est async (lecture sharedPool), on attend.
  await ctx.waitFor(() => {
    const p = header().querySelector('[aria-label="Alcoolémie de Léa"]');
    return p && /\d/.test(p.textContent);
  }, { label: 'taux de Léa numérique' });
});

test('favori retiré : retour à 1 pastille normale, slot identique', async () => {
  await ctx.act(async () => {
    await ctx.window.shareEngine.toggleFavorite('mock-lea');
    await ctx.sleep(200);
  });
  assert.equal(header().children.length, childrenBefore);
  const s = stack();
  assert.equal(s.style.height, '38px');
  const pills = headerPills();
  assert.equal(pills.length, 1);
  assert.equal(pills[0].style.padding, pillNormalPadding, 'padding taille normale restauré');
});

test('FriendRow : les pastilles des lignes Amis restent en taille normale', async () => {
  await ctx.act(async () => {
    await ctx.window.shareEngine.toggleFavorite('mock-lea');
    await ctx.sleep(200);
  });
  await ctx.clickAria(/Amis/, 300);
  const rows = [...ctx.q('#root').querySelectorAll('[aria-label^="Alcoolémie de"]')]
    .filter((p) => !header().contains(p));
  assert.ok(rows.length >= 2, 'pastilles de lignes amis présentes');
  for (const p of rows) {
    assert.equal(p.style.padding, '6px 10px 6px 8px', 'ligne ami : padding normal');
  }
});

test('leaveGroup : purge le favori (share.favoriteId) et la pastille', async () => {
  await ctx.act(async () => {
    await ctx.window.shareEngine.leaveGroup();
    await ctx.sleep(300);
  });
  const fav = await ctx.window.dbManager.getSetting('share.favoriteId');
  assert.equal(fav, null, 'setting share.favoriteId purgé');
  assert.equal(headerPills().length, 1, 'pastille verte disparue');
  assert.equal(stack().style.height, '38px', 'slot toujours 38px');
});
