// Firebase Configuration for Caddr
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAiwb2sYqJm2jVWWcG7ZvZy7wfAGZQXKpA",
  authDomain: "caddr-b0a5f.firebaseapp.com",
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
export const db = getFirestore(app);

export default app;
