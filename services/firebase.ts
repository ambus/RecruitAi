import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

/**
 * Konfiguracja Firebase.
 * Wartości są pobierane ze zmiennych środowiskowych.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.error('BŁĄD: Brak VITE_FIREBASE_API_KEY. Skonfiguruj zmienne środowiskowe, aby logowanie działało.');
}
if (!firebaseConfig.projectId) {
  console.error('BŁĄD: Brak VITE_FIREBASE_PROJECT_ID. Skonfiguruj zmienne środowiskowe, aby baza danych działało.');
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {}, 'recruit-ai-db');

export const googleProvider = new GoogleAuthProvider();

export {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onAuthStateChanged,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  signInWithPopup,
  signOut,
  updateDoc,
};
export type { User };
