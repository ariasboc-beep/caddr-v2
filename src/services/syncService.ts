import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { AppData } from '../types';

// App installée sur l'écran d'accueil : la popup ne peut pas renvoyer le résultat à
// l'app → connexion par redirection. Dans un onglet de navigateur (ordinateur ou
// téléphone), la popup fonctionne et évite les soucis de redirection.
export const isStandalone = (): boolean =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);
export const isIOS = (): boolean =>
  typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const prefersRedirect = (): boolean => isStandalone();

const PENDING_KEY = 'caddr_auth_pending';
const startRedirect = async () => {
  try { localStorage.setItem(PENDING_KEY, String(Date.now())); } catch {}
  await signInWithRedirect(auth, googleProvider); // la page part chez Google puis revient
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<User | null> => {
  if (prefersRedirect()) { await startRedirect(); return null; }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
      await startRedirect();
      return null;
    }
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

// Au retour de Google : récupère le résultat, l'erreur, ou signale une connexion
// lancée qui n'est jamais revenue dans l'app (cas typique : app installée sur iPhone).
export const completeRedirectSignIn = async (): Promise<{ user: User | null; error?: string; lost?: boolean }> => {
  let pending = false;
  try { const t = Number(localStorage.getItem(PENDING_KEY) || 0); pending = !!t && Date.now() - t < 10 * 60 * 1000; localStorage.removeItem(PENDING_KEY); } catch {}
  try {
    const res = await getRedirectResult(auth);
    const user = res?.user || auth.currentUser;
    return { user: user || null, lost: pending && !user };
  } catch (error: any) {
    console.error('Redirect sign-in error:', error);
    return { user: null, error: error?.code || 'auth/unknown' };
  }
};

// --- Comptes e-mail / mot de passe ---
export const signUpWithEmail = async (email: string, password: string, name?: string): Promise<User> => {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name?.trim()) { try { await updateProfile(cred.user, { displayName: name.trim() }); } catch {} }
  return cred.user;
};
export const signInWithEmail = async (email: string, password: string): Promise<User> =>
  (await signInWithEmailAndPassword(auth, email.trim(), password)).user;
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email.trim());

// Messages d'erreur compréhensibles
export const authErrorMessage = (code?: string): string => ({
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/wrong-password': 'Mot de passe incorrect.',
  'auth/user-not-found': 'Aucun compte avec cet e-mail. Crée un compte.',
  'auth/email-already-in-use': 'Un compte existe déjà avec cet e-mail. Connecte-toi.',
  'auth/weak-password': 'Mot de passe trop court (6 caractères minimum).',
  'auth/invalid-email': 'Adresse e-mail invalide.',
  'auth/missing-password': 'Saisis ton mot de passe.',
  'auth/too-many-requests': 'Trop de tentatives. Patiente quelques minutes.',
  'auth/network-request-failed': 'Pas de connexion internet. Réessaie.',
  'auth/operation-not-allowed': "La connexion par e-mail n'est pas encore activée dans Firebase (Authentication → Méthode de connexion → E-mail/Mot de passe).",
  'auth/unauthorized-domain': "Ce domaine n'est pas autorisé dans Firebase (Authentication → Paramètres → Domaines autorisés).",
  'auth/popup-closed-by-user': 'Connexion annulée.',
  'auth/cancelled-popup-request': 'Connexion annulée.',
} as Record<string, string>)[code || ''] || 'La connexion a échoué. Réessaie.';

// Sign out
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
  }
};

// Listen to auth state changes
export const onAuthChange = (callback: (user: User | null) => void): Unsubscribe => {
  return onAuthStateChanged(auth, callback);
};

// Save app data to Firestore
export const saveDataToCloud = async (userId: string, data: AppData): Promise<boolean> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    // Firestore refuse les champs « undefined » (ex. récurrence relancée) :
    // un aller-retour JSON les retire proprement.
    const clean = JSON.parse(JSON.stringify(data));
    await setDoc(userDocRef, {
      appData: clean,
      lastUpdated: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (error) {
    console.error("Error saving data to cloud:", error);
    return false;
  }
};

// Load app data from Firestore
// Renvoie null si l'utilisateur n'a encore rien dans le cloud.
// LÈVE une erreur si la lecture échoue ou dépasse le délai : l'app ne doit surtout
// pas croire à un nouvel utilisateur (elle écraserait les vraies données du cloud).
export const loadDataFromCloud = async (userId: string, timeoutMs = 15000): Promise<AppData | null> => {
  const userDocRef = doc(db, 'users', userId);
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('cloud-timeout')), timeoutMs));
  const docSnap = await Promise.race([getDoc(userDocRef), timeout]);
  if (docSnap.exists()) return (docSnap.data().appData as AppData) || null;
  return null;
};

// Listen to real-time data changes
export const subscribeToDataChanges = (
  userId: string, 
  callback: (data: AppData | null) => void
): Unsubscribe => {
  const userDocRef = doc(db, 'users', userId);
  
  return onSnapshot(userDocRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      callback(data.appData as AppData);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("Error listening to data changes:", error);
  });
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// ---------------------------------------------------------------------------
// Fusion locale ↔ cloud : évite le "dernier écrit gagne" destructeur.
// Stratégie : union des journées / inbox / templates / objectifs (par clé ou id,
// en gardant l'entrée la plus riche en cas de conflit), XP au maximum des deux.
// ---------------------------------------------------------------------------

const richness = (v: unknown): number => JSON.stringify(v ?? '').length;

// Habitudes : union par id ; pour une même habitude, les jours sont fusionnés
// (l'entrée locale l'emporte pour un même jour), les réglages locaux priment.
const mergeHabits = (local: NonNullable<AppData['habits']>, cloud: NonNullable<AppData['habits']>) => {
  const map = new Map(cloud.map(h => [h.id, h]));
  local.forEach(h => {
    const c = map.get(h.id);
    map.set(h.id, c ? { ...c, ...h, entries: { ...(c.entries || {}), ...(h.entries || {}) } } : h);
  });
  return Array.from(map.values());
};

// Journal : par jour, la version modifiée le plus récemment l'emporte
const mergeJournal = (a: NonNullable<AppData['journal']>, b: NonNullable<AppData['journal']>) => {
  const out = { ...b };
  Object.entries(a).forEach(([k, e]) => { if (!out[k] || (e.updatedAt || '') > (out[k].updatedAt || '')) out[k] = e; });
  return out;
};

export const mergeAppData = (local: AppData, cloud: AppData): AppData => {
  // Journées : union, conflit résolu au profit de l'entrée la plus riche
  const days: AppData['days'] = { ...cloud.days };
  Object.entries(local.days || {}).forEach(([key, localDay]) => {
    if (!days[key] || richness(localDay) > richness(days[key])) {
      days[key] = localDay;
    }
  });

  const mergeById = <T extends { id: string }>(a: T[] = [], b: T[] = []): T[] => {
    const map = new Map<string, T>();
    b.forEach((item) => map.set(item.id, item));
    a.forEach((item) => {
      const existing = map.get(item.id);
      if (!existing || richness(item) > richness(existing)) map.set(item.id, item);
    });
    return Array.from(map.values());
  };

  // Structure maîtresse (blocks) : on garde la plus riche des deux versions
  const blocks = richness(local.blocks) >= richness(cloud.blocks) ? local.blocks : cloud.blocks;

  const localXp = local.userProfile?.xp || 0;
  const cloudXp = cloud.userProfile?.xp || 0;
  const bestProfile = localXp >= cloudXp ? local.userProfile : cloud.userProfile;

  return {
    days,
    blocks,
    templates: mergeById(local.templates, cloud.templates),
    recurringGoals: mergeById(local.recurringGoals, cloud.recurringGoals),
    inboxTasks: mergeById(local.inboxTasks, cloud.inboxTasks),
    userProfile: bestProfile || { xp: 0, level: 1 },
    longTermGoals: mergeById(local.longTermGoals || [], cloud.longTermGoals || []),
    weeklyReviews: { ...(cloud.weeklyReviews || {}), ...(local.weeklyReviews || {}) },
    settings: local.settings || cloud.settings,
    focusSessions: mergeById(local.focusSessions || [], cloud.focusSessions || []),
    skips: mergeById(local.skips || [], cloud.skips || []),
    taskLog: (() => { const rank = (x?: string) => ({ pending: 1, accepted: 2, declined: 2, done: 3 } as Record<string, number>)[x || ''] || 0; const m = new Map((cloud.taskLog || []).map(e => [e.id, e])); (local.taskLog || []).forEach(e => { const c = m.get(e.id); if (!c || rank(e.status) > rank(c.status)) m.set(e.id, e); }); return Array.from(m.values()); })(),
    hardDays: Array.from(new Set([...(cloud.hardDays || []), ...(local.hardDays || [])])),
    streakJokers: Array.from(new Set([...(cloud.streakJokers || []), ...(local.streakJokers || [])])),
    identities: mergeById(local.identities || [], cloud.identities || []).map(i => { const c = (cloud.identities || []).find(x => x.id === i.id); const l = (local.identities || []).find(x => x.id === i.id); return (c?.deleted || l?.deleted) ? { ...i, deleted: true } : i; }),
    rewards: (() => { const m = new Map<string, NonNullable<AppData['rewards']>[number]>(); [...(cloud.rewards || []), ...(local.rewards || [])].forEach(r => { if (!m.has(r.date)) m.set(r.date, r); }); return Array.from(m.values()); })(),
    daySnapshots: (() => { const out: { [k: string]: string[] } = { ...(cloud.daySnapshots || {}) }; Object.entries(local.daySnapshots || {}).forEach(([k, ids]) => { out[k] = Array.from(new Set([...(out[k] || []), ...ids])); }); return out; })(),
    monthlyReviews: { ...(cloud.monthlyReviews || {}), ...(local.monthlyReviews || {}) },
    habits: mergeHabits(local.habits || [], cloud.habits || []),
    journal: mergeJournal(local.journal || {}, cloud.journal || {}),
    assistantMemory: mergeById(local.assistantMemory || [], cloud.assistantMemory || []),
    lifeReviews: (() => { const out = { ...(cloud.lifeReviews || {}) }; Object.entries(local.lifeReviews || {}).forEach(([k, r]) => { if (!out[k] || r.updatedAt > out[k].updatedAt) out[k] = r; }); return out; })(),
  };
};
