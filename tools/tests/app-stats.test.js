// Onglet Stats : états vides (global / période) et réorganisation des
// sections (ordre persisté en setting `stats.sectionOrder`).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./helpers/boot-app');

let ctx;
test.before(async () => {
  ctx = await bootApp();
  await ctx.waitFor(() => ctx.text().includes('Bière'), { label: 'seed' });
});
test.after(() => ctx && ctx.cleanup());

const pad2 = (n) => String(n).padStart(2, '0');
const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

test('état vide GLOBAL : message seul, ni sections ni sélecteur de période', async () => {
  await ctx.clickAria(/^Stats$/, 350);
  const t = ctx.text();
  assert.ok(t.includes('Pas de données disponibles'), 'message d’état vide');
  assert.ok(t.includes('Ajoute ta première boisson'), 'sous-texte global');
  assert.ok(!t.includes('Statistiques générales'), 'aucune section rendue');
  const periodTablist = ctx.qa('[role="tablist"]')
    .find((el) => (el.getAttribute('aria-label') || '') === 'Période');
  assert.ok(!periodTablist, 'sélecteur de période masqué sans aucune donnée');
});

test('avec une boisson aujourd’hui : sections et sélecteur de période visibles', async () => {
  await ctx.act(async () => {
    await ctx.window.addDrink({
      name: 'Bière test', category: 'Bière', quantity: 33, unit: 'cL',
      alcoholContent: 5, date: isoToday(), time: '18:00',
    });
    await ctx.sleep(300);
  });
  await ctx.waitFor(() => ctx.text().includes('Statistiques générales'), { label: 'sections visibles' });
  const t = ctx.text();
  assert.ok(!t.includes('Pas de données disponibles'), 'message d’état vide retiré');
  const periodTablist = ctx.qa('[role="tablist"]')
    .find((el) => (el.getAttribute('aria-label') || '') === 'Période');
  assert.ok(periodTablist, 'sélecteur de période de retour');
});

test('période vide : message + navigation conservée, sections masquées', async () => {
  // Semaine précédente : aucune boisson — mais on doit pouvoir revenir.
  await ctx.clickAria(/Période précédente/, 300);
  const t = ctx.text();
  assert.ok(t.includes('Pas de données disponibles'), 'message sur période vide');
  assert.ok(t.includes('Aucune boisson enregistrée sur cette période'), 'sous-texte période');
  assert.ok(!t.includes('Statistiques générales'), 'sections masquées sur période vide');
  const periodTablist = ctx.qa('[role="tablist"]')
    .find((el) => (el.getAttribute('aria-label') || '') === 'Période');
  assert.ok(periodTablist, 'sélecteur de période TOUJOURS là (navigation possible)');

  // Retour sur la semaine courante : les sections réapparaissent.
  await ctx.clickAria(/Période suivante/, 300);
  assert.ok(ctx.text().includes('Statistiques générales'), 'sections de retour');
});
