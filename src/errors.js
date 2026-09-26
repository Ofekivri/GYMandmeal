// Appends the cause to a user-facing message, e.g.
// "השמירה נכשלה. נסו שוב. (permission-denied)", so a screenshot is enough
// to diagnose. Falls back to the error's own message when it has no code.
export const withCode = (message, err) => {
  const detail = err?.code || (err?.message ? String(err.message).slice(0, 120) : '');
  return detail ? `${message} (${detail})` : message;
};

// Short build id (Vercel exposes the commit to Vite as VITE_VERCEL_*), shown
// on the login screen so we can tell which version a phone is running.
export const BUILD_ID = (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7);
