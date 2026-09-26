// Weekly adherence for one trainee, from that week's plan items and meals.
// "Due" = dated today or earlier, or already done (marked early counts).
export function summarizeWeek({ plan, meals }, today) {
  const isDue = (item, done) => item.date <= today || done;

  const workoutsDone = plan.filter(p => p.doneAt).length;
  const workoutsDue = plan.filter(p => isDue(p, p.doneAt)).length;
  const missed = plan
    .filter(p => !p.doneAt && p.date < today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const workoutsLeft = plan.filter(p => !p.doneAt && p.date >= today).length;

  const mealsEaten = meals.filter(m => m.eatenAt).length;
  const mealsDue = meals.filter(m => isDue(m, m.eatenAt)).length;
  const mealsDifferent = meals.filter(m => m.eatenAt && m.actual).length;
  const mealsUnmarked = meals.filter(m => !m.eatenAt && m.date < today).length;
  const mealsLeft = meals.filter(m => !m.eatenAt && m.date >= today).length;

  return {
    workouts: { done: workoutsDone, due: workoutsDue, left: workoutsLeft, missed },
    meals: { eaten: mealsEaten, due: mealsDue, left: mealsLeft, different: mealsDifferent, unmarked: mealsUnmarked },
    empty: plan.length === 0 && meals.length === 0,
  };
}

// 0–100 for a progress bar; an empty denominator reads as nothing to do.
export const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
