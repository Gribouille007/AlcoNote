// Regression guard for the pure helpers (no browser / no extra deps).
// Stubs the handful of globals the precompiled bundles touch at load time,
// then asserts the pure helpers shared across the app:
//   - canonicalCat  (trim + NFC, in proto/shared.jsx)
//   - computeCategoryStats dedupe (in proto/data.jsx)
//   - parseDecimal  (comma/dot parsing, in proto/shared.jsx)
//   - ethanolGrams / drinkAlcoholGrams (alcohol mass, in proto/shared.jsx)
//   - sameFamily  (family identity predicate, in proto/data.jsx)
// Run with `npm test`. Exits non-zero on the first failing assertion set.

const path = require('path');
const ROOT = path.join(__dirname, '..');

const noop = () => {};
const el = () => ({
  style: {}, setAttribute: noop, appendChild: noop, append: noop, insertBefore: noop,
  addEventListener: noop, removeEventListener: noop, remove: noop,
  classList: { add: noop, remove: noop, toggle: noop },
  querySelector: () => null, querySelectorAll: () => [],
});
global.navigator = { serviceWorker: null, userAgent: 'node' };
global.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
global.matchMedia = () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop });
global.document = Object.assign(el(), {
  createElement: el, createElementNS: el, getElementById: () => null,
  head: el(), body: el(), documentElement: el(), addEventListener: noop, readyState: 'complete',
});
global.window = global;
global.React = {
  createContext: (d) => ({ _d: d, Provider: ({ children }) => children, Consumer: ({ children }) => children }),
  createElement: () => ({}), Fragment: 'frag', memo: (f) => f,
  useState: (i) => [typeof i === 'function' ? i() : i, noop], useEffect: noop, useMemo: (f) => f(),
  useContext: (c) => (c && c._d), useRef: (i) => ({ current: i }), useCallback: (f) => f,
};

require(path.join(ROOT, 'proto/dist/shared.js'));
require(path.join(ROOT, 'proto/dist/data.js'));

const { canonicalCat, computeCategoryStats, parseDecimal,
  ethanolGrams, drinkAlcoholGrams, ETHANOL_DENSITY_G_PER_ML, sameFamily } = global;
let fails = 0;
function eq(actual, expected, msg) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? '  ok  ' : '  FAIL'} ${msg}${pass ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
  if (!pass) fails++;
}

console.log('canonicalCat');
eq(typeof canonicalCat, 'function', 'exported from shared bundle');
eq(canonicalCat('  Bière  '), 'Bière', 'trims surrounding whitespace');
eq(canonicalCat('Bière'), canonicalCat('Bière'), 'NFD == NFC for "Bière"');
eq(canonicalCat(null), '', 'null -> empty string');

console.log('computeCategoryStats dedupe');
{
  const categories = [{ id: 1, name: 'Bière' }, { id: 2, name: 'Vin' }];
  const families = [
    { category: 'Bière ', entries: [{}, {}] }, // trailing space -> must fold into id 1
    { category: 'Bière',  entries: [{}] },
    { category: 'Rhum',   entries: [{}] },      // unknown -> synthetic
  ];
  const res = computeCategoryStats(categories, families);
  const biere = res.find((r) => canonicalCat(r.name) === 'Bière');
  const rhum = res.find((r) => r.name === 'Rhum');
  eq(res.filter((r) => canonicalCat(r.name) === 'Bière').length, 1, 'no duplicate Bière card');
  eq(biere && biere.id, 1, 'Bière keeps its real id');
  eq(biere && biere.entries, 3, 'Bière entries folded (2 + 1)');
  eq(biere && biere.families, 2, 'Bière families folded across spellings');
  eq(!!rhum && String(rhum.id).startsWith('cat-'), true, 'unknown category stays synthetic');
}

console.log('parseDecimal');
eq(typeof parseDecimal, 'function', 'exported from shared bundle');
eq(parseDecimal('5.5'), 5.5, 'dot decimal -> 5.5');
eq(parseDecimal('5,5'), 5.5, 'comma decimal -> 5.5');
eq(parseDecimal('0,789'), 0.789, 'leading-zero comma -> 0.789');
eq(parseDecimal(' 33 '), 33, 'trims surrounding whitespace');
eq(Number.isNaN(parseDecimal('')), true, 'empty string -> NaN');
eq(Number.isNaN(parseDecimal(null)), true, 'null -> NaN');
eq(Number.isNaN(parseDecimal('abc')), true, 'non-numeric -> NaN');

console.log('ethanolGrams / drinkAlcoholGrams');
eq(typeof ethanolGrams, 'function', 'ethanolGrams exported from shared bundle');
eq(typeof drinkAlcoholGrams, 'function', 'drinkAlcoholGrams exported from shared bundle');
eq(ETHANOL_DENSITY_G_PER_ML, 0.789, 'ethanol density constant (g/mL)');
eq(Math.round(ethanolGrams(50, 5) * 10) / 10, 19.7, '50cL @ 5% ≈ 19.7 g pure alcohol');
eq(ethanolGrams(50, 0), 0, 'zero abv -> 0 g');
eq(ethanolGrams(50, null), 0, 'null abv guarded -> 0 g');
eq(ethanolGrams(0, 5), 0, 'zero volume -> 0 g');
eq(drinkAlcoholGrams({ quantity: 50, unit: 'cl', alcoholContent: 5 }), ethanolGrams(50, 5), 'cL drink folds to ethanolGrams(50, 5)');
eq(drinkAlcoholGrams({ quantity: 0.5, unit: 'L', alcoholContent: 5 }), ethanolGrams(50, 5), 'L unit converts via toCl (0.5 L = 50 cL)');

console.log('sameFamily');
eq(typeof sameFamily, 'function', 'sameFamily exported from data bundle');
{
  // Family objects carry `alcohol`; raw drinks carry `alcoholContent` — the
  // predicate must bridge the two (the mapping buildFamilies establishes).
  const fam = { name: 'Heineken', quantity: 50, unit: 'cL', alcohol: 5 };
  eq(sameFamily({ name: 'Heineken', quantity: 50, unit: 'cL', alcoholContent: 5 }, fam), true, 'exact match (alcoholContent ↔ alcohol)');
  eq(sameFamily({ name: '  heineken ', quantity: 50, unit: 'cl', alcoholContent: 5 }, fam), true, 'name + unit are trimmed / case-insensitive');
  eq(sameFamily({ name: 'Heineken', quantity: 33, unit: 'cL', alcoholContent: 5 }, fam), false, 'different quantity -> false');
  eq(sameFamily({ name: 'Heineken', quantity: 50, unit: 'cL', alcoholContent: 8 }, fam), false, 'different abv -> false');
  eq(sameFamily({ name: 'Affligem', quantity: 50, unit: 'cL', alcoholContent: 5 }, fam), false, 'different name -> false');
  eq(sameFamily({ name: 'X', quantity: 50, unit: 'cL' }, { name: 'X', quantity: 50, unit: 'cL' }), true, 'missing abv on both sides -> 0 === 0');
}

console.log(fails ? `\n${fails} assertion(s) FAILED` : '\nAll assertions passed');
process.exit(fails ? 1 : 0);
