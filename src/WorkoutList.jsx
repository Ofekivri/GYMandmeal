import { exercisesCount } from './hebrew';

// The trainee's workout library. Tapping a workout opens the editor;
// "התחלה" starts it right away without planning it.
// workouts: null while loading (App owns the Firestore listener).
export default function WorkoutList({ workouts, error, title, onEdit, onNew, onStart }) {
  return (
    <div>
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>{title}</h2>
      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
      {workouts === null ? (
        <p className="muted">טוען…</p>
      ) : (
        <div className="list">
          {workouts.length === 0 && !error && (
            <div className="card">
              <div style={{ fontWeight: 600 }}>עוד אין אימונים</div>
              <div className="muted">צרו את האימון הראשון, ואחר כך תוכלו לשבץ אותו בימים.</div>
            </div>
          )}
          {workouts.map(w => (
            <div key={w.id} className="card plan-row">
              <button className="workout-row" style={{ flex: 1, background: 'none', border: 'none', padding: 0 }}
                onClick={() => onEdit(w)} aria-label={`עריכת ${w.name}`}>
                <div style={{ flex: 1 }}>
                  <div className="title">{w.name}</div>
                  <div className="muted">{exercisesCount((w.exercises || []).length)} · לחצו לעריכה</div>
                </div>
              </button>
              <button className="btn btn-small" onClick={() => onStart(w)}>התחלה</button>
            </div>
          ))}
          <button className="btn btn-block btn-dashed" onClick={onNew}>+ אימון חדש</button>
        </div>
      )}
    </div>
  );
}
