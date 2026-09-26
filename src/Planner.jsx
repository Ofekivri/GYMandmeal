import { useEffect, useMemo, useState } from 'react';
import { listenPlan, addPlanItem, addPlanItems, updatePlanItem, deletePlanItem } from './data';
import { todayKey, addDays, weekStart, weekDays, fromKey, shortDate, dayLabel, DAY_LETTERS } from './dates';

const MISSED_LOOKBACK_DAYS = 14;

// Week strip planner. Workouts are placed on dates by hand — by the trainee
// or the admin. A past, unfinished workout counts as missed and can be
// moved to today in one tap.
export default function Planner({ uid, editorUid, workouts, onGoToLibrary }) {
  const today = todayKey();
  const [plan, setPlan] = useState(null); // null = loading
  const [viewWeek, setViewWeek] = useState(() => weekStart(today));
  const [selected, setSelected] = useState(today);
  const [picking, setPicking] = useState(false);
  const [movingId, setMovingId] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    setPlan(null);
    setError('');
    return listenPlan(uid, setPlan, err => {
      console.error('[plan] listen failed', err);
      setError('לא הצלחנו לטעון את התכנון. בדקו את החיבור ונסו שוב.');
      setPlan([]);
    });
  }, [uid]);

  const byDate = useMemo(() => {
    const map = {};
    for (const item of plan || []) (map[item.date] ||= []).push(item);
    for (const items of Object.values(map)) items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return map;
  }, [plan]);

  const isMissed = item => !item.doneAt && item.date < today;
  const missed = (plan || [])
    .filter(item => isMissed(item) && item.date >= addDays(today, -MISSED_LOOKBACK_DAYS))
    .sort((a, b) => a.date.localeCompare(b.date));

  const run = async fn => {
    setError('');
    setInfo('');
    try {
      await fn();
    } catch (err) {
      console.error('[plan] write failed', err);
      setError('הפעולה נכשלה. נסו שוב.');
    }
  };

  const goToWeek = start => {
    setViewWeek(start);
    setSelected(start <= today && today <= addDays(start, 6) ? today : start);
    setPicking(false);
    setMovingId(null);
    setInfo('');
  };

  const selectDay = key => { setSelected(key); setPicking(false); setMovingId(null); };

  const place = workout => run(async () => {
    await addPlanItem(uid, { date: selected, workout }, editorUid);
    setPicking(false);
  });

  const moveTo = (item, date) => run(async () => {
    await updatePlanItem(uid, item.id, { date });
    setMovingId(null);
  });

  const copyLastWeek = () => run(async () => {
    const source = weekDays(addDays(viewWeek, -7)).flatMap(d => byDate[d] || []);
    if (source.length === 0) return setInfo('אין אימונים בשבוע הקודם להעתקה.');
    const items = source
      .map(item => ({ date: addDays(item.date, 7), workoutId: item.workoutId, workoutName: item.workoutName }))
      .filter(n => !(byDate[n.date] || []).some(e => e.workoutId === n.workoutId));
    if (items.length === 0) return setInfo('כל האימונים של השבוע הקודם כבר נמצאים בשבוע הזה.');
    await addPlanItems(uid, items, editorUid);
    setInfo(items.length === 1 ? 'הועתק אימון אחד.' : `הועתקו ${items.length} אימונים.`);
  });

  if (plan === null) return <p className="muted">טוען…</p>;

  const days = weekDays(viewWeek);
  const selectedItems = byDate[selected] || [];

  return (
    <div>
      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      {missed.length > 0 && (
        <div className="card missed" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>לא בוצעו</div>
          <div className="list">
            {missed.map(item => (
              <div key={item.id} className="plan-row">
                <div style={{ flex: 1 }}>
                  <div>{item.workoutName}</div>
                  <div className="muted">{dayLabel(item.date)}</div>
                </div>
                <button className="btn" onClick={() => moveTo(item, today)}>העברה להיום</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="week-nav">
        <button className="btn btn-ghost" onClick={() => goToWeek(addDays(viewWeek, -7))} aria-label="שבוע קודם">→</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600 }}>{shortDate(days[0])} – {shortDate(days[6])}</div>
          {viewWeek !== weekStart(today) && (
            <button className="btn btn-ghost" style={{ padding: '0 6px', fontSize: 13 }} onClick={() => goToWeek(weekStart(today))}>חזרה להיום</button>
          )}
        </div>
        <button className="btn btn-ghost" onClick={() => goToWeek(addDays(viewWeek, 7))} aria-label="שבוע הבא">←</button>
      </div>

      <div className="week-strip">
        {days.map(key => {
          const items = byDate[key] || [];
          return (
            <button key={key} onClick={() => selectDay(key)}
              className={`day${key === selected ? ' selected' : ''}${key === today ? ' today' : ''}`}
              aria-label={`${dayLabel(key)}, ${items.length} אימונים`}>
              <span className="day-letter">{DAY_LETTERS[fromKey(key).getDay()]}</span>
              <span className="day-num">{fromKey(key).getDate()}</span>
              <span className="dots">
                {items.slice(0, 3).map(item => (
                  <span key={item.id} className={`dot ${item.doneAt ? 'done' : isMissed(item) ? 'missed' : ''}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>{dayLabel(selected)}</h2>
        <div className="list">
          {selectedItems.length === 0 && !picking && <p className="muted" style={{ margin: 0 }}>אין אימון מתוכנן ליום הזה.</p>}

          {selectedItems.map(item => (
            <div key={item.id} className="card">
              <div className="plan-row">
                <div style={{ flex: 1, fontWeight: 600 }}>{item.workoutName}</div>
                {item.doneAt && <span className="badge done">בוצע</span>}
                {isMissed(item) && <span className="badge missed">לא בוצע</span>}
              </div>
              <div className="plan-actions">
                {item.doneAt ? (
                  !item.logId && <button className="btn btn-ghost" onClick={() => run(() => updatePlanItem(uid, item.id, { doneAt: null }))}>ביטול הסימון</button>
                ) : (
                  <>
                    <button className="btn" onClick={() => run(() => updatePlanItem(uid, item.id, { doneAt: Date.now() }))}>סימון כבוצע</button>
                    {isMissed(item) && <button className="btn" onClick={() => moveTo(item, today)}>העברה להיום</button>}
                    <button className="btn btn-ghost" onClick={() => setMovingId(movingId === item.id ? null : item.id)}>העברה ליום אחר</button>
                  </>
                )}
                <button className="btn btn-ghost" onClick={() => run(() => deletePlanItem(uid, item.id))}>הסרה</button>
              </div>
              {movingId === item.id && (
                <div className="field" style={{ marginTop: 8 }}>
                  <label htmlFor={`move-${item.id}`}>לאיזה יום?</label>
                  <input id={`move-${item.id}`} type="date" className="input" defaultValue={item.date}
                    onChange={e => e.target.value && moveTo(item, e.target.value)} />
                </div>
              )}
            </div>
          ))}

          {picking ? (
            <div className="card">
              <div className="plan-row" style={{ marginBottom: 8 }}>
                <div style={{ flex: 1, fontWeight: 600 }}>איזה אימון?</div>
                <button className="btn btn-ghost" onClick={() => setPicking(false)}>ביטול</button>
              </div>
              {workouts.length === 0 ? (
                <div>
                  <p className="muted" style={{ marginTop: 0 }}>עוד אין אימונים. צרו אימון קודם, ואז שבצו אותו כאן.</p>
                  <button className="btn" onClick={onGoToLibrary}>לרשימת האימונים</button>
                </div>
              ) : (
                <div className="list">
                  {workouts.map(w => (
                    <button key={w.id} className="btn btn-block" style={{ textAlign: 'start' }} onClick={() => place(w)}>
                      {w.name} <span className="muted">· {(w.exercises || []).length} תרגילים</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button className="btn btn-block btn-dashed" onClick={() => setPicking(true)}>+ הוספת אימון ליום הזה</button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-block" onClick={copyLastWeek}>העתקת השבוע הקודם לשבוע הזה</button>
        {info && <div className="info" style={{ marginTop: 8 }}>{info}</div>}
      </div>
    </div>
  );
}
