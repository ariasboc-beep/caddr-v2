# Sécurité de Caddr. — état & actions

## ✅ Ce qui a été fait dans le code (déjà appliqué)

1. **Dépendances : 0 vulnérabilité.** `npm audit` remontait 13 failles (1 critique,
   2 élevées) via d'anciennes versions de Firebase et jsPDF. Mises à jour :
   - firebase 10 → 12
   - jspdf 2 → 4, jspdf-autotable 3 → 5
   Résultat : `found 0 vulnerabilities`.

2. **En-têtes de sécurité HTTP** (dans `netlify.toml`) :
   - `Content-Security-Policy` (compatible Firebase/Google) — limite d'où le code
     et les données peuvent venir, principale défense anti-XSS.
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

Console Firebase → Firestore Database → Règles. Utilisez :
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```
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
