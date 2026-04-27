// data.jsx — mock app state.

const CATEGORIES = [{
  id: 'biere',
  name: 'Bière'
}, {
  id: 'vin',
  name: 'Vin'
}, {
  id: 'spirit',
  name: 'Spiritueux'
}, {
  id: 'cocktail',
  name: 'Cocktail'
}, {
  id: 'autre',
  name: 'Autre'
}];

// A "family" = distinct drink + quantity + unit. Each has an array of entries.
const DRINK_FAMILIES = [{
  id: 'f1',
  name: 'Guinness Draught',
  category: 'Bière',
  quantity: 1,
  unit: 'EcoCup',
  alcohol: 4.2,
  rating: 4,
  entries: [{
    id: 'e1',
    ts: '2026-04-18T20:30',
    place: 'Le Comptoir'
  }, {
    id: 'e2',
    ts: '2026-04-15T19:45',
    place: 'Chez Paul'
  }, {
    id: 'e3',
    ts: '2026-04-11T22:10',
    place: 'Le Comptoir'
  }, {
    id: 'e4',
    ts: '2026-04-04T21:00',
    place: null
  }]
}, {
  id: 'f2',
  name: 'Pilsner Urquell',
  category: 'Bière',
  quantity: 33,
  unit: 'cL',
  alcohol: 4.4,
  rating: 4,
  entries: [{
    id: 'e5',
    ts: '2026-04-12T19:20',
    place: 'Bar du Coin'
  }, {
    id: 'e6',
    ts: '2026-04-06T20:15',
    place: 'Bar du Coin'
  }]
}, {
  id: 'f3',
  name: 'IPA Brewdog Punk',
  category: 'Bière',
  quantity: 33,
  unit: 'cL',
  alcohol: 5.6,
  rating: 5,
  entries: [{
    id: 'e7',
    ts: '2026-04-17T21:30',
    place: 'Maison'
  }, {
    id: 'e8',
    ts: '2026-04-10T20:00',
    place: 'Maison'
  }]
}, {
  id: 'f4',
  name: 'Chardonnay Bourgogne',
  category: 'Vin',
  quantity: 12,
  unit: 'cL',
  alcohol: 12.5,
  rating: 3,
  entries: [{
    id: 'e9',
    ts: '2026-04-18T19:15',
    place: 'Maison'
  }, {
    id: 'e10',
    ts: '2026-04-13T20:30',
    place: 'Maison'
  }]
}, {
  id: 'f5',
  name: 'Côtes du Rhône',
  category: 'Vin',
  quantity: 15,
  unit: 'cL',
  alcohol: 13,
  rating: 4,
  entries: [{
    id: 'e11',
    ts: '2026-04-09T21:00',
    place: null
  }]
}, {
  id: 'f6',
  name: 'Jack & Coke',
  category: 'Cocktail',
  quantity: 8,
  unit: 'cL',
  alcohol: 35,
  rating: 3,
  entries: [{
    id: 'e12',
    ts: '2026-04-18T21:45',
    place: 'Le Comptoir'
  }, {
    id: 'e13',
    ts: '2026-04-11T23:15',
    place: 'Le Comptoir'
  }]
}, {
  id: 'f7',
  name: 'Mojito',
  category: 'Cocktail',
  quantity: 15,
  unit: 'cL',
  alcohol: 12,
  rating: 4,
  entries: [{
    id: 'e14',
    ts: '2026-04-05T22:00',
    place: 'Havana Club'
  }]
}, {
  id: 'f8',
  name: 'Whisky Glenlivet',
  category: 'Spiritueux',
  quantity: 4,
  unit: 'cL',
  alcohol: 40,
  rating: 5,
  entries: [{
    id: 'e15',
    ts: '2026-04-16T22:45',
    place: 'Maison'
  }]
}];

// Compute grams of pure alcohol for a family
function gramsOfAlcohol(f) {
  const volCl = f.unit === 'EcoCup' ? f.quantity * 25 : f.unit === 'L' ? f.quantity * 100 : f.quantity;
  return volCl * 10 * (f.alcohol / 100) * 0.789;
}
// 1 unit = 10g
function units(f) {
  return gramsOfAlcohol(f) / 10;
}

// Count families + entries per category
function categoryStats() {
  return CATEGORIES.map(c => {
    const fams = DRINK_FAMILIES.filter(f => f.category === c.name);
    const entries = fams.reduce((s, f) => s + f.entries.length, 0);
    return {
      ...c,
      families: fams.length,
      entries
    };
  }).sort((a, b) => b.entries - a.entries);
}

// Flattened entry list for Historique
function allEntries() {
  const out = [];
  for (const f of DRINK_FAMILIES) {
    for (const e of f.entries) {
      out.push({
        ...e,
        family: f
      });
    }
  }
  return out.sort((a, b) => b.ts.localeCompare(a.ts));
}
Object.assign(window, {
  CATEGORIES,
  DRINK_FAMILIES,
  gramsOfAlcohol,
  units,
  categoryStats,
  allEntries
});