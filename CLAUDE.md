# GYMandmeal: Claude Code context

Simple Hebrew (RTL) workout planner for trainees (Nofar first). Ofek is admin. Tracked in Linear as PSY-103.
Ofek's own ACL rehab stays in the separate ACL-Tracker repo.

**Stack:** Vite + React 19, plain JSX, one CSS file (`src/index.css`), Firebase Auth (Google + email/password) + Firestore with an on-device cache (works offline, syncs later).
It uses the same Firebase project as ACL-Tracker. Security rules live in that repo's `firestore.rules`.

## Files
- `src/App.jsx`: auth, admin detection, trainee switcher, tabs (תכנון / אימונים), and the shared workouts listener
- `src/data.js`: all Firestore reads and writes
- `src/dates.js`: local "YYYY-MM-DD" date helpers. Weeks start on Sunday. Never use `toISOString()` (it's UTC)
- `src/Planner.jsx`: week strip, the selected day's workouts, missed workouts, copy last week, start a workout
- `src/session.js`: pure logic for a workout in progress (build from a template and last time's sets, convert to a log, localStorage draft)
- `src/WorkoutSession.jsx`: doing a workout, one exercise at a time
- `src/History.jsx`: finished workouts with every set; deleting a log undoes its plan item
- `src/hebrew.js`: count wording ("תרגיל אחד", not "1 תרגילים")
- `src/WorkoutList.jsx`, `src/WorkoutEditor.jsx`: the workout library
- `src/Login.jsx`: Google, plus email and password (sign up, sign in, reset password)

## Data model (`trainees/{uid}`, owner or admin only)
```
trainees/{uid}                 { name, email, lastSeenAt }
trainees/{uid}/workouts/{id}   { name, exercises: [{ name, sets, reps, weight, note }], createdAt, updatedAt, updatedBy }
trainees/{uid}/plan/{id}       { date: "YYYY-MM-DD", workoutId, workoutName, doneAt, logId, createdAt, createdBy }
trainees/{uid}/logs/{id}       { workoutId, workoutName, date, startedAt, finishedAt, note, planId, unplanned, loggedBy, exercises: [{ name, sets: [{ weight, reps }] }] }
```
Admin is `config/settings.adminEmail`, the same source the rules' `isAdmin()` reads. The admin gets no trainee doc.
A plan item is done when `doneAt` is set: by "סימון כבוצע", or by finishing a workout, which also sets `logId`. It's missed when its date is before today and it isn't done.
Finishing a workout writes the log and updates the plan item in one batch (`finishSession`). A planned workout moves to the day it was done; an unplanned one gets a new plan item (`unplanned: true` on the log).
A workout in progress lives in localStorage (`gym_session_v1_{traineeUid}`) until it's saved or discarded. Only sets marked ✓ are saved.
"Last time" matches exercises by normalized name across the latest 100 logs.
`workoutName` is copied into each plan item so it still reads right after the workout is renamed or deleted.

## Product decisions
- Date planner: a week strip, and workouts are placed by hand. Nothing is auto-scheduled and there's no recurrence ("copy last week" instead).
- A missed workout stays on its date as "not done", with a one-tap "move to today".
- Logging is weight × reps per set, showing last time's values.
- Exercises are free text (no shared exercise library).
- All UI copy is in Hebrew. Use gender-neutral plural imperatives ("נסו שוב").

## Workflow
Push directly to `main`; Vercel auto-deploys. Ask before touching `.env*`, secrets, or Firestore rules.
