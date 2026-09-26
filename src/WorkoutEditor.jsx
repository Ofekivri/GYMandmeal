import { useState } from 'react';
import { saveWorkout, deleteWorkout } from './data';

let nextKey = 0;
const newRow = (ex = {}) => ({
  key: nextKey++,
  name: ex.name || '',
  sets: ex.sets != null ? String(ex.sets) : '3',
  reps: ex.reps != null ? String(ex.reps) : '10',
  weight: ex.weight != null ? String(ex.weight) : '',
  note: ex.note || '',
});

// "" → null, "12.5" → 12.5. Keeps empty fields out of the numbers.
const toNumber = v => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Create or edit one workout: a name plus an ordered list of exercises.
export default function WorkoutEditor({ uid, editorUid, workout, onDone }) {
  const [name, setName] = useState(workout?.name || '');
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
    const filled = rows.filter(r => r.name.trim() || r.weight || r.note.trim());
    if (!name.trim()) return setError('תנו שם לאימון.');
    if (filled.some(r => !r.name.trim())) return setError('לכל תרגיל צריך שם.');
    if (filled.length === 0) return setError('הוסיפו לפחות תרגיל אחד.');

    setError('');
    setBusy(true);
    try {
      await saveWorkout(uid, {
        ...(workout?.id ? { id: workout.id } : {}),
        name: name.trim(),
        exercises: filled.map(r => ({
          name: r.name.trim(),
          sets: toNumber(r.sets),
          reps: toNumber(r.reps),
          weight: toNumber(r.weight),
          note: r.note.trim(),
        })),
      }, editorUid);
      onDone();
    } catch (err) {
      console.error('[workout] save failed', err);
      setError('השמירה נכשלה. נסו שוב.');
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
      setError('המחיקה נכשלה. נסו שוב.');
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
        <input id="workout-name" className="input" value={name} placeholder="אימון A · רגליים"
          onChange={e => setName(e.target.value)} />
      </div>

      <div className="list">
        {rows.map((r, i) => (
          <div key={r.key} className="card exercise">
            <div className="exercise-head">
              <span className="muted" style={{ minWidth: 18 }}>{i + 1}.</span>
              <input className="input" value={r.name} placeholder="שם התרגיל" aria-label="שם התרגיל"
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
          </div>
        ))}
        <button className="btn btn-block btn-dashed" onClick={() => setRows(rs => [...rs, newRow()])}>+ הוספת תרגיל</button>
      </div>

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
