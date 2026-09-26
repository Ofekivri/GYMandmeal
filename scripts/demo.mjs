// Find ExerciseDB 3D animations for exercises (free V1 API, no key):
//   node scripts/demo.mjs "face pull" "cable seated row" …
// Prints id | name | target muscles | gif. Put the id in an exercise's "demo"
// (push.mjs) after opening the gif to check it's the same variation.
// Free for non-commercial use only, with credit to AscendAPI (the app shows it).
const API = 'https://oss.exercisedb.dev/api/v1/exercises/search';

const queries = process.argv.slice(2);
if (!queries.length) {
  console.error('Usage: node scripts/demo.mjs "<english exercise name>" […]');
  process.exit(1);
}
for (const [i, q] of queries.entries()) {
  if (i) await new Promise(r => setTimeout(r, 1000)); // the free API is rate limited
  const res = await fetch(`${API}?${new URLSearchParams({ search: q, threshold: '0.3' })}`);
  const body = await res.json().catch(() => ({}));
  console.log(`== ${q}${res.ok ? '' : ` (HTTP ${res.status})`}`);
  for (const e of (body.data || []).slice(0, 8)) {
    console.log(`  ${e.exerciseId} | ${e.name} | ${(e.targetMuscles || []).join(', ')} | ${e.gifUrl}`);
  }
}
