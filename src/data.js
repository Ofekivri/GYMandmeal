// Firestore access for the gym app. Everything lives under trainees/{uid}
// (see firestore.rules in the ACL-Tracker repo): the trainee owns it, the
// admin can read + write all of it.
import {
  collection, doc, getDoc, getDocs, onSnapshot, setDoc, addDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';

// Admin = the email stored in config/settings.adminEmail — the same source
// the security rules' isAdmin() checks, so the UI and the rules agree.
export async function fetchIsAdmin(user) {
  try {
    const snap = await getDoc(doc(db, 'config', 'settings'));
    return snap.exists() && snap.data().adminEmail === user.email;
  } catch (err) {
    console.warn('[admin] settings read failed', err);
    return false;
  }
}

// Creates/refreshes the trainee profile so the admin can find them.
export function ensureTrainee(user) {
  return setDoc(doc(db, 'trainees', user.uid), {
    name: user.displayName || user.email,
    email: user.email,
    lastSeenAt: Date.now(),
  }, { merge: true });
}

export async function fetchTrainees() {
  const snap = await getDocs(collection(db, 'trainees'));
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));
}

// Live list of a trainee's workouts, oldest first.
export function listenWorkouts(uid, onData, onError) {
  return onSnapshot(
    collection(db, 'trainees', uid, 'workouts'),
    snap => onData(
      snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
    ),
    onError,
  );
}

export async function saveWorkout(uid, workout, editorUid) {
  const { id, ...fields } = workout;
  const payload = { ...fields, updatedAt: Date.now(), updatedBy: editorUid };
  if (id) {
    await setDoc(doc(db, 'trainees', uid, 'workouts', id), payload, { merge: true });
    return id;
  }
  const ref = await addDoc(collection(db, 'trainees', uid, 'workouts'), { ...payload, createdAt: Date.now() });
  return ref.id;
}

export function deleteWorkout(uid, id) {
  return deleteDoc(doc(db, 'trainees', uid, 'workouts', id));
}
