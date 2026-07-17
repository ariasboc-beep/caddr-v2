# Activer les notifications push (app fermée) — Caddr.

Tout le **code est en place** :
- `public/sw.js` : réception des push + clic sur la notification.
- `src/push.ts` + bouton « Activer push » (Réglages) : abonne l'appareil et stocke
  la subscription dans Firestore (`users/{uid}/pushSubscriptions/web`).
- `netlify/functions/send-reminders.mts` : **fonction programmée** (chaque minute)
  qui lit les tâches dues à l'heure courante et envoie les notifications. ✅ déjà écrite.

Il ne reste que **3 réglages de configuration** (clés + variables), que vous seul
pouvez faire.

## 1. Générer les clés VAPID (une fois)
```bash
npx web-push generate-vapid-keys
```
Vous obtenez une clé **publique** et une clé **privée**.

## 2. Récupérer un compte de service Firebase
Console Firebase → Paramètres du projet → Comptes de service → « Générer une nouvelle
clé privée ». Un fichier JSON est téléchargé. Copiez tout son contenu (sur une seule
ligne).

## 3. Variables d'environnement Netlify
Project configuration → Environment variables :
- `VITE_VAPID_PUBLIC_KEY` = la clé publique (préfixe VITE_ voulu : elle est publique)
- `VAPID_PRIVATE_KEY` = la clé privée (SANS VITE_)
- `VAPID_SUBJECT` = `mailto:votre-email@exemple.com`
- `FIREBASE_SERVICE_ACCOUNT` = le JSON du compte de service (une ligne) — marquez-la
  comme « secret ».

Redéployez. Le bouton « Activer push » fonctionnera, et la fonction programmée
enverra les rappels.

## Vérifier
- Réglages → « Activer push » → autorisez les notifications. Un doc apparaît dans
  Firestore sous `users/{votre-uid}/pushSubscriptions/web`.
- Créez une tâche horodatée à l'heure suivante (ex. dans 2 min) et attendez : la
  notification doit arriver même app fermée.
- Les logs de la fonction (Netlify → Functions → send-reminders) indiquent le nombre
  d'envois.

## Notes
- **iOS** : les push web ne marchent que si l'app est **installée sur l'écran
  d'accueil** (la PWA le permet déjà). Android/desktop : aucune installation requise.
- La fonction scanne tous les utilisateurs chaque minute : parfait au début. À grande
  échelle, on optimisera (index des heures de rappel) pour réduire les lectures Firestore.
- Une règle Firestore doit autoriser la sous-collection `pushSubscriptions` (déjà
  couverte par la règle récursive `match /{document=**}` que vous avez publiée).
