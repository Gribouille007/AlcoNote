// Stubs globaux minimaux pour charger les bundles compilés (proto/dist/*.js)
// dans Node SANS navigateur ni React réels. Les bundles exécutent du code
// top-level (createContext, injection de <style>, addEventListener…) qui ne
// doit pas jeter ; ces stubs suffisent pour tester les helpers PURS exposés
// sur window. Pattern hérité de l'ancien tools/test-icons.js.
'use strict';

const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');

// Node ≥ 21 expose `global.navigator` (et quelques autres) en getter natif :
// l'affectation directe jette. On redéfinit la propriété proprement.
function defineGlobal(name, value) {
  Object.defineProperty(global, name, { value, configurable: true, writable: true });
}

function installStubs() {
  const noop = () => {};
  const el = () => ({
    style: {}, setAttribute: noop, appendChild: noop, append: noop, insertBefore: noop,
    addEventListener: noop, removeEventListener: noop, remove: noop,
    classList: { add: noop, remove: noop, toggle: noop },
    querySelector: () => null, querySelectorAll: () => [],
  });
  defineGlobal('navigator', { serviceWorker: null, userAgent: 'node' });
  defineGlobal('localStorage', { getItem: () => null, setItem: noop, removeItem: noop });
  defineGlobal('matchMedia', () => ({
    matches: false, addEventListener: noop, removeEventListener: noop,
    addListener: noop, removeListener: noop,
  }));
  defineGlobal('document', Object.assign(el(), {
    createElement: el, createElementNS: el, getElementById: () => null,
    head: el(), body: el(), documentElement: el(), addEventListener: noop, readyState: 'complete',
  }));
  defineGlobal('window', global);
  global.React = {
    createContext: (d) => ({ _d: d, Provider: ({ children }) => children, Consumer: ({ children }) => children }),
    createElement: () => ({}), Fragment: 'frag', memo: (f) => f, forwardRef: (f) => f,
    useState: (i) => [typeof i === 'function' ? i() : i, noop], useEffect: noop, useMemo: (f) => f(),
    useContext: (c) => (c && c._d), useRef: (i) => ({ current: i }), useCallback: (f) => f,
  };
  return global;
}

// Charge des bundles dist (ex. loadDist('shared', 'data')) dans l'ordre.
// `installStubs()` doit avoir été appelé avant.
function loadDist(...names) {
  for (const n of names) require(path.join(ROOT, 'proto', 'dist', `${n}.js`));
  return global;
}

module.exports = { installStubs, loadDist, ROOT };
