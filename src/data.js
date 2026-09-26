// Firestore access for the gym app. Everything lives under trainees/{uid}
// (see firestore.rules in the ACL-Tracker repo): the trainee owns it, the
// admin can read + write all of it.
import {
  collection, doc, getDoc, getDocs, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, writeBatch,
  query, orderBy, limit,
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

// ─── Plan: a workout placed on a date ───────────────────────────────────────
// { date: "YYYY-MM-DD", workoutId, workoutName, doneAt, logId, createdAt, createdBy }
// workoutName is copied in so the plan still reads right if the workout is
// later renamed or deleted. Done = doneAt is set (phase 3 also sets logId).

// Loads the whole plan. Fine at a few workouts a week; if it grows to
// thousands of docs, switch to a date-range query.
export function listenPlan(uid, onData, onError) {
  return onSnapshot(
    collection(db, 'trainees', uid, 'plan'),
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
//   unplanned, loggedBy, exercises: [{ name, sets: [{ weight, reps }] }] }

const LOG_HISTORY_LIMIT = 100;

// Newest first. Also feeds the "last time" numbers in a new session.
export function listenLogs(uid, onData, onError) {
  return onSnapshot(
    query(collection(db, 'trainees', uid, 'logs'), orderBy('finishedAt', 'desc'), limit(LOG_HISTORY_LIMIT)),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
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
