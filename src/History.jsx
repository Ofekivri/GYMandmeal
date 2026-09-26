import { useMemo, useState } from 'react';
import { deleteLog, markCoachNoteSeen } from './data';
import { dayLabel } from './dates';
import { durationMinutes, formatSet, isActivity, hasNewCoachNote, EFFORT_LABELS } from './session';
import { recordsByLog } from './records';
import { setsCount } from './hebrew';
import { withCode } from './errors';
import LogEditor from './LogEditor';
import Progress from './Progress';
import { CoachNoteView, CoachNoteForm } from './CoachNote';

// Finished workouts, newest first. Tap to see every set (personal records
// marked 🏆), edit it, or delete it. The admin can leave a note on a
// trainee's workout; the trainee sees it here, flagged until opened.
// isOwner: the trainee is looking at their own history.
// canCoach: the admin is looking at someone else's.
export default function History({ uid, editorUid, logs, error, isOwner, canCoach, coachName, knownNames }) {
  const [view, setView] = useState('logs'); // logs | exercises
  const [openId, setOpenId] = useState(null);
  const [mode, setMode] = useState(null); // the open log: null | 'edit' | 'note'
  const [confirmId, setConfirmId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const records = useMemo(() => recordsByLog(logs || []), [logs]);

  const toggle = log => {
    const opening = openId !== log.id;
    setOpenId(opening ? log.id : null);
    setMode(null);
    setConfirmId(null);
    if (opening && isOwner && hasNewCoachNote(log)) {
      markCoachNoteSeen(uid, log.id).catch(err => console.warn('[coach] mark seen failed', err));
    }
  };

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

      {logs.length > 0 && (
        <div className="chips" role="tablist" aria-label="תצוגה" style={{ marginBottom: 12 }}>
          {[{ id: 'logs', label: 'אימונים' }, { id: 'exercises', label: 'התקדמות לפי תרגיל' }].map(v => (
            <button key={v.id} type="button" role="tab" aria-selected={view === v.id}
              className={`chip${view === v.id ? ' on' : ''}`} onClick={() => setView(v.id)}>{v.label}</button>
          ))}
        </div>
      )}

      {view === 'exercises' && logs.length > 0 ? <Progress logs={logs} /> : (
      <div className="list">
        {logs.map(log => {
          const sets = (log.exercises || []).reduce((n, e) => n + e.sets.length, 0);
          const activity = isActivity(log);
          // Activities log their own duration; strength uses start → finish
          // (none when it was logged for a past day).
          const minutes = activity ? log.durationMin : log.startedAt ? durationMinutes(log.startedAt, log.finishedAt) : null;
          const open = openId === log.id;
          const logRecords = records.get(log.id);
          const newNote = isOwner && hasNewCoachNote(log);
          return (
            <div key={log.id} className="card">
              <button className="workout-row" style={{ background: 'none', border: 'none', padding: 0 }}
                onClick={() => toggle(log)} aria-expanded={open}>
                <div style={{ flex: 1 }}>
                  <div className="title">
                    {log.workoutName}
                    {logRecords && <span title="שיא חדש" aria-label="שיא חדש"> 🏆</span>}
                    {log.coachNote && !newNote && <span title="יש הערה" aria-label="יש הערה"> 💬</span>}
                  </div>
                  <div className="muted">
                    {dayLabel(log.date)} · {activity ? `מאמץ ${log.effort}/10` : setsCount(sets)}{minutes != null && minutes < 300 ? ` · ${minutes} דק׳` : ''}
                  </div>
                </div>
                {newNote && <span className="badge new">הערה חדשה</span>}
                <span className="muted" aria-hidden="true">{open ? '▴' : '▾'}</span>
              </button>
              {open && mode === 'edit' && (
                <LogEditor uid={uid} editorUid={editorUid} log={log} knownNames={knownNames} onDone={() => setMode(null)} />
              )}
              {open && mode !== 'edit' && (
                <div style={{ marginTop: 10 }}>
                  {activity && <div className="history-ex">מד מאמץ: {log.effort}/10 · {EFFORT_LABELS[log.effort]}</div>}
                  {(log.exercises || []).map((e, i) => (
                    <div key={i} className="history-ex">
                      <div style={{ fontWeight: 500 }}>{e.name}</div>
                      <div className="muted">
                        {e.sets.map((s, k) => {
                          const record = logRecords?.get(i) === k;
                          return (
                            <span key={k}>{k > 0 && ' · '}
                              {record
                                ? <span className="pr-set">🏆 <bdi dir="ltr">{formatSet(s)}</bdi></span>
                                : <bdi dir="ltr">{formatSet(s)}</bdi>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {log.note && <div className="muted" style={{ marginTop: 8 }}>הערה: {log.note}</div>}
                  <CoachNoteView log={log} showSeen={canCoach} />
                  {mode === 'note' && (
                    <CoachNoteForm uid={uid} log={log} coachName={coachName} onDone={() => setMode(null)} />
                  )}
                  {mode !== 'note' && (
                    <div className="plan-actions">
                      {canCoach && (
                        <button className="btn btn-small" onClick={() => { setMode('note'); setConfirmId(null); }}>
                          {log.coachNote ? 'עריכת ההערה' : '💬 הערה למתאמן/ת'}
                        </button>
                      )}
                      <button className="btn btn-ghost" onClick={() => { setMode('edit'); setConfirmId(null); }}>עריכה</button>
                      <button className={`btn ${confirmId === log.id ? 'btn-danger' : 'btn-ghost'}`} onClick={() => remove(log)}>
                        {confirmId === log.id ? 'לחצו שוב כדי למחוק' : 'מחיקה'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
