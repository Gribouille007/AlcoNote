// friends.jsx — Onglet « Amis » + vue des stats d'un ami.
//
// La liste montre chaque membre du groupe (pseudo + pastille d'alcoolémie en
// direct). Au tap, on réaffiche le StatsTab existant pour cet ami via des
// Context.Provider surchargés (ses boissons partagées au lieu des miennes) —
// la carte (pas de GPS) et le BAC (si non partagé) sont masqués.

// Petit avatar circulaire avec l'initiale du pseudo.
function FriendAvatar({ name, size = 38 }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div aria-hidden="true" style={{
      width: size, height: size, borderRadius: 99, flexShrink: 0,
      background: T.surface3, border: `1px solid ${T.rule}`,
      display: 'grid', placeItems: 'center',
      color: T.ink, fontFamily: fontSerif, fontStyle: 'italic', fontSize: size * 0.42,
    }}>{letter}</div>
  );
}

// Ligne d'un ami : avatar + pseudo + pastille BAC, cliquable.
function FriendRow({ member, bac, onOpen }) {
  const press = usePressScale();
  return (
    <button type="button" {...press.handlers} onClick={() => onOpen(member)}
      aria-label={`Voir les statistiques de ${member.displayName}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '12px 14px', background: 'transparent', border: 'none',
        borderBottom: `1px solid ${T.rule}`, cursor: 'pointer',
        fontFamily: 'inherit', textAlign: 'left', color: T.ink,
        ...press.style,
      }}>
      <FriendAvatar name={member.displayName} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 600, color: T.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{member.displayName || 'Anonyme'}</div>
        <div style={{
          fontSize: 9.5, color: T.muted, letterSpacing: 0.3,
          textTransform: 'uppercase', marginTop: 2, fontWeight: 500,
        }}>{member.shareBac ? 'Alcoolémie en direct' : 'BAC non partagé'}</div>
      </div>
      <BacPill bac={bac == null ? null : bac} ariaLabel={`Alcoolémie de ${member.displayName}`} />
      <span style={{ display: 'flex', color: T.muted, marginLeft: 2 }}>
        <SvgIcon icon={Ic.chevR} size={18} />
      </span>
    </button>
  );
}

// État vide / d'amorçage : créer ou rejoindre un groupe.
function FriendsEmpty() {
  const s = useShare();
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  if (!s.available) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: T.muted, fontSize: 13, lineHeight: 1.6 }}>
        Le partage n'est pas configuré sur cette installation.
      </div>
    );
  }
  if (!s.enabled) {
    return (
      <div style={{ padding: '36px 22px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, color: T.accent }}>
          <SvgIcon icon={Ic.users} size={34} />
        </div>
        <div style={{ fontFamily: fontSerif, fontStyle: 'italic', fontSize: 22, color: T.ink, marginBottom: 8 }}>
          Partage entre amis
        </div>
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
          Active le partage dans les <strong style={{ color: T.ink }}>Paramètres</strong> (menu en haut à gauche)
          pour voir l'alcoolémie et les statistiques de tes amis ici.
        </div>
      </div>
    );
  }

  const create = async () => {
    setBusy(true);
    try { await shareEngine.createGroup(); Toast.show('Groupe créé'); }
    catch (e) { Toast.show("Échec de la création"); }
    finally { setBusy(false); }
  };
  const join = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try { await shareEngine.joinGroup(code); Toast.show('Groupe rejoint'); }
    catch (e) { Toast.show('Code invalide'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ padding: '28px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: T.accent }}>
          <SvgIcon icon={Ic.users} size={32} />
        </div>
        <div style={{ fontFamily: fontSerif, fontStyle: 'italic', fontSize: 22, color: T.ink, marginBottom: 6 }}>
          Rejoins tes amis
        </div>
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
          Crée un groupe et partage le code, ou saisis le code d'un ami.
        </div>
      </div>

      <button type="button" onClick={create} disabled={busy} style={{
        padding: '13px 18px', borderRadius: 14, fontSize: 14, fontWeight: 600,
        background: T.accent, color: T.accentInk, border: 'none',
        cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
      }}>Créer un groupe</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 11 }}>
        <div style={{ flex: 1, height: 1, background: T.rule }} />
        OU
        <div style={{ flex: 1, height: 1, background: T.rule }} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="CODE-AMI" aria-label="Code d'invitation"
          style={{
            flex: 1, padding: '12px 14px', borderRadius: 12,
            background: T.surface3, border: `1px solid ${T.rule}`, color: T.ink,
            fontFamily: fontNum, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase',
          }} />
        <button type="button" onClick={join} disabled={busy || !code.trim()} style={{
          padding: '12px 18px', borderRadius: 12, fontSize: 14, fontWeight: 600,
          background: T.surface2, color: T.ink, border: `1px solid ${T.rule}`,
          cursor: (busy || !code.trim()) ? 'default' : 'pointer', fontFamily: 'inherit',
          opacity: (busy || !code.trim()) ? 0.5 : 1,
        }}>Rejoindre</button>
      </div>
    </div>
  );
}

function FriendsTab({ onOpenFriend }) {
  const s = useShare();
  const members = useGroupMembers();
  const bacMap = useFriendsBac(members);

  const hasGroup = s.enabled && !!s.groupId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {hasGroup && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', gap: 10,
        }}>
          <div style={{ fontSize: 9.5, color: T.muted, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: 500 }}>
            {s.syncing ? 'Synchronisation…' :
              (s.lastPullAt ? `Mis à jour ${fmtRelTime(s.lastPullAt)}` : 'Prêt')}
            {s.error ? ' · hors ligne' : ''}
          </div>
          <button type="button" onClick={() => shareEngine.refreshNow()} aria-label="Rafraîchir"
            disabled={s.syncing} style={{
              ...ghostButton, display: 'flex', alignItems: 'center', gap: 6,
              color: T.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              opacity: s.syncing ? 0.5 : 1, padding: '4px 6px',
            }}>
            <SvgIcon icon={Ic.refresh} size={15} /> Rafraîchir
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: hasGroup ? '0 16px 120px' : '0 0 120px' }}>
        {!hasGroup && <FriendsEmpty />}

        {hasGroup && members.length === 0 && (
          <div style={{ padding: '32px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: T.ink, marginBottom: 8 }}>Aucun ami pour l'instant</div>
            <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6 }}>
              Partage ton code d'invitation pour que tes amis te rejoignent.
            </div>
            {s.inviteCode && (
              <div style={{
                marginTop: 16, display: 'inline-block', padding: '10px 16px', borderRadius: 12,
                background: T.surface2, border: `1px solid ${T.rule}`,
                fontFamily: fontNum, fontSize: 18, letterSpacing: 2, color: T.accent,
              }}>{s.inviteCode}</div>
            )}
          </div>
        )}

        {hasGroup && members.length > 0 && (
          <div style={{
            background: T.surface2, border: `1px solid ${T.rule}`, borderRadius: 14,
            overflow: 'hidden',
          }}>
            {members.map(m => (
              <FriendRow key={m.userId} member={m} bac={bacMap[m.userId]} onOpen={onOpenFriend} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Libellé relatif court ("à l'instant", "il y a 8 min", "il y a 2 h").
function fmtRelTime(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 30) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

// Vue plein écran : stats d'un ami via StatsTab + contextes surchargés.
function FriendStatsView({ friend, onClose }) {
  const friendDrinks = useSharedDrinks(friend.userId);
  const friendRatings = useSharedRatings(friend.userId);

  const drinksValue = React.useMemo(() => ({ drinks: friendDrinks, loading: false }), [friendDrinks]);
  const settingsValue = React.useMemo(() => ({
    userWeight: friend.bacWeight != null ? friend.bacWeight : undefined,
    userGender: friend.bacGender || undefined,
  }), [friend.bacWeight, friend.bacGender]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: T.bg, color: T.ink, display: 'flex', flexDirection: 'column',
      animation: `slideUp ${MOTION.base}ms ${MOTION.ease}`,
    }}>
      <div style={{
        padding: 'calc(env(safe-area-inset-top) + 14px) 16px 12px',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        borderBottom: `1px solid ${T.rule}`,
      }}>
        <button type="button" onClick={onClose} aria-label="Retour" style={{
          width: 38, height: 38, borderRadius: 12, background: T.surface2,
          display: 'grid', placeItems: 'center', color: T.ink, cursor: 'pointer',
          border: `1px solid ${T.rule}`, padding: 0, fontFamily: 'inherit',
        }}>
          <SvgIcon icon={Ic.back} size={18} />
        </button>
        <FriendAvatar name={friend.displayName} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: fontSerif, fontStyle: 'italic', fontSize: 19, color: T.ink,
            letterSpacing: -0.3, lineHeight: 1.1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{friend.displayName || 'Anonyme'}</div>
          <div style={{
            fontSize: 9.5, color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase',
            marginTop: 2, fontWeight: 500,
          }}>Statistiques partagées</div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <DrinksContext.Provider value={drinksValue}>
          <SettingsContext.Provider value={settingsValue}>
            <RatingsContext.Provider value={friendRatings}>
              <BacProvider>
                <StatsTab storageScope={'friend:' + friend.userId} hideMap hideBac={!friend.shareBac} />
              </BacProvider>
            </RatingsContext.Provider>
          </SettingsContext.Provider>
        </DrinksContext.Provider>
      </div>
    </div>
  );
}

Object.assign(window, { FriendsTab, FriendStatsView, FriendAvatar, FriendRow });
