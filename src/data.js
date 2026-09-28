// Firestore access for the gym app. Everything lives under trainees/{uid}
// (see firestore.rules in the ACL-Tracker repo): the trainee owns it, the
// admin can read + write all of it.
import {
  collection, doc, getDoc, getDocFromCache, getDocs, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, writeBatch,
  query, orderBy, limit, where,
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

// Live, so a trainee who signs up shows up for the admin without a reload.
export function listenTrainees(onData, onError) {
  return onSnapshot(
    collection(db, 'trainees'),
    snap => onData(
      snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he')),
    ),
    onError,
  );
}

// The signed-in user's own trainee doc, live. Carries a one-time message
// from the admin (afterWorkoutMessage) to show after their next finished
// workout; it's set per trainee from Claude Code, so only they see it.
export function listenTrainee(uid, onData, onError) {
  return onSnapshot(doc(db, 'trainees', uid), snap => onData(snap.exists() ? { uid, ...snap.data() } : null), onError);
}

export function markAfterWorkoutMessageShown(uid) {
  return updateDoc(doc(db, 'trainees', uid), { afterWorkoutMessageShownAt: Date.now() });
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

// ─── Plan: a workout placed on a date ───────────────────────────────────────
// { date: "YYYY-MM-DD", workoutId, workoutName, doneAt, logId, createdAt, createdBy }
// workoutName is copied in so the plan still reads right if the workout is
// later renamed or deleted. Done = doneAt is set (phase 3 also sets logId).

// Only plan items from sinceKey on, so every open doesn't re-read the whole
// history (finished workouts stay in logs).
export function listenPlan(uid, sinceKey, onData, onError) {
  return onSnapshot(
    query(collection(db, 'trainees', uid, 'plan'), where('date', '>=', sinceKey)),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

export function addPlanItem(uid, { date, workout }, editorUid) {
  return addDoc(collection(db, 'trainees', uid, 'plan'), {
    date,
    workoutId: workout.id,
    workoutName: workout.name,
    doneAt: null,
    logId: null,
    createdAt: Date.now(),
    createdBy: editorUid,
  });
}

export function updatePlanItem(uid, id, fields) {
  return updateDoc(doc(db, 'trainees', uid, 'plan', id), fields);
}

export function deletePlanItem(uid, id) {
  return deleteDoc(doc(db, 'trainees', uid, 'plan', id));
}

// Adds several plan items in one write (used by "copy last week").
export async function addPlanItems(uid, items, editorUid) {
  const batch = writeBatch(db);
  for (const { date, workoutId, workoutName } of items) {
    batch.set(doc(collection(db, 'trainees', uid, 'plan')), {
      date, workoutId, workoutName,
      doneAt: null, logId: null, createdAt: Date.now(), createdBy: editorUid,
    });
  }
  await batch.commit();
}

// ─── Logs: finished workouts ────────────────────────────────────────────────
// { workoutId, workoutName, date, startedAt, finishedAt, note, planId,
//   unplanned, loggedBy, exercises: [{ name, sets: [{ weight, reps }] }],
//   coachNote, coachNoteAt, coachName, coachNoteSeenAt, editedAt, editedBy }

const LOG_HISTORY_LIMIT = 100;

// Newest first by the day it was done (a workout can be logged for a past
// date, or have its date edited), then by finish time. Also feeds the "last
// time" numbers and the personal records.
export function listenLogs(uid, onData, onError) {
  return onSnapshot(
    query(collection(db, 'trainees', uid, 'logs'), orderBy('finishedAt', 'desc'), limit(LOG_HISTORY_LIMIT)),
    snap => onData(
      snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.finishedAt || 0) - (a.finishedAt || 0)),
    ),
    onError,
  );
}

// Saves the log and marks the plan item done in one atomic write. A planned
// workout moves to the day it was actually done; an unplanned one gets a new
// plan item so the planner shows it.
export async function finishSession(uid, { log, planId }, editorUid) {
  const commit = async existingPlanId => {
    const batch = writeBatch(db);
    const logRef = doc(collection(db, 'trainees', uid, 'logs'));
    const planRef = existingPlanId
      ? doc(db, 'trainees', uid, 'plan', existingPlanId)
      : doc(collection(db, 'trainees', uid, 'plan'));
    batch.set(logRef, { ...log, planId: planRef.id, unplanned: !existingPlanId, loggedBy: editorUid });
    if (existingPlanId) {
      batch.update(planRef, { doneAt: log.finishedAt, logId: logRef.id, date: log.date });
    } else {
      batch.set(planRef, {
        date: log.date, workoutId: log.workoutId, workoutName: log.workoutName,
        doneAt: log.finishedAt, logId: logRef.id, createdAt: log.finishedAt, createdBy: editorUid,
      });
    }
    await batch.commit();
  };
  try {
    await commit(planId);
  } catch (err) {
    // The plan item was removed while the workout was in progress: save it
    // as unplanned instead of losing the sets.
    if (planId && err.code === 'not-found') return commit(null);
    throw err;
  }
}

// Deleting a log un-does its plan item: removes it if the workout was
// unplanned, otherwise puts it back to "not done".
export async function deleteLog(uid, log) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'trainees', uid, 'logs', log.id));
  if (log.planId) {
    const planRef = doc(db, 'trainees', uid, 'plan', log.planId);
    const planSnap = await getDoc(planRef);
    if (planSnap.exists() && planSnap.data().logId === log.id) {
      if (log.unplanned) batch.delete(planRef);
      else batch.update(planRef, { doneAt: null, logId: null });
    }
  }
  await batch.commit();
}

// Edits a finished workout. A new date moves its plan item along, as
// finishing a workout does.
export async function updateLog(uid, log, fields, editorUid) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'trainees', uid, 'logs', log.id), { ...fields, editedAt: Date.now(), editedBy: editorUid });
  if (fields.date && fields.date !== log.date && log.planId) {
    const planRef = doc(db, 'trainees', uid, 'plan', log.planId);
    const planSnap = await getDoc(planRef);
    if (planSnap.exists() && planSnap.data().logId === log.id) batch.update(planRef, { date: fields.date });
  }
  await batch.commit();
}

// The admin's note on a finished workout; an empty text removes it.
export function saveCoachNote(uid, logId, text, coachName) {
  return updateDoc(doc(db, 'trainees', uid, 'logs', logId), text
    ? { coachNote: text, coachNoteAt: Date.now(), coachName }
    : { coachNote: '', coachNoteAt: null });
}

export function markCoachNoteSeen(uid, logId) {
  return updateDoc(doc(db, 'trainees', uid, 'logs', logId), { coachNoteSeenAt: Date.now() });
}

// ─── Meals: free-text meals placed on a date ───────────────────────────────
// { date: "YYYY-MM-DD", slot, text, eatenAt, actual, photoId, createdAt, createdBy }
// Eaten = eatenAt is set. `actual` is what was eaten instead, if different.
// text is empty when a photo stands in for it.

// Only meals from sinceKey on: meals pile up ~30 a week per trainee, and
// re-reading all of them on every open would eat the free read quota.
export function listenMeals(uid, sinceKey, onData, onError) {
  return onSnapshot(
    query(collection(db, 'trainees', uid, 'meals'), where('date', '>=', sinceKey)),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

// eaten: saved as already eaten. photo: from shrinkPhoto, saved with it.
export async function addMeal(uid, { date, slot, text, eaten = false, photo = null }, editorUid) {
  const batch = writeBatch(db);
  const mealRef = doc(collection(db, 'trainees', uid, 'meals'));
  batch.set(mealRef, {
    date, slot, text, eatenAt: eaten ? Date.now() : null, actual: '',
    photoId: photo ? addPhoto(batch, uid, { mealId: mealRef.id, date, photo }, editorUid) : null,
    createdAt: Date.now(), createdBy: editorUid,
  });
  await batch.commit();
}

export function updateMeal(uid, id, fields) {
  return updateDoc(doc(db, 'trainees', uid, 'meals', id), fields);
}

// A meal's photo goes with it.
export async function deleteMeal(uid, meal) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'trainees', uid, 'meals', meal.id));
  if (meal.photoId) batch.delete(doc(db, 'trainees', uid, 'mealPhotos', meal.photoId));
  await batch.commit();
}

// Adds several meals in one write (copy a day / copy last week).
export async function addMeals(uid, meals, editorUid) {
  const batch = writeBatch(db);
  meals.forEach(({ date, slot, text }, i) => {
    batch.set(doc(collection(db, 'trainees', uid, 'meals')), {
      date, slot, text, eatenAt: null, actual: '', createdAt: Date.now() + i, createdBy: editorUid,
    });
  });
  await batch.commit();
}

// ─── Meal photos ───────────────────────────────────────────────────────────
// trainees/{uid}/mealPhotos/{id}: { mealId, date, image, width, height, createdAt, createdBy }
// image is a JPEG data URL (~100 KB, see photo.js). Each photo is its own doc
// so the meals listener stays small: a photo is read only when its meal is
// shown. A photo never changes (a new one is a new doc), so the copy on the
// device is always good, and only the first view on a device hits the server.

const PHOTOS_IN_MEMORY = 60;
const photoSrcs = new Map(); // photoId → data URL, so a day seen before opens at once

function remember(photoId, src) {
  photoSrcs.set(photoId, src);
  if (photoSrcs.size > PHOTOS_IN_MEMORY) photoSrcs.delete(photoSrcs.keys().next().value);
}

export const cachedMealPhoto = photoId => photoSrcs.get(photoId) || null;

// The photo's data URL, or null if it's gone. Only an inline JPEG is shown,
// so a stored value can never make the app load some other URL.
export async function fetchMealPhoto(uid, photoId) {
  const cached = photoSrcs.get(photoId);
  if (cached) return cached;
  const ref = doc(db, 'trainees', uid, 'mealPhotos', photoId);
  let snap = await getDocFromCache(ref).catch(() => null);
  if (!snap?.exists()) snap = await getDoc(ref);
  const src = snap.exists() ? snap.data().image : null;
  if (typeof src !== 'string' || !src.startsWith('data:image/jpeg;base64,')) return null;
  remember(photoId, src);
  return src;
}

// Adds a photo doc to a batch and returns its id.
function addPhoto(batch, uid, { mealId, date, photo }, editorUid) {
  const ref = doc(collection(db, 'trainees', uid, 'mealPhotos'));
  batch.set(ref, {
    mealId, date, image: photo.src, width: photo.width, height: photo.height,
    createdAt: Date.now(), createdBy: editorUid,
  });
  remember(ref.id, photo.src); // shows at once, even before it's synced
  return ref.id;
}

// Puts a photo on a meal, replacing its old one. eaten: also marks the meal
// eaten, unless it already is.
export async function setMealPhoto(uid, meal, { photo, eaten }, editorUid) {
  const batch = writeBatch(db);
  const fields = { photoId: addPhoto(batch, uid, { mealId: meal.id, date: meal.date, photo }, editorUid) };
  if (eaten && !meal.eatenAt) Object.assign(fields, { eatenAt: Date.now(), actual: '' });
  if (meal.photoId) batch.delete(doc(db, 'trainees', uid, 'mealPhotos', meal.photoId));
  batch.update(doc(db, 'trainees', uid, 'meals', meal.id), fields);
  await batch.commit();
}

export async function removeMealPhoto(uid, meal) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'trainees', uid, 'mealPhotos', meal.photoId));
  batch.update(doc(db, 'trainees', uid, 'meals', meal.id), { photoId: null });
  await batch.commit();
}

// ─── Admin overview ────────────────────────────────────────────────────────
// One trainee's plan items and meals between two dates (inclusive), read
// once — the overview doesn't need live updates.
export async function fetchWeek(uid, fromKey, toKey) {
  const range = name => getDocs(query(
    collection(db, 'trainees', uid, name),
    where('date', '>=', fromKey), where('date', '<=', toKey),
  ));
  const [planSnap, mealsSnap] = await Promise.all([range('plan'), range('meals')]);
  const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return { plan: rows(planSnap), meals: rows(mealsSnap) };
}
