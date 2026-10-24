// Export a trainee's training and nutrition to one readable Markdown file, for
// review, coaching advice, or pasting into a chat:
//   node scripts/export.mjs <trainee> [from] [to] [--all] [--out file.md] [--json]
// The range defaults to the last 30 days; --all exports everything from the first record. Default file: ~/Downloads/gymandmeal-<name>-<from>_<to>.md
// --json writes the raw docs instead (same range).
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { listByDate, listDocs, openTrainee } from './lib.mjs';
import { todayKey, addDays } from '../src/dates.js';
import { buildExportMarkdown, exportFileName } from '../src/exportMarkdown.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const all = args.includes('--all');
const outIdx = args.indexOf('--out');
const outArg = outIdx >= 0 ? args[outIdx + 1] : null;
const [who, from0, to0] = args.filter((a, i) => !a.startsWith('--') && i !== outIdx + 1);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };
if (!who) fail('Usage: node scripts/export.mjs <trainee> [from] [to] [--all] [--out file.md] [--json]');

const today = todayKey();
const to = to0 || today;
const from = all ? '2000-01-01' : from0 || addDays(to, -30);
if (!isDate(from) || !isDate(to) || from > to) fail(`bad range "${from}" → "${to}" (use YYYY-MM-DD)`);

const { s, trainee, root } = await openTrainee(who).catch(err => fail(err.message));
const [workouts, plan, logs, meals] = await Promise.all([
  listDocs(s, `${root}/workouts`),
  listByDate(s, root, 'plan', from, to),
  listByDate(s, root, 'logs', from, to),
  listByDate(s, root, 'meals', from, to),
]);

// --all: show the real first date instead of the query's lower bound
const first = all ? [...plan, ...logs, ...meals].map(x => x.date).sort()[0] || to : from;
const outPath = outArg || path.join(homedir(), 'Downloads', exportFileName(trainee, first, to, json ? 'json' : 'md'));

if (json) {
  writeFileSync(outPath, JSON.stringify({ trainee, from: first, to, workouts, plan, logs, meals }, null, 2));
  console.log(`✓ ${outPath}`);
  process.exit(0);
}

const md = buildExportMarkdown({ trainee, first, to, today, plan, logs, meals });
writeFileSync(outPath, md);
console.log(`✓ ${outPath}`);
console.log(`  ${logs.length} אימונים · ${meals.length} ארוחות · ${first} → ${to}`);
