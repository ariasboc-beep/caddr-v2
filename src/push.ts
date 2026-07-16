// Abonnement Web Push (VAPID). Stocke la subscription dans Firestore pour que
// la fonction serveur programmée puisse envoyer les rappels, app fermée.
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushResult = { ok: boolean; message: string };

export async function enablePush(userId: string): Promise<PushResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, message: "Votre navigateur ne supporte pas les notifications push." };
  }
  if (!VAPID_PUBLIC) {
    return { ok: false, message: "Push non configuré : ajoutez la clé VITE_VAPID_PUBLIC_KEY (voir PUSH_SETUP.md)." };
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, message: "Permission refusée." };
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
    // Stocke la subscription sous l'utilisateur (la fonction serveur la lira)
    await setDoc(doc(db, 'users', userId, 'pushSubscriptions', 'web'), {
      subscription: JSON.parse(JSON.stringify(sub)),
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, message: "Notifications push activées." };
  } catch (e) {
    console.error('Push subscribe failed:', e);
    return { ok: false, message: "Échec de l'abonnement push." };
  }
}
