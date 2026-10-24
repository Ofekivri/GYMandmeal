// Builds the readable Markdown report of a trainee's training and nutrition,
// shared by the app's "ייצוא נתונים" button and scripts/export.mjs.
import { fromKey, weekStart, DAY_LETTERS } from './dates.js';

// first/to: the report's date range; today: to tell "not eaten" from "planned".
export function buildExportMarkdown({ trainee, first, to, today, plan, logs, meals }) {
  const day = key => `${key} (${DAY_LETTERS[fromKey(key).getDay()]})`;
  const num = n => (n === null || n === undefined || n === '' ? '?' : n);
  const avg = arr => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '–');
  const SLOT = { breakfast: 'ארוחת בוקר', lunch: 'צהריים', dinner: 'ערב', snack: 'נשנוש' };
  const SLOT_ORDER = Object.keys(SLOT);
  const byDate = (a, b) => a.date.localeCompare(b.date);

  const due = plan.filter(p => p.date <= today);
  const done = due.filter(p => p.doneAt);
  const efforts = logs.map(l => l.effort).filter(Number.isFinite);
  const durs = logs.map(l => l.durationMin ?? (l.startedAt && l.finishedAt ? Math.round((l.finishedAt - l.startedAt) / 60000) : null)).filter(Number.isFinite);
  const mealsDue = meals.filter(m => m.date <= today);
  const eaten = mealsDue.filter(m => m.eatenAt);
  const swapped = eaten.filter(m => m.actual);

  const L = [];
  L.push(`# ${trainee.name} · ${first} → ${to}`, '');
  L.push('## סיכום', '');
  L.push(`- אימונים מתוכננים שהגיע זמנם: ${due.length} · בוצעו: ${done.length} (${pct(done.length, due.length)}) · פוספסו: ${due.length - done.length}`);
  L.push(`- אימונים ביומן: ${logs.length}${logs.filter(l => l.unplanned).length ? ` (מהם ללא תכנון: ${logs.filter(l => l.unplanned).length})` : ''}`);
  L.push(`- מאמץ ממוצע (1–10): ${avg(efforts) ?? '–'} · משך ממוצע: ${avg(durs) ?? '–'} דק׳`);
  L.push(`- ארוחות מתוכננות שהגיע זמנן: ${mealsDue.length} · נאכלו: ${eaten.length} (${pct(eaten.length, mealsDue.length)}) · "אכלתי משהו אחר": ${swapped.length}`);
  L.push(`- ימים עם ארוחות מתועדות: ${new Set(meals.map(m => m.date)).size}`, '');

  // Weekly table
  const weeks = new Map();
  const wk = k => { if (!weeks.has(k)) weeks.set(k, { due: 0, done: 0, logs: 0, mDue: 0, mEaten: 0 }); return weeks.get(k); };
  for (const p of due) { const w = wk(weekStart(p.date)); w.due++; if (p.doneAt) w.done++; }
  for (const l of logs) wk(weekStart(l.date)).logs++;
  for (const m of mealsDue) { const w = wk(weekStart(m.date)); w.mDue++; if (m.eatenAt) w.mEaten++; }
  L.push('## לפי שבוע (שבוע מתחיל ביום ראשון)', '', '| שבוע | אימונים בוצעו/תוכננו | יומנים | ארוחות נאכלו/תוכננו |', '|---|---|---|---|');
  for (const k of [...weeks.keys()].sort()) { const w = weeks.get(k); L.push(`| ${k} | ${w.done}/${w.due} | ${w.logs} | ${w.mEaten}/${w.mDue} |`); }
  L.push('');

  // Per-exercise progression
  const byEx = new Map();
  for (const l of [...logs].sort(byDate)) for (const ex of l.exercises || []) {
    const sets = (ex.sets || []).filter(st => st.reps != null || st.weight != null);
    if (!sets.length) continue;
    const top = sets.reduce((b, st) => ((st.weight ?? 0) > (b.weight ?? 0) || ((st.weight ?? 0) === (b.weight ?? 0) && (st.reps ?? 0) > (b.reps ?? 0)) ? st : b), sets[0]);
    const key = ex.name.trim();
    if (!byEx.has(key)) byEx.set(key, []);
    byEx.get(key).push({ date: l.date, top, volume: sets.reduce((v, st) => v + (st.weight ?? 0) * (st.reps ?? 0), 0), n: sets.length });
  }
  L.push('## התקדמות לפי תרגיל (סט הכי חזק בכל אימון)', '', '| תרגיל | פעמים | ראשון | אחרון | שינוי משקל |', '|---|---|---|---|---|');
  const fmt = e => `${e.date.slice(5)}: ${num(e.top.weight)}×${num(e.top.reps)}`;
  for (const [name, rows] of byEx) {
    const a = rows[0], b = rows[rows.length - 1];
    const delta = a.top.weight != null && b.top.weight != null ? `${b.top.weight - a.top.weight >= 0 ? '+' : ''}${b.top.weight - a.top.weight}` : '–';
    L.push(`| ${name} | ${rows.length} | ${fmt(a)} | ${fmt(b)} | ${rows.length > 1 ? delta : '–'} |`);
  }
  L.push('');

  // Workout diary
  L.push('## יומן אימונים', '');
  for (const l of [...logs].sort((a, b) => a.date.localeCompare(b.date) || (a.finishedAt || 0) - (b.finishedAt || 0))) {
    const mins = l.durationMin ?? (l.startedAt && l.finishedAt ? Math.round((l.finishedAt - l.startedAt) / 60000) : null);
    const extras = [l.effort ? `מאמץ ${l.effort}/10` : '', mins ? `${mins} דק׳` : '', l.unplanned ? 'לא מתוכנן' : ''].filter(Boolean).join(' · ');
    L.push(`### ${day(l.date)} · ${l.workoutName}${extras ? ` · ${extras}` : ''}`);
    if (l.note) L.push(`- הערת מתאמן/ת: ${l.note}`);
    if (l.coachNote) L.push(`- הערת מאמן: ${l.coachNote}`);
    for (const ex of l.exercises || []) L.push(`- ${ex.name}: ${(ex.sets || []).map(st => `${num(st.weight)}×${num(st.reps)}`).join(', ') || '(ללא סטים)'}`);
    L.push('');
  }
  const missed = due.filter(p => !p.doneAt).sort(byDate);
  if (missed.length) L.push('## אימונים שפוספסו', '', ...missed.map(p => `- ${day(p.date)} · ${p.workoutName}`), '');

  // Meals by day
  L.push('## תזונה לפי יום', '');
  const mealDays = [...new Set(meals.map(m => m.date))].sort();
  for (const d of mealDays) {
    L.push(`### ${day(d)}`);
    for (const m of meals.filter(x => x.date === d).sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || (a.createdAt || 0) - (b.createdAt || 0))) {
      const status = m.actual ? `אכל/ה במקום: ${m.actual}` : m.eatenAt ? 'נאכל' : m.date < today ? 'לא נאכל' : 'מתוכנן';
      L.push(`- ${SLOT[m.slot] || m.slot}: ${m.text || '(תמונה בלבד)'}${m.photoId ? ' 📷' : ''} — ${status}`);
    }
    L.push('');
  }

  return L.join('\n');
}

export const exportFileName = (trainee, first, to, ext = 'md') =>
  `gymandmeal-${String(trainee.name || 'trainee').replace(/[^\p{L}\p{N}]+/gu, '-')}-${first}_${to}.${ext}`;
