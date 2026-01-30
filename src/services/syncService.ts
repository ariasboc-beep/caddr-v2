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
