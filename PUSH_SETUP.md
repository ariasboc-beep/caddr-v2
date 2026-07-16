# Activer les notifications push (app fermée) — Caddr.

Le code client est déjà en place :
- `public/sw.js` gère la réception des push et le clic sur la notification.
- `src/push.ts` abonne l'appareil (bouton « Activer push » dans Réglages) et stocke
  la subscription dans Firestore : `users/{uid}/pushSubscriptions/web`.

Il reste **3 étapes de configuration** que vous seul pouvez faire, car elles
touchent vos clés et votre infrastructure.

## 1. Générer les clés VAPID

En local, une seule fois :
```bash
npx web-push generate-vapid-keys
```
Vous obtenez une clé **publique** et une clé **privée**.

Ajoutez-les dans Netlify → Project configuration → Environment variables :
- `VITE_VAPID_PUBLIC_KEY` = la clé publique (le préfixe VITE_ est voulu : elle est
  publique et doit être dans le bundle client)
- `VAPID_PRIVATE_KEY` = la clé privée (SANS préfixe VITE_ : elle reste côté serveur)
- `VAPID_SUBJECT` = `mailto:votre-email@exemple.com`

Redéployez pour que le bouton « Activer push » fonctionne.

## 2. Règles Firestore

Autorisez chaque utilisateur à écrire sa propre subscription :
```
match /users/{userId}/pushSubscriptions/{doc} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

## 3. La fonction serveur programmée qui envoie les rappels

Cette fonction lit les subscriptions + les heures de rappel dans Firestore et
envoie les push. Elle a besoin d'un **compte de service Firebase** pour lire
Firestore (Console Firebase → Paramètres → Comptes de service → Générer une clé).
Mettez le JSON dans la variable Netlify `FIREBASE_SERVICE_ACCOUNT`.

Installez les dépendances serveur :
```bash
npm i web-push firebase-admin
```

Créez `netlify/functions/send-reminders.mts` :
```ts
import webpush from 'web-push';
import admin from 'firebase-admin';

export const config = { schedule: '* * * * *' }; // chaque minute

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)),
  });
}
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VITE_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export default async () => {
  const db = admin.firestore();
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5); // "HH:mm"

  const users = await db.collection('users').get();
  for (const u of users.docs) {
    const data = u.data();
    // Récupère les tâches/objectifs dont l'heure de rappel == maintenant.
    const due = collectDueReminders(data, hhmm); // à implémenter selon votre schéma
    if (due.length === 0) continue;

    const subSnap = await db.doc(`users/${u.id}/pushSubscriptions/web`).get();
    const sub = subSnap.data()?.subscription;
    if (!sub) continue;

    for (const item of due) {
      await webpush.sendNotification(
        sub,
        JSON.stringify({ title: 'Caddr.', body: item.title, url: '/' })
      ).catch(() => {});
    }
  }
  return new Response('ok');
};
```

`collectDueReminders` parcourt les blocs/tâches de l'utilisateur et retourne ceux
dont `startTime` (ou `reminderTime`) vaut l'heure courante. Adaptez-le à votre
structure de données (les tâches ont un champ `startTime` au format "HH:mm").

## Note importante
Sur iOS, les push web ne fonctionnent que si l'app a été **installée sur l'écran
d'accueil** (ce que la PWA permet déjà). Sur Android et desktop, aucune
installation n'est requise.
