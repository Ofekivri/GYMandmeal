// Read a trainee's data from Claude Code:
//   node scripts/show.mjs                              → the trainees
//   node scripts/show.mjs <trainee> [from] [to]        → workouts library + plan, logs and meals in the range
//   node scripts/show.mjs <trainee> [from] [to] --json → the raw docs
// The range defaults to this week (Sunday → Saturday); a single date means that day only.
// Every item prints its [id], which push.mjs's "update" and "delete" take.
import { session, listDocs, listByDate, openTrainee } from './lib.mjs';
import { todayKey, weekStart, addDays, fromKey, DAY_LETTERS } from '../src/dates.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const [who, from0, to0] = args.filter(a => !a.startsWith('--'));
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };

if (!who) {
  const s = await session().catch(err => fail(err.message));
  for (const t of await listDocs(s, 'trainees')) {
    const seen = t.lastSeenAt ? new Date(t.lastSeenAt).toLocaleString('he-IL') : 'never';
    console.log(`${t.name} <${t.email}> [${t.id}] · last seen ${seen}`);
  }
  process.exit(0);
}

const today = todayKey();
const from = from0 || weekStart(today);
const to = to0 || (from0 ? from0 : addDays(from, 6));
if (!isDate(from) || !isDate(to) || from > to) fail(`bad range "${from}" → "${to}" (use YYYY-MM-DD)`);

const { s, trainee, root } = await openTrainee(who).catch(err => fail(err.message));
const [workouts, plan, logs, meals] = await Promise.all([
  listDocs(s, `${root}/workouts`),
  listByDate(s, root, 'plan', from, to),
  listByDate(s, root, 'logs', from, to),
  listByDate(s, root, 'meals', from, to),
]);

if (json) {
  console.log(JSON.stringify({ trainee, from, to, today, workouts, plan, logs, meals }, null, 2));
  process.exit(0);
}

const day = key => `${key} ${DAY_LETTERS[fromKey(key).getDay()]}`;
const num = n => (n === null || n === undefined || n === '' ? '?' : n);
const byDate = (a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0);
const SLOT_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

console.log(`${trainee.name} <${trainee.email}> · ${from} → ${to} · today ${today}\n`);

console.log(`Workouts (${workouts.length}):`);
for (const w of workouts.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))) {
  if (w.kind === 'activity') {
    console.log(`  [${w.id}] ${w.name} · activity${w.durationMin ? ` · ${w.durationMin} min` : ''}${w.note ? ` · ${w.note}` : ''}`);
    continue;
  }
  console.log(`  [${w.id}] ${w.name} · ${(w.exercises || []).length} exercises`);
  for (const ex of w.exercises || []) {
    console.log(`      ${ex.name} ${num(ex.sets)}×${num(ex.reps)}${ex.weight ? ` @${ex.weight}` : ''}${ex.note ? ` (${ex.note})` : ''}${ex.video ? ` ▶ ${ex.video}` : ''}`);
  }
}

console.log(`\nPlan (${plan.length}):`);
for (const p of plan.sort(byDate)) {
  const status = p.doneAt ? `done${p.logId ? ` · log ${p.logId}` : ' (marked, no log)'}` : p.date < today ? 'MISSED' : 'planned';
  console.log(`  ${day(p.date)} [${p.id}] ${p.workoutName} · ${status}`);
}

console.log(`\nLogs (${logs.length}):`);
for (const l of logs.sort((a, b) => a.date.localeCompare(b.date) || a.finishedAt - b.finishedAt)) {
  const mins = l.durationMin ?? (l.startedAt && l.finishedAt ? Math.round((l.finishedAt - l.startedAt) / 60000) : null);
  const extras = [
    l.effort ? `effort ${l.effort}/10` : '',
    mins ? `${mins} min` : '',
    l.unplanned ? 'unplanned' : '',
    l.note ? `"${l.note}"` : '',
  ].filter(Boolean).join(' · ');
  console.log(`  ${day(l.date)} [${l.id}] ${l.workoutName}${extras ? ` · ${extras}` : ''}`);
  for (const ex of l.exercises || []) {
    console.log(`      ${ex.name}: ${(ex.sets || []).map(st => `${num(st.weight)}×${num(st.reps)}`).join(', ') || '(no sets)'}`);
  }
}

console.log(`\nMeals (${meals.length}):`);
for (const m of meals.sort((a, b) => a.date.localeCompare(b.date) || SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))) {
  const status = m.actual ? `ate instead: ${m.actual}` : m.eatenAt ? 'eaten' : m.date < today ? 'not eaten' : '';
  console.log(`  ${day(m.date)} ${m.slot} [${m.id}] ${m.text}${status ? ` · ${status}` : ''}`);
}
