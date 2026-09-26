// Plan dates are local calendar days stored as "YYYY-MM-DD" strings.
// Never use toISOString() here — it's UTC, so late-evening dates in Israel
// would land on the wrong day.

const pad = n => String(n).padStart(2, '0');

export const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = key => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = () => toKey(new Date());

export const addDays = (key, days) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
};

// Israeli week: Sunday → Saturday.
export const weekStart = key => addDays(key, -fromKey(key).getDay());

export const weekDays = startKey => Array.from({ length: 7 }, (_, i) => addDays(startKey, i));

export const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// "27.9"
export const shortDate = key => {
  const d = fromKey(key);
  return `${d.getDate()}.${d.getMonth() + 1}`;
};

// "היום", "מחר", "אתמול" or "יום שלישי, 29.9"
export const dayLabel = key => {
  const today = todayKey();
  if (key === today) return 'היום';
  if (key === addDays(today, 1)) return 'מחר';
  if (key === addDays(today, -1)) return 'אתמול';
  return `יום ${DAY_NAMES[fromKey(key).getDay()]}, ${shortDate(key)}`;
};
