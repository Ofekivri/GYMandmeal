import { useState } from 'react';
import { countDoneSets, durationMinutes, formatSet, sessionToLog } from './session';
import { newRecords } from './records';
import { shortDate, todayKey } from './dates';
import { countOf } from './hebrew';
import { withCode } from './errors';

// Doing a workout: one exercise at a time, weight × reps per set, ✓ to mark
// a set done. Only done sets are saved. Every change goes through onChange,
// which App persists to localStorage. The summary shows new personal records
// (against logs, newest first) and can date the workout to a past day.
export default function WorkoutSession({ session, logs, onChange, onFinish, onDiscard }) {
  const [finishing, setFinishing] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const total = session.exercises.length;
  const idx = Math.min(session.current, total - 1);
  const ex = session.exercises[idx];
  const doneSets = countDoneSets(session);

  const setExercise = (i, fn) =>
    onChange({ ...session, exercises: session.exercises.map((e, j) => (j === i ? fn(e) : e)) });
  const setSet = (si, fields) =>
    setExercise(idx, e => ({ ...e, sets: e.sets.map((s, k) => (k === si ? { ...s, ...fields } : s)) }));
  const addSet = () => setExercise(idx, e => ({ ...e, sets: [...e.sets, { ...e.sets[e.sets.length - 1], done: false }] }));
  const removeSet = () => setExercise(idx, e => (e.sets.length > 1 ? { ...e, sets: e.sets.slice(0, -1) } : e));
  const goTo = i => { setError(''); onChange({ ...session, current: i }); };

  const today = todayKey();

  const save = async () => {
    if (doneSets === 0) return setError('סמנו לפחות סט אחד כבוצע (✓) לפני השמירה.');
    if (session.date > today) return setError('אי אפשר לרשום אימון בתאריך עתידי.');
    setError('');
    setBusy(true);
    try {
      await onFinish();
    } catch (err) {
      console.error('[session] save failed', err);
      setError(withCode('השמירה נכשלה. האימון עדיין שמור במכשיר, נסו שוב.', err));
      setBusy(false);
    }
  };

  const header = (
    <div className="header">
      <div>
        <h2 style={{ fontSize: 18, margin: 0 }}>{session.workoutName}</h2>
        <div className="muted">{countOf(doneSets, 'סט אחד בוצע', 'סטים בוצעו')} · {durationMinutes(session.startedAt, Date.now())} דק׳</div>
      </div>
      <button className={`btn ${confirmExit ? 'btn-danger' : 'btn-ghost'}`}
        onClick={() => (confirmExit ? onDiscard() : setConfirmExit(true))}>
        {confirmExit ? 'לצאת בלי לשמור?' : 'יציאה'}
      </button>
    </div>
  );

  if (total === 0) {
    return <div>{header}<p className="muted">אין תרגילים באימון הזה. ערכו אותו ברשימת האימונים.</p></div>;
  }

  if (finishing) {
    const log = sessionToLog(session);
    const records = newRecords(log, (logs || []).filter(l => l.date <= log.date));
    return (
      <div>
        {header}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>סיכום</div>
          <div className="list" style={{ gap: 6 }}>
            {session.exercises.map((e, i) => {
              const done = e.sets.filter(s => s.done).length;
              const record = records.find(r => r.name === e.name);
              return (
                <div key={i}>
                  <div className="plan-row">
                    <span style={{ flex: 1 }}>{e.name}</span>
                    <span className={done ? '' : 'muted'}>{done}/{e.sets.length} סטים</span>
                  </div>
                  {record && <span className="badge pr">🏆 שיא חדש: <bdi dir="ltr">{formatSet(record.set)}</bdi></span>}
                </div>
              );
            })}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="session-note">הערה לאימון (לא חובה)</label>
            <textarea id="session-note" className="input" rows={2} value={session.note}
              onChange={e => onChange({ ...session, note: e.target.value })} />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="session-date">תאריך האימון</label>
            <input id="session-date" type="date" className="input" max={today} value={session.date || today}
              onChange={e => onChange({ ...session, date: e.target.value && e.target.value !== today ? e.target.value : null })} />
          </div>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        <div className="actions">
          <button className="btn" onClick={() => { setFinishing(false); setError(''); }} disabled={busy}>חזרה לאימון</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'שומר…' : 'שמירת האימון'}</button>
        </div>
      </div>
    );
  }

  const target = [
    ex.target.sets && ex.target.reps ? `${ex.target.sets} × ${ex.target.reps}` : null,
    ex.target.weight != null ? `${ex.target.weight} ק״ג` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div>
      {header}

      <div className="ex-chips" aria-label="תרגילים">
        {session.exercises.map((e, i) => {
          const done = e.sets.filter(s => s.done).length;
          const state = done === e.sets.length ? 'done' : done > 0 ? 'partial' : '';
          return (
            <button key={i} className={`ex-chip ${state}${i === idx ? ' current' : ''}`}
              onClick={() => goTo(i)} aria-label={`תרגיל ${i + 1}: ${e.name}`}>{i + 1}</button>
          );
        })}
      </div>

      <div className="card">
        <div className="muted">תרגיל {idx + 1} מתוך {total}</div>
        <div style={{ fontSize: 20, fontWeight: 700, margin: '2px 0 4px' }}>{ex.name}</div>
        {target && <div className="muted">יעד: {target}</div>}
        {ex.note && <div className="muted">{ex.note}</div>}
        {ex.last && (
          <div className="last-time">
            פעם קודמת ({shortDate(ex.last.date)}):{' '}
            {ex.last.sets.map((s, i) => (
              <span key={i}>{i > 0 && ' · '}<bdi dir="ltr">{formatSet(s)}</bdi></span>
            ))}
          </div>
        )}

        <div className="sets">
          <div className="set-row set-head muted">
            <span>סט</span><span>משקל (ק״ג)</span><span>חזרות</span><span />
          </div>
          {ex.sets.map((s, si) => (
            <div key={si} className={`set-row${s.done ? ' done' : ''}`}>
              <span className="muted">{si + 1}</span>
              <input className="input" inputMode="decimal" value={s.weight} placeholder="—" aria-label={`משקל סט ${si + 1}`}
                onChange={e => setSet(si, { weight: e.target.value })} />
              <input className="input" inputMode="numeric" value={s.reps} aria-label={`חזרות סט ${si + 1}`}
                onChange={e => setSet(si, { reps: e.target.value })} />
              <button className={`check${s.done ? ' on' : ''}`} onClick={() => setSet(si, { done: !s.done })}
                aria-label={s.done ? `ביטול סימון סט ${si + 1}` : `סימון סט ${si + 1} כבוצע`} aria-pressed={s.done}>✓</button>
            </div>
          ))}
        </div>
        <div className="plan-actions">
          <button className="btn btn-ghost" onClick={addSet}>+ הוספת סט</button>
          {ex.sets.length > 1 && <button className="btn btn-ghost" onClick={removeSet}>הסרת הסט האחרון</button>}
        </div>
      </div>

      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      <div className="actions">
        <button className="btn" onClick={() => goTo(idx - 1)} disabled={idx === 0}>הקודם</button>
        {idx < total - 1 ? (
          <button className="btn btn-primary" onClick={() => goTo(idx + 1)}>הבא</button>
        ) : (
          <button className="btn btn-primary" onClick={() => setFinishing(true)}>סיום אימון</button>
        )}
      </div>
      {idx < total - 1 && (
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setFinishing(true)}>סיום מוקדם</button>
      )}
    </div>
  );
}
