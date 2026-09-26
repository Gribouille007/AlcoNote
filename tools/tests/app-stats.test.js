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

test('période vide : seule l’Alcoolémie reste, le message « Pas de données » en bas', async () => {
  // Semaine précédente : aucune boisson — mais on doit pouvoir revenir.
  await ctx.clickAria(/Période précédente/, 300);
  const t = ctx.text();
  assert.ok(t.includes('Pas de données disponibles'), 'message sur période vide');
  assert.ok(t.includes('Aucune boisson enregistrée sur cette période'), 'sous-texte période');
  assert.ok(!t.includes('Statistiques générales'), 'sections période-scopées masquées');
  // Seul le BAC en direct survit : ni carte ni charts globaux.
  assert.ok(t.includes('Alcoolémie'), 'section BAC (en direct) conservée');
  assert.ok(!t.includes('Carte des consommations'), 'pas de carte sur période vide');
  assert.ok(!t.includes('Tendances'), 'pas de charts globaux sur période vide');
  assert.deepEqual(ctx.qa('[data-stats-section]').map((el) => el.getAttribute('data-stats-section')),
    ['bac'], 'une seule section rendue');
  // Le message vient EN BAS de page, après la section Alcoolémie.
  const bac = ctx.q('[data-stats-section="bac"]');
  const msg = ctx.qa('div').find((el) => el.textContent === 'Pas de données disponibles');
  assert.ok(bac && msg, 'section BAC et message présents');
  assert.ok(bac.compareDocumentPosition(msg) & ctx.window.Node.DOCUMENT_POSITION_FOLLOWING,
    'message placé après la section Alcoolémie');
  const periodTablist = ctx.qa('[role="tablist"]')
    .find((el) => (el.getAttribute('aria-label') || '') === 'Période');
  assert.ok(periodTablist, 'sélecteur de période TOUJOURS là (navigation possible)');

  // Retour sur la semaine courante : les sections réapparaissent.
  await ctx.clickAria(/Période suivante/, 300);
  assert.ok(ctx.text().includes('Statistiques générales'), 'sections de retour');
});

test('chips de portée : la jauge BAC est étiquetée « En direct »', async () => {
  await ctx.waitFor(() => ctx.text().includes('Alcoolémie'), { label: 'section BAC' });
  assert.ok(ctx.text().includes('En direct'), 'chip de portée sur la jauge');
});

const sectionDomOrder = () =>
  ctx.qa('[id^="alco-section-"]').map((el) => el.id.replace('alco-section-', ''));

test('nouvelles sections : Calendrier + Sessions rendues avec des données', async () => {
  // On revient sur la semaine courante (test précédent y a laissé une boisson).
  await ctx.waitFor(() => ctx.text().includes('Statistiques générales'), { label: 'sections visibles' });
  const ids = sectionDomOrder();
  assert.ok(ids.includes('heatmap'), 'section Calendrier (heatmap) montée');
  assert.ok(ids.includes('sessions'), 'section Sessions montée');
  assert.ok(ctx.text().includes('Calendrier'), 'titre Calendrier affiché');
});

test('comparaison cumulée : card présente quand la période précédente a des données', async () => {
  // Une boisson il y a 7 jours (= même jour la semaine dernière → période
  // précédente) débloque le cumul vs période précédente dans « Évolution ».
  const lastWeek = new Date(Date.now() - 7 * 24 * 3600_000);
  await ctx.act(async () => {
    await ctx.window.addDrink({
      name: 'Cumul Pils', category: 'Bière', quantity: 33, unit: 'cL',
      alcoholContent: 5, date: ctx.window.localDate(lastWeek), time: '19:00',
    });
    await ctx.sleep(300);
  });
  await ctx.waitFor(() => ctx.text().includes('Cumul vs période précédente'),
    { label: 'card cumulée affichée' });
});

test('période « Jour » : les contenus multi-jours / globaux sont masqués', async () => {
  await ctx.clickText(/^Jour$/, 350);
  const t = ctx.text();
  assert.ok(t.includes('Statistiques générales'), 'sections du jour rendues');
  assert.ok(!t.includes('Cumul vs période précédente'), 'pas de cumul sur 1 jour');
  assert.ok(!t.includes('Jour de pointe'), 'pas de jour de pointe sur 1 jour');
  assert.ok(!t.includes('Entre sessions'), 'pas d\'écart inter-sessions sur 1 jour');
  assert.ok(!t.includes('Par jour de la semaine'), 'pas de radar hebdo sur 1 jour');
  assert.ok(!t.includes('Moyenne mobile'), 'pas de moyenne mobile 30 j sur 1 jour');
  assert.ok(t.includes('Heure de pointe'), 'l\'heure de pointe reste');
  // Retour sur « Semaine » pour les tests suivants.
  await ctx.clickText(/^Semaine$/, 350);
  await ctx.waitFor(() => ctx.text().includes('Moyenne mobile') || ctx.text().includes('Statistiques générales'),
    { label: 'retour semaine' });
});

// ── Réorganisation des sections ─────────────────────────────────────

test('mode Réorganiser : flèche clavier déplace une section, ordre persisté en DB', async () => {
  assert.deepEqual(sectionDomOrder().slice(0, 2), ['general', 'temporal'], 'ordre par défaut au départ');

  await ctx.clickAria(/Réorganiser les sections/, 300);
  assert.ok(ctx.text().includes('Terminé'), 'mode édition actif');
  const handles = ctx.qa('button').filter((b) => /^Déplacer «/.test(b.getAttribute('aria-label') || ''));
  assert.equal(handles.length, 10, '10 lignes compactes (toutes les sections visibles)');

  // ↓ sur la première poignée : « Statistiques générales » passe en 2e.
  await ctx.act(async () => {
    handles[0].dispatchEvent(new ctx.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await ctx.sleep(250);
  });
  await ctx.clickText(/^Terminé$/, 300);

  assert.deepEqual(sectionDomOrder().slice(0, 2), ['temporal', 'general'], 'ordre DOM mis à jour');
  const raw = await ctx.window.dbManager.getSetting('stats.sectionOrder');
  const saved = JSON.parse(raw);
  assert.deepEqual(saved.slice(0, 2), ['temporal', 'general'], 'ordre persisté en setting Dexie');
});

test('mode Réorganiser : drag à la poignée (pointer events)', async () => {
  await ctx.clickAria(/Réorganiser les sections/, 300);
  const handles = ctx.qa('button').filter((b) => /^Déplacer «/.test(b.getAttribute('aria-label') || ''));
  // La 1re ligne est désormais « Analyse temporelle » ; on la glisse d'une
  // ligne (56 px) vers le bas → elle repasse 2e, retour à l'ordre d'origine.
  await ctx.act(async () => {
    handles[0].dispatchEvent(new ctx.window.MouseEvent('pointerdown', { bubbles: true, clientY: 120 }));
    await ctx.sleep(60);
    handles[0].dispatchEvent(new ctx.window.MouseEvent('pointermove', { bubbles: true, clientY: 120 + 56 }));
    await ctx.sleep(60);
    handles[0].dispatchEvent(new ctx.window.MouseEvent('pointerup', { bubbles: true, clientY: 120 + 56 }));
    await ctx.sleep(250);
  });
  await ctx.clickText(/^Terminé$/, 300);

  assert.deepEqual(sectionDomOrder().slice(0, 2), ['general', 'temporal'], 'drag commité au relâchement');
  const saved = JSON.parse(await ctx.window.dbManager.getSetting('stats.sectionOrder'));
  assert.deepEqual(saved.slice(0, 2), ['general', 'temporal'], 'persistance après drag');
});

// ── Badges Δ% : jamais en surimpression de la valeur ────────────────
test('badges Δ% dans le flux (jamais position absolue sur la valeur)', async () => {
  // La semaine courante et la précédente ont chacune une boisson (tests
  // précédents) → les cellules portent un badge de comparaison.
  await ctx.waitFor(() => ctx.qa('[aria-label$="vs période précédente"]').length > 0,
    { label: 'badges Δ% rendus' });
  for (const b of ctx.qa('[aria-label$="vs période précédente"]')) {
    assert.notEqual(b.style.position, 'absolute', 'badge dans le flux');
  }
});

// ── Calendrier : tap → infobulle + « Voir … », second tap → ouvre le jour ─
test('calendrier : premier tap sélectionne un jour, second tap ouvre la période « Jour »', async () => {
  const svg = ctx.q('svg[aria-label="Calendrier de consommation"]');
  assert.ok(svg, 'calendrier rendu (semaine courante)');
  const [, , vbW, vbH] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  // jsdom ne mesure rien : on aligne la boîte rendue sur le viewBox.
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: vbW, height: vbH, right: vbW, bottom: vbH });
  const g = ctx.window.calendarGeometry({ layout: 'week', rows: 1, cols: 7, rowLabels: [] }, vbW);
  const col = (new Date().getDay() + 6) % 7; // aujourd'hui (lundi = 0)
  const x = g.padL + col * g.stepX + g.cellW / 2;
  const y = g.padT + g.cellH / 2;
  const tap = async () => ctx.act(async () => {
    svg.dispatchEvent(new ctx.window.MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
    svg.dispatchEvent(new ctx.window.MouseEvent('pointerup', { bubbles: true, clientX: x, clientY: y }));
    await ctx.sleep(120);
  });

  await tap();
  const d = new Date();
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const title = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  assert.ok(ctx.text().includes(`Voir ${title}`), `lien « Voir ${title} » après le 1er tap`);
  assert.ok(ctx.text().includes("g d'alcool"), 'infobulle collante (grammes du jour)');

  await tap();
  const jour = ctx.qa('[role="tab"]').find((b) => b.textContent === 'Jour');
  assert.equal(jour.getAttribute('aria-selected'), 'true', 'période « Jour » ouverte');
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  assert.ok(ctx.text().includes(`${days[d.getDay()]} ${d.getDate()}`), 'libellé de période = le jour tapé');
  await ctx.clickText(/^Semaine$/, 350);
});
