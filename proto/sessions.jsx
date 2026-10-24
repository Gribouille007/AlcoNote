// sessions.jsx — Sessions de consommation : Historique « Par session »,
// renommage, et page de statistiques d'UNE session.
//
// Une session = un épisode d'alcoolémie (de la sortie de 0 au retour à 0),
// calculé par le moteur Widmark UNIQUE `computeBACSessions` (stats.jsx), via
// le cache `cachedBACSessions` (compare.jsx) : l'Historique, Stats et la page
// d'une session lisent les MÊMES objets — aucune recomputation par écran.
// Le NOM d'une session est accroché à ses boissons (data.jsx › § Noms de
// session) : il survit aux fusions/scissions/déplacements de la session.
//
// La page d'une session réutilise les sections de Stats (mêmes composants,
// mêmes calculs) avec un bag `sp` scopé à la session (`period: 'session'`),
// plus trois sections propres : résumé (écarts vs la session moyenne),
// courbe d'alcoolémie DE la session, liste des boissons.

// ── Helpers purs (testables sous stub-globals) ────────────────────

// Paramètres Widmark du profil courant (mêmes défauts que StatsTab).
function widmarkParams(settings) {
  const s = settings || {};
  return { weight: Number(s.userWeight) || DEFAULT_WEIGHT_KG, gender: s.userGender || 'male' };
}

// Session « en cours » : commencée et pas encore revenue à 0 (sa fin est
// alors une PROJECTION sans nouvelle boisson).
function isSessionOngoing(s, nowMs = Date.now()) {
  return !!s && s.startTs <= nowMs && s.endTs > nowMs;
}

const _capFirst = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : str);

// « Samedi 12 octobre » (+ année hors année courante).
function sessionDateLabel(startTs, now = new Date()) {
  const d = new Date(startTs);
  const base = `${FR_DAYS_LONG[d.getDay()]} ${d.getDate()} ${FR_MONTHS_LONG[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

// « Sam. 12 oct. » (+ année hors année courante).
function sessionShortDate(startTs, now = new Date()) {
  const d = new Date(startTs);
  const base = `${_capFirst(FR_DAYS_SHORT[d.getDay()])}. ${d.getDate()} ${FR_MONTHS_DOTTED[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

// « 21:30 → 03:10 » ; « 21:30 → en cours » ; « (+N j) » quand la session
// dure 24 h ou plus (sinon « 21:00 → 22:00 » serait ambigu).
function sessionTimeRange(s, { ongoing = false } = {}) {
  const a = localTime(new Date(s.startTs));
  if (ongoing) return `${a} → en cours`;
  const b = localTime(new Date(s.endTs));
  const days = Math.floor((s.endTs - s.startTs) / 86400_000);
  return days >= 1 ? `${a} → ${b} (+${days} j)` : `${a} → ${b}`;
}

function sessionCountsLabel(s) {
  const n = (s.drinks || []).length;
  return `${n} conso${n > 1 ? 's' : ''} · pic ${Math.round(s.peakBac || 0)} mg/L`;
}

// Titre : le nom s'il existe, sinon la date (toujours unique : deux sessions
// ne commencent jamais au même instant, et le sous-titre porte l'heure).
function sessionTitle(s, name, now = new Date()) {
  return name || sessionDateLabel(s.startTs, now);
}

// Sous-titre : (date courte si nommée) · plage horaire · consos · pic.
function sessionSubtitle(s, name, { ongoing = false, now = new Date() } = {}) {
  const parts = [];
  if (name) parts.push(sessionShortDate(s.startTs, now));
  parts.push(sessionTimeRange(s, { ongoing }));
  parts.push(sessionCountsLabel(s));
  return parts.join(' · ');
}

// Durée (ms) passée STRICTEMENT au-dessus de `thr` sur une courbe affine par
// morceaux [{ ts, bac }] (sommets exacts de computeBACSessions).
function curveTimeAbove(curve, thr) {
  const c = curve || [];
  let total = 0;
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1], b = c[i];
    const dt = b.ts - a.ts;
    if (dt <= 0) continue;
    const ia = a.bac > thr, ib = b.bac > thr;
    if (ia && ib) total += dt;
    else if (ia !== ib) {
      const f = (thr - a.bac) / (b.bac - a.bac);  // instant du croisement
      total += ia ? dt * f : dt * (1 - f);
    }
  }
  return total;
}

// Instant (ms) du DERNIER passage sous `thr` (null si la courbe ne l'a jamais
// dépassé) — « conduite possible à … » pour thr = BAC_LEGAL_LIMIT.
function curveLastDropBelow(curve, thr) {
  const c = curve || [];
  for (let i = c.length - 1; i >= 0; i--) {
    if (c[i].bac > thr + 1e-9) {
      const a = c[i], b = c[i + 1];
      if (!b) return a.ts;
      const f = (a.bac - thr) / Math.max(1e-12, a.bac - b.bac);
      return a.ts + (b.ts - a.ts) * f;
    }
  }
  return null;
}

// Chiffres d'une session (mêmes helpers que Stats : aggregateGeneral,
// computeSpendingSummary). `spend` null = aucun prix saisi.
function sessionMetrics(s, nowMs = Date.now()) {
  const drinks = (s && s.drinks) || [];
  const agg = aggregateGeneral(drinks);
  const spending = computeSpendingSummary(drinks);
  const ongoing = isSessionOngoing(s, nowMs);
  return {
    durationMs: Math.max(0, s.endTs - s.startTs),
    elapsedMs: ongoing ? Math.max(0, nowMs - s.startTs) : null,
    drinkingMs: Math.max(0, (s.lastDrinkTs || s.startTs) - s.startTs),
    peakBac: s.peakBac || 0,
    avgBac: s.avgBac || 0,
    count: agg.count,
    volumeCl: agg.volumeCl,
    grams: agg.grams,
    uniqueCount: agg.uniqueCount,
    aboveLegalMs: curveTimeAbove(s.curve, BAC_LEGAL_LIMIT),
    spend: spending.count ? spending.total : null,
    ongoing,
  };
}

// « Session moyenne » : moyenne de chaque chiffre sur les AUTRES sessions
// terminées (la session affichée et une session en cours, partielle, sont
// exclues). La dépense moyenne ne compte que les sessions avec un prix.
// null quand il n'y a aucune autre session.
const SESSION_BASELINE_KEYS = ['durationMs', 'peakBac', 'avgBac', 'count', 'volumeCl',
  'grams', 'uniqueCount', 'aboveLegalMs', 'spend'];
function sessionBaseline(allSessions, excludeId, nowMs = Date.now()) {
  const others = (allSessions || []).filter(s =>
    s.id !== excludeId && s.startTs <= nowMs && !isSessionOngoing(s, nowMs));
  if (!others.length) return null;
  const sums = {}, ns = {};
  for (const s of others) {
    const m = sessionMetrics(s, nowMs);
    for (const k of SESSION_BASELINE_KEYS) {
      if (m[k] == null) continue;
      sums[k] = (sums[k] || 0) + m[k];
      ns[k] = (ns[k] || 0) + 1;
    }
  }
  const mean = { n: others.length };
  for (const k of SESSION_BASELINE_KEYS) mean[k] = ns[k] ? sums[k] / ns[k] : null;
  return mean;
}

// Écart relatif (%) à une référence ; null sans référence exploitable.
function pctVsBaseline(cur, base) {
  if (cur == null || base == null || base === 0) return null;
  return ((cur - base) / base) * 100;
}

// Courbe d'une session pour SvgBACProjection : t en heures relatives à
// `refMs` (maintenant pour une session en cours, sa fin sinon).
function sessionCurvePoints(s, refMs) {
  return ((s && s.curve) || []).map(p => ({ t: (p.ts - refMs) / 3600_000, bac: p.bac }));
}

// Boissons par heure DE LA SESSION, dans l'ordre chronologique (une soirée
// qui passe minuit reste continue : 22h, 23h, 0h, 1h…), de l'heure de la 1re
// boisson à celle de la dernière. Borné à 96 tranches (garde-fou).
function sessionHourlyBuckets(s) {
  const drinks = (s && s.drinks) || [];
  if (!drinks.length) return [];
  const start = new Date(s.startTs); start.setMinutes(0, 0, 0);
  const out = [];
  for (let d = new Date(start); d.getTime() <= s.lastDrinkTs && out.length < 96; d.setHours(d.getHours() + 1)) {
    const h = d.getHours();
    out.push({ label: `${h}h`, fullLabel: `${h}h – ${(h + 1) % 24}h`, v: 0, ts: d.getTime() });
  }
  for (const dr of drinks) {
    const ts = dr._ts != null ? dr._ts : new Date(`${dr.date}T${dr.time}`).getTime();
    let i = out.length - 1;
    while (i > 0 && out[i].ts > ts) i--;
    out[i].v += 1;
  }
  return out;
}

// id de boisson → session (lookup O(1) pour l'Historique).
function sessionIndexByDrinkId(sessions) {
  const m = new Map();
  for (const s of (sessions || [])) for (const d of (s.drinks || [])) m.set(d.id, s);
  return m;
}

// Regroupe des entrées d'Historique (triées, plus récente d'abord) par
// session : [{ key, session, entries, totalCl }]. Les boissons hors de toute
// session (taux resté à 0 : sans alcool bue à jeun…) forment des groupes
// « hors session » CONSÉCUTIFS (clé = 1re entrée) — jamais déplacés au-dessus
// d'une session qu'ils ne chevauchent pas.
function groupEntriesBySession(entries, sessions, byDrinkId = null) {
  const index = byDrinkId || sessionIndexByDrinkId(sessions);
  const groups = [];
  const bySession = new Map();
  let lastLoose = null;
  for (const e of (entries || [])) {
    const s = index.get(e.id) || null;
    let g;
    if (s) {
      g = bySession.get(s.id);
      if (!g) { g = { key: s.id, session: s, entries: [], totalCl: 0 }; bySession.set(s.id, g); groups.push(g); }
      lastLoose = null;
    } else {
      if (!lastLoose) {
        lastLoose = { key: 'hors::' + e.ts + '::' + e.id, session: null, entries: [], totalCl: 0 };
        groups.push(lastLoose);
      }
      g = lastLoose;
    }
    g.entries.push(e);
    g.totalCl += toCl(e.family.quantity, e.family.unit);
  }
  return groups;
}

// Même session « en valeur » pour l'affichage d'un en-tête de groupe.
function _sameSessionSummary(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.startTs === b.startTs && a.endTs === b.endTs
    && a.peakBac === b.peakBac && a.lastDrinkTs === b.lastDrinkTs
    && (a.drinks || []).length === (b.drinks || []).length;
}

// Références stables des groupes (cf. stabilizeDayGroups) : un groupe est
// réutilisé tel quel quand ses entrées (mêmes objets), son nom, son état
// « en cours » et les chiffres de sa session n'ont pas bougé — les SessionGroup
// (React.memo) sautent alors leur rendu. → { groups, byKey }.
function stabilizeSessionGroups(groups, prevByKey) {
  const byKey = new Map();
  const out = (groups || []).map((g) => {
    const p = prevByKey && prevByKey.get(g.key);
    const same = p && p.name === g.name && p.ongoing === g.ongoing
      && _sameSessionSummary(p.session, g.session)
      && p.entries.length === g.entries.length
      && p.entries.every((e, i) => e === g.entries[i]);
    const keep = same ? p : g;
    byKey.set(g.key, keep);
    return keep;
  });
  return { groups: out, byKey };
}

// Retrouve la session d'une page ouverte après un recalcul : même id, sinon
// la session qui contient une des boissons connues (l'id change quand une
// boisson est ajoutée AVANT la première, ou quand la première est supprimée).
function findSessionForView(allSessions, id, knownKeys) {
  const list = allSessions || [];
  const exact = list.find(s => s.id === id);
  if (exact) return exact;
  if (!knownKeys || !knownKeys.length) return null;
  const keys = new Set(knownKeys);
  return list.find(s => (s.drinks || []).some(d => keys.has(sessionDrinkKey(d)))) || null;
}

// ── Hooks ─────────────────────────────────────────────────────────

// Re-rend au retour à 0 de la session en cours (sa fin projetée) : le
// badge « En cours » tombe pile au bon moment, sans tick périodique.
function useSessionEndTick(sessions) {
  const [, bump] = React.useReducer(x => x + 1, 0);
  const now = Date.now();
  let nextEnd = null;
  for (const s of (sessions || [])) {
    if (isSessionOngoing(s, now) && (nextEnd == null || s.endTs < nextEnd)) nextEnd = s.endTs;
  }
  React.useEffect(() => {
    if (nextEnd == null) return undefined;
    const h = setTimeout(bump, Math.min(2147483000, Math.max(0, nextEnd - Date.now()) + 500));
    return () => clearTimeout(h);
  }, [nextEnd]);
  return now;
}

// Tick minute (courbe « en direct » d'une session en cours uniquement).
function useMinuteTick(active) {
  const [, bump] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    if (!active) return undefined;
    const h = setInterval(bump, 60_000);
    return () => clearInterval(h);
  }, [active]);
}

// ── Historique « Par session » : en-tête de groupe ────────────────
// Carte d'une session : le nom (ou la date) en grand titre serif, la pastille
// couleur du pic, la plage horaire et les chiffres. Toute la ligne ouvre la
// page de stats de la session ; le crayon (frère, pas imbriqué) la renomme.
const SessionGroup = React.memo(function SessionGroup({
  group, name, ongoing = false, onOpenSession, onRenameSession,
  onOpenEntry, onDirectAdd, onDelete, first, index = 0,
}) {
  useTheme();   // repaint sur bascule de thème malgré React.memo (cf. shared.jsx)
  const reduced = useReducedMotion();
  const s = group.session;
  const entries = group.entries;
  const lvl = s ? bacLevel(s.peakBac) : null;
  const title = s ? sessionTitle(s, name) : _capFirst(fmtDayHeader(new Date(entries[0].ts.slice(0, 10) + 'T00:00')));
  // Deux lignes explicites : quand/combien de temps, puis combien — une seule
  // ligne se tronquait en plein milieu des chiffres (« 5 con… »).
  const when = s ? `${name ? sessionShortDate(s.startTs) + ' · ' : ''}${sessionTimeRange(s, { ongoing })}` : 'Hors session · taux resté à 0';
  const what = s ? sessionCountsLabel(s) : `${entries.length} boisson${entries.length > 1 ? 's' : ''}`;
  const sub = `${when} · ${what}`;
  const headerBox = {
    display: 'flex', alignItems: 'stretch',
    background: T.surface, borderTopLeftRadius: 12, borderTopRightRadius: 12,
    borderTop: `1px solid ${T.rule}`, borderLeft: `1px solid ${T.rule}`, borderRight: `1px solid ${T.rule}`,
    position: 'relative', zIndex: 2,
  };
  const titleBlock = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontFamily: fontSerif, fontSize: s && name ? 20 : 18, color: s ? T.ink : T.ink2,
        fontStyle: s && name ? 'italic' : 'normal',
        letterSpacing: -0.3, lineHeight: 1.05,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{title}</div>
      {[when, what].map((line, i) => (
        <div key={i} style={{
          fontSize: 10, color: T.muted, letterSpacing: 0.4, marginTop: i === 0 ? 4 : 2, fontFamily: fontNum,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{line}</div>
      ))}
    </div>
  );
  return (
    <div data-session-group={s ? s.id : 'hors'} style={{
      marginTop: first ? 4 : 14, marginBottom: 4, position: 'relative',
      contentVisibility: 'auto', containIntrinsicSize: 'auto 200px',
      ...staggerStyle(index, { reduced }),
    }}>
      {s ? (
        <div style={headerBox}>
          <button type="button" onClick={() => onOpenSession && onOpenSession(s)}
            aria-label={`Statistiques de la session ${title} — ${sub}${ongoing ? ', en cours' : ''}`}
            style={{
              ...ghostButton, flex: 1, minWidth: 0, textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 4px 12px 12px',
            }}>
            <span aria-hidden="true" style={{
              width: 10, height: 10, borderRadius: 99, background: lvl.color, flexShrink: 0,
              boxShadow: `0 0 8px ${withAlpha(lvl.color, 0.5)}`,
            }}/>
            {titleBlock}
            {ongoing && (
              <span style={{
                flexShrink: 0, fontSize: 9.5, letterSpacing: 0.3, textTransform: 'uppercase',
                fontWeight: 600, color: T.accent, background: T.accentSoft,
                border: `1px solid ${T.accentSoftBorder}`, borderRadius: 99, padding: '2px 8px',
              }}>En cours</span>
            )}
            <span style={{ display: 'flex', color: T.muted, flexShrink: 0 }}>
              <SvgIcon icon={Ic.chevR} size={16} />
            </span>
          </button>
          {onRenameSession && (
            <button type="button" onClick={() => onRenameSession(s, name)}
              aria-label={`${name ? 'Renommer' : 'Nommer'} la session ${title}`}
              style={{
                ...ghostButton, flexShrink: 0, padding: '0 12px 0 6px',
                display: 'flex', alignItems: 'center', color: name ? T.accent : T.muted,
              }}>
              <span style={{
                width: 30, height: 30, borderRadius: 10, background: T.surface2,
                border: `1px solid ${T.rule}`, display: 'grid', placeItems: 'center',
              }}><SvgIcon icon={Ic.edit} size={14} /></span>
            </button>
          )}
        </div>
      ) : (
        <div style={{ ...headerBox, alignItems: 'center', gap: 10, padding: '10px 12px' }}>
          <span aria-hidden="true" style={{
            width: 10, height: 10, borderRadius: 99, flexShrink: 0,
            border: `1px dashed ${T.muted}`,
          }}/>
          {titleBlock}
        </div>
      )}
      <div style={{ position: 'relative', paddingLeft: 24 }}>
        <div style={{
          position: 'absolute', left: 22, top: 0, bottom: 14,
          width: 2, background: T.rule,
        }}/>
        <div style={{
          background: T.surface, borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
          borderLeft: `1px solid ${T.rule}`, borderRight: `1px solid ${T.rule}`,
          borderBottom: `1px solid ${T.rule}`, borderTop: `1px solid ${T.rule}`,
          marginLeft: -24, overflow: 'hidden',
        }}>
          {entries.map((e, i) => (
            <EntryRow key={e.id || i} entry={e} onOpenEntry={onOpenEntry}
              onDirectAdd={onDirectAdd} onDelete={onDelete}
              first={i === 0} last={i === entries.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
});

// ── Renommer une session ──────────────────────────────────────────
function RenameSessionSheet({ session, name: initialName, onClose }) {
  const [name, setName] = React.useState(initialName || '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const savingRef = React.useRef(false);
  const [closing, close] = useSheetClose(onClose);
  const ongoing = isSessionOngoing(session);

  const commit = async (value) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setBusy(true); setErr('');
    try {
      const n = normalizeSessionName(value);
      await setSessionName(session, n);
      Toast.show(n ? 'Session renommée' : 'Nom de la session retiré');
      close();
    } catch (e) {
      setErr(e && e.message ? e.message : 'Erreur');
    } finally { setBusy(false); savingRef.current = false; }
  };

  return (
    <SheetOverlay onClose={close} closing={closing} label="Nommer la session">
      <div style={{
        background: T.bg, borderRadius: '22px 22px 0 0',
        maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
        borderTop: `1px solid ${T.rule}`, borderLeft: `1px solid ${T.rule}`, borderRight: `1px solid ${T.rule}`,
        overflowX: 'hidden',
      }}>
        <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 42, height: 4, borderRadius: 99, background: T.rule }}/>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 18px 6px',
        }}>
          <div style={{ width: 30 }}/>
          <div style={{
            fontFamily: fontSerif, fontSize: 22, color: T.ink,
            letterSpacing: -0.3, fontStyle: 'italic',
          }}>{initialName ? 'Renommer la session' : 'Nommer la session'}</div>
          <button type="button" onClick={close} aria-label="Fermer" style={{
            width: 30, height: 30, borderRadius: 99, background: T.surface2,
            display: 'grid', placeItems: 'center', color: T.ink2, cursor: 'pointer',
            border: 'none', padding: 0, fontFamily: 'inherit',
          }}><SvgIcon icon={Ic.close} size={14} /></button>
        </div>
        <div style={{
          textAlign: 'center', color: T.muted, fontSize: 10.5, fontFamily: fontNum,
          letterSpacing: 0.3, padding: '0 18px 16px',
        }}>
          <div>{sessionShortDate(session.startTs)} · {sessionTimeRange(session, { ongoing })}</div>
          <div style={{ marginTop: 2 }}>{sessionCountsLabel(session)}</div>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 18px 18px', flex: 1 }}>
          <FieldGroup label="Nom de la session">
            <input value={name} autoFocus maxLength={SESSION_NAME_MAX}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (!busy) commit(name); } }}
              placeholder="Ex. Anniv' de Lucas, Festival…"
              aria-label="Nom de la session" style={inputBaseStyle()} />
          </FieldGroup>
          <div style={{ color: T.muted, fontSize: 10.5, lineHeight: 1.5, marginTop: -4 }}>
            Le nom suit les boissons de la session : il reste si tu en ajoutes ou en modifies une.
          </div>
          {initialName && (
            <button type="button" onClick={busy ? undefined : () => commit('')} disabled={busy} style={{
              width: '100%', marginTop: 16, padding: '12px', borderRadius: 12,
              background: T.surface2, color: T.ink2, border: `1px solid ${T.rule}`,
              fontSize: 12.5, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
              opacity: busy ? 0.5 : 1,
            }}>Retirer le nom</button>
          )}
          {err && (
            <div style={{
              color: T.accent2, background: T.dangerSoftBg, border: `1px solid ${T.dangerSoftBorder}`,
              padding: '8px 12px', borderRadius: 10, fontSize: 12, marginTop: 10,
            }}>{err}</div>
          )}
        </div>
        <div style={{
          padding: '12px 18px calc(22px + env(safe-area-inset-bottom))',
          borderTop: `1px solid ${T.rule}`, display: 'flex', gap: 10,
        }}>
          <button type="button" onClick={close} style={{
            flex: 1, padding: '14px', textAlign: 'center', borderRadius: 12,
            background: T.surface2, color: T.ink2, fontSize: 13, cursor: 'pointer',
            border: `1px solid ${T.rule}`, fontFamily: 'inherit',
          }}>Annuler</button>
          <button type="button" onClick={busy ? undefined : () => commit(name)} disabled={busy} style={{
            flex: 2, padding: '14px', textAlign: 'center', borderRadius: 12,
            background: T.accent, color: T.accentInk, fontSize: 13, fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1,
            border: 'none', fontFamily: 'inherit',
            boxShadow: `0 4px 18px ${withAlpha(T.accent, 0.4)}`,
          }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </SheetOverlay>
  );
}

// ── Ligne de session (liste « Sessions » de Stats) ────────────────
function SessionListRow({ session: s, name, ongoing = false, onOpen, last }) {
  const lvl = bacLevel(s.peakBac);
  const title = sessionTitle(s, name);
  const n = (s.drinks || []).length;
  const sub = `${name ? sessionShortDate(s.startTs) : sessionTimeRange(s, { ongoing })} · ${n} conso${n > 1 ? 's' : ''}`;
  const Tag = onOpen ? 'button' : 'div';
  return (
    <Tag {...(onOpen ? { type: 'button', onClick: () => onOpen(s),
      'aria-label': `Statistiques de la session ${title} — ${sub}` } : {})}
      style={{
        ...(onOpen ? ghostButton : {}), width: '100%', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px',
        borderBottom: last ? 'none' : `1px solid ${T.rule}`,
      }}>
      <div style={{
        width: 10, height: 10, borderRadius: 99, background: lvl.color, flexShrink: 0,
        boxShadow: `0 0 8px ${withAlpha(lvl.color, 0.5)}`,
      }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: T.ink, fontSize: name ? 15 : 13, letterSpacing: -0.1,
          fontFamily: name ? fontSerif : fontSans, fontStyle: name ? 'italic' : 'normal',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{title}</div>
        <div style={{
          color: T.muted, fontSize: 10.5, fontFamily: fontNum, marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{sub}</div>
      </div>
      {ongoing && (
        <span style={{
          flexShrink: 0, fontSize: 9.5, letterSpacing: 0.3, textTransform: 'uppercase',
          fontWeight: 600, color: T.accent,
        }}>En cours</span>
      )}
      <div style={{
        fontFamily: fontSerif, fontSize: 17, color: T.ink, letterSpacing: -0.3,
        whiteSpace: 'nowrap', flexShrink: 0,
      }}>{Math.round(s.peakBac)}<span style={{
        fontSize: 9.5, color: T.muted, fontFamily: fontSans, marginLeft: 2,
      }}>mg/L</span></div>
      {onOpen && (
        <span style={{ display: 'flex', color: T.muted, flexShrink: 0 }}>
          <SvgIcon icon={Ic.chevR} size={14} />
        </span>
      )}
    </Tag>
  );
}

// ── Page d'une session : sections propres ─────────────────────────

// Résumé (remplace « Statistiques générales ») : chiffres de la session et
// écart à la session moyenne (badges Δ%).
function SessionSummarySection({ session, metrics, baseline, collapsed, toggleSection, hidePrice }) {
  const m = metrics, b = baseline;
  const d = (k) => (b ? pctVsBaseline(m[k], b[k]) : null);
  const cells = [
    m.ongoing
      ? { v: fmtDurationHM(m.elapsedMs / 3600_000), l: 'Écoulé', icon: Ic.hourglass }
      : { v: fmtDurationHM(m.durationMs / 3600_000), l: 'Durée', delta: d('durationMs'), icon: Ic.hourglass },
    { v: Math.round(m.peakBac), l: 'Pic (mg/L)', delta: d('peakBac') },
    { v: m.count, l: 'Consos', delta: d('count') },
    { v: `${(m.volumeCl / 100).toFixed(1)}L`, l: 'Volume', delta: d('volumeCl') },
    { v: `${Math.round(m.grams)}g`, l: 'Alcool pur', delta: d('grams') },
    { v: Math.round(m.avgBac), l: 'Taux moy. (mg/L)', delta: d('avgBac') },
    { v: m.aboveLegalMs > 0 ? fmtDurationHM(m.aboveLegalMs / 3600_000) : '—', l: 'Au-delà 0,5 g/L',
      delta: d('aboveLegalMs') },
    { v: m.uniqueCount, l: 'Boissons diff.', delta: d('uniqueCount') },
  ];
  if (!hidePrice && m.spend != null) cells.push({ v: fmtPrice(m.spend), l: 'Dépense', delta: d('spend') });
  return (
    <StatSection id="general" title="Résumé de la session" sub="Les chiffres clés de cette session"
      collapsed={collapsed} toggleSection={toggleSection}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {cells.map((c, i) => (
          <StatCell key={c.l} value={c.v} label={c.l} icon={c.icon}
            delta={c.delta} deltaVs="la session moyenne" period="session" index={i} />
        ))}
      </div>
      <div style={{
        color: T.muted, fontSize: 10.5, marginTop: 10, fontStyle: 'italic', fontFamily: fontSerif,
        lineHeight: 1.5,
      }}>
        {b
          ? `Écarts par rapport à la session moyenne (${b.n} autre${b.n > 1 ? 's' : ''} session${b.n > 1 ? 's' : ''} terminée${b.n > 1 ? 's' : ''}).`
          : 'Première session : pas encore de moyenne à comparer.'}
      </div>
    </StatSection>
  );
}

// Courbe d'alcoolémie DE la session (sommets exacts du moteur) — pas le
// taux en direct : une session passée se rejoue, une session en cours montre
// le réalisé (plein) et la descente projetée (pointillés).
function SessionBacSection({ session: s, metrics, collapsed, toggleSection }) {
  const ongoing = metrics.ongoing;
  const refMs = ongoing ? Date.now() : s.endTs;
  const points = React.useMemo(() => sessionCurvePoints(s, refMs), [s, refMs]);
  const legalTs = React.useMemo(() => curveLastDropBelow(s.curve, BAC_LEGAL_LIMIT), [s]);
  const clock = (ts) => localTime(new Date(ts));
  const peakT = (s.peakTs - refMs) / 3600_000;
  return (
    <StatSection id="bac" title="Alcoolémie" sub="Courbe de la session (modèle Widmark)"
      collapsed={collapsed} toggleSection={toggleSection}>
      <Card>
        {ongoing && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <ScopeChip label="En cours" />
          </div>
        )}
        <ChartAutoWidth minHeight={180}>
          {(width) => (
            <SvgBACProjection points={points} width={width} height={bacChartHeight(width)}
              nowMs={refMs} showNow={ongoing} focusDefaultT={ongoing ? 0 : peakT}
              ariaLabel="Alcoolémie au cours de la session" />
          )}
        </ChartAutoWidth>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 14px', marginTop: 12,
        }}>
          <StatRow label="Début" value={clock(s.startTs)} />
          <StatRow label="Pic" value={`${clock(s.peakTs)}${s.peakTs > Date.now() ? ' (prévu)' : ''}`} />
          <StatRow label="Sous 0,5 g/L" value={legalTs == null ? 'Jamais au-delà' : clock(legalTs)} />
          <StatRow label="Retour à 0" value={`${clock(s.endTs)}${ongoing ? ' (prévu)' : ''}`} />
        </div>
      </Card>
    </StatSection>
  );
}

// Boissons bues pendant la session, dans l'ordre. Mes sessions : un tap
// ouvre l'édition de CETTE entrée.
function SessionDrinksSection({ session: s, collapsed, toggleSection, onEditDrink, hidePrice }) {
  useCatPalette();   // pastilles de catégorie (repaint sur changement de teinte)
  const drinks = s.drinks || [];
  const multiDay = drinks.some(d => d.date !== drinks[0].date);
  const n = drinks.length;
  return (
    <StatSection id="session-drinks" title="Boissons de la session"
      sub={`${n} conso${n > 1 ? 's' : ''} · de ${localTime(new Date(s.startTs))} à ${localTime(new Date(s.lastDrinkTs))}`}
      collapsed={collapsed} toggleSection={toggleSection}>
      <Card style={{ padding: '4px 4px' }}>
        {drinks.map((d, i) => {
          const place = drinkPlaceLabel(d);
          const dt = new Date(d._ts != null ? d._ts : `${d.date}T${d.time}`);
          const row = (
            <>
              <div style={{
                width: multiDay ? 72 : 40, flexShrink: 0, fontFamily: fontNum, fontSize: 11, color: T.ink2,
                whiteSpace: 'nowrap',
              }}>{multiDay ? `${FR_DAYS_SHORT[dt.getDay()]}. ` : ''}{localTime(dt)}</div>
              <div style={{
                width: 8, height: 8, borderRadius: 99, background: catColor(d.category, 70), flexShrink: 0,
              }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, color: T.ink, fontWeight: 500, letterSpacing: -0.1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{d.name}</div>
                <div style={{
                  color: T.muted, fontSize: 11.5, marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{d.quantity} {d.unit} · {d.alcoholContent || 0}°{place ? ` · ${place}` : ''}</div>
              </div>
              {!hidePrice && isPricedDrink(d) && (
                <div style={{ fontFamily: fontNum, fontSize: 11, color: T.ink2, flexShrink: 0 }}>{fmtPrice(d.price)}</div>
              )}
            </>
          );
          const rowStyle = {
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px',
            borderBottom: i === n - 1 ? 'none' : `1px solid ${T.rule}`,
          };
          return onEditDrink ? (
            <button key={d.id || i} type="button" onClick={() => onEditDrink(d)}
              aria-label={`Modifier ${d.name}, ${localTime(dt)}`}
              style={{ ...ghostButton, ...rowStyle, width: '100%', textAlign: 'left' }}>{row}</button>
          ) : (
            <div key={d.id || i} style={rowStyle}>{row}</div>
          );
        })}
      </Card>
    </StatSection>
  );
}

// ── Registre des sections de la page d'une session ────────────────
// `lead` : sections propres à la session, toujours en tête (résumé, courbe,
// boissons) ; les autres sont des sections de Stats réutilisées TELLES
// QUELLES (bag `sp` scopé à la session, `period: 'session'`) et suivent
// l'ordre personnalisé de l'onglet Stats.
const SESSION_PAGE_SECTIONS = [
  { id: 'general',        Comp: SessionSummarySection, lead: true },
  { id: 'bac',            Comp: SessionBacSection,     lead: true },
  { id: 'session-drinks', Comp: SessionDrinksSection,  lead: true },
  { id: 'temporal',       Comp: TemporalSection },
  { id: 'category',       Comp: CategorySection },
  { id: 'top',            Comp: TopDrinksSection },
  { id: 'spending',       Comp: SpendingSection, hide: (f) => f.hidePrice },
  { id: 'map',            Comp: MapSection,      hide: (f) => f.hideMap },
];
// Sections de Stats SANS objet sur une seule session — décision consciente,
// testée : toute section de STATS_SECTIONS figure dans l'une des deux listes.
const SESSION_EXCLUDED_SECTIONS = {
  heatmap: 'Calendrier : une seule soirée = une case',
  sessions: 'Liste de sessions : la page EST une session',
  trends: 'Tendances : des mois de données',
};

// Ordre des sections de la page : têtes fixes, puis l'ordre de Stats.
function sessionPageSectionOrder(statsOrder, flags = {}) {
  const visible = SESSION_PAGE_SECTIONS.filter(s => !(s.hide && s.hide(flags)));
  const lead = visible.filter(s => s.lead);
  const rest = visible.filter(s => !s.lead);
  const rank = new Map((statsOrder || []).map((id, i) => [id, i]));
  rest.sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 999) - (rank.has(b.id) ? rank.get(b.id) : 999));
  return lead.concat(rest);
}

// ── Page de statistiques d'une session ────────────────────────────
// Vue plein écran (transition « page » comme la fiche ami), montée en portail
// sur <body> par l'Historique ou par Stats : elle lit les contextes de son
// parent React (MES boissons, ou celles d'un ami dans FriendStatsView).
// `canEdit` : renommer + éditer les boissons (mes sessions uniquement).
function SessionStatsView({ sessionId, onClose, canEdit = false, hideMap = false, hidePrice = false, ownerName = null }) {
  const reduced = useReducedMotion();
  const [closing, close] = useSheetClose(onClose);
  useBackButton(true, close);
  useCatPalette();
  const { drinks } = useDrinks();
  const settings = useSettings();
  const { weight, gender } = widmarkParams(settings);
  const allSessions = React.useMemo(() => cachedBACSessions(drinks, weight, gender), [drinks, weight, gender]);
  // Suivi de la session à travers les recalculs (id puis boissons connues).
  const knownRef = React.useRef([]);
  const session = React.useMemo(
    () => findSessionForView(allSessions, sessionId, knownRef.current),
    [allSessions, sessionId]
  );
  if (session) knownRef.current = (session.drinks || []).map(sessionDrinkKey).filter(Boolean);
  // Session disparue (toutes ses boissons supprimées) → la page se referme.
  React.useEffect(() => { if (!session) close(); }, [session, close]);

  const names = useSessionNames();
  const name = canEdit ? resolveSessionName(session, names) : null;
  const ongoing = !!session && isSessionOngoing(session);
  useMinuteTick(ongoing);
  // Session en cours : les chiffres (écoulé…) suivent le tick minute.
  const minuteKey = ongoing ? Math.floor(Date.now() / 60_000) : 0;
  const metrics = React.useMemo(() => (session ? sessionMetrics(session, Date.now()) : null),
    [session, minuteKey]);
  const baseline = React.useMemo(() => (session ? sessionBaseline(allSessions, session.id) : null),
    [allSessions, session]);

  const [collapsed, setCollapsed] = React.useState(() => loadCollapsedSections('session'));
  const toggleSection = React.useCallback((id) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveCollapsedSections(next, 'session');
      return next;
    });
  }, []);
  const [statsOrder] = useSectionOrder();
  const sections = React.useMemo(
    () => sessionPageSectionOrder(statsOrder, { hideMap, hidePrice }),
    [statsOrder, hideMap, hidePrice]
  );
  const [renaming, setRenaming] = React.useState(false);
  const [editDrink, setEditDrink] = React.useState(null);

  const sp = React.useMemo(() => {
    if (!session) return null;
    const sDrinks = session.drinks || [];
    const day = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d; };
    return {
      collapsed, toggleSection, period: 'session', session, sessionName: name,
      drinks: sDrinks, allDrinks: drinks,
      prevDrinks: null, prevRange: null, prevFullDrinks: null, prevFullRange: null,
      settings, range: { start: day(session.startTs), end: day(session.lastDrinkTs) },
      anchor: new Date(session.startTs), onPickPeriod: null, hasPeriodData: true,
      agg: aggregateGeneral(sDrinks), prevAgg: null,
      sessions: [session], prevSessions: null, allSessions,
      streak: 0, streakRecord: 0,
      bourreMs: Math.max(0, session.endTs - session.startTs), prevBourreMs: null,
      weight, gender, bacAvailable: true, hidePrice, hideMap,
      metrics, baseline,
      onEditDrink: canEdit ? setEditDrink : null,
    };
  }, [session, name, collapsed, toggleSection, drinks, settings, allSessions, weight, gender,
    hidePrice, hideMap, metrics, baseline, canEdit]);

  const title = session ? sessionTitle(session, name) : '';
  const sub = session
    ? [ownerName, name ? sessionShortDate(session.startTs) : null, sessionTimeRange(session, { ongoing })]
      .filter(Boolean).join(' · ')
    : '';

  return (
    <div role="dialog" aria-modal="true" aria-label={`Session ${title}`} style={{
      position: 'fixed', inset: 0, zIndex: 61,
      background: T.bg, color: T.ink, display: 'flex', flexDirection: 'column',
      animation: reduced ? undefined
        : closing ? `pageOut ${MOTION.fast}ms ${MOTION.ease} forwards`
        : `pageIn ${MOTION.base}ms ${MOTION.ease}`,
      pointerEvents: closing ? 'none' : undefined,
    }}>
      <div style={{
        padding: 'calc(env(safe-area-inset-top) + 14px) 16px 12px',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        borderBottom: `1px solid ${T.rule}`,
      }}>
        <button type="button" onClick={close} aria-label="Retour" style={{
          width: 38, height: 38, borderRadius: 12, background: T.surface2,
          display: 'grid', placeItems: 'center', color: T.ink, cursor: 'pointer',
          border: `1px solid ${T.rule}`, padding: 0, fontFamily: 'inherit', flexShrink: 0,
        }}>
          <SvgIcon icon={Ic.back} size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: fontSerif, fontStyle: 'italic', fontSize: 19, color: T.ink,
            letterSpacing: -0.3, lineHeight: 1.1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{title}</div>
          <div style={{
            fontSize: 9.5, color: ongoing ? T.accent : T.muted, letterSpacing: 0.5, textTransform: 'uppercase',
            marginTop: 2, fontWeight: 500, fontFamily: fontNum,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{sub}</div>
        </div>
        {canEdit && session && (
          <button type="button" onClick={() => setRenaming(true)}
            aria-label={name ? 'Renommer la session' : 'Nommer la session'}
            style={{
              width: 38, height: 38, borderRadius: 12, background: T.accentSoft,
              display: 'grid', placeItems: 'center', cursor: 'pointer',
              border: `1px solid ${T.accentSoftBorder}`, padding: 0, fontFamily: 'inherit',
              color: T.accent, flexShrink: 0,
            }}>
            <SvgIcon icon={Ic.edit} size={17} />
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px calc(40px + env(safe-area-inset-bottom))' }}>
        {sp && sections.map(({ id, Comp }) => <Comp key={id} {...sp} />)}
      </div>
      {renaming && session && (
        <RenameSessionSheet key={session.id} session={session} name={name} onClose={() => setRenaming(false)} />
      )}
      {editDrink && (
        <EditEntrySheet key={editDrink.id} entry={editDrink} onClose={() => setEditDrink(null)} />
      )}
    </div>
  );
}

// Monture en portail : la page est `position: fixed` et ne doit dépendre
// d'aucun ancêtre transformé (onglet animé, fiche ami en transition).
function SessionStatsPortal(props) {
  if (typeof document === 'undefined' || !document.body) return null;
  return ReactDOM.createPortal(<SessionStatsView {...props} />, document.body);
}

Object.assign(window, {
  widmarkParams, isSessionOngoing, sessionDateLabel, sessionShortDate, sessionTimeRange,
  sessionCountsLabel, sessionTitle, sessionSubtitle, curveTimeAbove, curveLastDropBelow,
  sessionMetrics, sessionBaseline, SESSION_BASELINE_KEYS, pctVsBaseline, sessionCurvePoints,
  sessionHourlyBuckets, sessionIndexByDrinkId, groupEntriesBySession, stabilizeSessionGroups,
  findSessionForView, useSessionEndTick, useMinuteTick,
  SessionGroup, RenameSessionSheet, SessionListRow,
  SessionSummarySection, SessionBacSection, SessionDrinksSection,
  SESSION_PAGE_SECTIONS, SESSION_EXCLUDED_SECTIONS, sessionPageSectionOrder,
  SessionStatsView, SessionStatsPortal,
});
