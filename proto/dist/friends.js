/* AUTO-GENERATED from proto/friends.jsx — do not edit by hand. */
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function FriendRow({
  member,
  bac,
  onOpen,
  favorite,
  onToggleFav
}) {
  const press = usePressScale();
  const name = member.displayName || 'Anonyme';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'stretch',
      borderBottom: `1px solid ${T.rule}`
    }
  }, member.shareBac && /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": favorite ? `Retirer ${name} des favoris` : `Mettre ${name} en favori`,
    "aria-pressed": !!favorite,
    onClick: () => onToggleFav && onToggleFav(),
    style: {
      ...ghostButton,
      padding: '0 4px 0 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      color: favorite ? T.accent : T.muted
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: favorite ? Ic.star : Ic.starOutline,
    size: 17
  })), /*#__PURE__*/React.createElement("button", _extends({
    type: "button"
  }, press.handlers, {
    onClick: () => onOpen(member),
    "aria-label": `Voir les statistiques de ${name}`,
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      paddingTop: 14,
      paddingBottom: 14,
      paddingRight: 16,
      paddingLeft: member.shareBac ? 6 : 16,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'inherit',
      textAlign: 'left',
      color: T.ink,
      ...press.style
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: T.ink,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      color: T.muted,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      marginTop: 2,
      fontWeight: 500
    }
  }, member.shareBac ? 'Alcoolémie en direct' : 'BAC non partagé')), /*#__PURE__*/React.createElement(BacPill, {
    bac: bac == null ? null : bac,
    ariaLabel: `Alcoolémie de ${name}`
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      color: T.muted,
      marginLeft: 2
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.chevR,
    size: 18
  }))));
}

// Pied de l'onglet quand on est dans un groupe : action « Quitter le groupe ».
// Le code d'invitation N'EST PLUS affiché ici (déjà dans un groupe) — il reste
// accessible dans Paramètres › Partage, pour inviter d'autres personnes.
function GroupFooter() {
  const onLeave = async () => {
    const ok = await Confirm.ask({
      title: 'Quitter le groupe ?',
      message: 'Tes données partagées seront retirées du groupe et tu ne verras plus celles des autres membres.',
      confirmText: 'Quitter',
      danger: true
    });
    if (!ok) return;
    try {
      await shareEngine.leaveGroup();
      Toast.show('Groupe quitté');
    } catch (e) {
      Toast.show(shareErrorMessage(e));
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onLeave,
    style: {
      ...ghostButton,
      padding: '10px 12px',
      cursor: 'pointer',
      color: T.accent2,
      fontSize: 13,
      fontWeight: 600,
      alignSelf: 'center'
    }
  }, "Quitter le groupe"));
}

// État vide / d'amorçage : créer ou rejoindre un groupe.
function FriendsEmpty() {
  const s = useShare();
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  if (!s.available) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '40px 20px',
        textAlign: 'center',
        color: T.muted,
        fontSize: 13,
        lineHeight: 1.6
      }
    }, "Le partage n'est pas configur\xE9 sur cette installation.");
  }
  if (!s.enabled) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '36px 22px',
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 14,
        color: T.accent
      }
    }, /*#__PURE__*/React.createElement(SvgIcon, {
      icon: Ic.users,
      size: 34
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: fontSerif,
        fontStyle: 'italic',
        fontSize: 22,
        color: T.ink,
        marginBottom: 8
      }
    }, "Partage entre amis"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: T.muted,
        lineHeight: 1.6,
        maxWidth: 300,
        margin: '0 auto'
      }
    }, "Active le partage dans les ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: T.ink
      }
    }, "Param\xE8tres"), " (menu en haut \xE0 gauche) pour voir l'alcool\xE9mie et les statistiques de tes amis ici."));
  }
  const create = async () => {
    setBusy(true);
    try {
      await shareEngine.createGroup();
      Toast.show('Groupe créé');
    } catch (e) {
      Toast.show(shareErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const join = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      await shareEngine.joinGroup(code);
      Toast.show('Groupe rejoint');
    } catch (e) {
      Toast.show(shareErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '28px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 12,
      color: T.accent
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.users,
    size: 32
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontStyle: 'italic',
      fontSize: 22,
      color: T.ink,
      marginBottom: 6
    }
  }, "Rejoins tes amis"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: T.muted,
      lineHeight: 1.5
    }
  }, "Cr\xE9e un groupe et partage le code, ou saisis le code d'un ami.")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: create,
    disabled: busy,
    style: {
      padding: '13px 18px',
      borderRadius: 14,
      fontSize: 14,
      fontWeight: 600,
      background: T.accent,
      color: T.accentInk,
      border: 'none',
      cursor: busy ? 'default' : 'pointer',
      fontFamily: 'inherit',
      opacity: busy ? 0.6 : 1
    }
  }, "Cr\xE9er un groupe"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      color: T.muted,
      fontSize: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: T.rule
    }
  }), "OU", /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: T.rule
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: code,
    onChange: e => setCode(e.target.value.toUpperCase()),
    placeholder: "CODE-AMI",
    "aria-label": "Code d'invitation",
    style: {
      flex: 1,
      padding: '12px 14px',
      borderRadius: 12,
      background: T.surface3,
      border: `1px solid ${T.rule}`,
      color: T.ink,
      fontFamily: fontNum,
      fontSize: 14,
      letterSpacing: 1,
      textTransform: 'uppercase'
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: join,
    disabled: busy || !code.trim(),
    style: {
      padding: '12px 18px',
      borderRadius: 12,
      fontSize: 14,
      fontWeight: 600,
      background: T.surface2,
      color: T.ink,
      border: `1px solid ${T.rule}`,
      cursor: busy || !code.trim() ? 'default' : 'pointer',
      fontFamily: 'inherit',
      opacity: busy || !code.trim() ? 0.5 : 1
    }
  }, "Rejoindre")));
}
function FriendsTab({
  onOpenFriend
}) {
  const s = useShare();
  const members = useGroupMembers();
  const bacMap = useFriendsBac(members);
  const hasGroup = s.enabled && !!s.groupId;
  const onRefresh = async () => {
    const err = await shareEngine.refreshNow();
    if (err) Toast.show(err);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, hasGroup && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      color: T.muted,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      fontWeight: 500
    }
  }, s.syncing ? 'Synchronisation…' : s.lastPullAt ? `Mis à jour ${fmtRelTime(s.lastPullAt)}` : 'Prêt'), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onRefresh,
    "aria-label": "Rafra\xEEchir",
    disabled: s.syncing,
    style: {
      ...ghostButton,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      color: T.accent,
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      opacity: s.syncing ? 0.5 : 1,
      padding: '4px 6px'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.refresh,
    size: 15
  }), " Rafra\xEEchir")), hasGroup && !s.online && /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '0 16px 8px',
      padding: '8px 12px',
      borderRadius: 10,
      background: T.surface2,
      border: `1px solid ${T.rule}`,
      color: T.ink2,
      fontSize: 11.5,
      lineHeight: 1.4,
      textAlign: 'center'
    }
  }, "Vous n'\xEAtes pas connect\xE9\xB7e \xE0 Internet"), hasGroup && s.online && s.errorDetail && /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '0 16px 8px',
      padding: '8px 12px',
      borderRadius: 10,
      background: T.dangerSoftBg,
      border: `1px solid ${T.dangerSoftBorder}`,
      color: T.accent2,
      fontSize: 11.5,
      lineHeight: 1.4
    }
  }, s.errorDetail), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: hasGroup ? '0 16px 120px' : '0 0 120px'
    }
  }, !hasGroup && /*#__PURE__*/React.createElement(FriendsEmpty, null), hasGroup && members.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '32px 22px 8px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: T.ink,
      marginBottom: 8
    }
  }, "Aucun ami pour l'instant"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: T.muted,
      lineHeight: 1.6
    }
  }, "Partage ton code d'invitation ci-dessous pour que tes amis te rejoignent.")), hasGroup && members.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface2,
      border: `1px solid ${T.rule}`,
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, members.map(m => /*#__PURE__*/React.createElement(FriendRow, {
    key: m.userId,
    member: m,
    bac: bacMap[m.userId],
    onOpen: onOpenFriend,
    favorite: s.favoriteId === m.userId,
    onToggleFav: () => shareEngine.toggleFavorite(m.userId)
  }))), hasGroup && /*#__PURE__*/React.createElement(GroupFooter, null)));
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
function FriendStatsView({
  friend,
  onClose
}) {
  const s = useShare();
  const isFav = s.favoriteId === friend.userId;
  const friendDrinks = useSharedDrinks(friend.userId);
  const friendRatings = useSharedRatings(friend.userId);
  const drinksValue = React.useMemo(() => ({
    drinks: friendDrinks,
    loading: false
  }), [friendDrinks]);
  const settingsValue = React.useMemo(() => ({
    userWeight: friend.bacWeight != null ? friend.bacWeight : undefined,
    userGender: friend.bacGender || undefined
  }), [friend.bacWeight, friend.bacGender]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 60,
      background: T.bg,
      color: T.ink,
      display: 'flex',
      flexDirection: 'column',
      animation: `slideUp ${MOTION.base}ms ${MOTION.ease}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'calc(env(safe-area-inset-top) + 14px) 16px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0,
      borderBottom: `1px solid ${T.rule}`
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "Retour",
    style: {
      width: 38,
      height: 38,
      borderRadius: 12,
      background: T.surface2,
      display: 'grid',
      placeItems: 'center',
      color: T.ink,
      cursor: 'pointer',
      border: `1px solid ${T.rule}`,
      padding: 0,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.back,
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontStyle: 'italic',
      fontSize: 19,
      color: T.ink,
      letterSpacing: -0.3,
      lineHeight: 1.1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, friend.displayName || 'Anonyme'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      color: T.muted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginTop: 2,
      fontWeight: 500
    }
  }, "Statistiques partag\xE9es")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "T\xE9l\xE9charger tout l'historique",
    disabled: s.syncing,
    onClick: async () => {
      const errDetail = await shareEngine.pullFullHistory();
      Toast.show(errDetail ? 'Échec du téléchargement' : 'Historique à jour');
    },
    style: {
      width: 38,
      height: 38,
      borderRadius: 12,
      background: T.surface2,
      display: 'grid',
      placeItems: 'center',
      cursor: s.syncing ? 'default' : 'pointer',
      border: `1px solid ${T.rule}`,
      padding: 0,
      fontFamily: 'inherit',
      color: T.ink,
      flexShrink: 0,
      opacity: s.syncing ? 0.6 : 1
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: s.syncing ? Ic.refresh : Ic.download,
    size: 18
  })), friend.shareBac && /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": isFav ? 'Retirer des favoris' : 'Mettre en favori',
    "aria-pressed": isFav,
    onClick: () => shareEngine.toggleFavorite(friend.userId),
    style: {
      width: 38,
      height: 38,
      borderRadius: 12,
      background: T.surface2,
      display: 'grid',
      placeItems: 'center',
      cursor: 'pointer',
      border: `1px solid ${T.rule}`,
      padding: 0,
      fontFamily: 'inherit',
      color: isFav ? T.accent : T.muted,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: isFav ? Ic.star : Ic.starOutline,
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(DrinksContext.Provider, {
    value: drinksValue
  }, /*#__PURE__*/React.createElement(SettingsContext.Provider, {
    value: settingsValue
  }, /*#__PURE__*/React.createElement(RatingsContext.Provider, {
    value: friendRatings
  }, /*#__PURE__*/React.createElement(BacProvider, null, /*#__PURE__*/React.createElement(StatsTab, {
    storageScope: 'friend:' + friend.userId,
    hideMap: true,
    hidePrice: true,
    hideBac: !friend.shareBac,
    bacAvailable: !!friend.shareBac
  })))))));
}

// Pastille verte de l'ami favori, montée dans le header SOUS ma pastille BAC,
// alignée à droite (en flux). `tone="good"` (vert). Renvoie `null` sans favori
// (ou favori parti du groupe) → le header retrouve exactement sa hauteur
// d'origine, sans réserver d'espace. Le hook `useFavoriteFriend` + l'abonnement
// share restent confinés ICI : un `shareBus.bump` (pull) ne re-rend que cette
// pastille, pas tout le header.
function FavoriteFriendPill() {
  const fav = useFavoriteFriend();
  const bacMap = useFriendsBac(fav ? [fav] : []);
  if (!fav) return null;
  const bac = bacMap[fav.userId];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(BacPill, {
    bac: bac == null ? null : bac,
    tone: "good",
    ariaLabel: `Alcoolémie de ${fav.displayName || 'mon favori'}`
  }));
}
Object.assign(window, {
  FriendsTab,
  FriendStatsView,
  FriendRow,
  GroupFooter,
  FavoriteFriendPill
});