# Cahier des Charges — Sync Cloud AlcoNote

## 📋 Vue d'ensemble

**Objectif** : Permettre la synchronisation des données AlcoNote entre appareils via un cloud storage gratuit, sans login utilisateur ni backend complexe.

**Approche** : Export automatique du JSON IndexedDB vers Firebase Storage, import périodique sur les autres appareils, tous les calculs restent client-side.

**Stack** :
- **Cloud Storage** : Firebase Storage (Google) — free tier 5GB
- **Authentification** : Token opaque par utilisateur (UUID localStorage)
- **Synchronisation** : Fetch HTTP simple, pas de libraire complexe
- **Intégration** : ~300 lignes de code nouveau

---

## 🎯 Fonctionnalités

### Utilisateur crée/modifie une boisson
- ✅ Calculs/mise à jour IndexedDB comme avant
- ✅ Export automatique JSON complet → Firebase Storage
- ✅ Toast "Synchronisé" ou erreur silencieuse si offline
- ✅ Aucune interruption UX

### Utilisateur accède depuis un autre appareil
- ✅ Au lancement : vérifie si données cloud plus récentes
- ✅ Import automatique dans IndexedDB local
- ✅ Stats/charts rechargent avec données importées
- ✅ Aucune action requise de l'utilisateur

### Utilisateur offline
- ✅ App fonctionne 100% normalement (IndexedDB local)
- ✅ Sync reprend quand connexion revenue

### Conflits (2 appareils éditent simultanément)
- ✅ **Règle** : "Last Write Wins" (timestamp le plus récent)
- ✅ Pas de merge sophistiqué (KISS)

---

## 🏗️ Architecture

### Fichiers existants modifiés

**`proto/shared.jsx`**
- Ajouter constante `FIREBASE_CONFIG` (clés publiques Firebase)
- Ajouter UUID utilisateur initial si absent

**`proto/data.jsx`**
- À la fin de chaque mutation (addDrink, updateDrink, deleteDrink, addCategory, etc.)
- Appeler `CloudSync.scheduleUpload()` (ne pas bloquer le UI)
- Au chargement du composant : appeler `CloudSync.downloadIfNewer()`

**`proto/app.jsx`**
- Setup periodic sync (5 min) via `useEffect`
- Afficher badge "Sync en cours..." ou spinner discret (optionnel)

### Fichiers nouveaux

**`proto/cloud-sync.jsx`** (150-200 lignes)
```
Gère :
- Génération/stockage UUID utilisateur
- Upload JSON vers Firebase Storage
- Download du cloud et import dans IndexedDB
- Debounce/throttle des uploads
- Gestion des erreurs silencieuse
```

**`firebase.json`** (config publique pour Firebase)
```json
{
  "projectId": "alconote-sync",
  "apiKey": "AIza...",
  "storageBucket": "alconote-sync.appspot.com"
}
```

### Workflow de synchronisation

```
┌─────────────────────────────────────────────────────────────┐
│ User ajoute une boisson                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
            ┌────────────────┐
            │ dataBus.bump() │
            └────────┬───────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
    UI updates         CloudSync.scheduleUpload()
   (réactive)          (non-bloquant, debounce)
                               │
                               ▼ (après 2s d'inactivité)
                    ┌──────────────────────┐
                    │ Export IndexedDB     │
                    │ → JSON complet       │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Upload Firebase      │
                    │ /users/{userId}.json │
                    └──────────┬───────────┘
                               │
                        ┌──────▼──────┐
                        │ OK          │ Erreur
                        │ (silencieux)│ (log console)
                        └─────────────┴─────────┘

┌──────────────────────────────────────────────────────┐
│ Chaque 5 min OU app reprend de pause               │
└────────────────────┬─────────────────────────────────┘
                     │
        CloudSync.downloadIfNewer()
                     │
        ┌────────────▼────────────┐
        │ Fetch Firebase          │
        │ /users/{userId}.json    │
        └────────────┬────────────┘
                     │
        ┌────────────▼───────────────┐
        │ Compare timestamps:        │
        │ cloud > local?             │
        └────────────┬───────────────┘
                     │
            ┌────────┴────────┐
            │                 │
         OUI                  NON
            │                 │
            ▼                 ▼
      Import JSON       (skip silencieusement)
      → IndexedDB
            │
            ▼
      dataBus.bump()
            │
            ▼
      UI rechargée
   (charts mise à jour)
```

---

## 📦 Format de données

**Fichier stock sur Firebase** : `/users/{userId}.json`

```json
{
  "version": 1,
  "timestamp": 1686489234567,
  "userId": "uuid-xxx-yyy",
  "data": {
    "drinks": [
      {
        "id": "d1",
        "name": "Bière Kronenbourg",
        "category": "Bière",
        "quantity": 50,
        "unit": "cL",
        "alcoholContent": 4.2,
        "date": "2024-06-05",
        "time": "20:30",
        "location": null,
        "barcode": null
      }
    ],
    "categories": [
      {
        "id": "cat1",
        "name": "Bière",
        "drinkCount": 42
      }
    ],
    "settings": [
      { "key": "theme", "value": "dark" },
      { "key": "user.weight", "value": 75 },
      { "key": "user.gender", "value": "M" }
    ],
    "drinkRatings": [
      { "drinkName": "Bière Kronenbourg", "rating": 4 }
    ]
  }
}
```

**Stockage** :
- Cloud file max : ~2-5MB (données + historique 5 ans) → Free tier Firebase **5GB** suffisant pour 1000+ utilisateurs
- Update freq : Max 1 requête / 2 secondes (debounce)
- Download freq : 1 requête / 5 min (ou manual via bouton)

---

## 🔐 Sécurité & Confidentialité

### Auth utilisateur
- **UUID généré** : `localStorage.getItem('alconote.userId')` ou généré via crypto
- **Pas de password** : chaque appareil = UUID indépendant
- **Aucune authentification Firebase** : juste accès public au fichier JSON personnel
  
### Règles Firebase Storage
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}.json {
      // Lecture : requête doit inclure ?secret={UUID}
      allow read: if request.query.secret == userId;
      // Écriture : idem
      allow write: if request.query.secret == userId;
    }
  }
}
```

### Chiffrement optionnel
- ⏭️ **Phase 1** : Pas de chiffrement (données accessibles si quelqu'un connaît l'UUID)
- 🔄 **Phase 2** (optionnel) : Chiffrer le JSON avant upload via `TweetNaCl.js` ou `libsodium.js`

### RGPD
- ✅ Droit à l'effacement : supprimer le fichier Firebase + localStorage
- ✅ Droit à la portabilité : exporter JSON depuis Paramètres (existe déjà)
- ✅ No tracking, no analytics

---

## 🛠️ Implémentation détaillée

### Phase 1 : Setup Firebase (1 jour)

1. **Créer projet Firebase** (gratuit)
   - Aller sur console.firebase.google.com
   - Créer projet "alconote-sync"
   - Activer **Cloud Storage**
   - Récupérer config (apiKey, storageBucket, projectId, etc.)

2. **Ajouter config à `proto/shared.jsx`**
   ```javascript
   const FIREBASE_CONFIG = {
     apiKey: "AIza...",
     projectId: "alconote-sync",
     storageBucket: "alconote-sync.appspot.com"
   };
   ```

3. **Configurer règles Firebase Storage** (public avec secret URL)

### Phase 2 : Implémenter CloudSync (2 jours)

**Fichier : `proto/cloud-sync.jsx`**

```javascript
// Singleton CloudSync
const CloudSync = (() => {
  let userId = null;
  let lastUpload = 0;
  let lastDownload = 0;
  let uploadTimeout = null;

  // Initialisation
  const init = () => {
    userId = localStorage.getItem('alconote.userId');
    if (!userId) {
      userId = generateUUID(); // crypto.getRandomValues + hex
      localStorage.setItem('alconote.userId', userId);
    }
  };

  // Export IndexedDB → JSON
  const exportData = async () => {
    const drinks = await db.drinks.toArray();
    const categories = await db.categories.toArray();
    const settings = await db.settings.toArray();
    const drinkRatings = await db.drinkRatings.toArray();
    
    return {
      version: 1,
      timestamp: Date.now(),
      userId: userId,
      data: { drinks, categories, settings, drinkRatings }
    };
  };

  // Upload vers Firebase (debounce 2s)
  const scheduleUpload = () => {
    clearTimeout(uploadTimeout);
    uploadTimeout = setTimeout(async () => {
      try {
        const payload = await exportData();
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        
        const formData = new FormData();
        formData.append('file', blob);
        
        const url = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_CONFIG.storageBucket}/o/users/${userId}.json?uploadType=media&secret=${userId}`;
        
        await fetch(url, {
          method: 'POST',
          body: blob,
          headers: { 'Content-Type': 'application/json' }
        });
        
        lastUpload = Date.now();
        console.debug('[CloudSync] Upload OK');
      } catch (e) {
        console.warn('[CloudSync] Upload failed:', e);
        // Silencieux, retry au prochain changement
      }
    }, 2000);
  };

  // Download depuis Firebase + import
  const downloadIfNewer = async () => {
    try {
      const url = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_CONFIG.storageBucket}/o/users/${userId}.json?alt=media&secret=${userId}`;
      
      const response = await fetch(url);
      if (!response.ok) return; // File not found ou erreur, skip
      
      const cloud = await response.json();
      
      // Last Write Wins
      const localTimestamp = localStorage.getItem('alconote.lastSync') || 0;
      if (cloud.timestamp <= localTimestamp) return; // Cloud pas plus récent
      
      // Import dans IndexedDB
      await db.drinks.bulkPut(cloud.data.drinks);
      await db.categories.bulkPut(cloud.data.categories);
      await db.settings.bulkPut(cloud.data.settings);
      await db.drinkRatings.bulkPut(cloud.data.drinkRatings);
      
      localStorage.setItem('alconote.lastSync', cloud.timestamp);
      lastDownload = Date.now();
      
      console.debug('[CloudSync] Download & import OK');
      return true; // Signaler que données ont changé
    } catch (e) {
      console.warn('[CloudSync] Download failed:', e);
      return false;
    }
  };

  return {
    init,
    scheduleUpload,
    downloadIfNewer,
    getUserId: () => userId,
    getStatus: () => ({ lastUpload, lastDownload })
  };
})();

Object.assign(window, { CloudSync });
```

### Phase 3 : Intégration (1 jour)

**1. Dans `proto/shared.jsx`** (tout début)
```javascript
CloudSync.init(); // Générer UUID si absent
```

**2. Dans `proto/data.jsx`** (chaque mutation)
```javascript
const addDrink = async (drink) => {
  // ... logique existante
  dataBus.bump();
  CloudSync.scheduleUpload(); // Non-bloquant
};

const updateDrink = async (id, updates) => {
  // ... logique existante
  dataBus.bump();
  CloudSync.scheduleUpload();
};

// etc. pour delete, addCategory, etc.
```

**3. Dans `proto/app.jsx`** (setup periodic + startup)
```javascript
React.useEffect(() => {
  // Sync au startup
  CloudSync.downloadIfNewer().then(hasChanged => {
    if (hasChanged) dataBus.bump(); // Rerender si données importées
  });
  
  // Sync périodique toutes les 5 min
  const syncInterval = setInterval(() => {
    CloudSync.downloadIfNewer().then(hasChanged => {
      if (hasChanged) dataBus.bump();
    });
  }, 5 * 60 * 1000);
  
  return () => clearInterval(syncInterval);
}, []);
```

**4. Dans `proto/modals.jsx`** (écran Paramètres)
```javascript
<button onClick={() => CloudSync.downloadIfNewer()}>
  Synchroniser maintenant
</button>

<div style={{ fontSize: 11, opacity: 0.6 }}>
  ID utilisateur: {CloudSync.getUserId()}
  Sync: {new Date(CloudSync.getStatus().lastUpload).toLocaleString()}
</div>
```

### Phase 4 : Build & Deploy (0.5 jour)

```bash
npm run build   # Compile proto/*.jsx
# Push sur git + Netlify redeploy automatique
```

---

## ✅ Checklist d'implémentation

- [ ] Créer projet Firebase (console.firebase.google.com)
- [ ] Configurer Cloud Storage + règles d'accès
- [ ] Copier config Firebase → `proto/shared.jsx`
- [ ] Écrire `proto/cloud-sync.jsx` (copier code ci-dessus)
- [ ] Intégrer dans `data.jsx` (scheduleUpload après chaque mutation)
- [ ] Intégrer dans `app.jsx` (periodic sync)
- [ ] Ajouter bouton "Sync maintenant" dans Paramètres
- [ ] Tester sur 2 appareils (ajouter boisson sur A, vérifier sur B)
- [ ] Test offline : fonctionnaire normalement
- [ ] Test avec délai réseau : vérifier debounce 2s
- [ ] Build & deploy

---

## 🧪 Tests manuels

1. **Sync basique**
   - Appareil A : Ajouter une bière
   - Attendre 2s (debounce)
   - Appareil B : Refresh / attendre 5 min
   - ✅ Bière apparaît

2. **Offline**
   - Appareil A : Mode avion
   - Ajouter 3 boissons → functionne normalement
   - Mode avion OFF
   - Attendre 2s → upload
   - Appareil B : Voir les 3 boissons

3. **Conflits**
   - Appareil A & B : Simultanément ajouter 2 boissons différentes
   - Un device aura timestamp plus récent (LWW)
   - ✅ Boisson "gagnante" conservée, l'autre... (clarifier stratégie)

4. **Multi-appareil**
   - Desktop, téléphone, tablette
   - Tous synchronisés OK

5. **Large dataset**
   - Importer ~1000 boissons (5 ans)
   - Upload < 2s, download < 1s
   - ✅ Pas de lag UI

---

## 📊 Monitoring & Logs

**Console browser** (DevTools) :
- `[CloudSync] Upload OK`
- `[CloudSync] Download & import OK`
- `[CloudSync] Upload failed: ...`

**Optional** : ajouter Sentry pour erreurs production

---

## 🚀 Alternatives & évolutions futures

### Si Firebase Storage saturé
- Migrer vers **Supabase** (PostgreSQL + storage, gratuit)
- Ou **AWS S3** (free tier 1GB/mois)

### Si besoin de chiffrement
- Utiliser **libsodium.js** (Argon2 + ChaCha20-Poly1305)
- Stocker clé maître dans localStorage (dérivée du mot de passe perso si souhaité)

### Si besoin de gestion multi-utilisateurs (groupe/famille)
- Ajouter système de sharing de lien (voir specs précédentes)
- Pas d'implémentation actuellement

---

## 📝 Notes

- **Délai de sync** : upload debounce 2s, download 5 min = délai quasi-imperceptible
- **Bande passante** : JSON ~2MB pour 5 ans = trivial
- **Coûts** : Firebase free tier 5GB pour 1000+ utilisateurs
- **Offline-first** : App fonctionne 100% sans connexion
- **Code existant** : Aucun changement aux calculs/stats, juste ajout de couche sync

---

**Durée totale implémentation** : 4-5 jours avec tests
