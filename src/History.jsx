import { useState } from 'react';
import { deleteLog } from './data';
import { dayLabel } from './dates';
import { durationMinutes, formatSet } from './session';
import { setsCount } from './hebrew';
import { withCode } from './errors';

// Finished workouts, newest first. Tap to see every set.
export default function History({ uid, logs, error }) {
  const [openId, setOpenId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const remove = async log => {
    if (confirmId !== log.id) return setConfirmId(log.id);
    setDeleteError('');
    try {
      await deleteLog(uid, log);
      setOpenId(null);
    } catch (err) {
      console.error('[history] delete failed', err);
      setDeleteError(withCode('המחיקה נכשלה. נסו שוב.', err));
    }
    setConfirmId(null);
  };

  if (logs === null) return <p className="muted">טוען…</p>;

  return (
    <div>
      {(error || deleteError) && <div className="error" style={{ marginBottom: 12 }}>{error || deleteError}</div>}
      {logs.length === 0 && !error && (
        <div className="card">
          <div style={{ fontWeight: 600 }}>עוד אין אימונים שבוצעו</div>
          <div className="muted">כשתסיימו אימון, הוא יופיע כאן עם כל הסטים.</div>
        </div>
      )}
      <div className="list">
        {logs.map(log => {
          const sets = (log.exercises || []).reduce((n, e) => n + e.sets.length, 0);
          const minutes = log.startedAt ? durationMinutes(log.startedAt, log.finishedAt) : null;
          const open = openId === log.id;
          return (
            <div key={log.id} className="card">
              <button className="workout-row" style={{ background: 'none', border: 'none', padding: 0 }}
                onClick={() => { setOpenId(open ? null : log.id); setConfirmId(null); }} aria-expanded={open}>
                <div style={{ flex: 1 }}>
                  <div className="title">{log.workoutName}</div>
                  <div className="muted">
                    {dayLabel(log.date)} · {setsCount(sets)}{minutes != null && minutes < 300 ? ` · ${minutes} דק׳` : ''}
                  </div>
                </div>
                <span className="muted" aria-hidden="true">{open ? '▴' : '▾'}</span>
              </button>
              {open && (
                <div style={{ marginTop: 10 }}>
                  {(log.exercises || []).map((e, i) => (
                    <div key={i} className="history-ex">
                      <div style={{ fontWeight: 500 }}>{e.name}</div>
                      <div className="muted">
                        {e.sets.map((s, k) => <span key={k}>{k > 0 && ' · '}<bdi dir="ltr">{formatSet(s)}</bdi></span>)}
                      </div>
                    </div>
                  ))}
                  {log.note && <div className="muted" style={{ marginTop: 8 }}>הערה: {log.note}</div>}
                  <div className="plan-actions">
                    <button className={`btn ${confirmId === log.id ? 'btn-danger' : 'btn-ghost'}`} onClick={() => remove(log)}>
                      {confirmId === log.id ? 'לחצו שוב כדי למחוק' : 'מחיקת האימון מההיסטוריה'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
