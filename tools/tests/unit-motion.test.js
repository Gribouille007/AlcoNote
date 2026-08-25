// Unitaires du moteur de mouvement (shared.jsx § Ressorts / Élan / Approche).
// Ces helpers sont PURS : ils décrivent une physique et une courbe optique,
// donc ils se testent sans DOM et sans React. Ce sont eux qui portent tout le
// « toucher » de l'app — une régression ici se sent partout.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { installStubs, loadDist } = require('./helpers/stub-globals');

installStubs();
const W = loadDist('shared');

const {
  MOTION, springStep, springAtRest, projectMomentum, rubberband, clampRubber,
  nearestSnapPoint, createVelocityTracker, createSpringDriver, axisLock,
  setLayerHint, STAGGER_MAX, ENTER_TOTAL_MS,
  tracking, leading, remSize, type, TYPE,
} = W;

// Intègre un ressort jusqu'au repos et rend la trajectoire.
function simulate(from, to, config, { dt = 1 / 60, maxSteps = 2000, v0 = 0 } = {}) {
  let st = { x: from, v: v0 };
  const xs = [st.x];
  let steps = 0;
  while (!springAtRest(st, to) && steps < maxSteps) {
    st = springStep(st, to, config, dt);
    xs.push(st.x);
    steps++;
  }
  return { xs, steps, settled: springAtRest(st, to), last: st };
}

// ── Ressorts ───────────────────────────────────────────────────────

test('ressort — un amortissement critique rejoint la cible SANS jamais la dépasser', () => {
  const to = 100;
  const { xs, settled } = simulate(0, to, { damping: 1, response: 0.35 });
  assert.ok(settled, 'le ressort doit finir par se poser');
  assert.ok(Math.max(...xs) <= to + 1e-6,
    `dépassement interdit en amorti critique (max ${Math.max(...xs)})`);
  // …et il progresse vraiment (pas un ressort mort qui reste sur place).
  assert.ok(xs[10] > 0 && xs[10] < to);
});

test('ressort — sous-amorti : dépassement franc, réservé aux gestes avec élan', () => {
  const to = 100;
  const { xs, settled } = simulate(0, to, { damping: 0.6, response: 0.35 });
  assert.ok(settled);
  assert.ok(Math.max(...xs) > to, 'damping < 1 doit dépasser la cible');
});

test('ressort — sur-amorti : aucun dépassement, approche plus lente que le critique', () => {
  const to = 100;
  const crit = simulate(0, to, { damping: 1, response: 0.35 });
  const over = simulate(0, to, { damping: 2.2, response: 0.35 });
  assert.ok(over.settled && crit.settled);
  assert.ok(Math.max(...over.xs) <= to + 1e-6, 'pas de dépassement en sur-amorti');
  assert.ok(over.steps > crit.steps, 'le sur-amorti met plus de temps');
});

test('ressort — `response` plus court = arrivée plus rapide', () => {
  const fast = simulate(0, 100, { damping: 1, response: 0.2 });
  const slow = simulate(0, 100, { damping: 1, response: 0.6 });
  assert.ok(fast.steps < slow.steps, 'response 0.2 doit se poser avant response 0.6');
});

test('ressort — indépendance à la cadence : même trajectoire à 60 et à 120 fps', () => {
  const cfg = { damping: 1, response: 0.4 };
  // La solution est analytique : un pas de 1/60 doit donner le même point que
  // deux pas de 1/120. Une intégration d'Euler échouerait ici.
  let a = { x: 0, v: 0 };
  a = springStep(a, 100, cfg, 1 / 60);
  let b = { x: 0, v: 0 };
  b = springStep(b, 100, cfg, 1 / 120);
  b = springStep(b, 100, cfg, 1 / 120);
  assert.ok(Math.abs(a.x - b.x) < 1e-9, `x: ${a.x} vs ${b.x}`);
  assert.ok(Math.abs(a.v - b.v) < 1e-9, `v: ${a.v} vs ${b.v}`);
});

test('ressort — une vitesse initiale vers la cible fait arriver plus tôt', () => {
  const cfg = { damping: 1, response: 0.4 };
  const still = simulate(0, 100, cfg, { v0: 0 });
  const thrown = simulate(0, 100, cfg, { v0: 400 });
  assert.ok(thrown.steps < still.steps, 'la vitesse de relâchement doit être exploitée');
});

test('ressort — une vitesse initiale À CONTRE-SENS repart en arrière puis revient', () => {
  const cfg = { damping: 1, response: 0.4 };
  const { xs, settled } = simulate(0, 100, cfg, { v0: -600 });
  assert.ok(settled, 'il finit quand même par rejoindre la cible');
  assert.ok(Math.min(...xs) < 0, 'la trajectoire doit d’abord reculer (continuité de la vitesse)');
});

test('ressort — un pas de temps nul ou négatif ne bouge rien', () => {
  const st = { x: 12, v: 34 };
  assert.deepEqual(springStep(st, 0, MOTION.spring.ui, 0), { x: 12, v: 34 });
  assert.deepEqual(springStep(st, 0, MOTION.spring.ui, -1), { x: 12, v: 34 });
});

test('ressort — entrées invalides : on retombe sur un état fini, jamais NaN', () => {
  const r = springStep({ x: NaN, v: NaN }, NaN, { damping: NaN, response: NaN }, 1 / 60);
  assert.ok(Number.isFinite(r.x) && Number.isFinite(r.v), `NaN produit : ${JSON.stringify(r)}`);
});

test('repos — près de la cible MAIS rapide n’est pas au repos', () => {
  assert.equal(springAtRest({ x: 0.001, v: 0.001 }, 0), true);
  assert.equal(springAtRest({ x: 0.001, v: 900 }, 0), false, 'passer sur la cible à pleine vitesse ≠ arrivé');
  assert.equal(springAtRest({ x: 40, v: 0 }, 0), false);
});

// ── Pilote de ressort (interruptibilité, reprise en vol) ───────────

test('pilote — `snap` pose la valeur, coupe la vitesse et notifie', () => {
  const seen = [];
  const d = createSpringDriver((x) => seen.push(x), { from: 0 });
  d.snap(42);
  assert.equal(d.value(), 42);
  assert.equal(d.velocity(), 0);
  assert.deepEqual(seen, [42]);
});

test('pilote — retargeter en vol CONSERVE la vitesse (pas de mur)', () => {
  const d = createSpringDriver(() => {}, { from: 0 });
  d.snap(0);
  // On simule un geste relâché à 500 px/s vers 100…
  d.set(100, { velocity: 500 });
  assert.equal(d.velocity(), 500);
  // …puis un changement d'avis vers 0 : la vitesse en cours est gardée.
  d.set(0);
  assert.equal(d.velocity(), 500, 'sans vitesse explicite, la vitesse courante survit au retarget');
});

test('pilote — reduced-motion : `set` téléporte à la cible et prévient une fois', () => {
  const seen = [];
  const d = createSpringDriver((x) => seen.push(x), { from: 0, reduced: true });
  d.set(250);
  assert.equal(d.value(), 250);
  assert.equal(d.animating(), false, 'aucune boucle d’animation en reduced-motion');
  assert.deepEqual(seen, [250]);
});

test('pilote — une cible déjà atteinte ne démarre aucune animation', () => {
  const d = createSpringDriver(() => {}, { from: 7 });
  d.set(7);
  assert.equal(d.animating(), false);
});

// ── Élan ───────────────────────────────────────────────────────────

test('projection — c’est la décroissance exponentielle d’Apple, pas v²/2a', () => {
  // v/1000 · d/(1−d) ; d = 0.998 → facteur 499.
  assert.ok(Math.abs(projectMomentum(1000, 0.998) - 499) < 1e-9);
  assert.equal(projectMomentum(0), 0);
  // Le signe suit la vitesse : on projette DEVANT le doigt, des deux côtés.
  assert.ok(projectMomentum(-800) < 0);
});

test('projection — un taux plus sec projette moins loin', () => {
  assert.ok(projectMomentum(1000, MOTION.decelSnappy) < projectMomentum(1000, MOTION.decel));
});

test('projection — un petit coup sec porte plus loin qu’un long geste lent', () => {
  // C’est TOUT l’intérêt : « petite entrée, grosse sortie ». Un flick à
  // 900 px/s relâché à 20px doit dépasser un glissement lent relâché à 60px.
  const flick = 20 + projectMomentum(900);
  const slow = 60 + projectMomentum(40);
  assert.ok(flick > slow, `${flick} doit dépasser ${slow}`);
});

test('projection — entrées non finies neutralisées', () => {
  assert.equal(projectMomentum(NaN), 0);
  assert.ok(Number.isFinite(projectMomentum(500, NaN)));
});

// ── Bords élastiques ───────────────────────────────────────────────

test('élastique — la résistance croît, et le débordement plafonne à `dimension`', () => {
  const dim = 200;
  const a = rubberband(50, dim);
  const b = rubberband(400, dim);
  assert.ok(a < 50, 'on suit MOINS que le doigt au-delà de la borne');
  assert.ok(b > a, 'tirer plus fort avance quand même un peu');
  assert.ok(rubberband(1e6, dim) < dim, 'asymptote : on ne tire jamais indéfiniment');
});

test('élastique — symétrique et nul à l’origine', () => {
  assert.equal(rubberband(0, 200), 0);
  assert.ok(Math.abs(rubberband(-80, 200) + rubberband(80, 200)) < 1e-12);
});

test('élastique — dimension nulle/absente : aucun débordement', () => {
  assert.equal(rubberband(90, 0), 0);
  assert.equal(rubberband(90, -5), 0);
});

test('clampRubber — dedans : transparent ; dehors : élastique du bon côté', () => {
  assert.equal(clampRubber(30, 0, 100, 200), 30);
  const under = clampRubber(-60, 0, null, 200);
  assert.ok(under < 0 && under > -60, 'la borne basse résiste sans bloquer');
  const over = clampRubber(160, null, 100, 200);
  assert.ok(over > 100 && over < 160, 'la borne haute résiste sans bloquer');
  // Côté laissé libre (null) : aucun frein.
  assert.equal(clampRubber(1000, 0, null, 200), 1000);
});

// ── Accrochage ─────────────────────────────────────────────────────

test('accrochage — point le plus proche, listes vides/sales gérées', () => {
  assert.equal(nearestSnapPoint(31, [0, 50, 100]), 50);
  assert.equal(nearestSnapPoint(-999, [0, 50]), 0);
  assert.equal(nearestSnapPoint(10, []), null);
  assert.equal(nearestSnapPoint(10, [NaN, 42]), 42);
});

// ── Vitesse de relâchement ─────────────────────────────────────────

test('vitesse — mesurée sur une FENÊTRE, pas sur les deux derniers points', () => {
  const t = createVelocityTracker(100);
  t.add(0, 0); t.add(50, 50); t.add(100, 100);
  assert.ok(Math.abs(t.velocity() - 1000) < 1e-6, '100px en 100ms = 1000 px/s');
});

test('vitesse — un doigt qui s’immobilise juste avant de lâcher garde son élan', () => {
  const t = createVelocityTracker(100);
  t.add(0, 0); t.add(90, 60); t.add(90, 80);
  // Les deux derniers points donneraient 0 : la fenêtre, elle, voit le geste.
  assert.ok(t.velocity() > 500, `élan perdu (${t.velocity()})`);
});

test('vitesse — échantillons hors fenêtre oubliés, reset, cas dégénérés', () => {
  const t = createVelocityTracker(100);
  t.add(0, 0); t.add(1000, 5000);          // très vieux point purgé
  assert.equal(t.samples().length, 1);
  assert.equal(t.velocity(), 0, 'un seul point = pas de vitesse');
  t.add(1100, 5050);
  assert.ok(t.velocity() > 0);
  t.reset();
  assert.equal(t.velocity(), 0);
});

test('vitesse — deux échantillons au même instant ne divisent pas par zéro', () => {
  const t = createVelocityTracker(100);
  t.add(0, 10); t.add(80, 10);
  assert.equal(t.velocity(), 0);
});

// ── Engagement d'une direction (le défilement d'abord) ─────────────

test('engagement — sous le seuil, l’intention reste illisible : aucune direction', () => {
  assert.equal(axisLock(0, 0), null);
  assert.equal(axisLock(5, 5), null);
  assert.equal(axisLock(-5, 3), null);
});

test('engagement — un geste franchement sur l’axe engage l’axe', () => {
  assert.equal(axisLock(12, 0), 'axis');
  assert.equal(axisLock(-12, 2), 'axis', 'le SIGNE n’entre pas en compte');
  assert.equal(axisLock(MOTION.lockPx, 0), 'axis', 'le seuil lui-même suffit');
});

test('engagement — le DÉFILEMENT est prioritaire : l’axe doit dominer franchement', () => {
  // Le cas qui casse tout en vrai : un pouce qui défile verticalement dérive
  // de quelques pixels sur le côté. Avec un simple |d| > |cross|, ce geste
  // engageait l’axe — la liste se figeait et le tap suivant était avalé.
  assert.equal(axisLock(7, 6), 'cross', 'une courte avance ne suffit pas');
  assert.equal(axisLock(10, 9), 'cross');
  assert.equal(axisLock(3, 12), 'cross', 'geste clairement transversal');
  // Au-delà du biais, l’axe l’emporte sans ambiguïté.
  assert.equal(axisLock(10, 6), 'axis');
  assert.ok(MOTION.axisBias > 1, 'sans avance demandée, la règle ne sert à rien');
});

test('engagement — un biais explicite remplace le défaut, et 1 rend la règle neutre', () => {
  assert.equal(axisLock(7, 6, { bias: 1 }), 'axis');
  assert.equal(axisLock(10, 6, { bias: 3 }), 'cross');
  assert.equal(axisLock(9, 0, { slop: 20 }), null, 'seuil relevé = rien n’engage');
});

test('engagement — entrées non finies neutralisées (jamais de NaN dans la décision)', () => {
  assert.equal(axisLock(NaN, NaN), null);
  assert.equal(axisLock(undefined, 30), 'cross');
  assert.equal(axisLock(30, null), 'axis');
});

// ── Couche composée : armée au geste, RENDUE au repos ──────────────

test('couche — `will-change` s’arme puis se rend complètement', () => {
  const el = { style: {} };
  setLayerHint(el, true);
  assert.equal(el.style.willChange, 'transform');
  setLayerHint(el, false);
  assert.equal(el.style.willChange, '', 'au repos, la propriété doit DISPARAÎTRE');
  // Un nœud absent (démonté entre deux frames) ne doit rien casser.
  assert.doesNotThrow(() => { setLayerHint(null, true); setLayerHint({}, false); });
});

test('cascade — la fenêtre d’entrée couvre le dernier item plafonné', () => {
  assert.equal(STAGGER_MAX, 12);
  assert.equal(ENTER_TOTAL_MS, MOTION.base + STAGGER_MAX * MOTION.stagger);
});

// ── Tokens de mouvement gelés ──────────────────────────────────────

test('gel — les ressorts nommés gardent les valeurs de la référence Apple', () => {
  assert.deepEqual({ ...MOTION.spring.move }, { damping: 1, response: 0.4 });
  assert.deepEqual({ ...MOTION.spring.sheet }, { damping: 0.8, response: 0.3 });
  assert.deepEqual({ ...MOTION.spring.flick }, { damping: 0.8, response: 0.4 });
  assert.equal(MOTION.spring.ui.damping, 1, 'le défaut est SANS rebond');
  assert.equal(MOTION.decel, 0.998);
  assert.equal(MOTION.rubber, 0.55);
  assert.equal(MOTION.lockPx, 6);
  assert.equal(MOTION.axisBias, 1.4);
});

test('gel — `easeReverse` est le miroir exact d’`ease`', () => {
  // g(t) = 1 − f(1−t) : cubic-bezier(x1,y1,x2,y2) → (1−x2, 1−y2, 1−x1, 1−y1).
  const nums = (s) => s.match(/-?[\d.]+/g).map(Number);
  const [x1, y1, x2, y2] = nums(MOTION.ease);
  const mirror = [1 - x2, 1 - y2, 1 - x1, 1 - y1];
  assert.deepEqual(nums(MOTION.easeReverse), mirror);
});

// ── Typographie : l'approche suit la taille ────────────────────────

test('approche — négative sur les grandes tailles, positive sur les petites', () => {
  const em = (s) => parseFloat(s);
  assert.ok(em(tracking(34)) < 0, 'un grand titre se RESSERRE');
  assert.ok(em(tracking(24)) < 0);
  assert.ok(Math.abs(em(tracking(14))) < 0.005, 'le corps de texte reste neutre');
  assert.ok(em(tracking(10)) > 0, 'un micro-label s’OUVRE');
  assert.ok(em(tracking(9)) > em(tracking(11)), 'plus c’est petit, plus c’est ouvert');
});

test('approche — monotone décroissante avec la taille, et bornée', () => {
  const em = (s) => parseFloat(s);
  let prev = Infinity;
  for (let px = 8; px <= 64; px += 2) {
    const v = em(tracking(px));
    assert.ok(v < prev, `l’approche doit décroître (px=${px})`);
    assert.ok(v >= -0.03 && v <= 0.05, `hors bornes à px=${px} : ${v}`);
    prev = v;
  }
});

test('approche — les capitales reçoivent une ouverture supplémentaire', () => {
  const em = (s) => parseFloat(s);
  assert.ok(em(tracking(10, { caps: true })) > em(tracking(10)));
  assert.ok(em(tracking(22, { caps: true })) > em(tracking(22)));
});

test('approche — toujours une valeur en `em` exploitable, même sur entrée absurde', () => {
  for (const bad of [0, -5, NaN, undefined, null, 'x']) {
    assert.match(tracking(bad), /^-?\d*\.?\d+em$/, `tracking(${bad})`);
  }
});

test('interlignage — serré sur les grandes tailles, aéré sur le corps, borné', () => {
  assert.ok(leading(34) < leading(14), 'un grand titre a un interlignage plus serré');
  assert.ok(leading(10) > leading(20));
  for (const px of [6, 10, 14, 22, 40, 96]) {
    assert.ok(leading(px) >= 1.05 && leading(px) <= 1.6, `hors bornes à ${px}`);
  }
});

test('tailles — exprimées en rem (donc sensibles au réglage système)', () => {
  assert.equal(remSize(16), '1rem');
  assert.equal(remSize(14), '0.875rem');
  assert.match(remSize(13), /rem$/);
});

test('type() — compose taille + approche + interlignage, et les options', () => {
  const body = type(14);
  assert.equal(body.fontSize, remSize(14));
  assert.equal(body.letterSpacing, tracking(14));
  assert.equal(body.lineHeight, leading(14));
  const label = type(10, { caps: true, weight: 500 });
  assert.equal(label.textTransform, 'uppercase');
  assert.equal(label.fontWeight, 500);
  assert.equal(label.letterSpacing, tracking(10, { caps: true }));
  // `lineHeight` explicite : l'intention de l'auteur l'emporte sur la courbe.
  assert.equal(type(20, { lineHeight: 1 }).lineHeight, 1);
});

test('TYPE — chaque rôle porte le triplet complet, les chiffres restent neutres', () => {
  for (const role of ['display', 'title', 'heading', 'body', 'bodyStrong', 'callout', 'footnote', 'label', 'labelLg']) {
    const t = TYPE[role];
    assert.ok(t.fontSize && t.letterSpacing && t.lineHeight, `TYPE.${role} incomplet`);
    assert.match(t.fontSize, /rem$/, `TYPE.${role} doit être en rem`);
  }
  assert.equal(TYPE.num.letterSpacing, 0, 'les chiffres tabulaires ne prennent pas d’approche');
  assert.equal(TYPE.num.fontVariantNumeric, 'tabular-nums');
  assert.equal(TYPE.label.textTransform, 'uppercase');
});
