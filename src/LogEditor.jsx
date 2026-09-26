import { useState } from 'react';
import { updateLog } from './data';
import { isActivity, normalizeName, toNumber } from './session';
import { todayKey } from './dates';
import { EffortPicker } from './ActivitySession';
import { withCode } from './errors';

const str = v => (v == null ? '' : String(v));
let nextKey = 0;

// Fix a finished workout from History: its date, every set and the note, or
// effort and minutes for an activity. An exercise left with no sets is
// dropped; one that was never marked ✓ can be added back.
// knownNames: Map(normalized name → spelling), as in WorkoutEditor.
export default function LogEditor({ uid, editorUid, log, knownNames, onDone }) {
  const today = todayKey();
  const activity = isActivity(log);
  const [date, setDate] = useState(log.date);
  const [note, setNote] = useState(log.note || '');
  const [effort, setEffort] = useState(log.effort || null);
  const [durationMin, setDurationMin] = useState(str(log.durationMin));
  const [exercises, setExercises] = useState(() => (log.exercises || []).map(ex => ({
    key: nextKey++,
    name: ex.name,
    isNew: false,
    sets: (ex.sets || []).map(s => ({ weight: str(s.weight), reps: str(s.reps) })),
  })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setExercise = (key, fn) => setExercises(xs => xs.map(x => (x.key === key ? fn(x) : x)));
  const setSet = (key, i, fields) =>
    setExercise(key, x => ({ ...x, sets: x.sets.map((s, j) => (j === i ? { ...s, ...fields } : s)) }));
  const addSet = key => setExercise(key, x => ({ ...x, sets: [...x.sets, { ...(x.sets[x.sets.length - 1] || { weight: '', reps: '' }) }] }));
  const removeSet = (key, i) => setExercise(key, x => ({ ...x, sets: x.sets.filter((_, j) => j !== i) }));
  const addExercise = () =>
    setExercises(xs => [...xs, { key: nextKey++, name: '', isNew: true, sets: [{ weight: '', reps: '' }] }]);

  const save = async () => {
    if (!date) return setError('בחרו תאריך.');
    if (date > today) return setError('אי אפשר לרשום אימון בתאריך עתידי.');
    const fields = { date, note: note.trim() };
    if (activity) {
      if (!effort) return setError('בחרו מד מאמץ.');
      Object.assign(fields, { effort, durationMin: toNumber(durationMin) });
    } else {
      const kept = exercises
        .map(x => ({
          name: x.name.trim().replace(/\s+/g, ' '),
          sets: x.sets
            .filter(s => s.weight.trim() || s.reps.trim())
            .map(s => ({ weight: toNumber(s.weight), reps: toNumber(s.reps) })),
        }))
        .filter(x => x.sets.length > 0);
      if (kept.some(x => !x.name)) return setError('לכל תרגיל צריך שם.');
      if (kept.length === 0) return setError('השאירו לפחות סט אחד, או מחקו את האימון מההיסטוריה.');
      fields.exercises = kept.map(x => ({ ...x, name: knownNames.get(normalizeName(x.name)) || x.name }));
    }

    setError('');
    setBusy(true);
    try {
      await updateLog(uid, log, fields, editorUid);
      onDone();
    } catch (err) {
      console.error('[history] edit failed', err);
      setError(withCode('השמירה נכשלה. נסו שוב.', err));
      setBusy(false);
    }
  };

  return (
    <div className="list" style={{ marginTop: 10, gap: 12 }}>
      <div className="field">
        <label htmlFor={`log-date-${log.id}`}>תאריך האימון</label>
        <input id={`log-date-${log.id}`} type="date" className="input" max={today} value={date}
          onChange={e => setDate(e.target.value)} />
      </div>

      {activity ? (
        <>
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>מד מאמץ</div>
            <EffortPicker value={effort} onChange={setEffort} />
          </div>
          <div className="field">
            <label htmlFor={`log-minutes-${log.id}`}>משך (דקות)</label>
            <input id={`log-minutes-${log.id}`} className="input" inputMode="numeric" value={durationMin}
              onChange={e => setDurationMin(e.target.value)} />
          </div>
        </>
      ) : (
        <div>
          <datalist id="log-exercise-names">
            {[...knownNames.values()].map(n => <option key={n} value={n} />)}
          </datalist>
          <div className="set-row set-head muted">
            <span>סט</span><span>משקל (ק״ג)</span><span>חזרות</span><span />
          </div>
          {exercises.map(x => (
            <div key={x.key} className="history-ex">
              {x.isNew ? (
                <input className="input" list="log-exercise-names" value={x.name} placeholder="שם התרגיל"
                  aria-label="שם התרגיל" autoFocus onChange={e => setExercise(x.key, ex => ({ ...ex, name: e.target.value }))} />
              ) : (
                <div style={{ fontWeight: 500 }}>{x.name}</div>
              )}
              <div className="sets" style={{ marginTop: 6 }}>
                {x.sets.map((s, i) => (
                  <div key={i} className="set-row">
                    <span className="muted">{i + 1}</span>
                    <input className="input" inputMode="decimal" value={s.weight} placeholder="—"
                      aria-label={`${x.name || 'תרגיל'}: משקל סט ${i + 1}`} onChange={e => setSet(x.key, i, { weight: e.target.value })} />
                    <input className="input" inputMode="numeric" value={s.reps}
                      aria-label={`${x.name || 'תרגיל'}: חזרות סט ${i + 1}`} onChange={e => setSet(x.key, i, { reps: e.target.value })} />
                    <button type="button" className="check" onClick={() => removeSet(x.key, i)}
                      aria-label={`הסרת סט ${i + 1}`}>✕</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => addSet(x.key)}>+ הוספת סט</button>
            </div>
          ))}
          <button type="button" className="btn btn-block btn-dashed" style={{ marginTop: 6 }} onClick={addExercise}>+ הוספת תרגיל</button>
        </div>
      )}

      <div className="field">
        <label htmlFor={`log-note-${log.id}`}>הערה (לא חובה)</label>
        <textarea id={`log-note-${log.id}`} className="input" rows={2} value={note} onChange={e => setNote(e.target.value)} />
      </div>

      {error && <div className="error">{error}</div>}

      <div className="actions" style={{ marginTop: 0 }}>
        <button type="button" className="btn" onClick={onDone} disabled={busy}>ביטול</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'שומר…' : 'שמירת השינויים'}</button>
      </div>
    </div>
  );
}
