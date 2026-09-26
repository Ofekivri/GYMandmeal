import { useState } from 'react';
import { saveWorkout, deleteWorkout } from './data';
import { normalizeName, cleanVideoLink } from './session';
import { withCode } from './errors';

let nextKey = 0;
const newRow = (ex = {}) => ({
  key: nextKey++,
  name: ex.name || '',
  sets: ex.sets != null ? String(ex.sets) : '3',
  reps: ex.reps != null ? String(ex.reps) : '10',
  weight: ex.weight != null ? String(ex.weight) : '',
  note: ex.note || '',
  video: ex.video || '',
});

// "" → null, "12.5" → 12.5. Keeps empty fields out of the numbers.
const toNumber = v => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const KINDS = [
  { id: 'strength', label: 'כוח (סטים)' },
  { id: 'activity', label: 'פעילות (פילאטיס, ריצה…)' },
];

// Create or edit one workout. Strength: a name plus an ordered list of
// exercises. Activity (Pilates, a class, a run): no sets — the trainee logs
// effort and duration when it's done.
// knownNames: Map(normalized name → spelling) of every exercise the trainee
// has used — offered as suggestions, and a typed name that matches one is
// saved with that exact spelling.
export default function WorkoutEditor({ uid, editorUid, workout, knownNames, onDone }) {
  const [name, setName] = useState(workout?.name || '');
  const [kind, setKind] = useState(workout?.kind === 'activity' ? 'activity' : 'strength');
  const [durationMin, setDurationMin] = useState(workout?.durationMin != null ? String(workout.durationMin) : '');
  const [activityNote, setActivityNote] = useState(workout?.note || '');
  const [rows, setRows] = useState(() =>
    workout?.exercises?.length ? workout.exercises.map(newRow) : [newRow()],
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateRow = (key, field, value) =>
    setRows(rs => rs.map(r => (r.key === key ? { ...r, [field]: value } : r)));
  const removeRow = key => setRows(rs => rs.filter(r => r.key !== key));
  const moveRow = (index, delta) => setRows(rs => {
    const target = index + delta;
    if (target < 0 || target >= rs.length) return rs;
    const next = [...rs];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const save = async () => {
    const filled = rows.filter(r => r.name.trim() || r.weight || r.note.trim() || r.video.trim());
    if (!name.trim()) return setError('תנו שם לאימון.');
    if (kind === 'strength') {
      if (filled.some(r => !r.name.trim())) return setError('לכל תרגיל צריך שם.');
      if (filled.length === 0) return setError('הוסיפו לפחות תרגיל אחד.');
      const badLink = filled.findIndex(r => cleanVideoLink(r.video) === null);
      if (badLink >= 0) return setError(`הקישור לסרטון בתרגיל ${rows.indexOf(filled[badLink]) + 1} לא תקין. הדביקו כתובת מלאה, למשל מיוטיוב.`);
    }

    setError('');
    setBusy(true);
    try {
      await saveWorkout(uid, {
        ...(workout?.id ? { id: workout.id } : {}),
        name: name.trim(),
        kind,
        durationMin: kind === 'activity' ? toNumber(durationMin) : null,
        note: kind === 'activity' ? activityNote.trim() : '',
        exercises: kind === 'activity' ? [] : filled.map(r => ({
          name: knownNames.get(normalizeName(r.name)) || r.name.trim().replace(/\s+/g, ' '),
          sets: toNumber(r.sets),
          reps: toNumber(r.reps),
          weight: toNumber(r.weight),
          note: r.note.trim(),
          video: cleanVideoLink(r.video),
        })),
      }, editorUid);
      onDone();
    } catch (err) {
      console.error('[workout] save failed', err);
      setError(withCode('השמירה נכשלה. נסו שוב.', err));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await deleteWorkout(uid, workout.id);
      onDone();
    } catch (err) {
      console.error('[workout] delete failed', err);
      setError(withCode('המחיקה נכשלה. נסו שוב.', err));
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="header">
        <h2 style={{ fontSize: 18, margin: 0 }}>{workout ? 'עריכת אימון' : 'אימון חדש'}</h2>
        <button className="btn btn-ghost" onClick={onDone}>ביטול</button>
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label htmlFor="workout-name">שם האימון</label>
        <input id="workout-name" className="input" value={name} placeholder={kind === 'activity' ? 'פילאטיס מכשירים' : 'אימון A · רגליים'}
          onChange={e => setName(e.target.value)} />
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>סוג האימון</label>
        <div className="chips" role="radiogroup" aria-label="סוג האימון">
          {KINDS.map(k => (
            <button key={k.id} type="button" role="radio" aria-checked={kind === k.id}
              className={`chip${kind === k.id ? ' on' : ''}`} onClick={() => setKind(k.id)}>{k.label}</button>
          ))}
        </div>
      </div>

      {kind === 'activity' ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="muted">בלי סטים: בסוף האימון רושמים מד מאמץ, משך והערה.</div>
          <div className="field">
            <label htmlFor="activity-duration">משך משוער (דקות)</label>
            <input id="activity-duration" className="input" inputMode="numeric" value={durationMin} placeholder="50"
              onChange={e => setDurationMin(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="activity-note">הערה (לא חובה)</label>
            <input id="activity-note" className="input" value={activityNote} placeholder="רפורמר, סטודיו ליד הבית"
              onChange={e => setActivityNote(e.target.value)} />
          </div>
        </div>
      ) : (<>
      <datalist id="exercise-names">
        {[...knownNames.values()].map(n => <option key={n} value={n} />)}
      </datalist>

      <div className="list">
        {rows.map((r, i) => (
          <div key={r.key} className="card exercise">
            <div className="exercise-head">
              <span className="muted" style={{ minWidth: 18 }}>{i + 1}.</span>
              <input className="input" value={r.name} placeholder="שם התרגיל" aria-label="שם התרגיל" list="exercise-names"
                onChange={e => updateRow(r.key, 'name', e.target.value)} />
              <button className="btn btn-ghost" onClick={() => moveRow(i, -1)} disabled={i === 0} aria-label="הזזה למעלה">↑</button>
              <button className="btn btn-ghost" onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1} aria-label="הזזה למטה">↓</button>
              <button className="btn btn-ghost" onClick={() => removeRow(r.key)} aria-label="מחיקת תרגיל">✕</button>
            </div>
            <div className="exercise-grid">
              <div className="field">
                <label>סטים</label>
                <input className="input" inputMode="numeric" value={r.sets} onChange={e => updateRow(r.key, 'sets', e.target.value)} />
              </div>
              <div className="field">
                <label>חזרות</label>
                <input className="input" inputMode="numeric" value={r.reps} onChange={e => updateRow(r.key, 'reps', e.target.value)} />
              </div>
              <div className="field">
                <label>משקל (ק״ג)</label>
                <input className="input" inputMode="decimal" value={r.weight} placeholder="—" onChange={e => updateRow(r.key, 'weight', e.target.value)} />
              </div>
            </div>
            <input className="input" value={r.note} placeholder="הערה (לא חובה)" aria-label="הערה"
              onChange={e => updateRow(r.key, 'note', e.target.value)} />
            <input className="input" dir="ltr" inputMode="url" value={r.video} aria-label="קישור לסרטון הדגמה"
              placeholder="קישור לסרטון (לא חובה, אחרת חיפוש ביוטיוב)"
              onChange={e => updateRow(r.key, 'video', e.target.value)} />
          </div>
        ))}
        <button className="btn btn-block btn-dashed" onClick={() => setRows(rs => [...rs, newRow()])}>+ הוספת תרגיל</button>
      </div>
      </>)}

      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      <div className="actions">
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'שומר…' : 'שמירה'}</button>
      </div>
      {workout && (
        <div className="actions">
          <button className="btn btn-danger" onClick={remove} disabled={busy}>
            {confirmDelete ? 'לחצו שוב כדי למחוק' : 'מחיקת האימון'}
          </button>
        </div>
      )}
    </div>
  );
}
