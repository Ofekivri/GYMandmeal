import { useRef, useState } from 'react';
import { addMeal, addMeals, updateMeal, deleteMeal, setMealPhoto, removeMealPhoto } from './data';
import { MEAL_SLOTS, slotLabel, nextSlot, sameMeal } from './meals';
import { dayLabel } from './dates';
import { mealsCount } from './hebrew';
import { shrinkPhoto } from './photo';
import MealPhoto, { PhotoViewer } from './MealPhoto';
import { withCode } from './errors';

// Offline, a write resolves only once it reaches the server, but the change
// already shows from the on-device cache. Stop waiting after this long.
const OFFLINE_WAIT_MS = 4000;

// The nutrition half of the day view: free-text meals by slot, each with an
// optional photo. Anyone who can see the day (trainee or admin) can plan,
// edit and check meals off. "אכלתי משהו אחר" records what was actually eaten
// next to the plan. A photo of a meal from today or earlier means it was
// eaten, so it marks the meal eaten, and it can stand in for the text.
export default function DayMeals({ uid, editorUid, date, today, meals, mealsByDate, suggestions }) {
  const [adding, setAdding] = useState(false);
  const [slot, setSlot] = useState('breakfast');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null); // the new meal's photo, from shrinkPhoto
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editSlot, setEditSlot] = useState('breakfast');
  const [differentId, setDifferentId] = useState(null);
  const [actual, setActual] = useState('');
  const [copying, setCopying] = useState(false);
  const [viewingId, setViewingId] = useState(null); // the meal whose photo is open full size
  const [photoFor, setPhotoFor] = useState(null); // 'new' | meal id, while a picked photo is processed
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const fileInput = useRef(null);
  const pickFor = useRef(null);

  const pastOrToday = date <= today;
  const viewing = meals.find(m => m.id === viewingId && m.photoId);

  const run = async fn => {
    setError('');
    setInfo('');
    try {
      await fn();
    } catch (err) {
      console.error('[meals] write failed', err);
      setError(withCode('הפעולה נכשלה. נסו שוב.', err));
    }
  };

  const settle = write => {
    write.catch(err => console.error('[meals] write failed', err));
    return Promise.race([write, new Promise(resolve => setTimeout(resolve, OFFLINE_WAIT_MS))]);
  };

  const closeForms = () => { setAdding(false); setEditingId(null); setDifferentId(null); setCopying(false); };

  const openAdd = () => { closeForms(); setSlot(nextSlot(meals)); setText(''); setPhoto(null); setAdding(true); };

  const add = eaten => {
    if (!text.trim() && !photo) return setError('כתבו מה בארוחה, או הוסיפו תמונה.');
    run(async () => {
      setSaving(true);
      try {
        await settle(addMeal(uid, { date, slot, text: text.trim(), eaten, photo }, editorUid));
        setText('');
        setPhoto(null);
        setAdding(false);
      } finally {
        setSaving(false);
      }
    });
  };

  // One file input serves the new meal and every meal on the day. It's
  // visually hidden rather than display: none, which some phone browsers
  // won't open from a script.
  const pickPhoto = target => {
    pickFor.current = target;
    fileInput.current.click();
  };

  const onPhotoPicked = async e => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so picking the same file again still counts
    const target = pickFor.current;
    if (!file) return;
    setError('');
    setInfo('');
    setPhotoFor(target);
    try {
      const shrunk = await shrinkPhoto(file);
      const meal = target !== 'new' && meals.find(m => m.id === target);
      if (target === 'new') setPhoto(shrunk);
      else if (meal) await settle(setMealPhoto(uid, meal, { photo: shrunk, eaten: pastOrToday }, editorUid));
    } catch (err) {
      console.error('[meals] photo failed', err);
      setError(withCode('לא הצלחנו להוסיף את התמונה. נסו שוב, או בחרו תמונה אחרת.', err));
    }
    setPhotoFor(null);
    if (target !== 'new') setViewingId(null);
  };

  const removePhoto = meal => run(async () => {
    await settle(removeMealPhoto(uid, meal));
    setViewingId(null);
  });

  const openEdit = meal => { closeForms(); setEditingId(meal.id); setEditText(meal.text); setEditSlot(meal.slot); };

  const saveEdit = e => {
    e.preventDefault();
    const meal = meals.find(m => m.id === editingId);
    if (!editText.trim() && !meal?.photoId) return setError('כתבו מה בארוחה.');
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

  // Copies the text only: a photo shows what was eaten on its own day, and
  // a meal that is only a photo has nothing to plan from.
  const planned = meals.filter(m => m.text);
  const copyTo = target => run(async () => {
    if (!target) return;
    const copies = planned
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

  // With a photo of today's (or an earlier) meal, adding it means it was eaten.
  const photoEaten = !!photo && pastOrToday;

  return (
    <div className="list">
      <datalist id="meal-suggestions">
        {suggestions.map(t => <option key={t} value={t} />)}
      </datalist>
      <input ref={fileInput} type="file" accept="image/*" className="file-input" tabIndex={-1} aria-hidden="true"
        onChange={onPhotoPicked} />

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
                    {m.text && <div className={m.actual ? 'meal-text planned' : 'meal-text'}>{m.text}</div>}
                    {m.actual && <div className="meal-text">בפועל: {m.actual}</div>}
                  </>
                )}

                {m.photoId && (
                  <MealPhoto key={m.photoId} uid={uid} photoId={m.photoId} alt={m.text || slotLabel(m.slot)}
                    onOpen={() => setViewingId(m.id)} />
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
                    {!m.photoId && (
                      <button className="btn btn-ghost btn-small" onClick={() => pickPhoto(m.id)} disabled={!!photoFor}>
                        {photoFor === m.id ? 'מעבד תמונה…' : '📷 תמונה'}
                      </button>
                    )}
                    <button className="btn btn-ghost btn-small" onClick={() => run(() => deleteMeal(uid, m))}>הסרה</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <form className="card meal-form" onSubmit={e => { e.preventDefault(); add(photoEaten); }}>
          <div className="plan-row">
            <div style={{ flex: 1, fontWeight: 600 }}>ארוחה חדשה</div>
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>ביטול</button>
          </div>
          {slotPicker(slot, setSlot)}
          <input className="input" list="meal-suggestions" value={text} placeholder={photo ? 'מה בארוחה (לא חובה)' : '2 ביצים, טוסט, קוטג׳'}
            aria-label="מה בארוחה" onChange={e => setText(e.target.value)} autoFocus />
          {photo ? (
            <div className="plan-row">
              <img className="photo-preview" src={photo.src} alt="התמונה שנבחרה" />
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setPhoto(null)}>הסרת התמונה</button>
            </div>
          ) : (
            <button type="button" className="btn btn-dashed" onClick={() => pickPhoto('new')} disabled={!!photoFor}>
              {photoFor === 'new' ? 'מעבד תמונה…' : '📷 הוספת תמונה'}
            </button>
          )}
          <div className="actions" style={{ marginTop: 0 }}>
            {!photoEaten && <button type="submit" className="btn btn-primary" disabled={saving}>הוספה</button>}
            {pastOrToday && (
              <button type={photoEaten ? 'submit' : 'button'} className={`btn${photoEaten ? ' btn-primary' : ''}`} disabled={saving}
                onClick={photoEaten ? undefined : () => add(true)}>הוספה + אכלתי</button>
            )}
          </div>
        </form>
      ) : (
        <button className="btn btn-block btn-dashed" onClick={openAdd}>+ הוספת ארוחה</button>
      )}

      {planned.length > 0 && !adding && (
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

      {viewing && (
        <PhotoViewer key={viewing.photoId} uid={uid} photoId={viewing.photoId} alt={viewing.text || slotLabel(viewing.slot)}
          onClose={() => setViewingId(null)}>
          <button type="button" className="btn" onClick={() => pickPhoto(viewing.id)} disabled={!!photoFor}>
            {photoFor === viewing.id ? 'מעבד תמונה…' : 'החלפת התמונה'}
          </button>
          {viewing.text && <button type="button" className="btn" onClick={() => removePhoto(viewing)}>הסרת התמונה</button>}
        </PhotoViewer>
      )}
    </div>
  );
}
