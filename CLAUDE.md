# GYMandmeal: Claude Code context

Simple Hebrew (RTL) workout planner for trainees (Nofar first). Ofek is admin. Tracked in Linear as PSY-103.
Ofek's own ACL rehab stays in the separate ACL-Tracker repo.

**Stack:** Vite + React 19, plain JSX, one CSS file (`src/index.css`), Firebase Auth (Google) + Firestore.
It uses the same Firebase project as ACL-Tracker. Security rules live in that repo's `firestore.rules`.

## Files
- `src/App.jsx`: auth, admin detection, trainee switcher, screen switching
- `src/data.js`: all Firestore reads and writes
- `src/WorkoutList.jsx`, `src/WorkoutEditor.jsx`, `src/Login.jsx`: screens

## Data model (`trainees/{uid}`, owner or admin only)
```
trainees/{uid}                 { name, email, lastSeenAt }
trainees/{uid}/workouts/{id}   { name, exercises: [{ name, sets, reps, weight, note }], createdAt, updatedAt, updatedBy }
trainees/{uid}/plan/{id}       { date: "YYYY-MM-DD", workoutId, logId }          (phase 2)
trainees/{uid}/logs/{id}       { workoutId, workoutName, date, planId, exercises: [{ name, sets: [{ weight, reps }] }] }  (phase 3)
```
Admin is `config/settings.adminEmail`, the same source the rules' `isAdmin()` reads. The admin gets no trainee doc.

## Product decisions
- Date planner: a week strip, and workouts are placed by hand. Nothing is auto-scheduled and there's no recurrence ("copy last week" instead).
- A missed workout stays on its date as "not done", with a one-tap "move to today".
- Logging is weight × reps per set, showing last time's values.
- Exercises are free text (no shared exercise library).
- All UI copy is in Hebrew. Use gender-neutral plural imperatives ("נסו שוב").

## Workflow
Push directly to `main`; Vercel auto-deploys. Ask before touching `.env*`, secrets, or Firestore rules.
