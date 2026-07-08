// friends.jsx — Onglet « Amis » + vue des stats d'un ami.
//
// La liste montre chaque membre du groupe (pseudo + pastille d'alcoolémie en
// direct). Au tap, on réaffiche le StatsTab existant pour cet ami via des
// Context.Provider surchargés (ses boissons partagées au lieu des miennes) —
// la carte (pas de GPS) et le BAC (si non partagé) sont masqués.

// Ligne d'un ami : étoile favori (si BAC partagé) + pseudo + pastille BAC.
// Deux boutons FRÈRES dans un conteneur non-interactif — l'étoile (toggle
// favori) et le bouton « ouvrir la fiche » — au lieu d'imbriquer l'étoile dans
// la ligne. Plus de button-in-button ni d'élément focusable dans un
// `role="button"` (a11y propre), et plus besoin de garde-fou clavier ni de
// stopPropagation : un clic/Entrée sur l'étoile ne remonte pas au bouton voisin.
// `favorite`/`onToggleFav` viennent de FriendsTab (piloté par props → aucun
// abonnement share par ligne).
function FriendRow({ member, bac, onOpen, favorite, onToggleFav, index = 0 }) {
  const press = usePressScale();
  const reduced = useReducedMotion();
  const name = member.displayName || 'Anonyme';
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      borderBottom: `1px solid ${T.rule}`,
      ...staggerStyle(index, { reduced }),
    }}>
      {member.shareBac && (
        <button type="button"
          aria-label={favorite ? `Retirer ${name} des favoris` : `Mettre ${name} en favori`}
          aria-pressed={!!favorite}
          onClick={() => onToggleFav && onToggleFav()}
          style={{
            ...ghostButton, padding: '0 4px 0 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: favorite ? T.accent : T.muted,
          }}>
          <SvgIcon icon={favorite ? Ic.star : Ic.starOutline} size={17} />
        </button>
      )}
      <button type="button" {...press.handlers} onClick={() => onOpen(member)}
        aria-label={`Voir les statistiques de ${name}, ${member.shareBac ? 'Alcoolémie en direct' : 'BAC non partagé'}`}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
          paddingTop: 14, paddingBottom: 14, paddingRight: 16,
          paddingLeft: member.shareBac ? 6 : 16,
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left', color: T.ink,
          ...press.style,
        }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 600, color: T.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{name}</div>
          <div style={{
            fontSize: 9.5, color: T.muted, letterSpacing: 0.3,
            textTransform: 'uppercase', marginTop: 2, fontWeight: 500,
          }}>{member.shareBac ? 'Alcoolémie en direct' : 'BAC non partagé'}</div>
        </div>
        <BacPill bac={bac == null ? null : bac} ariaLabel={`Alcoolémie de ${name}`} />
        <span style={{ display: 'flex', color: T.muted, marginLeft: 2 }}>
          <SvgIcon icon={Ic.chevR} size={18} />
        </span>
      </button>
    </div>
  );
}

// Panneau d'administration du groupe — VISIBLE UNIQUEMENT pour le créateur
// (groups.created_by, persisté dans shareState.creatorId). La sécurité ne
// repose PAS sur cet affichage : le serveur re-vérifie les droits dans la
// RPC remove_member (RLS + created_by) quoi que fasse l'UI — un non-créateur
// qui forgerait l'appel reçoit une erreur. Ici on ne fait que refléter ces
// droits pour offrir une gestion visuelle des profils du groupe.
function GroupAdminPanel({ members }) {
  const s = useShare();
  const isCreator = !!s.groupId && !!s.userId && s.creatorId === s.userId;
  if (!isCreator || !members || members.length === 0) return null;
  const remove = async (m) => {
    const name = m.displayName || 'Anonyme';
    const ok = await Confirm.ask({
      title: `Retirer ${name} du groupe ?`,
      message: 'Son profil et ses boissons partagées seront supprimés du groupe pour tout le monde. Ses données personnelles sur son appareil ne sont pas touchées.',
      confirmText: 'Retirer', danger: true,
    });
    if (!ok) return;
    try {
      await shareEngine.removeMember(m.userId);
      Toast.show(`${name} retiré du groupe`);
    } catch (e) {
      Toast.show(shareErrorMessage(e));
    }
  };
  return (
    <div style={{ marginTop: 18 }}>
      <SectionHead>Administration du groupe</SectionHead>
      <div style={{
        marginTop: 10, background: T.surface2, border: `1px solid ${T.rule}`,
        borderRadius: 14, overflow: 'hidden',
      }}>
        {members.map((m, i) => (
          <div key={m.userId} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
            borderBottom: i === members.length - 1 ? 'none' : `1px solid ${T.rule}`,
          }}>
            <div style={{
              flex: 1, minWidth: 0, fontSize: 14, color: T.ink,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{m.displayName || 'Anonyme'}</div>
            <button type="button" onClick={() => remove(m)}
              aria-label={`Retirer ${m.displayName || 'Anonyme'} du groupe`}
              style={{
                ...ghostButton, display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 10, flexShrink: 0,
                background: T.dangerSoftBg, border: `1px solid ${T.dangerSoftBorder}`,
                color: T.accent2, fontSize: 11.5, fontWeight: 500,
              }}>
              <SvgIcon icon={Ic.userMinus} size={13} /> Retirer
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, color: T.muted, fontSize: 10.5, lineHeight: 1.5, letterSpacing: 0.1 }}>
        Visible uniquement par la personne qui a créé le groupe — le serveur
        re-vérifie ce droit à chaque retrait.
      </div>
    </div>
  );
}

// Pied de l'onglet quand on est dans un groupe : action « Quitter le groupe ».
// Le code d'invitation N'EST PLUS affiché ici (déjà dans un groupe) — il reste
// accessible dans Paramètres › Partage, pour inviter d'autres personnes.
function GroupFooter() {
  const onLeave = async () => {
    const ok = await Confirm.ask({
      title: 'Quitter le groupe ?',
      message: 'Tes données partagées seront retirées du groupe et tu ne verras plus celles des autres membres.',
      confirmText: 'Quitter', danger: true,
    });
    if (!ok) return;
    try { await shareEngine.leaveGroup(); Toast.show('Groupe quitté'); }
    catch (e) { Toast.show(shareErrorMessage(e)); }
  };
  return (
    <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button type="button" onClick={onLeave} style={{
        ...ghostButton, padding: '10px 12px', cursor: 'pointer',
        color: T.accent2, fontSize: 13, fontWeight: 600, alignSelf: 'center',
      }}>Quitter le groupe</button>
    </div>
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
    catch (e) { Toast.show(shareErrorMessage(e)); }
    finally { setBusy(false); }
  };
  const join = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try { await shareEngine.joinGroup(code); Toast.show('Groupe rejoint'); }
    catch (e) { Toast.show(shareErrorMessage(e)); }
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

  const onRefresh = async () => {
    const err = await shareEngine.refreshNow();
    if (err) Toast.show(err);
  };

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
          </div>
          <button type="button" onClick={onRefresh} aria-label="Rafraîchir"
            disabled={s.syncing} style={{
              ...ghostButton, display: 'flex', alignItems: 'center', gap: 6,
              color: T.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              opacity: s.syncing ? 0.5 : 1, padding: '4px 6px',
            }}>
            <SvgIcon icon={Ic.refresh} size={15} /> Rafraîchir
          </button>
        </div>
      )}

      {hasGroup && !s.online && (
        <div style={{
          margin: '0 16px 8px', padding: '8px 12px', borderRadius: 10,
          background: T.surface2, border: `1px solid ${T.rule}`,
          color: T.ink2, fontSize: 11.5, lineHeight: 1.4, textAlign: 'center',
        }}>Vous n'êtes pas connecté·e à Internet</div>
      )}

      {hasGroup && s.online && s.errorDetail && (
        <div style={{
          margin: '0 16px 8px', padding: '8px 12px', borderRadius: 10,
          background: T.dangerSoftBg, border: `1px solid ${T.dangerSoftBorder}`,
          color: T.accent2, fontSize: 11.5, lineHeight: 1.4,
        }}>{s.errorDetail}</div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: hasGroup ? '0 16px 120px' : '0 0 120px' }}>
        {!hasGroup && <FriendsEmpty />}

        {hasGroup && members.length === 0 && (
          <div style={{ padding: '32px 22px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: T.ink, marginBottom: 8 }}>Aucun ami pour l'instant</div>
            <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6 }}>
              Partage ton code d'invitation ci-dessous pour que tes amis te rejoignent.
            </div>
          </div>
        )}

        {hasGroup && members.length > 0 && (
          <div style={{
            background: T.surface2, border: `1px solid ${T.rule}`, borderRadius: 14,
            overflow: 'hidden',
          }}>
            {members.map((m, i) => (
              <FriendRow key={m.userId} member={m} bac={bacMap[m.userId]} onOpen={onOpenFriend}
                index={i}
                favorite={s.favoriteId === m.userId}
                onToggleFav={() => shareEngine.toggleFavorite(m.userId)} />
            ))}
          </div>
        )}

        {hasGroup && <GroupAdminPanel members={members} />}
        {hasGroup && <GroupFooter />}
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
// Transition « page » : pousse depuis la droite à l'ouverture (pageIn),
// ressort vers la droite à la fermeture (pageOut) — cohérent avec le geste
// système « revenir en arrière », qu'elle gère elle-même via useBackButton
// (montée = piège posé, fermée = piège retiré, comme une sheet).
function FriendStatsView({ friend, onClose }) {
  const s = useShare();
  const reduced = useReducedMotion();
  const [closing, close] = useSheetClose(onClose);
  useBackButton(true, close);
  const isFav = s.favoriteId === friend.userId;
  const friendDrinks = useSharedDrinks(friend.userId);
  const friendRatings = useSharedRatings(friend.userId);
  // « Retirer du groupe » : visible pour le CRÉATEUR du groupe, ou pour tout
  // membre quand le créateur est inconnu (created_by NULL) — le serveur
  // re-vérifie ces droits dans remove_member quoi qu'affiche l'UI.
  const canRemove = !!s.groupId && (s.creatorId == null || s.creatorId === s.userId);
  const name = friend.displayName || 'Anonyme';
  const onRemove = async () => {
    const ok = await Confirm.ask({
      title: `Retirer ${name} ?`,
      message: 'Ses boissons partagées seront supprimées du groupe pour tout le monde. Ses données personnelles sur son appareil ne sont pas touchées.',
      confirmText: 'Retirer',
      danger: true,
    });
    if (!ok) return;
    try {
      await shareEngine.removeMember(friend.userId);
      Toast.show(`${name} retiré du groupe`);
      close();
    } catch (e) {
      Toast.show(shareErrorMessage(e));
    }
  };

  const drinksValue = React.useMemo(() => ({ drinks: friendDrinks, loading: false }), [friendDrinks]);
  const settingsValue = React.useMemo(() => ({
    userWeight: friend.bacWeight != null ? friend.bacWeight : undefined,
    userGender: friend.bacGender || undefined,
  }), [friend.bacWeight, friend.bacGender]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
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
          border: `1px solid ${T.rule}`, padding: 0, fontFamily: 'inherit',
        }}>
          <SvgIcon icon={Ic.back} size={18} />
        </button>
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
        <button type="button"
          aria-label="Télécharger tout l'historique"
          disabled={s.syncing}
          onClick={async () => {
            const errDetail = await shareEngine.pullFullHistory();
            Toast.show(errDetail ? 'Échec du téléchargement' : 'Historique à jour');
          }}
          style={{
            width: 38, height: 38, borderRadius: 12, background: T.surface2,
            display: 'grid', placeItems: 'center', cursor: s.syncing ? 'default' : 'pointer',
            border: `1px solid ${T.rule}`, padding: 0, fontFamily: 'inherit',
            color: T.ink, flexShrink: 0, opacity: s.syncing ? 0.6 : 1,
          }}>
          <SvgIcon icon={s.syncing ? Ic.refresh : Ic.download} size={18} />
        </button>
        {canRemove && (
          <button type="button"
            aria-label={`Retirer ${name} du groupe`}
            onClick={onRemove}
            style={{
              width: 38, height: 38, borderRadius: 12, background: T.surface2,
              display: 'grid', placeItems: 'center', cursor: 'pointer',
              border: `1px solid ${T.rule}`, padding: 0, fontFamily: 'inherit',
              color: T.accent2, flexShrink: 0,
            }}>
            <SvgIcon icon={Ic.userMinus} size={18} />
          </button>
        )}
        {friend.shareBac && (
          <button type="button"
            aria-label={isFav ? 'Retirer des favoris' : 'Mettre en favori'}
            aria-pressed={isFav}
            onClick={() => shareEngine.toggleFavorite(friend.userId)}
            style={{
              width: 38, height: 38, borderRadius: 12, background: T.surface2,
              display: 'grid', placeItems: 'center', cursor: 'pointer',
              border: `1px solid ${T.rule}`, padding: 0, fontFamily: 'inherit',
              color: isFav ? T.accent : T.muted, flexShrink: 0,
            }}>
            <SvgIcon icon={isFav ? Ic.star : Ic.starOutline} size={18} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <DrinksContext.Provider value={drinksValue}>
          <SettingsContext.Provider value={settingsValue}>
            <RatingsContext.Provider value={friendRatings}>
              <BacProvider>
                <StatsTab storageScope={'friend:' + friend.userId} hideMap hidePrice
                  hideBac={!friend.shareBac} bacAvailable={!!friend.shareBac} />
              </BacProvider>
            </RatingsContext.Provider>
          </SettingsContext.Provider>
        </DrinksContext.Provider>
      </div>
    </div>
  );
}

// Pile des pastilles BAC du header, à droite du titre : ma pastille (ambre,
// même BacContext que la jauge Stats → même mg/L) et, si un ami favori est
// défini, la sienne (verte) juste en dessous. Le slot a une hauteur FIXE de
// 38px (= bouton menu) : le header ne change JAMAIS de hauteur, favori ou
// pas. Seule, ma pastille garde sa taille normale (centrée) ; à deux, les
// deux passent en variante `compact` empilée et `alignItems: stretch` leur
// donne la même largeur (bords alignés). Les abonnements (tick BAC 60 s,
// shareBus via useFavoriteFriend / useFriendsBac) sont confinés ICI : un pull
// ou un tick ne re-rend que la pile, pas tout le header.
function HeaderBacStack() {
  const bacInfo = useBacInfo();
  const fav = useFavoriteFriend();
  const bacMap = useFriendsBac(fav ? [fav] : []);
  const two = !!fav;
  return (
    <div style={{
      height: 38, flexShrink: 0,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: two ? 'stretch' : 'flex-end', gap: two ? 4 : 0,
    }}>
      <BacPill bac={bacInfo.current || 0} compact={two} />
      {two && (
        <BacPill bac={bacMap[fav.userId] == null ? null : bacMap[fav.userId]}
          tone="good" compact
          ariaLabel={`Alcoolémie de ${fav.displayName || 'mon favori'}`} />
      )}
    </div>
  );
}

Object.assign(window, { FriendsTab, FriendStatsView, FriendRow, GroupFooter, GroupAdminPanel, HeaderBacStack });
