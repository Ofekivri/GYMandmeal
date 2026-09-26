import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { firebaseConfigured } from './firebase';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {firebaseConfigured ? <App /> : (
      <div className="center">
        <h1 style={{ margin: 0 }}>האתר עוד לא מוגדר</h1>
        <p className="muted" style={{ margin: 0 }}>חסרות הגדרות Firebase ‏(VITE_FIREBASE_*). מוסיפים אותן ב-Vercel ובונים מחדש (Redeploy).</p>
      </div>
    )}
  </StrictMode>,
);

// Offline app shell (production only; in dev it would cache stale modules).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('[sw] register failed', err));
  });
}
