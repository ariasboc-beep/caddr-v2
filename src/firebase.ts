// Firebase Configuration for Caddr
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAiwb2sYqJm2jVWWcG7ZvZy7wfAGZQXKpA",
  // En production, la connexion passe par le domaine de l'app (proxy /__/auth vers Firebase,
  // voir netlify.toml) : indispensable pour la connexion par redirection sur mobile.
  authDomain: typeof window !== 'undefined' && window.location.hostname === 'caddr-v2.netlify.app'
    ? 'caddr-v2.netlify.app'
    : "caddr-b0a5f.firebaseapp.com",
  projectId: "caddr-b0a5f",
  storageBucket: "caddr-b0a5f.firebasestorage.app",
  messagingSenderId: "104062519224",
  appId: "1:104062519224:web:5aacd88a50bbabe6c1314d",
  measurementId: "G-LQFR6TE884"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Firestore and get a reference to the service
// Détection automatique du « long polling » : certains réseaux mobiles bloquent le
// canal de streaming de Firestore, ce qui laissait l'app charger indéfiniment.
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

export default app;
