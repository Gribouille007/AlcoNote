// Verdict du balayage pour supprimer (proto/history.jsx) — fonction PURE,
// donc testable sans DOM. C'est elle qui décide, au relâchement, sur lequel
// des trois crans la ligne se pose : fermé, OUVERT (plateau « Supprimer »
// découvert) ou supprimé.
//
// Les invariants ci-dessous sont la définition du geste : le cran ouvert doit
// rester ATTEIGNABLE (c'était le bug — tout-ou-rien, il fallait franchir un
// seuil du premier coup), et une suppression ne doit JAMAIS partir d'un petit
// geste vif projeté loin.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { installStubs, loadDist } = require('./helpers/stub-globals');

installStubs();
loadDist('shared', 'history');

const {
  swipeVerdict, swipeCommitThreshold,
  SWIPE_ACTION_W, SWIPE_COMMIT_RATIO, SWIPE_COMMIT_MIN, SWIPE_FLING_V,
  projectMomentum,
} = global;

const W = 360;                                  // largeur de ligne typique
const COMMIT = swipeCommitThreshold(W);         // point de non-retour (négatif)

test('gel — les crans du balayage', () => {
  // Changer ces valeurs change le toucher du geste (cf. CLAUDE.md § Mouvement).
  assert.equal(SWIPE_ACTION_W, 88);
  assert.equal(SWIPE_COMMIT_RATIO, 0.5);
  assert.equal(SWIPE_COMMIT_MIN, 150);
  assert.equal(SWIPE_FLING_V, 320);
});

test('seuil de suppression — moitié de la ligne, avec un plancher', () => {
  assert.equal(swipeCommitThreshold(360), -180, 'moitié de la ligne');
  assert.equal(swipeCommitThreshold(200), -150, 'plancher sur une ligne étroite');
  assert.equal(swipeCommitThreshold(0), -210, 'largeur inconnue → repli 420');
  assert.equal(swipeCommitThreshold(undefined), -210);
  // Le seuil est TOUJOURS au-delà du cran ouvert, sinon ouvrir supprimerait.
  for (const w of [120, 200, 320, 360, 420, 900]) {
    assert.ok(swipeCommitThreshold(w) < -SWIPE_ACTION_W,
      `seuil (${swipeCommitThreshold(w)}) doit dépasser le cran ouvert pour w=${w}`);
  }
});

test('geste mort (relâché près de zéro, sans vitesse) → reste fermé', () => {
  const v = swipeVerdict({ from: -8, velocity: 0, projected: -8, width: W });
  assert.deepEqual(v, { to: 0, commit: false, open: false });
});

test('demi-geste lent au-delà de la moitié du plateau → s’OUVRE', () => {
  // C'est LE cas qui échouait avant : la ligne se rétractait et tout était à
  // refaire. Le cran le plus proche du point projeté l'emporte désormais.
  const from = -(SWIPE_ACTION_W / 2) - 4;
  const v = swipeVerdict({ from, velocity: 0, projected: from, width: W });
  assert.equal(v.to, -SWIPE_ACTION_W);
  assert.equal(v.open, true);
  assert.equal(v.commit, false);
});

test('petit geste vif vers la gauche → ouvre, ne supprime PAS', () => {
  // 30 px parcourus, mais une vitesse qui projette bien au-delà du seuil : la
  // DISTANCE commande, sinon le plateau serait inatteignable au doigt rapide.
  const from = -30;
  const velocity = -700;
  const projected = from + projectMomentum(velocity);
  assert.ok(projected < COMMIT, 'la projection dépasse pourtant le seuil');
  const v = swipeVerdict({ from, velocity, projected, width: W });
  assert.equal(v.commit, false, 'aucune suppression sur un geste court');
  assert.equal(v.to, -SWIPE_ACTION_W, 'il ouvre');
  assert.equal(v.open, true);
});

test('balayage franc au-delà du seuil → supprime', () => {
  const v = swipeVerdict({ from: COMMIT - 1, velocity: -50, projected: COMMIT - 20, width: W });
  assert.equal(v.commit, true);
  assert.equal(v.to, -W, 'la ligne sort par la gauche, sur toute sa largeur');
  assert.equal(v.open, false);
});

test('relance sèche depuis le cran OUVERT → supprime sans re-traverser l’écran', () => {
  const v = swipeVerdict({
    from: -SWIPE_ACTION_W, velocity: -(SWIPE_FLING_V + 1),
    projected: -SWIPE_ACTION_W - 200, width: W, fromOpen: true,
  });
  assert.equal(v.commit, true, 'un coup sec depuis l’ouvert suffit');
  assert.equal(v.to, -W);
});

test('le MÊME coup sec au milieu d’un premier balayage n’efface RIEN', () => {
  // Le raccourci est réservé à la ligne déjà ouverte au repos : en plein
  // premier geste, seule la distance parcourue peut supprimer. Sans cette
  // restriction, tout balayage un peu vif passant devant le plateau
  // supprimait par surprise.
  const v = swipeVerdict({
    from: -SWIPE_ACTION_W, velocity: -(SWIPE_FLING_V + 1),
    projected: -SWIPE_ACTION_W - 200, width: W, fromOpen: false,
  });
  assert.equal(v.commit, false);
  assert.equal(v.to, -SWIPE_ACTION_W, 'il s’arrête au plateau');
  assert.equal(v.open, true);
});

test('depuis l’ouvert, un balayage LENT ne supprime pas non plus', () => {
  const v = swipeVerdict({
    from: -SWIPE_ACTION_W - 10, velocity: -100,
    projected: -SWIPE_ACTION_W - 60, width: W, fromOpen: true,
  });
  assert.equal(v.commit, false, 'il faut un coup SEC, pas un glissement');
  assert.equal(v.to, -SWIPE_ACTION_W);
});

test('lancer sec vers la DROITE → referme, quelle que soit la projection', () => {
  const v = swipeVerdict({
    from: -SWIPE_ACTION_W - 10, velocity: SWIPE_FLING_V + 1,
    projected: -400, width: W,
  });
  assert.equal(v.to, 0, 'la projection est ignorée : le sens de la vitesse tranche');
  assert.equal(v.commit, false);
  assert.equal(v.open, false);
});

test('le geste ne supprime jamais sans une vraie distance parcourue', () => {
  // Balayage de la zone « courte » : quelle que soit la vitesse vers la
  // gauche, tant que le doigt n'a pas dépassé le cran ouvert on n'ouvre
  // qu'au plus — jamais de suppression surprise.
  for (let from = 0; from > -SWIPE_ACTION_W; from -= 4) {
    for (const velocity of [0, -200, -600, -1500, -4000]) {
      for (const fromOpen of [false, true]) {
        const v = swipeVerdict({
          from, velocity, projected: from + projectMomentum(velocity),
          width: W, fromOpen,
        });
        assert.equal(v.commit, false,
          `suppression inattendue depuis from=${from} v=${velocity} (ouvert=${fromOpen})`);
        assert.ok(v.to === 0 || v.to === -SWIPE_ACTION_W, 'cran hors barème');
      }
    }
  }
});

test('la cible est TOUJOURS un des trois crans, sur des entrées absurdes', () => {
  const crazy = [NaN, undefined, null, Infinity, -Infinity, 1e9, -1e9];
  for (const from of crazy) {
    for (const velocity of crazy) {
      const v = swipeVerdict({ from, velocity, projected: from, width: W });
      assert.ok([0, -SWIPE_ACTION_W, -W].includes(v.to),
        `cible hors barème : ${v.to} (from=${from}, v=${velocity})`);
      assert.equal(typeof v.commit, 'boolean');
      assert.equal(v.open, v.to === -SWIPE_ACTION_W);
    }
  }
});

test('premier balayage : seule la DISTANCE peut supprimer, jamais la vitesse', () => {
  for (let from = 0; from > -300; from -= 6) {
    for (const velocity of [-4000, -900, -320, 0, 320, 900]) {
      const v = swipeVerdict({
        from, velocity, projected: from + projectMomentum(velocity),
        width: W, fromOpen: false,
      });
      assert.equal(v.commit, from <= COMMIT,
        `verdict incohérent : from=${from} v=${velocity} (seuil ${COMMIT})`);
    }
  }
});

test('ouvert et supprimé s’excluent — un verdict ne fait jamais les deux', () => {
  const samples = [-500, -300, -180, -120, -88, -44, -10, 0, 20];
  for (const from of samples) {
    for (const velocity of [-900, -320, 0, 320, 900]) {
      const v = swipeVerdict({
        from, velocity, projected: from + projectMomentum(velocity), width: W,
      });
      assert.ok(!(v.open && v.commit), `open ET commit pour from=${from} v=${velocity}`);
    }
  }
});
