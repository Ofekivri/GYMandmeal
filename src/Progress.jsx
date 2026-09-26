import { useMemo, useState } from 'react';
import { exerciseOptions, exerciseProgress } from './records';
import { formatSet } from './session';
import { dayLabel, shortDate } from './dates';
import { workoutsCount } from './hebrew';

// History "by exercise": pick an exercise, see its personal record, the best
// set of each workout over time as a small chart, and every workout's sets.
export default function Progress({ logs }) {
  const options = useMemo(() => exerciseOptions(logs), [logs]);
  const [picked, setPicked] = useState('');
  const key = options.some(o => o.key === picked) ? picked : options[0]?.key;
  const { rows, best } = useMemo(() => exerciseProgress(logs, key), [logs, key]);

  if (options.length === 0) {
    return (
      <div className="card">
        <div style={{ fontWeight: 600 }}>עוד אין תרגילים עם סטים</div>
        <div className="muted">אחרי אימון כוח ראשון, כאן תראו את ההתקדמות בכל תרגיל.</div>
      </div>
    );
  }

  return (
    <div className="list">
      <div className="field">
        <label htmlFor="progress-exercise">תרגיל</label>
        <select id="progress-exercise" className="input" value={key} onChange={e => setPicked(e.target.value)}>
          {options.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="plan-row">
          <span style={{ flex: 1 }} className="muted">שיא אישי · {workoutsCount(rows.length)}</span>
          {best && <strong>🏆 <bdi dir="ltr">{formatSet(best)}</bdi></strong>}
        </div>
        {rows.length > 1 && <ProgressChart key={key} rows={rows} />}
      </div>

      <div className="card" style={{ paddingBlock: 4 }}>
        {[...rows].reverse().map(r => (
          <div key={r.logId} className="progress-row">
            <div className="plan-row">
              <span style={{ flex: 1 }}>{dayLabel(r.date)}</span>
              {r.record && <span className="badge pr">🏆 שיא</span>}
            </div>
            <div className="muted">
              {r.sets.map((s, k) => <span key={k}>{k > 0 && ' · '}<bdi dir="ltr">{formatSet(s)}</bdi></span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const W = 320;
const H = 150;
const PAD = { top: 26, right: 14, bottom: 22, left: 34 };

// Best set per workout, oldest → newest left to right. Plots weight, or reps
// when the exercise is never done with weight. Tap a point to read it; the
// latest point is read out by default.
function ProgressChart({ rows }) {
  const byWeight = rows.some(r => r.set.weight > 0);
  const points = rows.filter(r => !byWeight || r.set.weight > 0);
  const [sel, setSel] = useState(points.length - 1);
  if (points.length < 2) return null;

  const value = r => (byWeight ? r.set.weight : r.set.reps || 0);
  const vals = points.map(value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const x = i => PAD.left + (i * (W - PAD.left - PAD.right)) / (points.length - 1);
  const y = v => PAD.top + ((hi - v) * (H - PAD.top - PAD.bottom)) / (hi - lo);

  const selected = Math.min(sel, points.length - 1); // a log may have been deleted
  const p = points[selected];
  const px = x(selected);
  const anchor = px > W - 60 ? 'end' : px < PAD.left + 40 ? 'start' : 'middle';

  return (
    <div style={{ marginTop: 8 }}>
      <div className="muted" style={{ fontSize: 12 }}>{byWeight ? 'משקל בסט הטוב ביותר (ק״ג)' : 'חזרות בסט הטוב ביותר'}</div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} dir="ltr" role="img"
        aria-label={`${byWeight ? 'משקל' : 'חזרות'} לאורך ${points.length} אימונים, מ-${lo} עד ${hi}`}>
        {[hi, lo].map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="chart-axis">{Math.round(v * 10) / 10}</text>
          </g>
        ))}
        <text x={PAD.left} y={H - 6} textAnchor="start" className="chart-axis">{shortDate(points[0].date)}</text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="chart-axis">{shortDate(points[points.length - 1].date)}</text>

        <polyline className="chart-line" points={points.map((r, i) => `${x(i)},${y(value(r))}`).join(' ')} />
        <line x1={px} x2={px} y1={PAD.top} y2={H - PAD.bottom} className="chart-cross" />
        {points.map((r, i) => (
          <g key={r.logId} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
            <circle cx={x(i)} cy={y(value(r))} r={14} fill="transparent" />
            <circle cx={x(i)} cy={y(value(r))} r={i === selected ? 6 : r.record ? 5 : 4} className="chart-dot" />
          </g>
        ))}
        <text x={px} y={14} textAnchor={anchor} className="chart-label">
          {formatSet(p.set)} · {shortDate(p.date)}{p.record ? ' 🏆' : ''}
        </text>
      </svg>
    </div>
  );
}
