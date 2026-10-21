// Accepted snapshots are plain immutable data. Retain identities for unchanged
// entities so a command for one fighter does not invalidate other cards/teams.
export function share(previous, next) {
  if (Object.is(previous, next)) return previous;
  if (
    !previous ||
    !next ||
    typeof previous !== "object" ||
    typeof next !== "object" ||
    Array.isArray(previous) !== Array.isArray(next)
  )
    return next;
  const keys = Object.keys(next);
  if (keys.length !== Object.keys(previous).length) return next;
  let same = true;
  const result = Array.isArray(next) ? [] : {};
  for (const key of keys) {
    if (!Object.hasOwn(previous, key)) return next;
    result[key] = share(previous[key], next[key]);
    if (result[key] !== previous[key]) same = false;
  }
  return same ? previous : result;
}
