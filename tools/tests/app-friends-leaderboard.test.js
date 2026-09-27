// Classement du groupe (app réelle, transport mock Léa/Tom) : entrée depuis
// l'onglet Amis, moi inclus, podium, changement de famille/stat, ami sans BAC
// non classé sur l'alcoolémie, tap sur un ami (fiche par-dessus), Retour.
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

const inBoard = () => !!ctx.q('[aria-label="Classement du groupe"]');
const board = () => ctx.q('[aria-label="Classement du groupe"]');
const boardText = () => (board() ? board().textContent : '');
const tab = (label) => ctx.qa('[role="tab"]').find((t) => t.textContent.trim() === label);

test('entrée « Classement » visible sous « Comparer »', async () => {
  assert.ok(ctx.q('[aria-label="Voir le classement du groupe"]'), 'carte Classement');
  assert.ok(ctx.q('[aria-label="Comparer mes statistiques avec un ami"]'), 'carte Comparer');
});

test('ouvrir le classement : tout le groupe, moi compris, podium', async () => {
  await ctx.clickAria(/^Voir le classement du groupe$/, 400);
  await ctx.waitFor(() => inBoard() && /classé/.test(boardText()), { label: 'classement calculé' });
  // Période « Jour » : ma boisson du jour + celles de Léa (mock, aujourd'hui).
  await ctx.act(async () => { ctx.click(tab('Jour')); await ctx.sleep(200); });
  await ctx.waitFor(() => !!ctx.q('[aria-label="Podium"]'), { label: 'podium' });
  const t = boardText();
  for (const n of ['Toi', 'Léa', 'Tom']) assert.ok(t.includes(n), `${n} présent`);
  assert.ok(t.includes('Alcool pur'), 'stat par défaut');
});

test('famille « Alcoolémie » : Tom (BAC non partagé) non classé, en bas', async () => {
  await ctx.act(async () => { ctx.click(tab('Alcoolémie')); await ctx.sleep(200); });
  await ctx.waitFor(() => boardText().includes('BAC non partagé'), { label: 'Tom non classé' });
  const tom = ctx.qa('[aria-label]').find((el) => /^Tom : non classé \(BAC non partagé\)/.test(el.getAttribute('aria-label')));
  assert.ok(tom, 'ligne Tom non classée');
  assert.ok(boardText().includes('Pic d’alcoolémie'), 'pastille de stat BAC');
});

test('changer de stat via les pastilles, la famille Fréquence absente sur « Jour »', async () => {
  assert.ok(!tab('Fréquence'), 'Fréquence n’a aucune stat sur un seul jour');
  await ctx.act(async () => { ctx.click(tab('Mois')); await ctx.sleep(200); });
  await ctx.waitFor(() => !!tab('Fréquence'), { label: 'Fréquence sur Mois' });
  await ctx.act(async () => { ctx.click(tab('Fréquence')); await ctx.sleep(200); });
  await ctx.clickText(/^Jours sobres$/, 200);
  await ctx.waitFor(() => /Jours sobres/.test(boardText()), { label: 'stat Jours sobres' });
});

test('taper un ami ouvre sa fiche PAR-DESSUS, Retour revient au classement', async () => {
  const lea = ctx.qa('button').find((b) => /Léa.*voir ses statistiques$/.test(b.getAttribute('aria-label') || ''));
  assert.ok(lea, 'Léa tapable');
  await ctx.act(async () => { ctx.click(lea); await ctx.sleep(450); });
  await ctx.waitFor(() => ctx.text().includes('Statistiques partagées'), { label: 'fiche Léa' });
  const backs = ctx.qa('button').filter((b) => b.getAttribute('aria-label') === 'Retour');
  await ctx.act(async () => { ctx.click(backs[backs.length - 1]); await ctx.sleep(400); });
  await ctx.waitFor(() => !ctx.text().includes('Statistiques partagées'), { label: 'fiche fermée' });
  assert.ok(inBoard(), 'classement toujours ouvert');
  // Moi : jamais tapable (pas de fiche « ami » pour soi).
  assert.ok(!ctx.qa('button').some((b) => /^\S+ : Toi,.*voir ses statistiques$/.test(b.getAttribute('aria-label') || '')));
});

test('Retour referme le classement', async () => {
  await ctx.clickAria(/^Retour$/, 400);
  await ctx.waitFor(() => !inBoard(), { label: 'classement fermé' });
});
