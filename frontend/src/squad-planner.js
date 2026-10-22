// Exhaustive subsets of a normal ten-character roster. No scoring or roster edits.
export const defaultSquadPlanner = () => ({
  open: false,
  min: 5,
  from: 15,
  to: 20,
  threat: 17,
  required: [],
  limit: 30,
});
const integer = (value, fallback, min, max) =>
  value !== "" &&
  Number.isInteger(Number(value)) &&
  Number(value) >= min &&
  Number(value) <= max
    ? Number(value)
    : fallback;
export function squadSettings(value = {}) {
  const from = integer(value.from, 15, 1, 99),
    to = integer(value.to, 20, 1, 99);
  return {
    min: integer(value.min, 5, 1, 10),
    from,
    to,
    threat: integer(
      value.threat,
      Math.max(from, Math.min(to, 17)),
      from,
      Math.max(from, to),
    ),
    required: Array.isArray(value.required)
      ? [...new Set(value.required.filter((s) => typeof s === "string"))]
      : [],
    limit: integer(value.limit, 30, 1, 1024),
  };
}
const identity = (c) =>
  String(c.alterEgo || "")
    .trim()
    .toLowerCase();
// The two catalog entries represent the two models explicitly allowed by Bastion's Legion.
const copies = (c) =>
  ["prime-sentinel-1", "prime-sentinel-2"].includes(c.slug) ? 2 : 1;
export function enumerateSquads(characters, options = {}) {
  const settings = squadSettings(options),
    { min, from, to, required } = settings;
  const result = { groups: [], total: 0, errors: [], settings };
  if (from > to) {
    result.errors.push("Начало диапазона Threat должно быть не больше конца.");
    return result;
  }
  if (characters.length > 10) {
    result.errors.push("Для подбора оставь в ростере не больше 10 персонажей.");
    return result;
  }
  const candidates = [],
    seen = new Set();
  for (const c of characters) {
    if (
      !c ||
      typeof c.slug !== "string" ||
      !Number.isInteger(c.threatLevel) ||
      c.threatLevel <= 0 ||
      c.isGrunt
    ) {
      result.errors.push(
        "В ростере есть персонаж без доступной стоимости Threat или вспомогательная модель.",
      );
      return result;
    }
    if (seen.has(c.slug)) {
      result.errors.push(
        "В ростере повторяется одна и та же версия персонажа.",
      );
      return result;
    }
    candidates.push(c);
    seen.add(c.slug);
  }
  if (required.some((slug) => !seen.has(slug))) {
    result.errors.push("Закреплённого персонажа больше нет в этом ростере.");
    return result;
  }
  const requiredSet = new Set(required),
    counts = new Map(),
    groupMap = new Map();
  for (let threat = from; threat <= to; threat++)
    groupMap.set(threat, { threat, squads: [] });
  const selected = [];
  function visit(index, total) {
    if (total > to || selected.length + candidates.length - index < min) return;
    if (index === candidates.length) {
      if (selected.length >= min && groupMap.has(total)) {
        const slugs = selected.map((c) => c.slug);
        groupMap
          .get(total)
          .squads.push({
            key: slugs.join("|"),
            slugs,
            threat: total,
            count: slugs.length,
          });
        result.total++;
      }
      return;
    }
    const c = candidates[index],
      key = identity(c),
      existing = key ? counts.get(key) || [] : [];
    // All occupants of a repeated identity must permit its multiplicity.
    const allowed =
      !key || existing.length < Math.min(copies(c), ...existing.map(copies));
    if (allowed) {
      selected.push(c);
      if (key) counts.set(key, [...existing, c]);
      visit(index + 1, total + c.threatLevel);
      selected.pop();
      if (key) {
        if (existing.length) counts.set(key, existing);
        else counts.delete(key);
      }
    }
    if (!requiredSet.has(c.slug)) visit(index + 1, total);
  }
  visit(0, 0);
  result.groups = [...groupMap.values()];
  for (const group of result.groups)
    group.squads.sort(
      (a, b) => b.count - a.count || a.key.localeCompare(b.key),
    );
  const fixed = candidates.filter((c) => requiredSet.has(c.slug));
  const fixedCounts = new Map();
  for (const c of fixed) {
    const key = identity(c);
    if (key) {
      const entries = [...(fixedCounts.get(key) || []), c];
      fixedCounts.set(key, entries);
      if (entries.length > Math.min(...entries.map(copies))) {
        result.errors.push(
          "У закреплённых персонажей совпадает alter ego: " + c.alterEgo + ".",
        );
        break;
      }
    }
  }
  if (fixed.reduce((n, c) => n + c.threatLevel, 0) > to)
    result.errors.push(
      "Закреплённые персонажи уже превышают максимальный Threat диапазона.",
    );
  return result;
}
