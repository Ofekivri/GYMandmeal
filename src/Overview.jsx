import { useEffect, useState } from 'react';
import { fetchWeek } from './data';
import { todayKey, weekStart, addDays, fromKey, DAY_LETTERS } from './dates';
import { summarizeWeek, percent } from './weekSummary';
import { withCode } from './errors';
import WeekNav from './WeekNav';
import { countOf } from './hebrew';

// Admin home: one card per trainee with the week's adherence — workouts done
// vs. due, meals eaten vs. due, and what was missed. Tap a card to open that
// trainee's planner.
export default function Overview({ trainees, onOpen }) {
  const today = todayKey();
  const [week, setWeek] = useState(() => weekStart(today));
  const [weeks, setWeeks] = useState({}); // uid → { plan, meals } | { error }

  // Re-fetch when the week or the set of trainees changes (not on every
  // profile update of the live trainee list).
  const uids = trainees.map(t => t.uid).join(',');
  useEffect(() => {
    let cancelled = false;
    setWeeks({});
    for (const uid of uids ? uids.split(',') : []) {
      fetchWeek(uid, week, addDays(week, 6))
        .then(data => { if (!cancelled) setWeeks(w => ({ ...w, [uid]: data })); })
        .catch(err => {
          console.error('[overview] load failed', uid, err);
          if (!cancelled) setWeeks(w => ({ ...w, [uid]: { error: withCode('לא הצלחנו לטעון.', err) } }));
        });
    }
    return () => { cancelled = true; };
  }, [week, uids]);

  return (
    <div>
      <WeekNav week={week} today={today} onChange={setWeek} />
      <div className="list" style={{ marginTop: 8 }}>
        {trainees.map(t => {
          const data = weeks[t.uid];
          return (
            <button key={t.uid} className="card overview-card" onClick={() => onOpen(t.uid)}
              aria-label={`פתיחת התכנון של ${t.name}`}>
              <div className="plan-row" style={{ marginBottom: 8 }}>
                <div style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>{t.name}</div>
                <span className="muted" aria-hidden="true">←</span>
              </div>
              {!data ? (
                <div className="muted">טוען…</div>
              ) : data.error ? (
                <div className="error">{data.error}</div>
              ) : (
                <WeekSummary summary={summarizeWeek(data, today)} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekSummary({ summary }) {
  const { workouts, meals, empty } = summary;
  if (empty) return <div className="muted">לא תוכנן כלום לשבוע הזה.</div>;

  return (
    <div className="list" style={{ gap: 10 }}>
      <StatRow
        label="אימונים"
        done={workouts.done}
        due={workouts.due}
        notes={[
          workouts.left > 0 && `עוד ${workouts.left} השבוע`,
        ]}
      />
      {workouts.missed.length > 0 && (
        <div className="overview-missed">
          לא בוצע: {workouts.missed.map(m => `${m.workoutName} (${DAY_LETTERS[fromKey(m.date).getDay()]})`).join(', ')}
        </div>
      )}
      <StatRow
        label="ארוחות"
        done={meals.eaten}
        due={meals.due}
        notes={[
          meals.different > 0 && countOf(meals.different, 'ארוחה אחת אחרת מהתכנון', 'אחרת מהתכנון'),
          meals.unmarked > 0 && countOf(meals.unmarked, 'ארוחה אחת לא סומנה', 'לא סומנו'),
          meals.left > 0 && `עוד ${meals.left} השבוע`,
        ]}
      />
    </div>
  );
}

function StatRow({ label, done, due, notes }) {
  const pct = percent(done, due);
  const extra = notes.filter(Boolean).join(' · ');
  return (
    <div>
      <div className="plan-row">
        <span style={{ flex: 1 }}>{label}</span>
        <span style={{ fontWeight: 600 }} dir="ltr">{due ? `${done}/${due}` : '—'}</span>
      </div>
      <div className="bar" role="presentation"><div className={`bar-fill${pct === 100 ? ' full' : ''}`} style={{ width: `${pct}%` }} /></div>
      {extra && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{extra}</div>}
    </div>
  );
}
