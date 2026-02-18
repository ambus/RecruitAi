
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Konfiguracja Firebase.
 * Wartości są pobierane ze zmiennych środowiskowych.
 * Upewnij się, że zdefiniowałeś FIREBASE_API_KEY oraz inne wymagane klucze w swoim środowisku.
 */
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.API_KEY, // Próba użycia FIREBASE_API_KEY lub domyślnego API_KEY
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Sprawdzenie krytycznych zmiennych w celu ułatwienia debugowania
if (!firebaseConfig.apiKey) {
  console.error("BŁĄD: Brak FIREBASE_API_KEY. Skonfiguruj zmienne środowiskowe, aby logowanie działało.");
}
if (!firebaseConfig.projectId) {
  console.error("BŁĄD: Brak FIREBASE_PROJECT_ID. Skonfiguruj zmienne środowiskowe, aby baza danych działała.");
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  getDocs 
};
export type { User };
