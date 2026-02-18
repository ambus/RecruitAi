import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

/**
 * Konfiguracja Firebase.
 * Wartości są pobierane ze zmiennych środowiskowych.
 * Upewnij się, że zdefiniowałeś FIREBASE_API_KEY oraz inne wymagane klucze w swoim środowisku.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Sprawdzenie krytycznych zmiennych w celu ułatwienia debugowania
if (!firebaseConfig.apiKey) {
  console.error('BŁĄD: Brak FIREBASE_API_KEY. Skonfiguruj zmienne środowiskowe, aby logowanie działało.');
}
if (!firebaseConfig.projectId) {
  console.error('BŁĄD: Brak FIREBASE_PROJECT_ID. Skonfiguruj zmienne środowiskowe, aby baza danych działała.');
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export {
  addDoc,
  collection,
  deleteDoc,
  doc,
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
