// Mode « Comparer » (app réelle, transport mock Léa/Tom) : entrées depuis
// l'onglet Amis et depuis la fiche ami, personne par défaut, inversion,
// choix d'une autre personne, alcoolémie masquée sans partage du BAC, retour.
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
  await ctx.act(async () => {
    // Une boisson perso aujourd'hui : « Toi » a des données sur la période.
    await ctx.window.addDrink({
      name: 'Orval', category: 'Bière', quantity: 33, unit: 'cL',
      alcoholContent: 6.2, date: isoToday(), time: '12:00',
    });
    await ctx.window.shareEngine.setDisplayName('Moi');
    await ctx.window.shareEngine.setEnabled(true);
    await ctx.window.shareEngine.createGroup();
    await ctx.sleep(450);
  });
  await ctx.clickAria(/Amis/, 300);
  await ctx.waitFor(() => ctx.text().includes('Léa'), { label: 'liste amis' });
});
test.after(() => ctx && ctx.cleanup());

const chips = () => ctx.qa('button').filter((b) => /^Changer la personne/.test(b.getAttribute('aria-label') || ''));
const chipNames = () => chips().map((b) => b.textContent.trim());
const inCompare = () => !!ctx.q('[aria-label="Comparaison des statistiques"]');
// « Retour » de la vue du DESSUS (la fiche ami recouverte garde le sien).
const clickTopBack = async () => {
  const backs = ctx.qa('button').filter((b) => b.getAttribute('aria-label') === 'Retour');
  await ctx.act(async () => { ctx.click(backs[backs.length - 1]); await ctx.sleep(400); });
};
const periodTab = (label) => ctx.qa('[role="tab"]').find((t) => t.textContent.trim() === label);

test('liste d’amis triée (alphabétique) et entrée « Comparer » visible', async () => {
  const rows = ctx.qa('button').filter((b) => /^Voir les statistiques de /.test(b.getAttribute('aria-label') || ''));
  const names = rows.map((b) => b.getAttribute('aria-label').replace(/^Voir les statistiques de ([^,]+),.*$/, '$1'));
  assert.deepEqual(names.filter((n) => n === 'Léa' || n === 'Tom'), ['Léa', 'Tom']);
  assert.ok(ctx.text().includes('Comparer'), 'entrée Comparer présente');
});

test('Comparer depuis l’onglet Amis : Toi à gauche, premier ami à droite', async () => {
  await ctx.clickAria(/^Comparer mes statistiques avec un ami$/, 400);
  await ctx.waitFor(() => inCompare() && ctx.text().includes('Volume & fréquence'), { label: 'vue comparaison' });
  assert.deepEqual(chipNames(), ['Toi', 'Léa']);
  const t = ctx.text();
  assert.ok(t.includes('Statistiques côte à côte'));
  // Période « Jour » : ma boisson du jour vs celles de Léa (mock : il y a
  // 35/75 min + 2h20) — verdict et badge d'écart.
  await ctx.act(async () => { ctx.click(periodTab('Jour')); await ctx.sleep(200); });
  await ctx.waitFor(() => /de plus que|seule personne|Autant/.test(ctx.text()), { label: 'verdict' });
  assert.ok(ctx.text().includes('Alcool pur'));
  // Les deux partagent l'alcoolémie (moi + Léa opt-in) → section chiffrée.
  assert.ok(ctx.text().includes('Taux moyen par session'), 'lignes BAC présentes');
  assert.ok(ctx.text().includes('En direct'), 'taux actuel étiqueté « En direct »');
});

test('inverser les deux personnes', async () => {
  await ctx.clickAria(/^Inverser les deux personnes$/, 200);
  assert.deepEqual(chipNames(), ['Léa', 'Toi']);
  await ctx.clickAria(/^Inverser les deux personnes$/, 200);
  assert.deepEqual(chipNames(), ['Toi', 'Léa']);
});

test('choisir Tom à droite : alcoolémie non comparable (BAC non partagé)', async () => {
  await ctx.clickAria(/^Changer la personne de droite/, 300);
  assert.ok(ctx.q('[aria-label="Choisir la personne de droite"]'), 'sélecteur ouvert');
  await ctx.clickText(/^TomBAC non partagé$/, 400);
  await ctx.waitFor(() => chipNames()[1] === 'Tom', { label: 'Tom choisi' });
  await ctx.waitFor(() => ctx.text().includes('Tom ne partage pas son alcoolémie'), { label: 'BAC masqué' });
  assert.ok(!ctx.text().includes('Taux moyen par session'), 'aucun taux inventé');
});

test('choisir la personne déjà en face inverse les côtés', async () => {
  await ctx.clickAria(/^Changer la personne de gauche/, 300);
  await ctx.clickText(/^TomEn face/, 400);
  await ctx.waitFor(() => chipNames()[0] === 'Tom', { label: 'inversion' });
  assert.deepEqual(chipNames(), ['Tom', 'Toi']);
});

test('Retour referme la comparaison', async () => {
  await ctx.clickAria(/^Retour$/, 400);
  await ctx.waitFor(() => !inCompare(), { label: 'comparaison fermée' });
});

test('Comparer depuis la fiche ami : cet ami à droite, Retour revient à sa fiche', async () => {
  await ctx.clickAria(/Voir les statistiques de Tom/, 450);
  await ctx.waitFor(() => ctx.text().includes('Statistiques partagées'), { label: 'fiche Tom' });
  await ctx.clickAria(/^Comparer mes statistiques avec Tom$/, 400);
  await ctx.waitFor(() => inCompare(), { label: 'vue comparaison' });
  assert.deepEqual(chipNames(), ['Toi', 'Tom']);
  await clickTopBack();
  await ctx.waitFor(() => !inCompare(), { label: 'comparaison fermée' });
  assert.ok(ctx.text().includes('Statistiques partagées'), 'fiche ami toujours ouverte');
  await ctx.clickAria(/^Retour$/, 400);
});

test('fiche ami VIVANTE : se referme si l’ami quitte le groupe', async () => {
  await ctx.clickAria(/Voir les statistiques de Tom/, 450);
  await ctx.waitFor(() => ctx.text().includes('Statistiques partagées'), { label: 'fiche Tom' });
  await ctx.act(async () => {
    await ctx.window.shareEngine.removeMember('mock-tom');
    await ctx.sleep(400);
  });
  await ctx.waitFor(() => !ctx.text().includes('Statistiques partagées'), { label: 'fiche refermée' });
});
