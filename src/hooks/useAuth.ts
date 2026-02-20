import { useEffect, useState } from 'react';
import {
  auth,
  db,
  doc,
  getDoc,
  googleProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from '../../services/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            setIsAuthorized(true);
          } else {
            console.warn(`User ${currentUser.uid} not found in 'users' collection.`);
            setIsAuthorized(false);
          }
        } catch (error) {
          console.error('Błąd autoryzacji Firestore:', error);
          setIsAuthorized(false);
        }
      } else {
        setUser(null);
        setIsAuthorized(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
      setAuthLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  return { user, isAuthorized, authLoading, handleLogin, handleLogout };
}
