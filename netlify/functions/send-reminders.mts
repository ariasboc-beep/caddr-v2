import webpush from "web-push";
import admin from "firebase-admin";

// Fonction programmée : s'exécute chaque minute et envoie une notification push
// pour chaque tâche horodatée dont l'heure de début correspond à l'instant présent.
//
// Variables d'environnement Netlify requises (voir PUSH_SETUP.md) :
//   FIREBASE_SERVICE_ACCOUNT  = le JSON du compte de service Firebase (une ligne)
//   VITE_VAPID_PUBLIC_KEY     = clé VAPID publique
//   VAPID_PRIVATE_KEY         = clé VAPID privée
//   VAPID_SUBJECT             = "mailto:votre-email@exemple.com"
export const config = { schedule: "* * * * *" };

const REPEATING = new Set(["daily", "weekdays", "weekends", "week", "period"]);

function isDueToday(recurrence: string, specificDate: string | undefined, todayKey: string, dow: number): boolean {
  if (recurrence === "specific" || recurrence === "once") return specificDate === todayKey;
  if (recurrence === "daily" || recurrence === "week" || recurrence === "period") return true;
  if (recurrence === "weekdays") return dow >= 1 && dow <= 5;
  if (recurrence === "weekends") return dow === 0 || dow === 6;
  return REPEATING.has(recurrence);
}

let initialized = false;
function initAdmin(): boolean {
  if (initialized) return true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return false;
  try {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
    }
    initialized = true;
    return true;
  } catch (e) {
    console.error("Firebase admin init failed:", e);
    return false;
  }
}

export default async () => {
  // Vérifie la configuration ; sinon, ne fait rien (pas d'erreur bloquante).
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VITE_VAPID_PUBLIC_KEY || !process.env.VAPID_SUBJECT) {
    return new Response("Push non configuré (VAPID manquant).");
  }
  if (!initAdmin()) {
    return new Response("Push non configuré (FIREBASE_SERVICE_ACCOUNT manquant).");
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VITE_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const db = admin.firestore();
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dow = now.getDay();

  let sent = 0;
  try {
    const users = await db.collection("users").get();

    for (const userDoc of users.docs) {
      const data = userDoc.data() as any;
      const blocks: any[] = data?.blocks || [];

      // Collecte les tâches dues maintenant
      const due: string[] = [];
      for (const b of blocks) {
        if (!isDueToday(b.recurrence, b.specificDate, todayKey, dow)) continue;
        for (const t of b.tasks || []) {
          if (t.startTime === hhmm && isDueToday(t.recurrence, t.specificDate, todayKey, dow)) {
            const doneToday = (t.completedDates || []).includes(todayKey);
            if (!doneToday) due.push(t.title);
          }
        }
      }
      if (due.length === 0) continue;

      // Récupère la subscription push de l'utilisateur
      const subSnap = await db.doc(`users/${userDoc.id}/pushSubscriptions/web`).get();
      const sub = subSnap.exists ? (subSnap.data() as any)?.subscription : null;
      if (!sub) continue;

      for (const title of due) {
        try {
          await webpush.sendNotification(
            sub,
            JSON.stringify({ title: "Caddr.", body: `C'est l'heure : ${title}`, url: "/?tab=routine" })
          );
          sent++;
        } catch (err: any) {
          // Subscription expirée/invalide → on la supprime
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await db.doc(`users/${userDoc.id}/pushSubscriptions/web`).delete().catch(() => {});
          }
        }
      }
    }
  } catch (e) {
    console.error("send-reminders error:", e);
    return new Response("error", { status: 500 });
  }

  return new Response(`ok (${sent} sent)`);
};
