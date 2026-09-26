// Personal records, computed on the device from the loaded logs (the latest
// 100). A set beats another when it's heavier, or the same weight for more
// reps; with no weight (bodyweight), more reps. The first time an exercise
// is logged sets no record — there's nothing to beat yet.
import { normalizeName } from './session.js';

const weightOf = s => (s.weight > 0 ? s.weight : 0);

export const compareSets = (a, b) => weightOf(a) - weightOf(b) || (a.reps || 0) - (b.reps || 0);

// The best set of an exercise in one workout: { set, index }, or null.
export function bestSet(sets) {
  let best = null;
  (sets || []).forEach((set, index) => {
    if (!set || (set.weight == null && set.reps == null)) return;
    if (!best || compareSets(set, best.set) > 0) best = { set, index };
  });
  return best;
}

// Walks logs oldest → newest keeping the best set per exercise name.
// onExercise(log, exIndex, top, prior) sees each exercise before it counts.
function walk(logsNewestFirst, onExercise) {
  const best = new Map();
  for (const log of [...(logsNewestFirst || [])].reverse()) {
    (log.exercises || []).forEach((ex, i) => {
      const top = bestSet(ex.sets);
      if (!top) return;
      const key = normalizeName(ex.name);
      const prior = best.get(key);
      onExercise?.(log, i, top, prior);
      if (!prior || compareSets(top.set, prior) > 0) best.set(key, top.set);
    });
  }
  return best;
}

// Records a new log would set against earlier logs: [{ name, set }].
export function newRecords(log, earlierLogs) {
  const best = walk(earlierLogs);
  return (log.exercises || []).flatMap(ex => {
    const top = bestSet(ex.sets);
    const prior = best.get(normalizeName(ex.name));
    return top && prior && compareSets(top.set, prior) > 0 ? [{ name: ex.name, set: top.set }] : [];
  });
}

// For History: logId → Map(exercise index → index of the record set).
export function recordsByLog(logs) {
  const out = new Map();
  walk(logs, (log, i, top, prior) => {
    if (!prior || compareSets(top.set, prior) <= 0) return;
    if (!out.has(log.id)) out.set(log.id, new Map());
    out.get(log.id).set(i, top.index);
  });
  return out;
}

// Every logged exercise, most recently done first: [{ key, name, count }].
export function exerciseOptions(logs) {
  const byKey = new Map();
  for (const log of logs || []) {
    for (const ex of log.exercises || []) {
      if (!bestSet(ex.sets)) continue;
      const key = normalizeName(ex.name);
      if (!byKey.has(key)) byKey.set(key, { key, name: ex.name.trim(), count: 0 });
      byKey.get(key).count++;
    }
  }
  return [...byKey.values()];
}

// One exercise over time, oldest first: [{ logId, date, set, sets, record }].
export function exerciseProgress(logs, key) {
  const rows = [];
  let best = null;
  for (const log of [...(logs || [])].reverse()) {
    for (const ex of log.exercises || []) {
      if (normalizeName(ex.name) !== key) continue;
      const top = bestSet(ex.sets);
      if (!top) continue;
      rows.push({ logId: log.id, date: log.date, set: top.set, sets: ex.sets, record: !!best && compareSets(top.set, best) > 0 });
      if (!best || compareSets(top.set, best) > 0) best = top.set;
    }
  }
  return { rows, best };
}
