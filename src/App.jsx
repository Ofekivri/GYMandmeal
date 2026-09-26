import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { fetchIsAdmin, ensureTrainee, listenTrainees, listenWorkouts, listenLogs, finishSession } from './data';
import { buildSession, sessionToLog, loadSession, storeSession, knownExerciseNames } from './session';
import Login from './Login';
import Planner from './Planner';
import WorkoutList from './WorkoutList';
import WorkoutEditor from './WorkoutEditor';
import WorkoutSession from './WorkoutSession';
import History from './History';
import Overview from './Overview';
import { withCode } from './errors';

// With no signal the save stays queued in Firestore's on-device cache; stop
// waiting for the server after this long and let the trainee move on.
const OFFLINE_SAVE_WAIT_MS = 5000;

const ADMIN_TABS = [{ id: 'overview', label: 'סקירה' }];
const TABS = [
  { id: 'plan', label: 'תכנון' },
  { id: 'workouts', label: 'אימונים' },
  { id: 'history', label: 'היסטוריה' },
];

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking auth
  const [isAdmin, setIsAdmin] = useState(false);
  const [trainees, setTrainees] = useState(null); // admin only; null = loading
  const [activeUid, setActiveUid] = useState(null); // whose workouts we're looking at
  const [tab, setTab] = useState('plan');
  const [editing, setEditing] = useState(null); // null = list, {} = new, workout = edit
  const [workouts, setWorkouts] = useState(null); // null = loading
  const [workoutsError, setWorkoutsError] = useState('');
  const [logs, setLogs] = useState(null); // null = loading, newest first
  const [logsError, setLogsError] = useState('');
  const [session, setSession] = useState(null); // workout in progress
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Shared listeners for the active trainee: workouts feed the planner picker
  // and the library; logs feed history and the "last time" numbers.
  useEffect(() => {
    if (!activeUid) return;
    setWorkouts(null);
    setWorkoutsError('');
    return listenWorkouts(activeUid, setWorkouts, err => {
      console.error('[workouts] listen failed', err);
      setWorkoutsError(withCode('לא הצלחנו לטעון את האימונים. בדקו את החיבור ונסו שוב.', err));
      setWorkouts([]);
    });
  }, [activeUid]);

  useEffect(() => {
    if (!activeUid) return;
    setLogs(null);
    setLogsError('');
    return listenLogs(activeUid, setLogs, err => {
      console.error('[logs] listen failed', err);
      setLogsError(withCode('לא הצלחנו לטעון את ההיסטוריה. בדקו את החיבור ונסו שוב.', err));
      setLogs([]);
    });
  }, [activeUid]);

  // Admin: live trainee list. Keeps the picked trainee if still there.
  useEffect(() => {
    if (!isAdmin || !user) return;
    return listenTrainees(list => {
      setTrainees(list);
      setActiveUid(cur => (cur && list.some(t => t.uid === cur) ? cur : list[0]?.uid || null));
    }, err => {
      console.error('[trainees] listen failed', err);
      setError(withCode('לא הצלחנו לטעון את רשימת המתאמנים.', err));
      setTrainees([]);
    });
  }, [isAdmin, user]);

  // Resume a workout that was in progress on this device.
  useEffect(() => {
    setSession(activeUid ? loadSession(activeUid) : null);
  }, [activeUid]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => onAuthStateChanged(auth, async u => {
    setError('');
    setEditing(null);
    setTab('plan');
    if (!u) {
      setUser(null);
      setIsAdmin(false);
      setActiveUid(null);
      return;
    }
    const admin = await fetchIsAdmin(u);
    setIsAdmin(admin);
    if (admin) {
      setTab('overview');
      // The admin manages trainees (listener below); their own training
      // lives in the ACL Tracker.
      setTrainees(null);
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

  const updateSession = next => {
    setSession(next);
    storeSession(next?.traineeUid || activeUid, next);
  };

  const startSession = (workout, planItem = null) => {
    setEditing(null);
    setNotice('');
    updateSession(buildSession({ traineeUid: activeUid, workout, planItem, logs }));
  };

  const finishCurrentSession = async () => {
    const finished = session;
    const write = finishSession(finished.traineeUid, { log: sessionToLog(finished), planId: finished.planId }, user.uid);
    write.catch(err => console.error('[session] background save failed', err));
    const outcome = await Promise.race([
      write.then(() => 'saved'),
      new Promise(resolve => setTimeout(() => resolve('queued'), OFFLINE_SAVE_WAIT_MS)),
    ]);
    // Clear by the finished session's own trainee, in case the admin switched
    // trainees while the save was in flight.
    storeSession(finished.traineeUid, null);
    setSession(cur => (cur?.startedAt === finished.startedAt ? null : cur));
    setTab('history');
    setNotice(outcome === 'saved'
      ? 'האימון נשמר.'
      : 'אין חיבור כרגע. האימון נשמר במכשיר ויסונכרן כשהחיבור יחזור.');
  };

  if (user === undefined) return <div className="center muted">טוען…</div>;
  if (!user) return <Login />;

  const firstName = (user.displayName || '').split(' ')[0];
  const active = (trainees || []).find(t => t.uid === activeUid);
  const listTitle = isAdmin ? `האימונים של ${active?.name || ''}` : 'האימונים שלי';
  const inSession = session && session.traineeUid === activeUid;

  return (
    <div className="page">
      <div className="header">
        <h1>שלום{firstName ? `, ${firstName}` : ''}</h1>
        <button className="btn btn-ghost" onClick={() => signOut(auth)}>התנתקות</button>
      </div>

      {isAdmin && trainees?.length > 0 && tab !== 'overview' && (
        <div className="switcher">
          <label htmlFor="trainee" className="muted">מתאמן/ת:</label>
          <select id="trainee" className="input" value={activeUid || ''}
            onChange={e => { setActiveUid(e.target.value); setEditing(null); }}>
            {trainees.map(t => <option key={t.uid} value={t.uid}>{t.name}</option>)}
          </select>
        </div>
      )}

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
      
      {isAdmin && trainees === null && !error && <p className="muted">טוען…</p>}

      {isAdmin && trainees?.length === 0 && !error && (
        <div className="card">
          <div style={{ fontWeight: 600 }}>עוד אין מתאמנים</div>
          <div className="muted">שלחו להם את הקישור לאתר. אחרי ההתחברות הראשונה הם יופיעו כאן.</div>
        </div>
      )}

      {activeUid && inSession && (
        <WorkoutSession
          key={session.startedAt}
          session={session}
          onChange={updateSession}
          onFinish={finishCurrentSession}
          onDiscard={() => updateSession(null)}
        />
      )}

      {activeUid && !inSession && !editing && (
        <div className="tabs" role="tablist">
          {[...(isAdmin ? ADMIN_TABS : []), ...TABS].map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
      )}

      {activeUid && !inSession && (editing ? (
        <WorkoutEditor
          key={editing.id || 'new'}
          uid={activeUid}
          editorUid={user.uid}
          workout={editing.id ? editing : null}
          knownNames={knownExerciseNames(workouts, logs)}
          onDone={() => setEditing(null)}
        />
      ) : tab === 'overview' && isAdmin ? (
        <Overview
          trainees={trainees || []}
          onOpen={uid => { setActiveUid(uid); setEditing(null); setTab('plan'); }}
        />
      ) : tab === 'plan' ? (
        <Planner
          key={activeUid}
          uid={activeUid}
          editorUid={user.uid}
          workouts={workouts || []}
          onGoToLibrary={() => setTab('workouts')}
          onStart={startSession}
        />
      ) : tab === 'workouts' ? (
        <WorkoutList
          workouts={workouts}
          error={workoutsError}
          title={listTitle}
          onEdit={w => setEditing(w)}
          onNew={() => setEditing({})}
          onStart={w => startSession(w)}
        />
      ) : (
        <History uid={activeUid} logs={logs} error={logsError} />
      ))}

      {notice && <div className="info toast" role="status" onClick={() => setNotice('')}>{notice}</div>}
    </div>
  );
}
