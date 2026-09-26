// Push a program to a trainee from Claude Code:
//   node scripts/push.mjs <spec.json> [--dry-run]
//
// spec.json:
// {
//   "trainee": "נופר",                        // name (or part of it) or email
//   "workouts": [                              // created, or updated if the name exists
//     { "name": "אימון A · רגליים", "exercises": [{ "name": "סקוואט", "sets": 3, "reps": 10, "weight": 30, "note": "" }] },
//     { "name": "פילאטיס מכשירים", "kind": "activity", "durationMin": 50, "note": "רפורמר" }
//   ],
//   "plan":  [{ "date": "2026-09-28", "workout": "אימון A · רגליים" }],   // skipped if already on that day
//   "meals": [{ "date": "2026-09-28", "slot": "breakfast", "text": "2 ביצים, טוסט" }]  // skipped if duplicate
// }
import { readFileSync } from 'node:fs';
import { session, listDocs, getDoc, createDoc, updateDoc } from './lib.mjs';

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const norm = t => String(t || '').trim().replace(/\s+/g, ' ').toLowerCase();
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);

const [specPath, ...flags] = process.argv.slice(2);
const dryRun = flags.includes('--dry-run');
if (!specPath) {
  console.error('Usage: node scripts/push.mjs <spec.json> [--dry-run]');
  process.exit(1);
}
const spec = JSON.parse(readFileSync(specPath, 'utf8'));

// ─── Validate before touching anything ─────────────────────────────────────
const problems = [];
for (const w of spec.workouts || []) {
  if (!w.name?.trim()) problems.push('workout without a name');
  const activity = w.kind === 'activity';
  if (!activity && !(w.exercises || []).length) problems.push(`"${w.name}": strength workout needs exercises`);
  for (const ex of w.exercises || []) if (!ex.name?.trim()) problems.push(`"${w.name}": exercise without a name`);
}
for (const p of spec.plan || []) {
  if (!isDate(p.date)) problems.push(`plan: bad date "${p.date}"`);
  if (!p.workout) problems.push(`plan ${p.date}: missing workout name`);
}
for (const m of spec.meals || []) {
  if (!isDate(m.date)) problems.push(`meal: bad date "${m.date}"`);
  if (!SLOTS.includes(m.slot)) problems.push(`meal ${m.date}: slot must be one of ${SLOTS.join('/')}`);
  if (!m.text?.trim()) problems.push(`meal ${m.date} ${m.slot}: empty text`);
}
if (problems.length) {
  console.error('✗ Spec problems:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}

// ─── Resolve trainee ───────────────────────────────────────────────────────
const s = await session().catch(err => { console.error(`✗ ${err.message}`); process.exit(1); });
const settings = await getDoc(s, 'config/settings');
if (settings?.adminEmail !== s.email) console.warn(`! ${s.email} is not the admin in config/settings; writes to other trainees will be denied.`);

const trainees = await listDocs(s, 'trainees');
const q = norm(spec.trainee);
const matches = trainees.filter(t => norm(t.email) === q || norm(t.name).includes(q));
if (matches.length !== 1) {
  console.error(`✗ Trainee "${spec.trainee}" matched ${matches.length}: ${trainees.map(t => `${t.name} <${t.email}>`).join(', ') || '(no trainees)'}`);
  process.exit(1);
}
const trainee = matches[0];
const root = `trainees/${trainee.id}`;
console.log(`${dryRun ? '[dry run] ' : ''}Trainee: ${trainee.name} <${trainee.email}>`);

// ─── Workouts: create or update by name ────────────────────────────────────
const existing = await listDocs(s, `${root}/workouts`);
const byName = new Map(existing.map(w => [norm(w.name), w]));
const now = Date.now();
let created = 0, updated = 0;
for (const w of spec.workouts || []) {
  const activity = w.kind === 'activity';
  const data = {
    name: w.name.trim(),
    kind: activity ? 'activity' : 'strength',
    durationMin: activity ? (w.durationMin ?? null) : null,
    note: activity ? (w.note || '') : '',
    exercises: activity ? [] : w.exercises.map(ex => ({
      name: ex.name.trim(), sets: ex.sets ?? null, reps: ex.reps ?? null, weight: ex.weight ?? null, note: ex.note || '',
    })),
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
let planned = 0, planSkipped = 0;
if ((spec.plan || []).length) {
  const plan = await listDocs(s, `${root}/plan`);
  for (const p of spec.plan) {
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
}

// ─── Meals ─────────────────────────────────────────────────────────────────
let mealsAdded = 0, mealsSkipped = 0;
if ((spec.meals || []).length) {
  const dates = spec.meals.map(m => m.date).sort();
  const meals = (await listDocs(s, `${root}/meals`)).filter(m => m.date >= dates[0] && m.date <= dates[dates.length - 1]);
  for (const m of spec.meals) {
    if (meals.some(x => x.date === m.date && x.slot === m.slot && norm(x.text) === norm(m.text))) { mealsSkipped++; continue; }
    if (!dryRun) await createDoc(s, `${root}/meals`, {
      date: m.date, slot: m.slot, text: m.text.trim(), eatenAt: null, actual: '', createdAt: now + mealsAdded, createdBy: s.uid,
    });
    meals.push({ date: m.date, slot: m.slot, text: m.text });
    mealsAdded++;
  }
  if (mealsAdded) console.log(`  + meals added: ${mealsAdded}`);
}

console.log(`${dryRun ? '[dry run — nothing written] ' : '✓ '}workouts: ${created} created, ${updated} updated · plan: ${planned} added, ${planSkipped} already there · meals: ${mealsAdded} added, ${mealsSkipped} already there`);
