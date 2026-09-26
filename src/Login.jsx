import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

export default function Login() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const login = async () => {
    setError('');
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('[login]', err);
      if (err.code !== 'auth/popup-closed-by-user') setError('ההתחברות נכשלה. נסו שוב.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center">
      <h1 style={{ margin: 0 }}>האימונים שלי</h1>
      <p className="muted" style={{ margin: 0 }}>תכנון ומעקב אימונים</p>
      <button className="btn btn-primary" onClick={login} disabled={busy}>
        {busy ? 'מתחבר…' : 'התחברות עם Google'}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
