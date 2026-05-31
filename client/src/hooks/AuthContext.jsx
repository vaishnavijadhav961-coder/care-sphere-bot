import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { db } from '../firebase/config';
import { ref, get } from 'firebase/database';
import { loginUser, registerUser, logoutUser } from '../firebase/auth';

const AuthContext = createContext(null);

async function buildUser(fbUser) {
  const adminRef = ref(db, `admins/${fbUser.uid}`);
  const snap = await get(adminRef);
  return {
    uid: fbUser.uid,
    email: fbUser.email,
    displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    isAdmin: snap.exists() && snap.val() === true,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(await buildUser(firebaseUser));
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        setUser(firebaseUser ? {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          isAdmin: false,
        } : null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email, password) => {
    const fbUser = await loginUser(email, password);
    const u = await buildUser(fbUser);
    setUser(u);
    return u.isAdmin;
  };

  const register = async (email, password) => {
    const fbUser = await registerUser(email, password);
    setUser({
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
      isAdmin: false,
    });
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
