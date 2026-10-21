// Country of an event is read from its location, never inferred from its players.
const normalize = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
export const countryMatches = (actual, selected) =>
  !selected || (selected === "__unknown__" ? !actual : actual === selected);
export function tournamentGeography(data) {
  const players = new Map(
    (data.players || []).map((p) => [String(p.id), p.countryCode || ""]),
  );
  const names = new Map(
    (data.players || [])
      .filter((p) => p.countryCode && p.country)
      .map((p) => [p.countryCode, p.country]),
  );
  const suffixes = [...names]
    .map(([code, name]) => ({ code, name, suffix: normalize(name) }))
    .sort((a, b) => b.suffix.length - a.suffix.length);
  const events = new Map(),
    counts = new Map();
  for (const row of data.rosters) {
    if (events.has(row.eventId)) continue;
    const location = normalize(row.location).replace(/[.,;]+$/, "");
    const country = suffixes.find(
      (c) =>
        location === c.suffix ||
        location.endsWith(" " + c.suffix) ||
        location.endsWith("," + c.suffix),
    );
    const code = country?.code || "";
    events.set(row.eventId, code);
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  return {
    players,
    events,
    options: [...counts]
      .filter(([code]) => code)
      .map(([code, count]) => ({ code, name: names.get(code), count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    unknownEvents: counts.get("") || 0,
    matches: (row, eventCountry, playerCountry) =>
      countryMatches(events.get(row.eventId), eventCountry) &&
      countryMatches(players.get(String(row.playerId)), playerCountry),
  };
}
