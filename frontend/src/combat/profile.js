// Card-driven, isolated combat profiles. No tournament results enter this model.
export const CONDITIONS = [
  "bleed",
  "hex",
  "incinerate",
  "poison",
  "root",
  "shock",
  "slow",
  "stun",
  "stagger",
  "judgment",
];
export const DEFAULT_STATE = {
  form: 0,
  side: "front",
  damage: 0,
  cover: false,
  conditions: [],
  moved: false,
  attacked: false,
  objective: false,
  tokens: 0,
  stance: "",
  special: false,
};
export function clean(text = "") {
  return String(text)
    .replace(/\|[!*!]([^|]+)\|/g, "$1")
    .replace(/\|§[^§]+§([^|]+)\|/g, "$1")
    .replace(/\|£[^£]+£([^|]+)\|/g, "$1")
    .replace(/\|<[^>]+>([^|]+)\|/g, "$1")
    .replace(/[|&*]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
export function initialState(slug) {
  return {
    ...DEFAULT_STATE,
    conditions: [],
    special: ["cosmic-ghost-rider", "doctor-voodoo", "squirrel-girl"].includes(
      slug,
    ),
    tokens: slug === "mister-sinister" ? 1 : 0,
    stance:
      {
        vision: "physical",
        "omega-sentinel": "physical",
        "red-skull-master-of-hydra": "energy",
      }[slug] || "",
  };
}
export function state(value = {}) {
  const n = (x, max) => Math.max(0, Math.min(max, Math.floor(Number(x) || 0)));
  return {
    ...DEFAULT_STATE,
    form: value.form === 1 ? 1 : 0,
    side: value.side === "back" ? "back" : "front",
    damage: n(value.damage, 40),
    cover: !!value.cover,
    conditions: [
      ...new Set(
        Array.isArray(value.conditions)
          ? value.conditions.map((x) => String(x).toLowerCase())
          : [],
      ),
    ].filter((x) => CONDITIONS.includes(x)),
    moved: !!value.moved,
    attacked: !!value.attacked,
    objective: !!value.objective,
    tokens: n(value.tokens, 10),
    stance: String(value.stance || "").slice(0, 40),
    special: !!value.special,
  };
}
export function immunities(card) {
  return (card?.superPowers || []).flatMap((p) =>
    [...clean(p.name).matchAll(/Immunity \[([^\]]+)\]/g)].flatMap((m) =>
      m[1].split(",").map((s) => s.trim().toLowerCase()),
    ),
  );
}
export function profile(character, detail, value = {}) {
  const options = state(value),
    card = (options.form && detail.secondStatCard) || detail.statCard;
  if (!card?.frontSide) throw Error("Не загрузилась карта " + character.name);
  const face = (options.side === "back" && card.backSide) || card.frontSide;
  options.damage = Math.min(
    options.damage,
    Math.max(0, Number(face.stamina) - 1),
  );
  options.conditions = options.conditions.filter(
    (c) => !immunities(face).includes(c),
  );
  return {
    slug: character.slug,
    name: face.nameOverride || card.name || character.name,
    alterEgo: character.alterEgo || "",
    threat: Number(face.threatLevel ?? character.threatLevel) || 0,
    size: Number(face.size ?? character.size) || 2,
    stamina: Number(face.stamina) || 1,
    defense: Object.fromEntries(
      ["physical", "energy", "mystic"].map((t) => [
        t,
        Number(face[t + "Defense"]) || 0,
      ]),
    ),
    attacks: face.attacks || [],
    powers: (face.superPowers || []).filter((p) => p.type !== "leadership"),
    state: options,
  };
}
export function attackVariants(p) {
  return p.attacks.flatMap((a, index) =>
    /chooses whether this attack's type/i.test(clean((a.steps || []).join(" ")))
      ? ["physical", "energy", "mystic"].map((type) => ({
          ...a,
          type,
          index,
          id: `${index}:${type}`,
        }))
      : [{ ...a, index, id: String(index) }],
  );
}
export function contextFields(slug) {
  const stance = {
    vision: [
      ["physical", "Enhanced Density"],
      ["energy", "Phased"],
    ],
    "omega-sentinel": [
      ["physical", "Hardened Carapace"],
      ["energy", "Plasmatic Cloaking"],
      ["reroll", "Electrostatic Pole"],
    ],
    "red-skull-master-of-hydra": [
      ["energy", "Dispersion Field"],
      ["mystic", "Null Field"],
    ],
  }[slug];
  const tokens = {
    killmonger: "Kill Count",
    "mister-sinister": "Genetic Sample",
    "nkantu-the-living-mummy": "Captured Soul",
    sunspot: "Flare",
    nightcrawler: "Число размещений за ход",
    nimrod: "Предыдущие применения защиты за ход",
  }[slug];
  const special = {
    "cosmic-ghost-rider": "Есть Psychosis token",
    "doctor-voodoo": "Brother Daniel у этого персонажа",
    "squirrel-girl": "Tippy-Toe у этого персонажа",
    "drax-the-destroyer": "Vengeance на противнике",
    karnak: "Weakness на противнике",
    "silver-sable": "Sniper Nest: на подходящем здании",
  }[slug];
  return { stance, tokens, special };
}
