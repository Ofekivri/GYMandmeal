import { addDays, weekStart, shortDate } from './dates';

// "→  20.9 – 26.9  ←" with a back-to-this-week link. RTL: the right arrow
// goes back in time.
export default function WeekNav({ week, today, onChange }) {
  return (
    <div className="week-nav">
      <button className="btn btn-ghost" onClick={() => onChange(addDays(week, -7))} aria-label="שבוע קודם">→</button>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 600 }}>{shortDate(week)} – {shortDate(addDays(week, 6))}</div>
        {week !== weekStart(today) && (
          <button className="btn btn-ghost" style={{ padding: '0 6px', fontSize: 13 }} onClick={() => onChange(weekStart(today))}>חזרה להיום</button>
        )}
      </div>
      <button className="btn btn-ghost" onClick={() => onChange(addDays(week, 7))} aria-label="שבוע הבא">←</button>
    </div>
  );
}
