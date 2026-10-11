# Sécurité de Caddr. — état & actions

## ✅ Ce qui a été fait dans le code (déjà appliqué)

1. **Dépendances : 0 vulnérabilité.** `npm audit` remontait 13 failles (1 critique,
   2 élevées) via d'anciennes versions de Firebase et jsPDF. Mises à jour :
   - firebase 10 → 12
   - jspdf 2 → 4, jspdf-autotable 3 → 5
   Résultat : `found 0 vulnerabilities`.

2. **En-têtes de sécurité HTTP** (dans `netlify.toml`) :
   - `Content-Security-Policy` : DÉSACTIVÉE car elle bloquait la connexion Google.
     Conservée en commentaire (mode report-only) dans netlify.toml pour un test
     futur sans risque. Les autres en-têtes restent actifs.
   - `Strict-Transport-Security` (HSTS) — force HTTPS.
   - `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'` — anti-clickjacking.
   - `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
     (caméra/micro/géoloc désactivés), `Cross-Origin-Opener-Policy`.

3. **Fonction serveur Gemini durcie** (`netlify/functions/gemini.mts`) :
   - Contrôle d'origine (bloque l'abus depuis d'autres sites).
   - Plafond de taille de requête (anti-abus / coût).
   - Méthode POST uniquement, validation de l'action.

4. **Vérifié absent :** aucun `eval`, aucun `dangerouslySetInnerHTML`, aucun secret
   en dur (hors la clé Firebase, publique par conception).

## ⚠️ Ce que VOUS devez faire (hors de ma portée)

### 1. Règles de sécurité Firestore — LE POINT LE PLUS IMPORTANT
La clé Firebase est publique par design : **votre sécurité repose entièrement sur
les règles Firestore.** Sans règles strictes, n'importe qui peut lire/écrire les
données de tous les utilisateurs.

Console Firebase → Firestore Database → Règles. Copiez-collez **tout le contenu du fichier
`firestore.rules`** (à la racine du projet), puis cliquez sur « Publier ».

Ces règles protègent vos données personnelles (`users/{uid}`) et autorisent la
fonction « Affecter à quelqu'un » (`assignments`) : seuls l'expéditeur et le
destinataire (adresse e-mail du compte) peuvent lire une tâche confiée ; seul le
destinataire peut l'accepter, la refuser ou la marquer comme faite.
**Sans cette mise à jour, l'envoi de tâches à un autre utilisateur échoue.**

Elles couvrent aussi le **binôme de discipline** : invitations (`buddyLinks`), résumé publié
(`publicStats`, lisible uniquement par les binômes dont l'e-mail figure dans `viewers` ;
il contient séries et taux, jamais les tâches) et encouragements (`cheers`).

Si vos règles contiennent `allow read, write: if true;` → faille critique à corriger
immédiatement.

### 2. Régénérer la clé Gemini
L'ancienne clé a été exposée publiquement (avant le correctif de la fonction serveur).
Considérez-la comme compromise : régénérez-en une dans Google AI Studio et mettez la
nouvelle valeur dans la variable Netlify `GEMINI_API_KEY` (sans préfixe VITE_).

### 3. Variables d'environnement Netlify
- `GEMINI_API_KEY` (sans VITE_) — la clé régénérée.
- `ALLOWED_ORIGINS` (optionnel) — vos domaines autorisés séparés par des virgules,
  ex. `https://caddr-v2.netlify.app`. Par défaut le domaine Netlify est déjà accepté.

### 4. Domaines autorisés Firebase Auth
Console Firebase → Authentication → Settings → Authorized domains : ne gardez que
`caddr-v2.netlify.app` (et `localhost` pour le dev). Supprimez tout domaine inconnu.

### 5. Après déploiement : vérifier
- La **connexion Google** fonctionne toujours (si la CSP la bloquait, retirez la
  ligne `Content-Security-Policy` de `netlify.toml` et signalez-le-moi).
- La **synchronisation** cloud fonctionne.

## Pistes d'amélioration futures (optionnelles)
- Limitation de débit (rate limiting) sur la fonction Gemini via un store
  (Firestore/Upstash) — protège mieux contre l'abus automatisé que le seul
  contrôle d'origine.
- Vérification du jeton Firebase (ID token) côté fonction pour réserver l'IA aux
  utilisateurs connectés (attention : bloquerait le mode invité).

## IA (Gemini) : accès réservé aux comptes connectés

- La clé `GEMINI_API_KEY` reste côté serveur (fonction `netlify/functions/gemini.mts`), elle n'est jamais envoyée au navigateur.
- La fonction exige un jeton de connexion Firebase valide (`Authorization: Bearer …`), vérifié avec les clés publiques de Google (`netlify/lib/auth.mts`). Sans compte connecté, l'IA répond « Connecte-toi à ton compte pour utiliser l'IA ».
- Quota quotidien par utilisateur stocké dans Netlify Blobs : 40 demandes par jour par défaut, modifiable avec la variable d'environnement `AI_DAILY_LIMIT`.
- Restent actifs : contrôle d'origine, limite par adresse IP, taille maximale de requête.

## Agendas externes (fonction `calendar`)

- Relais en lecture seule pour les adresses iCal (Google, Outlook, iCloud) : https uniquement, adresses internes refusées (y compris après résolution DNS et redirections), réponse obligatoirement au format iCalendar, 5 Mo et 10 s maximum, limite par adresse IP.
