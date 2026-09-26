// A one-time message from the admin, shown after the trainee's next finished
// workout (trainees/{uid}.afterWorkoutMessage). Closed only by the button, so
// a stray tap doesn't dismiss it unread.
export default function AfterWorkoutMessage({ message, onClose }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={message.from ? `הודעה מ${message.from}` : 'הודעה'}
      style={{
        position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 20 }}>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 17, lineHeight: 1.7 }}>{message.text}</div>
        {message.from && <div className="muted" style={{ marginTop: 12, fontSize: 15 }}>— {message.from}</div>}
        <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} onClick={onClose} autoFocus>תודה! ❤️</button>
      </div>
    </div>
  );
}
