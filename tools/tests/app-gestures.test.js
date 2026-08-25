// Trois comportements que seul l'arbre RÉEL peut prouver :
//   • le thème repeint TOUT — y compris les composants React.memo, dont la
//     mémoïsation masquait la mutation de `T` (« je passe en clair, la liste
//     et les charts restent sombres ») ;
//   • la roue horaire CRANTE — un tick et une valeur par cran franchi, sous
//     le doigt, comme la roue par défaut d'iOS ;
//   • le balayage de suppression a un cran OUVERT atteignable, et une seule
//     ligne ouverte à la fois.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./helpers/boot-app');

let ctx;
const today = () => ctx.window.localDate(new Date());

test.before(async () => {
  ctx = await bootApp();
  await ctx.waitFor(() => ctx.text().includes('Bière'), { label: 'seed' });
  await ctx.act(async () => {
    await ctx.window.addDrink({ name: 'Gest A', category: 'Bière', quantity: 33, unit: 'cL', alcoholContent: 5, date: today(), time: '12:00' });
    await ctx.window.addDrink({ name: 'Gest B', category: 'Vin', quantity: 12, unit: 'cL', alcoholContent: 13, date: today(), time: '14:00' });
    await ctx.sleep(350);
  });
});
test.after(() => ctx && ctx.cleanup());

// jsdom renormalise les couleurs (« oklch(100% 0 0) » → « oklch(1 0 0) ») :
// on compare donc à la forme qu'il produit, pas au littéral du token.
function normColor(color) {
  const probe = ctx.document.createElement('div');
  probe.style.background = color;
  return probe.style.background;
}
const setTheme = async (name) => ctx.act(async () => {
  ctx.window.applyTheme(name);
  await ctx.sleep(250);
});

// ── Thème ───────────────────────────────────────────────────────────

test('thème : les lignes memoïsées de l’Historique repeignent', async () => {
  await ctx.clickAria(/^Historique$/, 350);
  await ctx.waitFor(() => ctx.text().includes('Gest A'), { label: 'historique peuplé' });

  // L'en-tête de jour est rendu par DayGroup (React.memo) ; ses props ne
  // bougent PAS quand le thème change — c'est tout le piège.
  const dayHeader = () => ctx.buttons()
    .find((b) => /^(Replier|Déplier)/.test(b.getAttribute('aria-label') || ''));
  // La ligne d'entrée vient d'EntryRow (React.memo lui aussi).
  const entryRow = () => ctx.qa('div')
    .find((d) => (d.getAttribute('style') || '').includes('pan-y'));

  await setTheme('light');
  const lightHeader = dayHeader().getAttribute('style');
  const lightRow = entryRow().getAttribute('style');
  assert.ok(lightHeader.includes(normColor(ctx.window.THEMES.light.surface)),
    'en clair, l’en-tête de jour porte la surface claire');

  await setTheme('dark');
  const darkHeader = dayHeader().getAttribute('style');
  const darkRow = entryRow().getAttribute('style');
  assert.notEqual(darkHeader, lightHeader, 'l’en-tête memoïsé a bien repeint');
  assert.notEqual(darkRow, lightRow, 'la ligne memoïsée a bien repeint');
  assert.ok(darkHeader.includes(normColor(ctx.window.THEMES.dark.surface)),
    'en sombre, l’en-tête de jour porte la surface sombre');
  assert.ok(!darkHeader.includes(normColor(ctx.window.THEMES.light.surface)),
    'plus aucune trace de la surface claire');
});

test('thème : aucune surface de l’ANCIEN thème ne survit dans le document', async () => {
  // Le test qui décrit le bug tel qu'il se voyait : après la bascule, des
  // morceaux d'interface restaient peints avec les tokens d'avant.
  for (const [from, to] of [['dark', 'light'], ['light', 'dark']]) {
    await setTheme(from);
    await setTheme(to);
    const html = ctx.document.body.innerHTML;
    const stale = ctx.window.THEMES[from];
    // Certaines valeurs sont VOLONTAIREMENT communes aux deux thèmes (l'encre
    // blanche fixe posée sur un bouton rouge vaut « oklch(100% 0 0) », soit la
    // surface du thème clair) : on ne teste que les valeurs qui n'existent
    // nulle part dans le thème d'arrivée, sinon on lèverait un faux positif.
    const arriving = new Set(Object.values(ctx.window.THEMES[to])
      .filter((v) => typeof v === 'string').map(normColor));
    for (const token of ['bg', 'surface', 'surface2', 'surface3', 'ink', 'rule']) {
      const needle = normColor(stale[token]);
      if (arriving.has(needle)) continue;
      assert.ok(!html.includes(needle),
        `token « ${token} » du thème ${from} encore peint après passage en ${to}`);
    }
  }
});

test('thème : les charts memoïsés (stats-charts) repeignent aussi', async () => {
  await ctx.clickAria(/^Stats$/, 500);
  await ctx.waitFor(() => ctx.qa('svg[role="img"]').length > 0, { label: 'un chart rendu' });
  const chartMarkup = () => ctx.qa('svg[role="img"]').map((s) => s.outerHTML).join('|');

  await setTheme('light');
  const light = chartMarkup();
  await setTheme('dark');
  const dark = chartMarkup();
  assert.notEqual(dark, light,
    'les primitives SVG sont memoïsées au boundary : sans useTheme() elles gardaient la palette d’avant');
});

// ── Roue horaire ────────────────────────────────────────────────────

async function openTimeWheel() {
  await ctx.clickAria(/^Catégories$/, 250);
  await ctx.clickAria(/Ajouter une boisson/, 250);
  await ctx.waitFor(() => ctx.findInputByAria(/^Boisson$/), { label: 'AddDrinkSheet' });
  await ctx.clickAria(/^Heure$/, 250);
  await ctx.waitFor(
    () => ctx.qa('[role="listbox"]').some((el) => el.getAttribute('aria-label') === 'Heures'),
    { label: 'roue ouverte' });
  return ctx.qa('[role="listbox"]').find((el) => el.getAttribute('aria-label') === 'Heures');
}
const closeTimeWheel = async () => {
  await ctx.clickText(/^Annuler$/, 200);
  const close = ctx.buttons().find((b) => /Fermer/.test(b.getAttribute('aria-label') || ''));
  if (close) await ctx.act(async () => { ctx.click(close); await ctx.sleep(200); });
};
// Le cran sélectionné, tel que l'arbre l'expose (aria-selected).
const selectedIn = (box) => {
  const opt = ctx.qa('[role="option"]').find((o) => box.contains(o) && o.getAttribute('aria-selected') === 'true');
  return opt && opt.textContent;
};
// jsdom ne fait pas de mise en page : `scrollTop` y est en lecture seule à 0.
// On l'installe donc à la main sur l'élément, puis on émet le vrai événement.
async function scrollWheelTo(box, top) {
  Object.defineProperty(box, 'scrollTop', { value: top, writable: true, configurable: true });
  await ctx.act(async () => {
    box.dispatchEvent(new ctx.window.Event('scroll', { bubbles: false }));
    await ctx.sleep(120);
  });
}

test('roue : un tick haptique et une valeur PAR CRAN franchi', async () => {
  const box = await openTimeWheel();
  const buzz = [];
  Object.defineProperty(ctx.window.navigator, 'vibrate', {
    value: (p) => { buzz.push(p); return true; }, configurable: true, writable: true,
  });

  const H = ctx.window.WHEEL.itemHeight;
  const start = selectedIn(box);
  assert.ok(start != null, 'un cran est sélectionné au départ');

  // Trois crans franchis, un par un : trois ticks, et la valeur suit le
  // défilement au lieu d'attendre l'arrêt (l'ancien comportement).
  const base = ctx.window.wheelOffsetForIndex(0, H);
  for (const idx of [1, 2, 3]) {
    buzz.length = 0;
    await scrollWheelTo(box, base + ctx.window.wheelOffsetForIndex(idx, H));
    assert.equal(buzz.length, 1, `un seul tick pour le cran ${idx}`);
    assert.equal(buzz[0], ctx.window.HAPTICS.tick, 'c’est bien un « tick », pas un commit');
    assert.equal(selectedIn(box), String(idx).padStart(2, '0'),
      'la valeur suit le cran sous le doigt');
  }

  // Rester sur le même cran ne re-vibre pas : on vibre au FRANCHISSEMENT.
  buzz.length = 0;
  await scrollWheelTo(box, ctx.window.wheelOffsetForIndex(3, H) + 4);
  assert.equal(buzz.length, 0, 'pas de tick sans changement de cran');

  await closeTimeWheel();
});

test('roue : un tap sur un cran lointain ne fait pas vibrer tout le trajet', async () => {
  const box = await openTimeWheel();
  const buzz = [];
  Object.defineProperty(ctx.window.navigator, 'vibrate', {
    value: (p) => { buzz.push(p); return true; }, configurable: true, writable: true,
  });

  const opt = ctx.qa('[role="option"]').find((o) => box.contains(o) && o.textContent === '19');
  assert.ok(opt, 'cran « 19 » présent');
  await ctx.act(async () => { ctx.click(opt); await ctx.sleep(150); });

  assert.equal(buzz.length, 1, 'un seul tick pour un saut de 19 crans');
  assert.equal(selectedIn(box), '19', 'le cran tapé est sélectionné');
  await closeTimeWheel();
});

test('roue : le crantage survit à une valeur imposée de l’extérieur', async () => {
  // Rouvrir la roue sur une heure existante repositionne le scroller sans
  // vibrer (personne n'a rien franchi), et le cran suivant crante toujours.
  const box = await openTimeWheel();
  const buzz = [];
  Object.defineProperty(ctx.window.navigator, 'vibrate', {
    value: (p) => { buzz.push(p); return true; }, configurable: true, writable: true,
  });
  assert.equal(buzz.length, 0, 'aucune vibration à la simple ouverture');

  const H = ctx.window.WHEEL.itemHeight;
  await scrollWheelTo(box, ctx.window.wheelOffsetForIndex(5, H));
  assert.equal(buzz.length, 1);
  assert.equal(selectedIn(box), '05');
  await closeTimeWheel();
});

// ── Balayage pour supprimer ─────────────────────────────────────────

const swipeRows = () => ctx.qa('div').filter((d) => (d.getAttribute('style') || '').includes('pan-y'));
// Le plateau d'action est le frère précédent de la ligne (bouton « Supprimer … »).
const trayOf = (row) => row.parentElement.querySelector('button[aria-label^="Supprimer"]');

// Le geste est joué en PLUSIEURS pas espacés dans le temps : la vitesse de
// relâchement est mesurée sur une fenêtre glissante (createVelocityTracker),
// et deux événements émis dans la même milliseconde donneraient une vitesse
// absurde qui ne ressemble à aucun doigt réel.
async function dragRow(row, dx, { steps = 8, gapMs = 20 } = {}) {
  const X0 = 300;
  const ev = (type, x) => new ctx.window.MouseEvent(type, {
    bubbles: true, clientX: Math.round(x), clientY: 100,
  });
  await ctx.act(async () => {
    row.dispatchEvent(ev('pointerdown', X0));
    for (let i = 1; i <= steps; i++) {
      await ctx.sleep(gapMs);
      row.dispatchEvent(ev('pointermove', X0 + (dx * i) / steps));
    }
    row.dispatchEvent(ev('pointerup', X0 + dx));
    await ctx.sleep(280);
  });
}

test('balayage : un demi-geste OUVRE le plateau (il ne se rétracte plus)', async () => {
  await ctx.clickAria(/^Historique$/, 350);
  await ctx.waitFor(() => swipeRows().length >= 2, { label: 'lignes balayables' });

  const row = swipeRows()[0];
  const tray = trayOf(row);
  assert.ok(tray, 'plateau « Supprimer » présent dans le DOM');
  assert.equal(tray.getAttribute('tabindex'), '-1', 'fermé : hors du parcours clavier');

  await dragRow(row, -100);          // au-delà du demi-plateau, loin du seuil de suppression
  assert.equal(trayOf(swipeRows()[0]).getAttribute('tabindex'), '0',
    'ouvert : le plateau devient une vraie cible clavier');
  assert.match(row.style.transform, /translate3d/, 'la ligne est décalée');
});

test('balayage : une seule ligne ouverte à la fois', async () => {
  const rows = swipeRows();
  assert.ok(rows.length >= 2, 'au moins deux lignes pour le test');
  // La première est restée ouverte du test précédent ; on saisit la seconde.
  await dragRow(rows[1], -100);
  const after = swipeRows();
  assert.equal(trayOf(after[1]).getAttribute('tabindex'), '0', 'la seconde s’ouvre');
  assert.equal(trayOf(after[0]).getAttribute('tabindex'), '-1', 'la première s’est refermée');
});

test('balayage : le clic FANTÔME d’un glissement ne referme pas ce qu’il ouvre', async () => {
  // Un vrai glissement laisse un clic derrière lui sur la plupart des moteurs.
  // Sans garde, ce clic tombait sur la règle « ouverte, un tap referme » et la
  // ligne se refermait dans la foulée du geste qui venait de l’ouvrir.
  const row = swipeRows()[0];
  await dragRow(row, -100);
  assert.equal(trayOf(swipeRows()[0]).getAttribute('tabindex'), '0', 'ouverte par le geste');

  await ctx.act(async () => { ctx.click(row); await ctx.sleep(120); });
  assert.equal(trayOf(swipeRows()[0]).getAttribute('tabindex'), '0',
    'le clic fantôme est avalé : la ligne reste ouverte');

  // Le tap SUIVANT, lui, est un vrai tap : il referme.
  await ctx.act(async () => { ctx.click(row); await ctx.sleep(250); });
  assert.equal(trayOf(swipeRows()[0]).getAttribute('tabindex'), '-1',
    'un vrai tap referme la ligne');
});

test('balayage : ouverte, la ligne est INERTE (voile au-dessus du contenu)', async () => {
  // « + » et « Modifier » agissent au relâchement : sans voile, vouloir
  // refermer le plateau ajoutait une boisson ou ouvrait la fiche au passage.
  const row = swipeRows()[0];
  const shield = () => row.querySelector('div[aria-hidden="true"][style*="z-index: 3"]');
  assert.equal(shield(), null, 'fermée : aucun voile, la ligne est cliquable');

  await dragRow(row, -100);
  assert.ok(shield(), 'ouverte : un voile couvre le contenu de la ligne');

  // On referme (deux clics : le fantôme du geste, puis le vrai tap).
  await ctx.act(async () => { ctx.click(row); await ctx.sleep(80); });
  await ctx.act(async () => { ctx.click(row); await ctx.sleep(250); });
  assert.equal(shield(), null, 'refermée : le voile disparaît');
});

test('balayage : un geste court se referme sans rien supprimer', async () => {
  const before = (await ctx.window.dbManager.getAllDrinks()).length;
  const row = swipeRows()[0];
  await dragRow(row, -12, { steps: 6, gapMs: 34 });   // court ET posé
  assert.equal(trayOf(swipeRows()[0]).getAttribute('tabindex'), '-1', 'refermé');
  assert.equal((await ctx.window.dbManager.getAllDrinks()).length, before,
    'aucune suppression sur un geste court');
});

test('balayage : un geste franc supprime, et le toast propose d’annuler', async () => {
  const before = await ctx.window.dbManager.getAllDrinks();
  const row = swipeRows()[0];
  await dragRow(row, -300);          // bien au-delà du point de non-retour
  await ctx.waitFor(
    async () => (await ctx.window.dbManager.getAllDrinks()).length === before.length - 1,
    { label: 'entrée supprimée' });
  assert.match(ctx.text(), /Boisson supprimée/, 'toast avec « Annuler »');
  await ctx.clickText(/^Annuler$/, 350);
  const after = await ctx.window.dbManager.getAllDrinks();
  assert.equal(after.length, before.length, 'undo restaure la boisson');
});
