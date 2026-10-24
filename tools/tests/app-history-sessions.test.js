// Sessions dans l'app : Historique « Par session » (cartes, hors-session,
// renommage, recherche par nom), page de stats d'une session (depuis
// l'Historique ET depuis Stats › Sessions), retour, persistance du mode.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./helpers/boot-app');

let ctx;
const daysAgo = (n) => ctx.window.localDate(new Date(Date.now() - n * 24 * 3600_000));
const db = () => ctx.window.dbManager;
const dialog = (re) => ctx.qa('[role="dialog"]').find((d) => re.test(d.getAttribute('aria-label') || ''));
const visible = (el) => {
  for (let n = el; n && n.style; n = n.parentElement) if (n.style.display === 'none') return false;
  return true;
};
// Bouton VISIBLE (les onglets restent montés en display:none).
const visibleButton = (re) => ctx.buttons()
  .find((b) => re.test(b.getAttribute('aria-label') || '') && visible(b));

test.before(async () => {
  ctx = await bootApp();
  await ctx.waitFor(() => ctx.text().includes('Bière'), { label: 'seed' });
  await ctx.act(async () => {
    const add = (p) => ctx.window.addDrink({ category: 'Bière', quantity: 50, unit: 'cL', alcoholContent: 5, ...p });
    // Session A (hier soir) : deux bières.
    await add({ name: 'Sess Pils', date: daysAgo(1), time: '20:00', price: 5 });
    await add({ name: 'Sess Pils', date: daysAgo(1), time: '21:00', price: 5 });
    // Session B (il y a 3 jours) : une IPA.
    await add({ name: 'Sess IPA', date: daysAgo(3), time: '20:00' });
    // Sans alcool à jeun (il y a 5 jours) : hors session — et ne doit PAS
    // avaler la session B (bug historique).
    await add({ name: 'Sess Zéro', date: daysAgo(5), time: '19:00', alcoholContent: 0 });
    await ctx.sleep(350);
  });
  await ctx.clickAria(/^Historique$/, 350);
  await ctx.waitFor(() => ctx.text().includes('Sess Pils'), { label: 'historique peuplé' });
});
test.after(() => ctx && ctx.cleanup());

test('bascule « Par session » : une carte par session + groupe hors session', async () => {
  const tab = ctx.tabs().find((t) => (t.textContent || '').trim() === 'Par session');
  assert.ok(tab, 'onglet de mode « Par session »');
  await ctx.act(async () => { ctx.click(tab); await ctx.sleep(300); });
  assert.equal(tab.getAttribute('aria-selected'), 'true');
  const groups = ctx.qa('[data-session-group]').map((g) => g.getAttribute('data-session-group'));
  assert.equal(groups.length, 3, `2 sessions + 1 hors session (${groups.join(', ')})`);
  assert.equal(groups.filter((g) => g === 'hors').length, 1);
  assert.ok(ctx.text().includes('Hors session'), 'groupe hors session étiqueté');
  assert.ok(ctx.text().includes('2 consos · pic'), 'chiffres de la session A');
  assert.equal(ctx.window.localStorage.getItem('alconote.hist.mode'), 'session', 'mode mémorisé');
});

test('nommer une session : sheet, nom bien en vue, stocké sur ses boissons', async () => {
  await ctx.act(async () => { ctx.click(visibleButton(/^Nommer la session/)); await ctx.sleep(300); });
  const input = await ctx.waitFor(() => ctx.findInputByAria(/^Nom de la session$/), { label: 'sheet de renommage' });
  await ctx.setInput(input, "  Anniv de  Lucas ");
  await ctx.clickText(/^Enregistrer$/, 450);
  await ctx.waitFor(() => ctx.text().includes('Anniv de Lucas'), { label: 'nom affiché' });
  const raw = await db().getSetting('session.names');
  const names = JSON.parse(raw);
  const pils = (await db().getAllDrinks()).filter((d) => d.name === 'Sess Pils');
  assert.equal(pils.length, 2);
  for (const d of pils) assert.equal(names[d.uid], 'Anniv de Lucas', 'nom normalisé sur chaque boisson');
  assert.ok(visibleButton(/^Renommer la session Anniv de Lucas/), 'le crayon propose désormais « Renommer »');
});

test('recherche par nom de session (mode « Par session »)', async () => {
  const search = ctx.qa('input').find((i) => /session/.test(i.getAttribute('placeholder') || '') && visible(i));
  assert.ok(search, 'champ de recherche de l’historique');
  await ctx.setInput(search, 'anniv', 400);
  await ctx.waitFor(() => !ctx.text().includes('Sess IPA'), { label: 'filtré par nom' });
  assert.ok(ctx.text().includes('Sess Pils'), 'toutes les boissons de la session trouvées');
  await ctx.setInput(search, '', 400);
  await ctx.waitFor(() => ctx.text().includes('Sess IPA'), { label: 'recherche vidée' });
});

test('taper une session ouvre sa page de stats ; Retour la referme', async () => {
  await ctx.act(async () => {
    ctx.click(visibleButton(/^Statistiques de la session Anniv de Lucas/));
    await ctx.sleep(400);
  });
  const page = await ctx.waitFor(() => dialog(/^Session Anniv de Lucas$/), { label: 'page de session' });
  const ids = [...page.querySelectorAll('[data-stats-section]')].map((el) => el.getAttribute('data-stats-section'));
  for (const id of ['general', 'bac', 'session-drinks', 'temporal', 'category', 'top', 'spending']) {
    assert.ok(ids.includes(id), `section ${id} rendue (${ids.join(', ')})`);
  }
  assert.deepEqual(ids.slice(0, 3), ['general', 'bac', 'session-drinks'], 'têtes fixes');
  for (const absent of ['heatmap', 'trends', 'sessions']) assert.ok(!ids.includes(absent), `${absent} exclue`);
  const t = page.textContent;
  assert.ok(t.includes('Résumé de la session'));
  assert.ok(t.includes('1 autre session terminée'), 'référence = la session moyenne (hors elle-même)');
  assert.ok(t.includes('Boissons de la session'));
  assert.ok(t.includes('Par heure de la session'), 'analyse temporelle scopée à la session');
  assert.ok(t.includes('Total dépensé') && t.includes('10 €'), 'dépenses de la session');
  assert.ok(!t.includes('Sess IPA'), 'seules les boissons de la session');
  // Le crayon de la page est disponible pour MES sessions.
  assert.ok([...page.querySelectorAll('button')].some((b) => /^Renommer la session$/.test(b.getAttribute('aria-label') || '')));
  await ctx.act(async () => {
    ctx.click([...page.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Retour'));
    await ctx.sleep(400);
  });
  await ctx.waitFor(() => !dialog(/^Session /), { label: 'page refermée' });
});

test('Stats › Sessions : noms, et un tap ouvre la page de la session', async () => {
  await ctx.clickAria(/^Stats$/, 350);
  const all = ctx.tabs().find((t) => (t.textContent || '').trim() === 'Tout');
  await ctx.act(async () => { ctx.click(all); await ctx.sleep(350); });
  const section = await ctx.waitFor(() => ctx.q('[data-stats-section="sessions"]'), { label: 'section Sessions' });
  assert.ok(section.textContent.includes('Anniv de Lucas'), 'session nommée par son nom');
  assert.ok(section.textContent.includes('2 sessions'), 'la boisson sans alcool n’a créé ni fusionné aucune session');
  const row = [...section.querySelectorAll('button')]
    .find((b) => /^Statistiques de la session Anniv de Lucas/.test(b.getAttribute('aria-label') || ''));
  assert.ok(row, 'ligne cliquable');
  await ctx.act(async () => { ctx.click(row); await ctx.sleep(400); });
  const page = await ctx.waitFor(() => dialog(/^Session Anniv de Lucas$/), { label: 'page depuis Stats' });
  assert.ok(page.textContent.includes('Boissons de la session'));
  await ctx.act(async () => {
    ctx.click([...page.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Retour'));
    await ctx.sleep(400);
  });
  await ctx.waitFor(() => !dialog(/^Session /), { label: 'page refermée' });
});

test('retirer le nom : la session redevient datée', async () => {
  await ctx.clickAria(/^Historique$/, 350);
  await ctx.act(async () => { ctx.click(visibleButton(/^Renommer la session Anniv de Lucas/)); await ctx.sleep(300); });
  await ctx.waitFor(() => ctx.findInputByAria(/^Nom de la session$/), { label: 'sheet' });
  await ctx.clickText(/^Retirer le nom$/, 450);
  await ctx.waitFor(() => !ctx.text().includes('Anniv de Lucas'), { label: 'nom retiré' });
  assert.equal(await db().getSetting('session.names'), null, 'setting supprimé quand plus aucun nom');
  const all = await db().getAllSettings();
  assert.ok(!('session.names' in all), 'aucune clé fantôme');
});

test('session EN COURS : badge, temps écoulé, courbe en direct', async () => {
  await ctx.act(async () => {
    const now = new Date(Date.now() - 20 * 60_000);
    await ctx.window.addDrink({ name: 'Sess Live', category: 'Bière', quantity: 50, unit: 'cL',
      alcoholContent: 5, date: ctx.window.localDate(now), time: ctx.window.localTime(now) });
    await ctx.sleep(400);
  });
  await ctx.waitFor(() => ctx.text().includes('Sess Live'), { label: 'boisson en cours listée' });
  const btn = visibleButton(/^Statistiques de la session .*, en cours$/);
  assert.ok(btn, 'la carte de la session courante est marquée « en cours »');
  assert.match(btn.textContent, /En cours/);
  await ctx.act(async () => { ctx.click(btn); await ctx.sleep(400); });
  const page = await ctx.waitFor(() => dialog(/^Session /), { label: 'page en cours' });
  const t = page.textContent;
  assert.ok(t.includes('Écoulé'), 'durée écoulée au lieu de la durée finale');
  assert.match(t, /→ en cours/i, 'en-tête « → en cours »');
  assert.ok(t.includes('(prévu)'), 'retour à 0 projeté');
  await ctx.act(async () => {
    ctx.click([...page.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Retour'));
    await ctx.sleep(400);
  });
  await ctx.waitFor(() => !dialog(/^Session /), { label: 'page refermée' });
});
