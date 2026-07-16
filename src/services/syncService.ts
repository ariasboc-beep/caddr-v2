import { 
  signInWithPopup, 
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

// Sign in with Google
export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    return null;
  }
};

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
    await setDoc(userDocRef, {
      appData: data,
      lastUpdated: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (error) {
    console.error("Error saving data to cloud:", error);
    return false;
  }
};

// Load app data from Firestore
export const loadDataFromCloud = async (userId: string): Promise<AppData | null> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.appData as AppData;
    }
    return null;
  } catch (error) {
    console.error("Error loading data from cloud:", error);
    return null;
  }
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
  };
};
