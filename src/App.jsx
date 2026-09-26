import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { fetchIsAdmin, ensureTrainee, fetchTrainees } from './data';
import Login from './Login';
import WorkoutList from './WorkoutList';
import WorkoutEditor from './WorkoutEditor';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking auth
  const [isAdmin, setIsAdmin] = useState(false);
  const [trainees, setTrainees] = useState([]);
  const [activeUid, setActiveUid] = useState(null); // whose workouts we're looking at
  const [editing, setEditing] = useState(null); // null = list, {} = new, workout = edit
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, async u => {
    setError('');
    setEditing(null);
    if (!u) {
      setUser(null);
      setIsAdmin(false);
      setActiveUid(null);
      return;
    }
    const admin = await fetchIsAdmin(u);
    setIsAdmin(admin);
    if (admin) {
      // The admin manages trainees; their own training lives in the ACL Tracker.
      try {
        const list = await fetchTrainees();
        setTrainees(list);
        setActiveUid(list[0]?.uid || null);
      } catch (err) {
        console.error('[trainees] load failed', err);
        setError('לא הצלחנו לטעון את רשימת המתאמנים.');
      }
    } else {
      try {
        await ensureTrainee(u);
      } catch (err) {
        console.error('[trainee] profile save failed', err);
      }
      setActiveUid(u.uid);
    }
    setUser(u);
  }), []);

  if (user === undefined) return <div className="center muted">טוען…</div>;
  if (!user) return <Login />;

  const firstName = (user.displayName || '').split(' ')[0];
  const active = trainees.find(t => t.uid === activeUid);
  const listTitle = isAdmin ? `האימונים של ${active?.name || ''}` : 'האימונים שלי';

  return (
    <div className="page">
      <div className="header">
        <h1>שלום{firstName ? `, ${firstName}` : ''}</h1>
        <button className="btn btn-ghost" onClick={() => signOut(auth)}>התנתקות</button>
      </div>

      {isAdmin && trainees.length > 0 && (
        <div className="switcher">
          <label htmlFor="trainee" className="muted">מתאמן/ת:</label>
          <select id="trainee" className="input" value={activeUid || ''}
            onChange={e => { setActiveUid(e.target.value); setEditing(null); }}>
            {trainees.map(t => <option key={t.uid} value={t.uid}>{t.name}</option>)}
          </select>
        </div>
      )}

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      {isAdmin && trainees.length === 0 && !error && (
        <div className="card">
          <div style={{ fontWeight: 600 }}>עוד אין מתאמנים</div>
          <div className="muted">שלחו להם את הקישור לאתר. אחרי ההתחברות הראשונה הם יופיעו כאן.</div>
        </div>
      )}

      {activeUid && (editing ? (
        <WorkoutEditor
          key={editing.id || 'new'}
          uid={activeUid}
          editorUid={user.uid}
          workout={editing.id ? editing : null}
          onDone={() => setEditing(null)}
        />
      ) : (
        <WorkoutList
          uid={activeUid}
          title={listTitle}
          onEdit={w => setEditing(w)}
          onNew={() => setEditing({})}
        />
      ))}
    </div>
  );
}
