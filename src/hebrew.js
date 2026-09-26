// "תרגיל אחד" / "3 תרגילים" — Hebrew counts read wrong as "1 תרגילים".
export const countOf = (n, one, many) => (n === 1 ? one : `${n} ${many}`);

export const exercisesCount = n => countOf(n, 'תרגיל אחד', 'תרגילים');
export const setsCount = n => countOf(n, 'סט אחד', 'סטים');
export const mealsCount = n => countOf(n, 'ארוחה אחת', 'ארוחות');
export const workoutsCount = n => countOf(n, 'אימון אחד', 'אימונים');
