// leaderboard.jsx — Classement du groupe, stat par stat.
//
// Tout le groupe (moi compris, ligne ambre) classé sur UNE stat au choix,
// rangée par famille : Volume, Fréquence, Alcoolémie. Même sélecteur de
// période que Comparer ; sur « Tout », chacun démarre à SA 1re boisson.
//
// AUCUN calcul n'est dupliqué : chaque personne est évaluée par le profil de
// Comparer (buildCompareProfile, via le cache module cachedCompareProfile) —
// un chiffre du classement est donc exactement celui de la comparaison.
//
// Honnêteté : une stat d'alcoolémie exige poids + sexe. Une personne qui ne
// partage pas son BAC n'est PAS classée sur ces stats — elle apparaît sous le
// classement, grisée, « BAC non partagé » (jamais un taux inventé).

const LEADERBOARD_STAT_KEY = 'alconote.leaderboard.stat';

const LEADERBOARD_GROUPS = [
  { id: 'volume', label: 'Volume' },
  { id: 'frequency', label: 'Fréquence' },
  { id: 'bac', label: 'Alcoolémie' },
];

// Registre des stats classables. `get(profile)` → nombre | null (null = pas
// de valeur → non classé). `multiDay` : n'a pas de sens sur « Jour » ;
// `periods` : périodes où la stat existe ; `total` : cumul (avantage les
// historiques longs sur « Tout ») ; `bac` : exige le partage du BAC.
const LEADERBOARD_STATS = [
  { id: 'grams', group: 'volume', label: 'Alcool pur', total: true,
    get: (p) => p.grams, fmt: (v) => COMPARE_FMT.grams(v) },
  { id: 'count', group: 'volume', label: 'Boissons', total: true,
    get: (p) => p.count, fmt: (v) => COMPARE_FMT.int(v) },
  { id: 'volume', group: 'volume', label: 'Volume', total: true,
    get: (p) => p.volumeCl, fmt: (v) => COMPARE_FMT.litres(v) },
  { id: 'perDay', group: 'volume', label: 'Boissons par jour', multiDay: true,
    get: (p) => p.perDay, fmt: (v) => COMPARE_FMT.one(v) },
  { id: 'drinkDays', group: 'frequency', label: 'Jours avec alcool', multiDay: true, total: true,
    get: (p) => p.drinkDays, fmt: (v) => COMPARE_FMT.int(v) },
  { id: 'soberDays', group: 'frequency', label: 'Jours sobres', multiDay: true, total: true,
    get: (p) => p.soberDays, fmt: (v) => COMPARE_FMT.int(v) },
  { id: 'perWeek', group: 'frequency', label: 'Boissons par semaine', periods: COMPARE_WEEKLY_PERIODS,
    get: (p) => p.perWeek, fmt: (v) => COMPARE_FMT.one(v) },
  { id: 'peakBac', group: 'bac', label: 'Pic d’alcoolémie', bac: true,
    get: (p) => (p.bac ? p.bac.peakBac : null), fmt: (v) => COMPARE_FMT.mgL(v) },
  { id: 'meanBac', group: 'bac', label: 'Taux moyen par session', bac: true,
    get: (p) => (p.bac ? p.bac.meanBac : null), fmt: (v) => COMPARE_FMT.mgL(v) },
  { id: 'bourre', group: 'bac', label: 'Temps bourré', bac: true, total: true,
    get: (p) => (p.bac ? p.bac.bourreMs : null), fmt: (v) => (v > 0 ? fmtBourreTime(v) : '0m') },
  { id: 'sessions', group: 'bac', label: 'Sessions', bac: true, total: true,
    get: (p) => (p.bac ? p.bac.sessions : null), fmt: (v) => COMPARE_FMT.int(v) },
];

// ── Helpers purs (testables sous stub-globals) ────────────────────

// Stats disponibles sur une période.
function leaderboardStatsFor(period) {
  return LEADERBOARD_STATS.filter(st =>
    !(st.multiDay && period === 'today') && !(st.periods && !st.periods.includes(period)));
}

// Stat effective : celle demandée si elle existe sur la période, sinon la
// 1re de son groupe, sinon la 1re disponible (« Jours sobres » choisi puis
// passage à « Jour » → repli sur « Alcool pur »).
function resolveLeaderboardStat(statId, period) {
  const avail = leaderboardStatsFor(period);
  const want = LEADERBOARD_STATS.find(st => st.id === statId);
  if (want && avail.includes(want)) return want;
  const sameGroup = want && avail.find(st => st.group === want.group);
  return sameGroup || avail[0];
}

// Classement (pur). `entries` = [{ id, name, isMe, bacAvailable, profile,
// member? }]. → { ranked: [{ …entry, value, display, rank }], unranked:
// [{ …entry, reason }], max }.
// - Tri décroissant ; départage alphabétique (fr), puis id (ordre stable).
// - Rang « compétition » (1, 1, 3) sur la valeur AFFICHÉE : deux « 1.2L »
//   sont ex æquo même si les cL diffèrent — jamais un écart invisible.
// - Non classé : BAC non partagé (stat d'alcoolémie), ou aucune valeur
//   (pas de session, pas de boisson sur « Tout »).
function rankLeaderboard(entries, stat) {
  const ranked = [], unranked = [];
  for (const e of (entries || [])) {
    if (stat.bac && !e.bacAvailable) { unranked.push({ ...e, reason: 'BAC non partagé' }); continue; }
    const raw = e.profile ? stat.get(e.profile) : null;
    const v = raw == null ? NaN : Number(raw);
    if (!Number.isFinite(v)) {
      unranked.push({ ...e, reason: stat.bac ? 'Aucune session' : 'Pas de données' });
      continue;
    }
    ranked.push({ ...e, value: v, display: stat.fmt(v) });
  }
  const byName = (a, b) =>
    String(a.name).localeCompare(String(b.name), 'fr', { sensitivity: 'base' })
    || String(a.id).localeCompare(String(b.id));
  ranked.sort((a, b) => (b.value - a.value) || byName(a, b));
  ranked.forEach((r, i) => {
    const prev = ranked[i - 1];
    r.rank = prev && prev.display === r.display ? prev.rank : i + 1;
  });
  unranked.sort(byName);
  return { ranked, unranked, max: ranked.length ? Math.max(0, ranked[0].value) : 0 };
}

// Avertissement « Tout » : les cumuls avantagent l'historique le plus long.
function leaderboardAllNote(period, stat, entries) {
  if (period !== 'all' || !stat.total) return null;
  const days = (entries || []).map(e => e.profile && e.profile.days).filter(d => d > 0);
  if (days.length < 2) return null;
  const lo = Math.min(...days), hi = Math.max(...days);
  if (hi - lo <= Math.max(1, lo * 0.1)) return null;
  return 'Depuis la 1re boisson de chacun : les cumuls avantagent les historiques les plus longs.';
}

// Ordinal français court : « 1er », « 2e », « 3e »…
function fmtRank(rank) { return rank === 1 ? '1er' : `${rank}e`; }

// Couleurs de médaille par rang (lues AU RENDU : T suit le thème).
function medalColors(rank) {
  if (rank === 1) return { fg: T.medalGold, soft: T.medalGoldSoft };
  if (rank === 2) return { fg: T.medalSilver, soft: T.medalSilverSoft };
  if (rank === 3) return { fg: T.medalBronze, soft: T.medalBronzeSoft };
  return null;
}

// ── Composants ────────────────────────────────────────────────────

function _loadLeaderboardStat() {
  try { return localStorage.getItem(LEADERBOARD_STAT_KEY) || 'grams'; } catch (e) { return 'grams'; }
}

// Pastille de rang (médaille sur le podium / 1-2-3, numéro neutre ensuite).
function RankBadge({ rank, size = 26 }) {
  const m = medalColors(rank);
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: 99, flexShrink: 0,
      display: 'grid', placeItems: 'center',
      background: m ? m.soft : T.surface3,
      border: `1px solid ${m ? m.fg : T.rule}`,
      color: m ? m.fg : T.ink2, fontFamily: fontNum, fontSize: size >= 30 ? 13 : 11, fontWeight: 600,
    }}>{rank}</span>
  );
}

// Colonne du podium. Les hauteurs de marche (1er > 2e > 3e) sont DÉCORATIVES :
// la valeur exacte est écrite au-dessus.
const PODIUM_STEP = { 1: 64, 2: 44, 3: 30 };
function PodiumColumn({ entry, onOpen }) {
  const m = medalColors(entry.rank);
  const tappable = !entry.isMe && onOpen;
  const body = (
    <>
      <RankBadge rank={entry.rank} size={entry.rank === 1 ? 34 : 28} />
      <div style={{
        marginTop: 8, fontSize: 13, fontWeight: 600, maxWidth: '100%',
        color: entry.isMe ? T.accent : T.ink,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{entry.name}</div>
      <div style={{
        marginTop: 4, fontFamily: fontSerif, fontStyle: 'italic',
        fontSize: entry.rank === 1 ? 26 : 22, letterSpacing: -0.4, lineHeight: 1,
        color: T.ink, whiteSpace: 'nowrap',
      }}>{entry.display}</div>
      <div aria-hidden="true" style={{
        marginTop: 10, width: '100%', height: PODIUM_STEP[entry.rank] || PODIUM_STEP[3],
        borderRadius: '12px 12px 0 0',
        background: m ? m.soft : T.surface3,
        borderTop: `2px solid ${m ? m.fg : T.rule}`,
      }} />
    </>
  );
  const colStyle = {
    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'flex-end', textAlign: 'center',
  };
  return tappable ? (
    <button type="button" onClick={() => onOpen(entry.member)}
      aria-label={`${fmtRank(entry.rank)} : ${entry.name}, ${entry.display} — voir ses statistiques`}
      style={{ ...ghostButton, ...colStyle }}>{body}</button>
  ) : (
    <div role="group" aria-label={`${fmtRank(entry.rank)} : ${entry.name}, ${entry.display}`} style={colStyle}>{body}</div>
  );
}

// Podium des 3 premiers, disposé 2 · 1 · 3.
function LeaderboardPodium({ top, onOpen }) {
  const order = [top[1], top[0], top[2]].filter(Boolean);
  return (
    <section aria-label="Podium" style={{
      display: 'flex', alignItems: 'flex-end', gap: 8,
      padding: '18px 14px 0', marginBottom: 14,
      background: T.surface2, border: `1px solid ${T.rule}`, borderRadius: 16, overflow: 'hidden',
    }}>
      {order.map(e => <PodiumColumn key={e.id} entry={e} onOpen={onOpen} />)}
    </section>
  );
}

// Ligne de la liste (rangs 4+, et non classés). Barre ∝ valeur / max.
function LeaderboardRow({ entry, max, first, onOpen }) {
  const unranked = entry.rank == null;
  const tappable = !entry.isMe && onOpen;
  const pct = !unranked && max > 0 ? Math.max(0, Math.min(1, entry.value / max)) : 0;
  const content = (
    <>
      {unranked
        ? <span aria-hidden="true" style={{ width: 26, textAlign: 'center', color: T.muted, fontFamily: fontNum, fontSize: 12, flexShrink: 0 }}>—</span>
        : <RankBadge rank={entry.rank} />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', fontSize: 14, fontWeight: 600,
          color: unranked ? T.muted : (entry.isMe ? T.accent : T.ink),
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{entry.name}</span>
        {unranked ? (
          <span style={{
            display: 'block', marginTop: 3, fontSize: 9.5, color: T.muted, letterSpacing: 0.3,
            textTransform: 'uppercase', fontWeight: 500,
          }}>{entry.reason}</span>
        ) : (
          <span aria-hidden="true" style={{
            display: 'block', marginTop: 6, height: 6, borderRadius: 99, background: T.surface3, overflow: 'hidden',
          }}>
            <span style={{
              display: 'block', height: '100%', width: `${pct * 100}%`, minWidth: pct > 0 ? 4 : 0,
              borderRadius: 99, background: entry.isMe ? T.accent : T.good,
              transition: 'width 0.22s ease',
            }} />
          </span>
        )}
      </span>
      {!unranked && (
        <span style={{
          fontFamily: fontNum, fontSize: 13, color: T.ink, flexShrink: 0, whiteSpace: 'nowrap',
        }}>{entry.display}</span>
      )}
      {tappable && (
        <span style={{ display: 'flex', color: T.muted, flexShrink: 0 }}>
          <SvgIcon icon={Ic.chevR} size={16} />
        </span>
      )}
    </>
  );
  const style = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', textAlign: 'left',
    borderTop: first ? 'none' : `1px solid ${T.rule}`,
  };
  const label = unranked
    ? `${entry.name} : non classé (${entry.reason})`
    : `${fmtRank(entry.rank)} : ${entry.name}, ${entry.display}`;
  return tappable ? (
    <button type="button" onClick={() => onOpen(entry.member)}
      aria-label={`${label} — voir ses statistiques`}
      style={{ ...ghostButton, ...style }}>{content}</button>
  ) : (
    <div role="group" aria-label={label} style={style}>{content}</div>
  );
}

// Choix de la stat : famille (segmenté) puis stat (pastilles).
function LeaderboardStatPicker({ stat, period, onChange }) {
  const avail = leaderboardStatsFor(period);
  const groups = LEADERBOARD_GROUPS.filter(g => avail.some(st => st.group === g.id));
  const inGroup = avail.filter(st => st.group === stat.group);
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ display: 'flex', padding: '12px 16px 10px' }}>
        <div role="tablist" aria-label="Famille de statistiques" style={{
          flex: 1, display: 'flex', gap: 2, padding: 3, background: T.surface2,
          borderRadius: 12, border: `1px solid ${T.rule}`,
        }}>
          {groups.map(g => {
            const on = g.id === stat.group;
            return (
              <button key={g.id} type="button" role="tab" aria-selected={on}
                onClick={() => onChange(resolveLeaderboardStat(
                  (avail.find(st => st.group === g.id) || stat).id, period).id)}
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 9, cursor: 'pointer',
                  background: on ? T.accent : 'transparent',
                  color: on ? T.accentInk : T.ink2,
                  fontSize: 12, fontWeight: on ? 600 : 400, letterSpacing: -0.1,
                  whiteSpace: 'nowrap', border: 'none', fontFamily: 'inherit',
                }}>{g.label}</button>
            );
          })}
        </div>
      </div>
      <div role="group" aria-label="Statistique classée" style={{
        display: 'flex', gap: 6, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {inGroup.map(st => (
          <Pill key={st.id} active={st.id === stat.id} onClick={() => onChange(st.id)}>{st.label}</Pill>
        ))}
      </div>
    </div>
  );
}

// Vue plein écran « Classement » (même transition « page » que Comparer).
// Montée SOUS la fiche ami (zIndex 59 < 60) : taper un ami ouvre sa fiche
// par-dessus, et Retour revient ici.
function LeaderboardView({ onClose, onOpenFriend }) {
  const s = useShare();
  const reduced = useReducedMotion();
  const [closing, close] = useSheetClose(onClose);
  useBackButton(true, close);
  React.useEffect(() => { if (!s.groupId) close(); }, [s.groupId, close]);

  const rawMembers = useGroupMembers();
  const members = React.useMemo(() => sortGroupMembers(rawMembers), [rawMembers]);
  const mySettings = useSettings();
  const myDrinks = useDrinks();
  const pool = usePoolByAuthor();

  const [period, setPeriod] = React.useState(() => storedPeriod(LEADERBOARD_PERIOD_KEY));
  const [anchor, setAnchor] = React.useState(() => new Date());
  const [statId, setStatId] = React.useState(_loadLeaderboardStat);
  React.useEffect(() => { try { localStorage.setItem(LEADERBOARD_PERIOD_KEY, period); } catch (e) {} }, [period]);
  React.useEffect(() => { try { localStorage.setItem(LEADERBOARD_STAT_KEY, statId); } catch (e) {} }, [statId]);
  const stat = resolveLeaderboardStat(statId, period);

  // Personnes à évaluer : moi + chaque membre, avec ses boissons.
  const people = React.useMemo(() => {
    const me = resolveComparePerson(COMPARE_ME, members, mySettings);
    return [
      { ...me, drinks: myDrinks.drinks || CMP_NO_DRINKS, member: null },
      ...members.map(m => ({
        ...resolveComparePerson(m.userId, members, mySettings),
        drinks: pool.byAuthor.get(m.userId) || CMP_NO_DRINKS,
        member: m,
      })),
    ];
  }, [members, mySettings, myDrinks.drinks, pool.byAuthor]);

  const loading = pool.loading || !!myDrinks.loading;
  // Même stratégie que Comparer : la page est peinte seule à la 1re image,
  // le classement (profils en général déjà préchauffés) à la suivante.
  const warm = useProgressiveStages(1) >= 1;
  const entries = React.useMemo(() => (warm && !loading ? people.map(p => ({
    id: p.id, name: p.name, isMe: p.isMe, bacAvailable: p.bacAvailable, member: p.member,
    profile: cachedCompareProfile(p.drinks, compareProfileOpts(p), period, anchor),
  })) : null), [warm, loading, people, period, anchor]);
  const board = React.useMemo(() => (entries ? rankLeaderboard(entries, stat) : null), [entries, stat]);
  const note = entries ? leaderboardAllNote(period, stat, entries) : null;

  const podium = board && board.max > 0 ? board.ranked.filter(r => r.rank <= 3).slice(0, 3) : [];
  const rest = board ? board.ranked.slice(podium.length) : [];
  // Tout le monde à 0 : aucun rang n'a de sens (tous « 1er » ex æquo) →
  // message seul, plus les non classés.
  const nothing = !!board && board.max === 0;
  const listRows = board ? [...(nothing ? [] : rest), ...board.unranked] : [];

  return (
    <div role="dialog" aria-modal="true" aria-label="Classement du groupe" style={{
      position: 'fixed', inset: 0, zIndex: 59,
      background: T.bg, color: T.ink, display: 'flex', flexDirection: 'column',
      animation: reduced ? undefined
        : closing ? `pageOut ${MOTION.fast}ms ${MOTION.ease} forwards`
        : `pageIn ${MOTION.base}ms ${MOTION.ease}`,
      pointerEvents: closing ? 'none' : undefined,
    }}>
      <div style={{
        padding: 'calc(env(safe-area-inset-top) + 14px) 16px 12px',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
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
          }}>Classement</div>
          <div style={{
            fontSize: 9.5, color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase',
            marginTop: 2, fontWeight: 500,
          }}>Le groupe, stat par stat</div>
        </div>
      </div>

      <LeaderboardStatPicker stat={stat} period={period} onChange={setStatId} />
      <PeriodSwitcher period={period} onChange={(p) => { setPeriod(p); setAnchor(new Date()); }} />

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 120px' }}>
        <PeriodNav period={period} anchor={anchor}
          onShift={(d) => setAnchor(shiftAnchor(period, anchor, d))}
          onReset={() => setAnchor(new Date())} />

        {!board && (
          <div aria-busy="true" aria-label="Calcul du classement" style={{
            height: 196, marginBottom: 14, borderRadius: 16,
            background: T.surface2, border: `1px solid ${T.rule}`,
          }} />
        )}

        {board && (
          <>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
              padding: '0 2px 10px',
            }}>
              <div style={{
                fontFamily: fontSerif, fontStyle: 'italic', fontSize: 20, color: T.ink,
                letterSpacing: -0.3, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{stat.label}</div>
              <div style={{
                color: T.muted, fontSize: 9.5, letterSpacing: 0.3, textTransform: 'uppercase',
                fontWeight: 500, flexShrink: 0,
              }}>{board.ranked.length} classé{board.ranked.length > 1 ? 's' : ''}</div>
            </div>

            {nothing && (
              <div style={{
                color: T.muted, fontSize: 12, padding: '4px 0 14px', textAlign: 'center',
                fontStyle: 'italic', fontFamily: fontSerif,
              }}>Personne n'a encore de valeur sur cette période</div>
            )}

            {podium.length > 0 && <LeaderboardPodium top={podium} onOpen={onOpenFriend} />}

            {listRows.length > 0 && (
              <div style={{
                background: T.surface2, border: `1px solid ${T.rule}`, borderRadius: 14, overflow: 'hidden',
              }}>
                {listRows.map((e, i) => (
                  <LeaderboardRow key={e.id} entry={e} max={board.max} first={i === 0} onOpen={onOpenFriend} />
                ))}
              </div>
            )}

            {note && (
              <div style={{
                marginTop: 10, color: T.muted, fontSize: 10.5, lineHeight: 1.5, textAlign: 'center',
              }}>{note}</div>
            )}
            {stat.bac && (
              <div style={{
                marginTop: 10, color: T.muted, fontSize: 10.5, lineHeight: 1.5, textAlign: 'center',
              }}>Alcoolémie estimée par le modèle de Widmark, à partir du poids et du sexe
                partagés — sans eux, aucun taux n'est calculé.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

Object.assign(window, {
  LEADERBOARD_STAT_KEY, LEADERBOARD_GROUPS, LEADERBOARD_STATS,
  leaderboardStatsFor, resolveLeaderboardStat, rankLeaderboard, leaderboardAllNote, medalColors, fmtRank,
  LeaderboardView, LeaderboardPodium, LeaderboardRow, LeaderboardStatPicker, RankBadge,
});
