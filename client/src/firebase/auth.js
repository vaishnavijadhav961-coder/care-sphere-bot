import { auth } from './config';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

export const loginUser = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
};

export const registerUser = async (email, password) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
};

export const logoutUser = () => signOut(auth);
