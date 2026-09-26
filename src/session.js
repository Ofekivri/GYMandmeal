// A workout in progress ("session"): built from a workout template plus the
// trainee's recent logs, kept in localStorage until it's saved or discarded
// so a reload or a locked phone doesn't lose the sets already entered.
import { todayKey } from './dates.js';

const STORAGE_PREFIX = 'gym_session_v1_';

// Exercises are free text, so match names loosely: "Squat " == "squat".
export const normalizeName = name => (name || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Most recent logged sets for an exercise name. logs: newest first.
export function lastSetsFor(logs, name) {
  const key = normalizeName(name);
  for (const log of logs || []) {
    const ex = (log.exercises || []).find(e => normalizeName(e.name) === key);
    if (ex?.sets?.length) return { date: log.date, sets: ex.sets };
  }
  return null;
}

const str = v => (v == null ? '' : String(v));

export function buildSession({ traineeUid, workout, planItem, logs }) {
  return {
    traineeUid,
    workoutId: workout.id,
    workoutName: workout.name,
    planId: planItem?.id || null,
    startedAt: Date.now(),
    current: 0,
    note: '',
    exercises: (workout.exercises || []).map(ex => {
      const last = lastSetsFor(logs, ex.name);
      const count = Math.max(1, ex.sets || last?.sets.length || 3);
      return {
        name: ex.name,
        target: { sets: ex.sets, reps: ex.reps, weight: ex.weight },
        note: ex.note || '',
        last,
        // Prefill: last time's weight for the same set, else the target weight.
        sets: Array.from({ length: count }, (_, i) => {
          const prev = last?.sets[i] || last?.sets[last.sets.length - 1];
          return {
            weight: str(prev?.weight ?? ex.weight),
            reps: str(ex.reps ?? prev?.reps),
            done: false,
          };
        }),
      };
    }),
  };
}

const toNumber = v => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Only sets marked done are saved; exercises with none are left out.
export function sessionToLog(session) {
  const finishedAt = Date.now();
  return {
    workoutId: session.workoutId,
    workoutName: session.workoutName,
    date: todayKey(),
    startedAt: session.startedAt,
    finishedAt,
    note: session.note.trim(),
    exercises: session.exercises
      .map(ex => ({
        name: ex.name,
        sets: ex.sets.filter(s => s.done).map(s => ({ weight: toNumber(s.weight), reps: toNumber(s.reps) })),
      }))
      .filter(ex => ex.sets.length > 0),
  };
}

export const countDoneSets = session =>
  session.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.done).length, 0);

// "32.5×8", or just "12" for a bodyweight set.
export const formatSet = s => (s.weight != null && s.weight !== '' ? `${s.weight}×${s.reps ?? '?'}` : `${s.reps ?? '?'}`);

export const durationMinutes = (startedAt, finishedAt) => Math.round((finishedAt - startedAt) / 60000);

export function loadSession(uid) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + uid) || 'null');
  } catch (err) {
    console.warn('[session] restore failed', err);
    return null;
  }
}

export function storeSession(uid, session) {
  try {
    if (session) localStorage.setItem(STORAGE_PREFIX + uid, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_PREFIX + uid);
  } catch (err) {
    console.warn('[session] save failed', err);
  }
}
