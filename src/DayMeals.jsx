import { useState } from 'react';
import { addMeal, addMeals, updateMeal, deleteMeal } from './data';
import { MEAL_SLOTS, slotLabel, nextSlot, sameMeal } from './meals';
import { dayLabel } from './dates';
import { mealsCount } from './hebrew';

// The nutrition half of the day view: free-text meals by slot. Anyone who
// can see the day (trainee or admin) can plan, edit and check meals off.
// "אכלתי משהו אחר" records what was actually eaten next to the plan.
export default function DayMeals({ uid, editorUid, date, today, meals, mealsByDate, suggestions }) {
  const [adding, setAdding] = useState(false);
  const [slot, setSlot] = useState('breakfast');
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editSlot, setEditSlot] = useState('breakfast');
  const [differentId, setDifferentId] = useState(null);
  const [actual, setActual] = useState('');
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const run = async fn => {
    setError('');
    setInfo('');
    try {
      await fn();
    } catch (err) {
      console.error('[meals] write failed', err);
      setError('הפעולה נכשלה. נסו שוב.');
    }
  };

  const closeForms = () => { setAdding(false); setEditingId(null); setDifferentId(null); setCopying(false); };

  const openAdd = () => { closeForms(); setSlot(nextSlot(meals)); setText(''); setAdding(true); };

  const add = e => {
    e.preventDefault();
    if (!text.trim()) return setError('כתבו מה בארוחה.');
    run(async () => {
      await addMeal(uid, { date, slot, text: text.trim() }, editorUid);
      setText('');
      setAdding(false);
    });
  };

  const openEdit = meal => { closeForms(); setEditingId(meal.id); setEditText(meal.text); setEditSlot(meal.slot); };

  const saveEdit = e => {
    e.preventDefault();
    if (!editText.trim()) return setError('כתבו מה בארוחה.');
    run(async () => {
      await updateMeal(uid, editingId, { text: editText.trim(), slot: editSlot });
      setEditingId(null);
    });
  };

  const openDifferent = meal => { closeForms(); setDifferentId(meal.id); setActual(meal.actual || ''); };

  const saveDifferent = e => {
    e.preventDefault();
    if (!actual.trim()) return setError('כתבו מה אכלתם בפועל.');
    run(async () => {
      await updateMeal(uid, differentId, { eatenAt: Date.now(), actual: actual.trim() });
      setDifferentId(null);
    });
  };

  const copyTo = target => run(async () => {
    if (!target) return;
    const copies = meals
      .map(m => ({ date: target, slot: m.slot, text: m.text }))
      .filter(n => !(mealsByDate[target] || []).some(e => sameMeal(e, n)));
    setCopying(false);
    if (copies.length === 0) return setInfo(`כל הארוחות כבר נמצאות ב${dayLabel(target)}.`);
    await addMeals(uid, copies, editorUid);
    setInfo(`הועתקו ל${dayLabel(target)}: ${mealsCount(copies.length)}.`);
  });

  const slotPicker = (value, onPick) => (
    <div className="chips" role="radiogroup" aria-label="סוג הארוחה">
      {MEAL_SLOTS.map(s => (
        <button key={s.id} type="button" role="radio" aria-checked={value === s.id}
          className={`chip${value === s.id ? ' on' : ''}`} onClick={() => onPick(s.id)}>{s.label}</button>
      ))}
    </div>
  );

  return (
    <div className="list">
      <datalist id="meal-suggestions">
        {suggestions.map(t => <option key={t} value={t} />)}
      </datalist>

      {meals.length === 0 && !adding && <p className="muted" style={{ margin: 0 }}>אין ארוחות מתוכננות ליום הזה.</p>}

      {meals.length > 0 && (
        <div className="card meals">
          {meals.map(m => {
            const eaten = !!m.eatenAt;
            const unmarked = !eaten && date < today;
            return (
              <div key={m.id} className="meal">
                <div className="plan-row">
                  <span className="muted" style={{ flex: 1, fontSize: 13 }}>{slotLabel(m.slot)}</span>
                  {eaten && !m.actual && <span className="badge done">נאכל</span>}
                  {eaten && m.actual && <span className="badge different">אכלתי אחרת</span>}
                  {unmarked && <span className="muted" style={{ fontSize: 12 }}>לא סומן</span>}
                </div>

                {editingId === m.id ? (
                  <form onSubmit={saveEdit} className="meal-form">
                    {slotPicker(editSlot, setEditSlot)}
                    <input className="input" list="meal-suggestions" value={editText} aria-label="מה בארוחה"
                      onChange={e => setEditText(e.target.value)} autoFocus />
                    <div className="plan-actions" style={{ marginTop: 0 }}>
                      <button type="submit" className="btn btn-primary btn-small">שמירה</button>
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditingId(null)}>ביטול</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className={m.actual ? 'meal-text planned' : 'meal-text'}>{m.text}</div>
                    {m.actual && <div className="meal-text">בפועל: {m.actual}</div>}
                  </>
                )}

                {differentId === m.id && (
                  <form onSubmit={saveDifferent} className="meal-form">
                    <input className="input" value={actual} placeholder="מה אכלתם בפועל?" aria-label="מה אכלתם בפועל"
                      onChange={e => setActual(e.target.value)} autoFocus />
                    <div className="plan-actions" style={{ marginTop: 0 }}>
                      <button type="submit" className="btn btn-primary btn-small">שמירה</button>
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => setDifferentId(null)}>ביטול</button>
                    </div>
                  </form>
                )}

                {editingId !== m.id && differentId !== m.id && (
                  <div className="plan-actions">
                    {eaten ? (
                      <button className="btn btn-ghost btn-small" onClick={() => run(() => updateMeal(uid, m.id, { eatenAt: null, actual: '' }))}>ביטול הסימון</button>
                    ) : (
                      <>
                        <button className="btn btn-small" onClick={() => run(() => updateMeal(uid, m.id, { eatenAt: Date.now(), actual: '' }))}>אכלתי</button>
                        <button className="btn btn-ghost btn-small" onClick={() => openDifferent(m)}>אכלתי משהו אחר</button>
                        <button className="btn btn-ghost btn-small" onClick={() => openEdit(m)}>עריכה</button>
                      </>
                    )}
                    <button className="btn btn-ghost btn-small" onClick={() => run(() => deleteMeal(uid, m.id))}>הסרה</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <form className="card meal-form" onSubmit={add}>
          <div className="plan-row">
            <div style={{ flex: 1, fontWeight: 600 }}>ארוחה חדשה</div>
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>ביטול</button>
          </div>
          {slotPicker(slot, setSlot)}
          <input className="input" list="meal-suggestions" value={text} placeholder="2 ביצים, טוסט, קוטג׳"
            aria-label="מה בארוחה" onChange={e => setText(e.target.value)} autoFocus />
          <button type="submit" className="btn btn-primary">הוספה</button>
        </form>
      ) : (
        <button className="btn btn-block btn-dashed" onClick={openAdd}>+ הוספת ארוחה</button>
      )}

      {meals.length > 0 && !adding && (
        copying ? (
          <div className="field">
            <label htmlFor={`copy-meals-${date}`}>לאיזה יום להעתיק את הארוחות?</label>
            <input id={`copy-meals-${date}`} type="date" className="input" onChange={e => copyTo(e.target.value)} />
          </div>
        ) : (
          <button className="btn btn-ghost btn-block" onClick={() => { closeForms(); setCopying(true); }}>העתקת הארוחות ליום אחר</button>
        )
      )}

      {error && <div className="error">{error}</div>}
      {info && <div className="info">{info}</div>}
    </div>
  );
}
