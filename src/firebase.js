import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// False when the VITE_FIREBASE_* env vars weren't set at build time (e.g. a
// new Vercel project). main.jsx then shows a setup message instead of
// crashing into a white screen.
export const firebaseConfigured = !!firebaseConfig.apiKey;

const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app && getAuth(app);
if (auth) auth.languageCode = 'he'; // Google popup + reset emails in Hebrew
// On-device cache: the app keeps working with a weak gym signal, and a
// finished workout saved offline syncs once the phone is back online.
export const db = app && initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const googleProvider = new GoogleAuthProvider();
