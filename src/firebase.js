import { initializeApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence,
  browserPopupRedirectResolver, GoogleAuthProvider,
} from 'firebase/auth';
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

// Someone was signed in on this device when the app last ran (App.jsx keeps
// it up to date).
const SIGNED_IN_KEY = 'gym_signed_in_v1';

export function wasSignedIn() {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberSignedIn(signedIn) {
  try {
    if (signedIn) localStorage.setItem(SIGNED_IN_KEY, '1');
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    // No storage (private mode): the helper below is then always loaded.
  }
}

// The Google sign-in helper (an iframe from Google's servers) is needed only
// on the login screen. On phones and Safari, getAuth() loads it on every open
// and waits for it before restoring the saved sign-in, which costs seconds on
// a weak signal. So it's loaded up front only when nobody was signed in here;
// if the login screen turns up anyway, App.jsx reloads once to get it, since
// the Google popup needs it ready when the button is tapped.
export const signInHelperLoaded = !wasSignedIn();

const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;
// Same as getAuth(), except for when the sign-in helper loads.
export const auth = app && initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
  popupRedirectResolver: signInHelperLoaded ? browserPopupRedirectResolver : undefined,
});
if (auth) auth.languageCode = 'he'; // Google popup + reset emails in Hebrew
// On-device cache: the app keeps working with a weak gym signal, and a
// finished workout saved offline syncs once the phone is back online.
export const db = app && initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const googleProvider = new GoogleAuthProvider();
