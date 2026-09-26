// Push changes to a trainee from Claude Code:
//   node scripts/push.mjs <spec.json> --dry-run      → prints what would change, writes nothing
//   node scripts/push.mjs <spec.json>                → writes it
//   node scripts/push.mjs <spec.json> --delete       → needed when the spec deletes anything (only after Ofek OKs the dry run)
//
// spec.json (every section is optional except trainee):
// {
//   "trainee": "נופר",                        // part of the name or email
//   "workouts": [                              // created, or updated if the name exists
//     { "name": "אימון A · רגליים", "exercises": [{ "name": "סקוואט", "sets": 3, "reps": 10, "weight": 30, "note": "", "video": "https://youtu.be/…" }] },
//     { "name": "פילאטיס מכשירים", "kind": "activity", "durationMin": 50, "note": "רפורמר" }
//   ],
//   "plan":  [{ "date": "2026-09-28", "workout": "אימון A · רגליים" }],   // skipped if already on that day
//   "meals": [{ "date": "2026-09-28", "slot": "breakfast", "text": "2 ביצים, טוסט" }],  // skipped if duplicate
//
//   "update": {                                // by [id] from show.mjs; only the fields given change
//     "workouts": [{ "id": "…", "name": "אימון A", "exercises": [...], "note": "", "durationMin": 45 }],  // a rename also renames its upcoming plan items
//     "plan":  [{ "id": "…", "date": "2026-09-30", "workout": "אימון B" }],  // move or swap; not for done items
//     "meals": [{ "id": "…", "date": "…", "slot": "lunch", "text": "…" }],
//     "logs":  [{ "id": "…", "note": "…", "effort": 7, "durationMin": 50, "exercises": [{ "name": "סקוואט", "sets": [{ "weight": 30, "reps": 10 }] }] }]
//   },
//   "delete": {                                // by [id]
//     "workouts": ["…"],                       // also removes its not-done plan items from today on
//     "plan": ["…"], "meals": ["…"],
//     "logs": ["…"]                            // like deleting in History: its plan item goes back to "not done" (removed if unplanned)
//   }
// }
import { readFileSync } from 'node:fs';
import { listDocs, getDoc, createDoc, updateDoc, listByDate, commit, openTrainee, norm } from './lib.mjs';
import { todayKey } from '../src/dates.js';
import { cleanVideoLink } from '../src/session.js';

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };

const [specPath, ...flags] = process.argv.slice(2);
const dryRun = flags.includes('--dry-run');
if (!specPath) fail('Usage: node scripts/push.mjs <spec.json> [--dry-run] [--delete]');
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const upd = spec.update || {};
const del = spec.delete || {};
const deleteCount = ['workouts', 'plan', 'meals', 'logs'].reduce((n, k) => n + (del[k] || []).length, 0);

const cleanExercise = ex => ({
  name: ex.name.trim(), sets: ex.sets ?? null, reps: ex.reps ?? null, weight: ex.weight ?? null, note: ex.note || '',
  video: cleanVideoLink(ex.video) || '',
});
const cleanLogExercise = ex => ({
  name: ex.name.trim(), sets: (ex.sets || []).map(st => ({ weight: st.weight ?? null, reps: st.reps ?? null })),
});

// ─── Validate the spec before touching anything ────────────────────────────
const problems = [];
if (!spec.trainee) problems.push('missing "trainee"');
for (const w of spec.workouts || []) {
  if (!w.name?.trim()) problems.push('workout without a name');
  const activity = w.kind === 'activity';
  if (!activity && !(w.exercises || []).length) problems.push(`"${w.name}": strength workout needs exercises`);
  for (const ex of w.exercises || []) {
    if (!ex.name?.trim()) problems.push(`"${w.name}": exercise without a name`);
    if (cleanVideoLink(ex.video) === null) problems.push(`"${w.name}" / ${ex.name}: bad video link "${ex.video}"`);
  }
}
for (const p of spec.plan || []) {
  if (!isDate(p.date)) problems.push(`plan: bad date "${p.date}"`);
  if (!p.workout) problems.push(`plan ${p.date}: missing workout name`);
}
const checkMeal = (m, label) => {
  if ('date' in m && !isDate(m.date)) problems.push(`${label}: bad date "${m.date}"`);
  if ('slot' in m && !SLOTS.includes(m.slot)) problems.push(`${label}: slot must be one of ${SLOTS.join('/')}`);
  if ('text' in m && !m.text?.trim()) problems.push(`${label}: empty text`);
};
for (const m of spec.meals || []) {
  if (!('date' in m) || !('slot' in m) || !('text' in m)) problems.push(`meal ${m.date || '?'}: needs date, slot and text`);
  checkMeal(m, `meal ${m.date} ${m.slot}`);
}
for (const [kind, list] of Object.entries({ ...upd, ...Object.fromEntries(Object.entries(del).map(([k, v]) => [`delete.${k}`, v])) })) {
  if (!['workouts', 'plan', 'meals', 'logs', 'delete.workouts', 'delete.plan', 'delete.meals', 'delete.logs'].includes(kind)) problems.push(`unknown section "${kind}"`);
  for (const item of list || []) if (!(kind.startsWith('delete.') ? item : item?.id)) problems.push(`${kind}: item without an id`);
}
for (const u of upd.workouts || []) {
  if ('name' in u && !u.name?.trim()) problems.push(`update workout ${u.id}: empty name`);
  for (const ex of u.exercises || []) {
    if (!ex.name?.trim()) problems.push(`update workout ${u.id}: exercise without a name`);
    if (cleanVideoLink(ex.video) === null) problems.push(`update workout ${u.id} / ${ex.name}: bad video link "${ex.video}"`);
  }
}
for (const u of upd.plan || []) if ('date' in u && !isDate(u.date)) problems.push(`update plan ${u.id}: bad date "${u.date}"`);
for (const u of upd.meals || []) checkMeal(u, `update meal ${u.id}`);
for (const u of upd.logs || []) {
  if ('effort' in u && !(Number.isInteger(u.effort) && u.effort >= 1 && u.effort <= 10)) problems.push(`update log ${u.id}: effort must be 1–10`);
  for (const ex of u.exercises || []) if (!ex.name?.trim()) problems.push(`update log ${u.id}: exercise without a name`);
}
if (problems.length) fail('Spec problems:\n  - ' + problems.join('\n  - '));
if (deleteCount && !dryRun && !flags.includes('--delete')) fail(`This spec deletes ${deleteCount} item(s). Run --dry-run, get Ofek's OK, then add --delete.`);

// ─── Resolve trainee and existing data ─────────────────────────────────────
const { s, trainee, root } = await openTrainee(spec.trainee).catch(err => fail(err.message));
console.log(`${dryRun ? '[dry run] ' : ''}Trainee: ${trainee.name} <${trainee.email}>`);
const today = todayKey();
const now = Date.now();

const existing = await listDocs(s, `${root}/workouts`);
const byName = new Map(existing.map(w => [norm(w.name), w]));
const byId = new Map(existing.map(w => [w.id, w]));
const specNames = new Set((spec.workouts || []).map(w => norm(w.name)));

// Every update/delete target is read and checked first, so a bad id aborts
// the whole run before anything is written.
const fetchAll = async (col, ids) => Promise.all(ids.map(async id => ({ id, doc: await getDoc(s, `${root}/${col}/${id}`) })));
const [updPlan, updMeals, updLogs, delPlan, delMeals, delLogs] = await Promise.all([
  fetchAll('plan', (upd.plan || []).map(u => u.id)),
  fetchAll('meals', (upd.meals || []).map(u => u.id)),
  fetchAll('logs', (upd.logs || []).map(u => u.id)),
  fetchAll('plan', del.plan || []),
  fetchAll('meals', del.meals || []),
  fetchAll('logs', del.logs || []),
]);
for (const [label, rows] of Object.entries({ 'update plan': updPlan, 'update meal': updMeals, 'update log': updLogs, 'delete plan': delPlan, 'delete meal': delMeals, 'delete log': delLogs })) {
  for (const r of rows) if (!r.doc) problems.push(`${label} ${r.id}: not found`);
}
for (const u of upd.workouts || []) {
  if (!byId.has(u.id)) { problems.push(`update workout ${u.id}: not found`); continue; }
  const clash = 'name' in u && byName.get(norm(u.name));
  if (clash && clash.id !== u.id) problems.push(`update workout ${u.id}: another workout is already named "${clash.name}"`);
}
for (const id of del.workouts || []) if (!byId.has(id)) problems.push(`delete workout ${id}: not found`);
upd.plan?.forEach((u, i) => {
  if (updPlan[i].doc?.doneAt) problems.push(`update plan ${u.id}: already done; delete its log first`);
  if ('workout' in u && !byName.has(norm(u.workout)) && !specNames.has(norm(u.workout))) problems.push(`update plan ${u.id}: no workout named "${u.workout}"`);
});
if (problems.length) fail('Problems:\n  - ' + problems.join('\n  - '));

// ─── Workouts: create or update by name ────────────────────────────────────
let created = 0, updated = 0;
for (const w of spec.workouts || []) {
  const activity = w.kind === 'activity';
  const data = {
    name: w.name.trim(),
    kind: activity ? 'activity' : 'strength',
    durationMin: activity ? (w.durationMin ?? null) : null,
    note: activity ? (w.note || '') : '',
    exercises: activity ? [] : w.exercises.map(cleanExercise),
    updatedAt: now,
    updatedBy: s.uid,
  };
  const found = byName.get(norm(w.name));
  if (found) {
    if (!dryRun) await updateDoc(s, `${root}/workouts/${found.id}`, data);
    byName.set(norm(w.name), { ...found, ...data });
    updated++;
    console.log(`  ~ workout updated: ${data.name}`);
  } else {
    const id = dryRun ? `(new:${data.name})` : await createDoc(s, `${root}/workouts`, { ...data, createdAt: now + created });
    byName.set(norm(w.name), { id, ...data });
    created++;
    console.log(`  + workout created: ${data.name}${activity ? ' (activity)' : ` (${data.exercises.length} exercises)`}`);
  }
}

// ─── Plan items ────────────────────────────────────────────────────────────
// Only the spec's date range is read for the duplicate check.
const inRange = async (col, items) => {
  if (!items.length) return [];
  const dates = items.map(x => x.date).sort();
  return listByDate(s, root, col, dates[0], dates[dates.length - 1]);
};
let planned = 0, planSkipped = 0;
const plan = await inRange('plan', spec.plan || []);
for (const p of spec.plan || []) {
  const w = byName.get(norm(p.workout));
  if (!w) { console.error(`✗ plan ${p.date}: no workout named "${p.workout}"`); process.exitCode = 1; continue; }
  if (plan.some(x => x.date === p.date && x.workoutId === w.id)) { planSkipped++; continue; }
  if (!dryRun) await createDoc(s, `${root}/plan`, {
    date: p.date, workoutId: w.id, workoutName: w.name, doneAt: null, logId: null, createdAt: now + planned, createdBy: s.uid,
  });
  plan.push({ date: p.date, workoutId: w.id });
  planned++;
  console.log(`  + planned: ${p.date} ${w.name}`);
}

// ─── Meals ─────────────────────────────────────────────────────────────────
let mealsAdded = 0, mealsSkipped = 0;
const meals = await inRange('meals', spec.meals || []);
for (const m of spec.meals || []) {
  if (meals.some(x => x.date === m.date && x.slot === m.slot && norm(x.text) === norm(m.text))) { mealsSkipped++; continue; }
  if (!dryRun) await createDoc(s, `${root}/meals`, {
    date: m.date, slot: m.slot, text: m.text.trim(), eatenAt: null, actual: '', createdAt: now + mealsAdded, createdBy: s.uid,
  });
  meals.push({ date: m.date, slot: m.slot, text: m.text });
  mealsAdded++;
}
if (mealsAdded) console.log(`  + meals added: ${mealsAdded}`);

// ─── Updates and deletes: one atomic commit ────────────────────────────────
const writes = [];
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]));
const changes = data => Object.entries(data).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ');
const upcoming = (upd.workouts || []).some(u => 'name' in u) || (del.workouts || []).length
  ? await listByDate(s, root, 'plan', today, '9999-12-31')
  : [];

for (const u of upd.workouts || []) {
  const w = byId.get(u.id);
  const data = pick(u, ['name', 'kind', 'durationMin', 'note']);
  if ('name' in data) data.name = data.name.trim();
  if ('kind' in data) data.kind = data.kind === 'activity' ? 'activity' : 'strength';
  if ('exercises' in u) data.exercises = u.exercises.map(cleanExercise);
  writes.push({ update: `${root}/workouts/${u.id}`, data: { ...data, updatedAt: now, updatedBy: s.uid } });
  console.log(`  ~ workout "${w.name}": ${changes(data)}`);
  if (data.name && data.name !== w.name) {
    for (const p of upcoming.filter(p => p.workoutId === u.id && !p.doneAt)) {
      writes.push({ update: `${root}/plan/${p.id}`, data: { workoutName: data.name } });
      console.log(`      renames plan ${p.date}`);
    }
  }
}
upd.plan?.forEach((u, i) => {
  const p = updPlan[i].doc;
  const data = pick(u, ['date']);
  if ('workout' in u) {
    const w = byName.get(norm(u.workout));
    Object.assign(data, { workoutId: w.id, workoutName: w.name });
  }
  writes.push({ update: `${root}/plan/${u.id}`, data });
  console.log(`  ~ plan ${p.date} ${p.workoutName} → ${data.date || p.date} ${data.workoutName || p.workoutName}`);
});
upd.meals?.forEach((u, i) => {
  const m = updMeals[i].doc;
  const data = pick(u, ['date', 'slot', 'text']);
  if ('text' in data) data.text = data.text.trim();
  writes.push({ update: `${root}/meals/${u.id}`, data });
  console.log(`  ~ meal ${m.date} ${m.slot} "${m.text}": ${changes(data)}`);
});
upd.logs?.forEach((u, i) => {
  const l = updLogs[i].doc;
  const data = pick(u, ['note', 'effort', 'durationMin']);
  if ('exercises' in u) data.exercises = u.exercises.map(cleanLogExercise);
  writes.push({ update: `${root}/logs/${u.id}`, data });
  console.log(`  ~ log ${l.date} ${l.workoutName}: ${changes(data)}`);
});

for (const id of del.workouts || []) {
  writes.push({ delete: `${root}/workouts/${id}` });
  console.log(`  - workout "${byId.get(id).name}"`);
  for (const p of upcoming.filter(p => p.workoutId === id && !p.doneAt)) {
    writes.push({ delete: `${root}/plan/${p.id}` });
    console.log(`      and its plan ${p.date}`);
  }
}
for (const { id, doc: p } of delPlan) {
  writes.push({ delete: `${root}/plan/${id}` });
  const logStays = p.logId && !(del.logs || []).includes(p.logId);
  console.log(`  - plan ${p.date} ${p.workoutName}${logStays ? ' (its log stays in history)' : ''}`);
}
for (const { id, doc: m } of delMeals) {
  writes.push({ delete: `${root}/meals/${id}` });
  console.log(`  - meal ${m.date} ${m.slot} "${m.text}"`);
}
for (const { id, doc: l } of delLogs) {
  writes.push({ delete: `${root}/logs/${id}` });
  let what = '';
  const p = l.planId && await getDoc(s, `${root}/plan/${l.planId}`);
  if (p?.logId === id) {
    if (l.unplanned) { writes.push({ delete: `${root}/plan/${l.planId}` }); what = ' (and its unplanned plan item)'; }
    else { writes.push({ update: `${root}/plan/${l.planId}`, data: { doneAt: null, logId: null } }); what = ' (its plan item goes back to not done)'; }
  }
  console.log(`  - log ${l.date} ${l.workoutName}${what}`);
}

// A path written twice in one commit fails the whole commit (e.g. a deleted
// log's plan item that's also deleted directly), so writes are folded per
// path: a delete wins, updates merge.
const byPath = new Map();
for (const w of writes) {
  const path = w.update || w.delete;
  const prev = byPath.get(path);
  if (prev?.delete || w.delete) byPath.set(path, { delete: path });
  else byPath.set(path, { update: path, data: { ...prev?.data, ...w.data } });
}
const finalWrites = [...byPath.values()];
if (finalWrites.length && !dryRun) await commit(s, finalWrites);

console.log(`${dryRun ? '[dry run — nothing written] ' : '✓ '}workouts: ${created} created, ${updated} updated · plan: ${planned} added, ${planSkipped} already there · meals: ${mealsAdded} added, ${mealsSkipped} already there · ${(Object.values(upd).flat()).length} updated · ${deleteCount} deleted`);
