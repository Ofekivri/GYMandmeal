import { useState } from 'react';
import { EFFORT_LABELS } from './session';
import { withCode } from './errors';

// Finishing an activity workout (Pilates, a class, a run): no sets — just
// effort 1–10, duration and a note. Changes go through onChange so App keeps
// the draft in localStorage like a strength session.
export default function ActivitySession({ session, onChange, onFinish, onDiscard }) {
  const [confirmExit, setConfirmExit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = fields => { setError(''); onChange({ ...session, ...fields }); };

  const save = async () => {
    if (!session.effort) return setError('בחרו מד מאמץ לפני השמירה.');
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
          <div className="effort-grid" role="radiogroup" aria-label="מד מאמץ">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button key={n} type="button" role="radio" aria-checked={session.effort === n}
                className={`effort effort-${n <= 3 ? 'easy' : n <= 6 ? 'mid' : 'hard'}${session.effort === n ? ' on' : ''}`}
                onClick={() => set({ effort: n })}>{n}</button>
            ))}
          </div>
          <div className="muted" style={{ marginTop: 6, minHeight: 20 }}>
            {session.effort ? `${session.effort}/10 · ${EFFORT_LABELS[session.effort]}` : '1 = קל מאוד · 10 = מקסימלי'}
          </div>
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
      </div>

      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      <div className="actions">
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'שומר…' : 'שמירת האימון'}</button>
      </div>
    </div>
  );
}
