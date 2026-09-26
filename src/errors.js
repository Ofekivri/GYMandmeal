// Appends Firebase's error code to a user-facing message, e.g.
// "השמירה נכשלה. נסו שוב. (permission-denied)", so a screenshot is enough
// to tell a missing rule from a network problem.
export const withCode = (message, err) => (err?.code ? `${message} (${err.code})` : message);
