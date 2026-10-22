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

test("hobby stages filter owned models only, round-trip in URL filters and reject invalid stages", () => {
  const c = character();
  for (const stage of ["assembled", "primed", "painted", "unset"]) {
    const f = F.normalizeFilters({ hobbyStage: stage });
    assert.equal(f.hobbyStage, stage);
    assert.equal(F.decodeFilters(F.encodeFilters(f)).hobbyStage, stage);
    const modelStage = stage === "unset" ? "" : stage;
    assert(F.matchesFilters(c, f, { owned: true, modelStage }));
    assert.equal(F.matchesFilters(c, f, { owned: false, modelStage }), false);
    assert.equal(
      F.matchesFilters(c, f, {
        owned: true,
        modelStage: stage === "painted" ? "primed" : "painted",
      }),
      false,
    );
  }
  assert.equal(F.normalizeFilters({ hobbyStage: "bad" }).hobbyStage, "");
  assert.equal(
    F.normalizeFilters({ missing: true, hobbyStage: "painted" }).hobbyStage,
    "",
  );
});

test("role filters sanitize and round-trip selections, match any/all roles, retain conditional profiles and compose with other filters", () => {
  const data = require("../data/catalog.json").characters;
  const hero = (slug) => data.find((c) => c.slug === slug);
  const f = F.normalizeFilters({ roles: ["support", "support", "unknown"] });
  assert.deepEqual(f.roles, ["support"]);
  assert(F.matchesFilters(hero("wong"), f));
  assert.equal(F.matchesFilters(hero("hulk"), f), false);
  assert.equal(F.matchesFilters(hero("hand-ninjas-grunts"), f), false);
  assert.equal(F.matchesFilters(character({ slug: "unknown" }), f), false);
  f.roles = ["support", "extract-hunter"];
  assert(F.matchesFilters(hero("wong"), f));
  assert(F.matchesFilters(hero("black-cat"), f));
  f.allRoles = true;
  assert.equal(F.matchesFilters(hero("wong"), f), false);
  assert.equal(F.matchesFilters(hero("black-cat"), f), false);
  f.roles = ["extract-hunter", "controller"];
  assert(F.matchesFilters(hero("black-cat"), f));
  f.minThreat = "4";
  assert.equal(F.matchesFilters(hero("black-cat"), f), false);
  f.minThreat = "";
  assert.equal(
    F.matchesFilters(hero("black-cat"), f, { onlyOwned: true, owned: false }),
    false,
  );
  assert(
    F.matchesFilters(hero("black-cat"), f, { onlyOwned: true, owned: true }),
  );
  const roundtrip = F.decodeFilters(F.encodeFilters(f));
  assert.deepEqual(roundtrip.roles, ["extract-hunter", "controller"]);
  assert.equal(roundtrip.allRoles, true);
  assert(F.matchesFilters(hero("black-cat"), roundtrip));
  assert(
    F.matchesFilters(
      hero("rhino"),
      F.normalizeFilters({ roles: ["extract-hunter"] }),
    ),
  );
  assert.deepEqual(F.normalizeFilters({ roles: "support" }).roles, []);
  assert.equal(F.encodeFilters(F.defaultFilters()), "");
});
