const test = require("node:test"),
  assert = require("node:assert/strict");
let F;
test.before(async () => {
  F = await import("../frontend/src/catalog-filters.js");
});
const character = (changes) => ({
  slug: "test",
  name: "Test Hero",
  alterEgo: "Alex Example",
  affiliations: [],
  tags: [],
  attacks: [],
  threatLevel: 4,
  stamina: 6,
  size: 2,
  speed: "M",
  baseSize: 35,
  physicalDefense: 3,
  energyDefense: 3,
  mysticDefense: 3,
  releaseDate: "2020-01-01",
  ...changes,
});
test("attack predicates share one attack, separate blocks use OR or AND, empty blocks do not restrict", () => {
  const c = character({
    attacks: [
      { type: "physical", range: "2", strength: "8" },
      { type: "energy", range: "5", strength: "4" },
    ],
  });
  const f = F.defaultFilters();
  f.attacks = [{ ...F.blankAttack(), range: "5", strength: "8" }];
  assert.equal(
    F.matchesFilters(c, f),
    false,
    "must not combine the range of one attack with the strength of another",
  );
  f.attacks = [
    { ...F.blankAttack(), strength: "8", types: ["physical"] },
    { ...F.blankAttack(2), range: "5", types: ["energy"] },
  ];
  f.allAttacks = true;
  assert(F.matchesFilters(c, f));
  f.attacks[1].types = ["mystic"];
  assert.equal(F.matchesFilters(c, f), false);
  f.allAttacks = false;
  assert(F.matchesFilters(c, f));
  f.attacks = [F.blankAttack()];
  assert(F.matchesFilters(character(), f));
});
test("range comparators understand area and beam values and reject unknown strengths", () => {
  for (const [op, wanted, expected] of [
    ["lt", 4, true],
    ["lte", 3, true],
    ["eq", 3, true],
    ["gt", 3, false],
    ["gte", 3, true],
  ])
    assert.equal(
      F.attackMatches(
        { type: "mystic", range: "B3", strength: "*" },
        {
          ...F.blankAttack(),
          range: String(wanted),
          rangeOp: op,
          shape: "beam",
        },
      ),
      expected,
    );
  assert.equal(
    F.attackMatches(
      { type: "mystic", range: "B3", strength: "*" },
      { ...F.blankAttack(), strength: "0" },
    ),
    false,
  );
  assert.equal(
    F.attackMatches(
      { type: "physical", range: "A2", strength: "5" },
      { ...F.blankAttack(), shape: "beam" },
    ),
    false,
  );
});
test("scaled ability tags, throws and cleansing match families; all selected traits must match", () => {
  assert(F.tagMatches(["healingFactor2"], "healingFactor"));
  assert(F.tagMatches(["gemBearerPower"], "gemBearer"));
  assert(F.tagMatches(["throwEverything3"], "throwCharacter"));
  assert(F.tagMatches(["throwTerrain3"], "throwTerrain"));
  assert.equal(F.tagMatches(["throwTerrain3"], "throwCharacter"), false);
  assert(F.tagMatches(["cleanseOtherAllied"], "cleanse"));
  const f = F.defaultFilters();
  f.tags = ["flight", "immuneToPoison"];
  assert(
    F.matchesFilters(character({ tags: ["flight", "immuneToPoison"] }), f),
  );
  assert.equal(F.matchesFilters(character({ tags: ["flight"] }), f), false);
});
test("timeline filters scope affiliation membership, OR/AND affiliations and tactic-based leadership", () => {
  const c = character({
    affiliations: [
      {
        name: "A",
        timelines: ["standard", "extended", "2025"],
        isLeaderWithTeamTactics: true,
      },
      { name: "B", timelines: ["extended", "2026"] },
    ],
  });
  const f = F.defaultFilters();
  f.affiliations = ["A", "B"];
  f.allAffiliations = true;
  f.leaders = true;
  assert(F.matchesFilters(c, f));
  f.timeline = "2025";
  assert.equal(F.matchesFilters(c, f), false);
  f.allAffiliations = false;
  assert(F.matchesFilters(c, f));
  f.affiliations = ["B"];
  assert.equal(F.matchesFilters(c, f), false);
  assert(
    F.matchesFilters(character({ slug: "iron-lad" }), {
      ...F.defaultFilters(),
      timeline: "2026",
    }),
  );
  assert.equal(
    F.matchesFilters(character({ slug: "iron-lad" }), {
      ...F.defaultFilters(),
      timeline: "2024",
    }),
    false,
  );
});
test("statistics, base size, collection and release date compose with name and tag search", () => {
  const c = character({
    tags: ["flight", "throwTerrain3"],
    affiliations: [{ name: "Web Warriors" }],
  });
  const f = F.defaultFilters();
  f.minThreat = "4";
  f.maxThreat = "4";
  f.minStamina = "6";
  f.sizes = [2];
  f.speeds = ["M"];
  f.baseSizes = [35];
  f.physicalDefense = "3";
  assert(F.matchesFilters(c, f, { query: "Web #flight !#poison" }));
  assert.equal(F.matchesFilters(c, f, { query: "!#flight" }), false);
  f.minStamina = "7";
  assert.equal(F.matchesFilters(c, f), false);
  f.minStamina = "";
  f.missing = true;
  assert.equal(F.matchesFilters(c, f, { owned: true }), false);
  assert(F.matchesFilters(c, f, { owned: false }));
  f.missing = false;
  f.hideUnreleased = true;
  assert.equal(
    F.matchesFilters({ ...c, releaseDate: "2030-01-01" }, f, {
      now: new Date("2026-10-21"),
    }),
    false,
  );
  assert.equal(F.matchesFilters({ ...c, releaseDate: null }, f), false);
  assert.equal(F.matchesFilters({ ...c, physicalDefense: null }, f), false);
});
test("filter URLs are bounded, sanitized, minimal and round-trip without losing attack semantics", () => {
  assert.equal(F.encodeFilters(F.defaultFilters()), "");
  assert.deepEqual(F.decodeFilters("not-json"), F.defaultFilters());
  assert.equal(
    new Set(
      F.normalizeFilters({ attacks: [{ id: 1 }, { id: 1 }] }).attacks.map(
        (a) => a.id,
      ),
    ).size,
    2,
  );
  const f = F.normalizeFilters({
    tags: ["flight", "flight"],
    sort: "BAD",
    minThreat: "NaN",
    attacks: [
      {
        ...F.blankAttack(),
        range: "3",
        shape: "beam",
        types: ["energy", "evil"],
      },
    ],
  });
  assert.deepEqual(F.decodeFilters(F.encodeFilters(f)), f);
  assert.deepEqual(f.tags, ["flight"]);
  assert.equal(f.sort, "name");
  assert.equal(f.minThreat, "");
  assert.deepEqual(f.attacks[0].types, ["energy"]);
  const data = require("../data/catalog.json");
  assert(
    data.characters.every(
      (c) =>
        Array.isArray(c.attacks) &&
        c.affiliations.every((a) => Array.isArray(a.timelines)),
    ),
  );
});

test("search keeps dotted and apostrophized names usable alongside tags", () => {
  assert(F.searchMatches(character({ name: "M.O.D.O.K." }), "M.O.D.O.K."));
  assert(F.searchMatches(character({ name: "M.O.D.O.K." }), "modok"));
  assert(F.searchMatches(character({ name: "M‘Baku" }), "M'Baku"));
});
