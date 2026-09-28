import { useEffect, useState } from 'react';
import { fetchMealPhoto, cachedMealPhoto } from './data';

// Loads a meal's photo once it's on screen. Callers key the component by
// photoId, so a replaced photo starts fresh.
function useMealPhoto(uid, photoId) {
  const [src, setSrc] = useState(() => cachedMealPhoto(photoId));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (src) return undefined;
    let live = true;
    fetchMealPhoto(uid, photoId)
      .then(found => {
        if (!live) return;
        setSrc(found);
        setFailed(!found);
      })
      .catch(err => {
        console.warn('[meals] photo load failed', err);
        if (live) setFailed(true);
      });
    return () => { live = false; };
  }, [uid, photoId, src, attempt]);

  return { src, failed, retry: () => { setFailed(false); setAttempt(a => a + 1); } };
}

// A meal's photo in the day view. Tap to see it full size.
export default function MealPhoto({ uid, photoId, alt, onOpen }) {
  const { src, failed, retry } = useMealPhoto(uid, photoId);
  if (failed) {
    return <button type="button" className="btn btn-ghost btn-small" onClick={retry}>התמונה לא נטענה. נסו שוב</button>;
  }
  return (
    <button type="button" className="meal-photo" onClick={onOpen} disabled={!src} aria-label={`הגדלת התמונה: ${alt}`}>
      {src ? <img src={src} alt={alt} /> : <span className="meal-photo-loading" />}
    </button>
  );
}

// The photo full size over the page, with the caller's actions as children.
export function PhotoViewer({ uid, photoId, alt, onClose, children }) {
  const { src, failed } = useMealPhoto(uid, photoId);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={alt}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {src ? <img src={src} alt={alt} /> : <div>{failed ? 'התמונה לא נטענה.' : 'טוען…'}</div>}
      <div className="plan-actions">
        {children}
        <button type="button" className="btn" onClick={onClose} autoFocus>סגירה</button>
      </div>
    </div>
  );
}
