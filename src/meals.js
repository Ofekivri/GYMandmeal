// Meal slots in the order a day is shown. Snacks can repeat.
export const MEAL_SLOTS = [
  { id: 'breakfast', label: 'ארוחת בוקר' },
  { id: 'lunch', label: 'ארוחת צהריים' },
  { id: 'dinner', label: 'ארוחת ערב' },
  { id: 'snack', label: 'נשנוש' },
];

export const slotLabel = id => MEAL_SLOTS.find(s => s.id === id)?.label || '';

const slotIndex = id => {
  const i = MEAL_SLOTS.findIndex(s => s.id === id);
  return i === -1 ? MEAL_SLOTS.length : i;
};

export const sortMeals = meals =>
  [...meals].sort((a, b) => slotIndex(a.slot) - slotIndex(b.slot) || (a.createdAt || 0) - (b.createdAt || 0));

const norm = text => (text || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Same slot + same text on the same day = a duplicate when copying.
export const sameMeal = (a, b) => a.date === b.date && a.slot === b.slot && norm(a.text) === norm(b.text);

// First main meal the day doesn't have yet, else a snack.
export const nextSlot = meals =>
  ['breakfast', 'lunch', 'dinner'].find(slot => !meals.some(m => m.slot === slot)) || 'snack';

// Unique meal texts, most recent first, for autocomplete.
export function mealSuggestions(meals) {
  const seen = new Set();
  const out = [];
  for (const m of [...meals].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))) {
    const key = norm(m.text);
    if (key && !seen.has(key)) { seen.add(key); out.push(m.text.trim()); }
  }
  return out;
}
