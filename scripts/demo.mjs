// Find ExerciseDB 3D animations for exercises (free V1 API, no key):
//   node scripts/demo.mjs "lateral raise" "seated row" …
// Matches names containing the text (English), so short keywords work best.
// Prints id | name | equipment | gif. Put the id in an exercise's "demo"
// (push.mjs) after opening the gif to check it's the same variation.
// Free for non-commercial use only, with credit to AscendAPI (the app shows it).
const API = 'https://oss.exercisedb.dev/api/v1/exercises';

const queries = process.argv.slice(2);
if (!queries.length) {
  console.error('Usage: node scripts/demo.mjs "<english exercise name>" […]');
  process.exit(1);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The free API is rate limited (429/503): space the calls out and back off.
async function search(q) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}?${new URLSearchParams({ name: q, limit: '25' })}`);
    if ((res.status !== 429 && res.status !== 503) || attempt === 4) return res;
    await sleep(5000 * (attempt + 1));
  }
}

for (const [i, q] of queries.entries()) {
  if (i) await sleep(2500);
  const res = await search(q);
  const body = await res.json().catch(() => ({}));
  const total = body.meta?.total ?? 0;
  console.log(`== ${q}${res.ok ? ` (${total})` : ` (HTTP ${res.status})`}`);
  for (const e of body.data || []) {
    console.log(`  ${e.exerciseId} | ${e.name} | ${(e.equipments || []).join(', ')} | ${e.gifUrl}`);
  }
  if (total > 25) console.log('  … more: use a longer name');
}
