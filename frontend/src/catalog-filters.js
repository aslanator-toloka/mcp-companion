import { CHARACTER_ROLES, roleProfile } from "./character-roles.js";
import { MODEL_STAGES } from "./model-progress.js";
// Pure local search. A block's predicates must match the same printed attack.
export const CONDITIONS = [
  "bleed",
  "hex",
  "incinerate",
  "judgment",
  "poison",
  "root",
  "shock",
  "slow",
  "stagger",
  "stun",
];
export const TRAITS = [
  ["flight", "Flight"],
  ["wallCrawler", "Wall Crawler"],
  ["healingFactor", "Healing Factor"],
  ["gemBearer", "Gem Bearer"],
  ["stealth", "Stealth"],
  ["martialArtist", "Martial Artist"],
  ["hardskin", "Damage Reduction"],
  ["charge", "Charge"],
  ["hitAndRun", "Hit and Run"],
];
export const EFFECTS = [
  ["powerGen", "Power generation"],
  ["pierce", "Pierce"],
  ["rapidFire", "Rapid Fire"],
  ["push", "Push"],
  ["healSelf", "Self Heal"],
  ["cleanse", "Cleanse"],
  ["counter", "Counter"],
  ["bodyguard", "Bodyguard"],
  ["explosive", "Explosive"],
  ["throwTerrain", "Throw terrain"],
  ["throwCharacter", "Throw characters"],
  ["throwEverything", "Throw anything"],
];
export const COMPARATORS = [
  ["lt", "<"],
  ["lte", "≤"],
  ["eq", "="],
  ["gte", "≥"],
  ["gt", ">"],
];
export const blankAttack = (id = 1) => ({
  id,
  range: "",
  rangeOp: "gte",
  strength: "",
  strengthOp: "gte",
  types: [],
  shape: "",
});
export const defaultFilters = () => ({
  affiliations: [],
  allAffiliations: false,
  roles: [],
  allRoles: false,
  leaders: false,
  minThreat: "",
  maxThreat: "",
  minStamina: "",
  sizes: [],
  speeds: [],
  physicalDefense: "",
  energyDefense: "",
  mysticDefense: "",
  baseSizes: [],
  attacks: [blankAttack()],
  allAttacks: false,
  tags: [],
  timeline: "extended",
  hideUnreleased: false,
  missing: false,
  hobbyStage: "",
  sort: "name",
  descending: false,
});
const list = (value) =>
  Array.isArray(value)
    ? [...new Set(value.filter((v) => typeof v === "string").slice(0, 250))]
    : [];
const number = (value, max = 99) =>
  value !== "" &&
  value !== null &&
  value !== undefined &&
  Number.isInteger(Number(value)) &&
  Number(value) >= 0 &&
  Number(value) <= max
    ? String(Number(value))
    : "";
const choice = (value, choices, fallback = "") =>
  choices.includes(value) ? value : fallback;
export function normalizeFilters(value) {
  const f = defaultFilters();
  if (!value || typeof value !== "object" || Array.isArray(value)) return f;
  for (const key of ["affiliations", "tags"]) f[key] = list(value[key]);
  f.roles = CHARACTER_ROLES.map((r) => r.id).filter((id) =>
    list(value.roles).includes(id),
  );
  for (const key of [
    "allRoles",
    "allAffiliations",
    "leaders",
    "allAttacks",
    "hideUnreleased",
    "missing",
    "descending",
  ])
    f[key] = value[key] === true;
  for (const key of [
    "minThreat",
    "maxThreat",
    "minStamina",
    "physicalDefense",
    "energyDefense",
    "mysticDefense",
  ])
    f[key] = number(value[key]);
  for (const [key, values] of [
    ["sizes", [1, 2, 3, 4, 5]],
    ["baseSizes", [35, 50, 65]],
    ["speeds", ["S", "M", "L"]],
  ])
    f[key] = Array.isArray(value[key])
      ? [...new Set(value[key].filter((v) => values.includes(v)))]
      : [];
  f.hobbyStage = f.missing
    ? ""
    : choice(value.hobbyStage, ["unset", ...MODEL_STAGES.map(([key]) => key)]);
  f.timeline = choice(
    value.timeline,
    ["standard", "extended", "2024", "2025", "2026"],
    "extended",
  );
  f.sort = choice(
    value.sort,
    ["name", "threat", "releaseDate", "boxSet"],
    "name",
  );
  if (Array.isArray(value.attacks) && value.attacks.length) {
    const used = new Set();
    f.attacks = value.attacks.slice(0, 20).map((a, index) => {
      let id =
        Number.isInteger(a?.id) && a.id > 0 && a.id <= 10000 ? a.id : index + 1;
      while (used.has(id)) id++;
      used.add(id);
      return {
        id,
        range: number(a?.range),
        strength: number(a?.strength),
        rangeOp: choice(
          a?.rangeOp,
          COMPARATORS.map((c) => c[0]),
          "gte",
        ),
        strengthOp: choice(
          a?.strengthOp,
          COMPARATORS.map((c) => c[0]),
          "gte",
        ),
        types: list(a?.types).filter((t) =>
          ["physical", "energy", "mystic"].includes(t),
        ),
        shape: choice(a?.shape, ["area", "beam"]),
      };
    });
  }
  return f;
}
export const activeAttack = (a) =>
  a.range !== "" || a.strength !== "" || a.types.length || a.shape;
export function compactFilters(value) {
  const f = normalizeFilters(value),
    defaults = defaultFilters(),
    out = {};
  for (const [key, v] of Object.entries(f)) {
    if (key === "attacks") {
      const active = v.filter(activeAttack);
      if (active.length)
        out.attacks = active.map((a, i) => ({ ...a, id: i + 1 }));
    } else if (JSON.stringify(v) !== JSON.stringify(defaults[key]))
      out[key] = v;
  }
  return out;
}
export const encodeFilters = (f) => {
  const out = compactFilters(f);
  return Object.keys(out).length ? JSON.stringify(out) : "";
};
export function decodeFilters(text) {
  try {
    return normalizeFilters(
      text && text.length < 20000 ? JSON.parse(text) : null,
    );
  } catch {
    return defaultFilters();
  }
}
const normalize = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[‘’']/g, "");
export function tagMatches(tags, filter) {
  if (filter === "throwTerrain" || filter === "throwCharacter")
    return tags.some(
      (t) => t.startsWith(filter) || t.startsWith("throwEverything"),
    );
  if (
    [
      "throwEverything",
      "healingFactor",
      "gemBearer",
      "bodyguard",
      "cleanse",
    ].includes(filter)
  )
    return tags.some((t) => t.startsWith(filter));
  return tags.includes(filter);
}
export function compare(op, actual, wanted) {
  if (actual === null || !Number.isFinite(actual)) return false;
  return (
    {
      lt: actual < wanted,
      lte: actual <= wanted,
      eq: actual === wanted,
      gte: actual >= wanted,
      gt: actual > wanted,
    }[op] ?? false
  );
}
export function attackMatches(attack, filter) {
  if (filter.types.length && !filter.types.includes(attack.type || attack.kind))
    return false;
  const rangeText = String(attack.range ?? ""),
    shape = rangeText.startsWith("A")
      ? "area"
      : rangeText.startsWith("B")
        ? "beam"
        : "";
  if (filter.shape && filter.shape !== shape) return false;
  const range = rangeText.match(/\d+/)?.[0];
  if (
    filter.range !== "" &&
    !compare(filter.rangeOp, range ? Number(range) : null, Number(filter.range))
  )
    return false;
  const strength = /^\d+$/.test(String(attack.strength))
    ? Number(attack.strength)
    : null;
  return (
    filter.strength === "" ||
    compare(filter.strengthOp, strength, Number(filter.strength))
  );
}
export function searchMatches(c, query, affiliations = c.affiliations) {
  const tags = (c.tags || []).map(normalize);
  const text = normalize(
    [c.name, c.alterEgo, ...affiliations.map((a) => a.name)].join(" "),
  ).replace(/[^\p{L}\p{N}\s-]/gu, "");
  return String(query)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => {
      const excluded = token.startsWith("!");
      if (excluded) token = token.slice(1);
      let match;
      if (token.startsWith("#"))
        match = tags.some((t) => t.startsWith(normalize(token.slice(1))));
      else {
        const parts =
          normalize(token)
            .replace(/\./g, "")
            .match(/[\p{L}\p{N}]+/gu) || [];
        const words = text.match(/[\p{L}\p{N}]+/gu) || [];
        match = parts.every((part) => words.some((w) => w.startsWith(part)));
      }
      return excluded ? !match : match;
    });
}
export function matchesFilters(
  c,
  f,
  {
    query = "",
    affiliation = "",
    threat = "",
    owned = false,
    modelStage = "",
    onlyOwned = false,
    now = new Date(),
  } = {},
) {
  if (f.roles?.length) {
    const profile = roleProfile(c),
      assigned = profile && !profile.grunt ? profile.roles : [];
    if (
      !(f.allRoles
        ? f.roles.every((r) => assigned.includes(r))
        : f.roles.some((r) => assigned.includes(r)))
    )
      return false;
  }
  const timed = (c.affiliations || []).filter(
    (a) => !a.timelines || a.timelines.includes(f.timeline),
  );
  const unaffiliatedException =
    (c.slug === "gladiator" &&
      ["standard", "extended", "2025"].includes(f.timeline)) ||
    (c.slug === "iron-lad" &&
      ["standard", "extended", "2026"].includes(f.timeline));
  if (
    !["standard", "extended"].includes(f.timeline) &&
    !timed.length &&
    !unaffiliatedException
  )
    return false;
  const selected = f.affiliations.length
    ? f.affiliations
    : affiliation
      ? [affiliation]
      : [];
  if (
    selected.length &&
    !(f.allAffiliations
      ? selected.every((name) => timed.some((a) => a.name === name))
      : selected.some((name) => timed.some((a) => a.name === name)))
  )
    return false;
  if (
    f.leaders &&
    !c.affiliations.some((a) => a.isLeader || a.isLeaderWithTeamTactics)
  )
    return false;
  if (threat && String(c.threatLevel) !== threat) return false;
  if (
    f.minThreat !== "" &&
    (c.threatLevel == null || c.threatLevel < Number(f.minThreat))
  )
    return false;
  if (
    f.maxThreat !== "" &&
    (c.threatLevel == null || c.threatLevel > Number(f.maxThreat))
  )
    return false;
  for (const [min, field] of [
    ["minStamina", "stamina"],
    ["physicalDefense", "physicalDefense"],
    ["energyDefense", "energyDefense"],
    ["mysticDefense", "mysticDefense"],
  ])
    if (f[min] !== "" && (c[field] == null || c[field] < Number(f[min])))
      return false;
  for (const [key, field] of [
    ["sizes", "size"],
    ["speeds", "speed"],
    ["baseSizes", "baseSize"],
  ])
    if (f[key].length && !f[key].includes(c[field])) return false;
  if (
    f.hideUnreleased &&
    (!c.releaseDate || c.releaseDate > now.toISOString().slice(0, 10))
  )
    return false;
  if ((onlyOwned && !owned) || (f.missing && owned)) return false;
  if (f.hobbyStage && (!owned || f.hobbyStage !== (modelStage || "unset")))
    return false;
  if (!f.tags.every((t) => tagMatches(c.tags || [], t))) return false;
  const blocks = f.attacks.filter(activeAttack);
  if (
    blocks.length &&
    !(f.allAttacks
      ? blocks.every((b) => (c.attacks || []).some((a) => attackMatches(a, b)))
      : blocks.some((b) => (c.attacks || []).some((a) => attackMatches(a, b))))
  )
    return false;
  return searchMatches(c, query, timed);
}
export function sortCharacters(rows, f) {
  const compareName = (a, b) =>
    a.name.localeCompare(b.name, "en") ||
    String(a.alterEgo || "").localeCompare(String(b.alterEgo || ""), "en");
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (f.sort === "threat")
      cmp = (a.threatLevel ?? -1) - (b.threatLevel ?? -1);
    if (f.sort === "releaseDate")
      cmp = String(a.releaseDate || "").localeCompare(
        String(b.releaseDate || ""),
      );
    if (f.sort === "boxSet")
      cmp = String(a.boxSets?.[0] || "").localeCompare(
        String(b.boxSets?.[0] || ""),
        "en",
        { numeric: true },
      );
    return (cmp || compareName(a, b)) * (f.descending ? -1 : 1);
  });
}
