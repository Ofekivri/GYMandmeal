import { useState } from 'react';
import { fetchAllForExport } from './data';
import { buildExportMarkdown, exportFileName } from './exportMarkdown';
import { todayKey } from './dates';
import { withCode } from './errors';

// Admin only: downloads one trainee's whole history (workouts with every set,
// meals, adherence summary) as a readable Markdown file.
export default function ExportButton({ uid, trainee }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const { plan, logs, meals } = await fetchAllForExport(uid);
      const today = todayKey();
      const first = [...plan, ...logs, ...meals].map(x => x.date).filter(Boolean).sort()[0] || today;
      const md = buildExportMarkdown({ trainee, first, to: today, today, plan, logs, meals });
      const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName(trainee, first, today);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('[export] failed', err);
      setError(withCode('לא הצלחנו לייצא. בדקו את החיבור ונסו שוב.', err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn btn-ghost" onClick={run} disabled={busy}>{busy ? 'מייצא…' : 'ייצוא נתונים'}</button>
      {error && <div className="error" style={{ width: '100%' }}>{error}</div>}
    </>
  );
}
