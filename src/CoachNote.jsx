import { useState } from 'react';
import { saveCoachNote } from './data';
import { withCode } from './errors';

// The admin's note on a finished workout, as the trainee reads it in
// History. showSeen: the admin's view, which also says whether it was read.
export function CoachNoteView({ log, showSeen }) {
  if (!log.coachNote) return null;
  const seen = (log.coachNoteSeenAt || 0) >= (log.coachNoteAt || 0);
  return (
    <div className="coach-note">
      <div className="coach-note-head">
        💬 {log.coachName || 'המאמן'}
        {showSeen && <span className="muted"> · {seen ? 'נקראה ✓' : 'עוד לא נקראה'}</span>}
      </div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{log.coachNote}</div>
    </div>
  );
}

// The admin writes or changes the note. Saving it empty removes it.
export function CoachNoteForm({ uid, log, coachName, onDone }) {
  const [text, setText] = useState(log.coachNote || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await saveCoachNote(uid, log.id, text.trim(), coachName);
      onDone();
    } catch (err) {
      console.error('[coach] save failed', err);
      setError(withCode('השמירה נכשלה. נסו שוב.', err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="meal-form" style={{ marginTop: 10 }}>
      <label htmlFor={`coach-note-${log.id}`} className="muted">הערה למתאמן/ת על האימון</label>
      <textarea id={`coach-note-${log.id}`} className="input" rows={3} value={text} autoFocus
        placeholder="כל הכבוד! בפעם הבאה ננסה להוסיף 2.5 ק״ג" onChange={e => setText(e.target.value)} />
      <div className="plan-actions" style={{ marginTop: 0 }}>
        <button type="submit" className="btn btn-primary btn-small" disabled={busy}>{busy ? 'שומר…' : 'שמירה'}</button>
        <button type="button" className="btn btn-ghost btn-small" onClick={onDone} disabled={busy}>ביטול</button>
      </div>
      {log.coachNote && <div className="muted" style={{ fontSize: 13 }}>כדי למחוק את ההערה, רוקנו את הטקסט ושמרו.</div>}
      {error && <div className="error">{error}</div>}
    </form>
  );
}
