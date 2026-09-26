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

export const isActivity = workoutOrLog => workoutOrLog?.kind === 'activity';

// How-to video for an exercise: the link set on it, else a YouTube search by
// name. Only http(s) links are used, so a stored link can never run script.
export function videoUrl(name, link) {
  if (/^https?:\/\//i.test(link || '')) return link;
  const q = /[\u0590-\u05FF]/.test(name) ? `${name} טכניקה` : `how to ${name}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

// 3D animation for an exercise, shown inside the app (no YouTube, no ads):
// `demo` is an exercise id from the free ExerciseDB V1 API
// (oss.exercisedb.dev). Free for non-commercial use only, with credit to
// AscendAPI. Only a plain id is accepted, so no other URL is ever loaded.
export const DEMO_CREDIT_URL = 'https://ascendapi.com';
export const isDemoId = id => /^[A-Za-z0-9]{4,16}$/.test(id || '');
export const demoUrl = id => (isDemoId(id) ? `https://static.exercisedb.dev/media/${id}.gif` : null);

// A typed video link as stored: "" when empty, https:// added when missing,
// null when it isn't a web address.
export function cleanVideoLink(value) {
  const t = String(value || '').trim();
  if (!t) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return url.hostname.includes('.') ? url.href : null;
  } catch {
    return null;
  }
}

// Effort scale 1–10 (RPE) for activity workouts.
export const EFFORT_LABELS = { 1: 'קל מאוד', 2: 'קל', 3: 'קל', 4: 'בינוני', 5: 'בינוני', 6: 'בינוני-קשה', 7: 'קשה', 8: 'קשה', 9: 'קשה מאוד', 10: 'מקסימלי' };

export function buildSession({ traineeUid, workout, planItem, logs }) {
  if (isActivity(workout)) {
    return {
      kind: 'activity',
      traineeUid,
      workoutId: workout.id,
      workoutName: workout.name,
      planId: planItem?.id || null,
      startedAt: Date.now(),
      effort: null,
      durationMin: str(workout.durationMin),
      note: '',
    };
  }
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
      const target = { sets: ex.sets, reps: ex.reps, weight: ex.weight };
      return {
        name: ex.name,
        target,
        note: ex.note || '',
        video: ex.video || '',
        demo: ex.demo || '',
        last,
        sets: prefillSets(Math.max(1, ex.sets || last?.sets.length || 3), last, target),
      };
    }),
  };
}

// Prefill: last time's weight for the same set, else the target weight.
function prefillSets(count, last, target) {
  return Array.from({ length: count }, (_, i) => {
    const prev = last?.sets[i] || last?.sets[last.sets.length - 1];
    return {
      weight: str(prev?.weight ?? target.weight),
      reps: str(target.reps ?? prev?.reps),
      done: false,
    };
  });
}

// Swaps an exercise for this session only (a busy machine, say); the workout
// itself keeps the original. The target weight, the note, the video link and
// the animation belonged to the original, so the new exercise starts from its
// own last time.
export function swapExercise(ex, name, logs) {
  const last = lastSetsFor(logs, name);
  const target = { ...ex.target, weight: null };
  return { ...ex, name, target, note: '', video: '', demo: '', last, sets: prefillSets(ex.sets.length, last, target) };
}

// "" → null, "12,5" → 12.5.
export const toNumber = v => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Only sets marked done are saved; exercises with none are left out.
// session.date is set when the workout is logged for a past day; that day
// has no real start → finish time, so startedAt is left out.
export function sessionToLog(session) {
  const finishedAt = Date.now();
  const date = session.date || todayKey();
  const startedAt = date === todayKey() ? session.startedAt : null;
  if (isActivity(session)) {
    return {
      kind: 'activity',
      workoutId: session.workoutId,
      workoutName: session.workoutName,
      date,
      startedAt,
      finishedAt,
      note: session.note.trim(),
      effort: session.effort,
      durationMin: toNumber(session.durationMin),
      exercises: [],
    };
  }
  return {
    workoutId: session.workoutId,
    workoutName: session.workoutName,
    date,
    startedAt,
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

// The admin wrote (or changed) a note the trainee hasn't opened yet.
export const hasNewCoachNote = log => !!log.coachNote && (log.coachNoteSeenAt || 0) < (log.coachNoteAt || 0);

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

// Every exercise name the trainee has used, one spelling per name (workouts
// first, then logs). Feeds autocomplete so "סקוואט" doesn't become
// "סקוואט " or "Squat" in one workout and split the history.
export function knownExerciseNames(workouts, logs) {
  const byKey = new Map();
  const add = name => {
    const key = normalizeName(name);
    if (key && !byKey.has(key)) byKey.set(key, name.trim().replace(/\s+/g, ' '));
  };
  for (const w of workouts || []) for (const ex of w.exercises || []) add(ex.name);
  for (const log of logs || []) for (const ex of log.exercises || []) add(ex.name);
  return byKey;
}
