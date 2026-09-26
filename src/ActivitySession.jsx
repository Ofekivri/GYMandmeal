import { useState } from 'react';
import { EFFORT_LABELS } from './session';
import { todayKey } from './dates';
import { withCode } from './errors';

// Effort 1–10 as a grid of buttons, with the chosen level's words below.
// Also used when editing a finished activity in History.
export function EffortPicker({ value, onChange }) {
  return (
    <div>
      <div className="effort-grid" role="radiogroup" aria-label="מד מאמץ">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button key={n} type="button" role="radio" aria-checked={value === n}
            className={`effort effort-${n <= 3 ? 'easy' : n <= 6 ? 'mid' : 'hard'}${value === n ? ' on' : ''}`}
            onClick={() => onChange(n)}>{n}</button>
        ))}
      </div>
      <div className="muted" style={{ marginTop: 6, minHeight: 20 }}>
        {value ? `${value}/10 · ${EFFORT_LABELS[value]}` : '1 = קל מאוד · 10 = מקסימלי'}
      </div>
    </div>
  );
}

// Finishing an activity workout (Pilates, a class, a run): no sets — just
// effort 1–10, duration and a note. Changes go through onChange so App keeps
// the draft in localStorage like a strength session.
export default function ActivitySession({ session, onChange, onFinish, onDiscard }) {
  const [confirmExit, setConfirmExit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const today = todayKey();
  const set = fields => { setError(''); onChange({ ...session, ...fields }); };

  const save = async () => {
    if (!session.effort) return setError('בחרו מד מאמץ לפני השמירה.');
    if (session.date > today) return setError('אי אפשר לרשום אימון בתאריך עתידי.');
    setBusy(true);
    try {
      await onFinish();
    } catch (err) {
      console.error('[activity] save failed', err);
      setError(withCode('השמירה נכשלה. הנתונים עדיין שמורים במכשיר, נסו שוב.', err));
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="header">
        <h2 style={{ fontSize: 18, margin: 0 }}>{session.workoutName}</h2>
        <button className={`btn ${confirmExit ? 'btn-danger' : 'btn-ghost'}`}
          onClick={() => (confirmExit ? onDiscard() : setConfirmExit(true))}>
          {confirmExit ? 'לצאת בלי לשמור?' : 'יציאה'}
        </button>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>מד מאמץ: כמה קשה היה?</div>
          <EffortPicker value={session.effort} onChange={effort => set({ effort })} />
        </div>

        <div className="field">
          <label htmlFor="activity-minutes">משך (דקות)</label>
          <input id="activity-minutes" className="input" inputMode="numeric" value={session.durationMin} placeholder="50"
            onChange={e => set({ durationMin: e.target.value })} />
        </div>

        <div className="field">
          <label htmlFor="activity-session-note">הערה (לא חובה)</label>
          <textarea id="activity-session-note" className="input" rows={2} value={session.note}
            placeholder="מה עשינו, איך הרגיש" onChange={e => set({ note: e.target.value })} />
        </div>

        <div className="field">
          <label htmlFor="activity-date">תאריך האימון</label>
          <input id="activity-date" type="date" className="input" max={today} value={session.date || today}
            onChange={e => set({ date: e.target.value && e.target.value !== today ? e.target.value : null })} />
        </div>
      </div>

      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      <div className="actions">
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'שומר…' : 'שמירת האימון'}</button>
      </div>
    </div>
  );
}
