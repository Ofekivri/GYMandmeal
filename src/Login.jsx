import { useState } from 'react';
import {
  signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { ensureTrainee } from './data';
import { withCode, BUILD_ID } from './errors';

const AUTH_ERRORS = {
  'auth/invalid-credential': 'האימייל או הסיסמה שגויים.',
  'auth/wrong-password': 'האימייל או הסיסמה שגויים.',
  'auth/user-not-found': 'האימייל או הסיסמה שגויים.',
  'auth/invalid-email': 'כתובת האימייל לא תקינה.',
  'auth/missing-password': 'הזינו סיסמה.',
  'auth/email-already-in-use': 'כבר יש חשבון עם האימייל הזה. נסו להתחבר.',
  'auth/weak-password': 'הסיסמה צריכה להיות לפחות 6 תווים.',
  'auth/too-many-requests': 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
  'auth/operation-not-allowed': 'התחברות עם אימייל לא מופעלת כרגע.',
  'auth/network-request-failed': 'אין חיבור לאינטרנט.',
  'auth/unauthorized-domain': 'הכתובת של האתר לא מאושרת להתחברות ב-Firebase (Authorized domains).',
  'auth/popup-blocked': 'הדפדפן חסם את חלון ההתחברות. אפשרו חלונות קופצים לאתר ונסו שוב.',
};
const authError = err => AUTH_ERRORS[err.code] || withCode('ההתחברות נכשלה. נסו שוב.', err);

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const switchMode = next => { setMode(next); setError(''); setInfo(''); };

  const run = async fn => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error('[login]', err.code, err);
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') setError(authError(err));
    } finally {
      setBusy(false);
    }
  };

  const google = () => run(() => signInWithPopup(auth, googleProvider));

  const submit = e => {
    e.preventDefault();
    if (mode === 'reset') {
      return run(async () => {
        await sendPasswordResetEmail(auth, email.trim());
        setInfo('אם יש חשבון עם האימייל הזה, שלחנו אליו קישור לאיפוס הסיסמה.');
      });
    }
    if (mode === 'signup') {
      if (!name.trim()) return setError('הזינו את השם שלכם.');
      return run(async () => {
        const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(user, { displayName: name.trim() });
        // App's auth listener may have written the profile before the name
        // was set; write it again so the admin sees a real name.
        await ensureTrainee(user);
      });
    }
    return run(() => signInWithEmailAndPassword(auth, email.trim(), password));
  };

  return (
    <div className="center">
      <h1 style={{ margin: 0 }}>האימונים שלי</h1>
      <p className="muted" style={{ margin: 0 }}>תכנון ומעקב אימונים</p>

      <div className="card" style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mode !== 'reset' && (
          <>
            <button className="btn btn-block" onClick={google} disabled={busy}>התחברות עם Google</button>
            <div className="divider"><span>או</span></div>
          </>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'start' }}>
          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="name">שם</label>
              <input id="name" className="input" value={name} autoComplete="name"
                onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">אימייל</label>
            <input id="email" className="input" type="email" dir="ltr" value={email} autoComplete="email"
              placeholder="name@gmail.com" onChange={e => setEmail(e.target.value)} />
          </div>
          {mode !== 'reset' && (
            <div className="field">
              <label htmlFor="password">סיסמה</label>
              <input id="password" className="input" type="password" dir="ltr" value={password}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder={mode === 'signup' ? 'לפחות 6 תווים' : ''}
                onChange={e => setPassword(e.target.value)} />
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'רגע…' : mode === 'signup' ? 'יצירת חשבון' : mode === 'reset' ? 'שליחת קישור לאיפוס' : 'התחברות'}
          </button>
        </form>

        {error && <div className="error">{error}</div>}
        {info && <div className="info">{info}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          {mode === 'login' && <>
            <button className="btn btn-ghost" onClick={() => switchMode('signup')}>אין לכם חשבון? הרשמה</button>
            <button className="btn btn-ghost" onClick={() => switchMode('reset')}>שכחתי סיסמה</button>
          </>}
          {mode !== 'login' && (
            <button className="btn btn-ghost" onClick={() => switchMode('login')}>חזרה להתחברות</button>
          )}
        </div>
      </div>
      <div className="muted" style={{ fontSize: 11 }} dir="ltr">v {BUILD_ID}</div>
    </div>
  );
}
