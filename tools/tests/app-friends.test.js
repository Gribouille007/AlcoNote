// Partage entre amis (transport mock Léa/Tom) : activation, groupe, liste,
// régression « pull partiel ne vide pas les membres », stats d'un ami
// (carte masquée, sections BAC conditionnées), Paramètres › Partage.
// Migration de la phase B de l'ancien tools/smoke-test.js.
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

const engine = () => ctx.window.shareEngine;

test('onglet Amis : CTA d’activation quand le partage est off', async () => {
  await ctx.clickAria(/Amis/, 300);
  assert.match(ctx.text(), /Active le partage|Partage entre amis/);
});

test('création de groupe (mock) : Léa et Tom listés, pied de page', async () => {
  await ctx.act(async () => {
    await engine().setDisplayName('Moi');
    await engine().setEnabled(true);
    await engine().createGroup();
    await ctx.sleep(450);
  });
  const t = ctx.text();
  assert.ok(t.includes('Léa'), 'Léa visible');
  assert.ok(t.includes('Tom'), 'Tom visible');
  assert.ok(t.includes('Quitter le groupe'), 'action de sortie présente');
  const members = engine().state.members.filter((m) => m.userId !== engine().state.userId);
  assert.equal(members.length, 2, '2 membres hors moi');
  // Léa partage son BAC, Tom non — la liste l'affiche.
  assert.ok(t.includes('Alcoolémie en direct'));
  assert.ok(t.includes('BAC non partagé'));
});

test('RÉGRESSION : un pull partiellement en échec CONSERVE les membres', async () => {
  const tr = ctx.window.getTransport();
  const realPull = tr.pullSince.bind(tr);
  tr.pullSince = async (cursor) => {
    const r = await realPull(cursor);
    return { ...r, drinks: [], error: { code: '42501', message: 'permission denied for table shared_drinks' } };
  };
  await ctx.act(async () => { await engine().refreshNow(); await ctx.sleep(250); });
  const still = engine().state.members.filter((m) => m.userId !== engine().state.userId);
  assert.equal(still.length, 2, 'membres conservés malgré l’erreur');
  assert.match(engine().state.errorDetail || '', /droits manquants|permission/i, 'erreur diagnostique exposée');

  tr.pullSince = realPull;
  await ctx.act(async () => { await engine().refreshNow(); await ctx.sleep(250); });
  assert.ok(!engine().state.errorDetail, 'erreur effacée après réparation');
});

test('stats de Léa : mêmes sections, carte masquée, BAC visible (opt-in)', async () => {
  await ctx.clickAria(/Voir les statistiques de Léa/, 450);
  // Les boissons partagées arrivent en async (useSharedDrinks) — on attend
  // que les stats dérivées du BAC apparaissent.
  await ctx.waitFor(() => ctx.text().includes('Temps bourré'), { label: 'stats BAC de Léa' });
  const t = ctx.text();
  assert.ok(t.includes('Statistiques partagées'), 'en-tête de la vue ami');
  assert.ok(t.includes('Statistiques générales'), 'StatsTab réutilisé');
  assert.ok(!t.includes('Carte des consommations'), 'carte MASQUÉE (pas de GPS partagé)');
  await ctx.clickAria(/^Retour$/, 300);
});

test('stats de Tom (BAC non partagé) : sections Widmark masquées', async () => {
  await ctx.clickAria(/Voir les statistiques de Tom/, 450);
  await ctx.waitFor(() => ctx.text().includes('Statistiques générales'), { label: 'vue de Tom' });
  await ctx.flush(400); // settle complet avant d'asserter une ABSENCE
  const t = ctx.text();
  assert.ok(t.includes('Statistiques partagées'));
  assert.ok(!t.includes('Temps bourré'), 'pas de poids partagé → pas de chiffre inventé');
  await ctx.clickAria(/^Retour$/, 300);
});

test('Paramètres › Partage : pseudo, code d’invitation, toggles', async () => {
  await ctx.clickAria(/Ouvrir les paramètres/, 350);
  const t = ctx.text();
  assert.ok(t.includes('Partage entre amis'), 'section présente');
  assert.ok(t.includes('Pseudo'), 'pseudo affiché (partage actif)');
  assert.ok(t.includes('Quitter le groupe'), 'sortie disponible aussi ici');
  assert.ok(t.includes('Partager mon alcoolémie'), 'toggle BAC');
  // Relocalisée depuis le pied de l'onglet Amis (ancien smoke-test) : le code
  // d'invitation vit désormais dans Paramètres › Partage.
  assert.ok(t.includes("Code d'invitation"), 'code d’invitation dans le tiroir');
});
