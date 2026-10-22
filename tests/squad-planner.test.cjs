const test = require("node:test"),
  assert = require("node:assert/strict"),
  catalog = require("../data/catalog.json").characters;
const { autorun } = require("mobx");
let P, RosterStore;
test.before(async () => {
  P = await import("../frontend/src/squad-planner.js");
  RosterStore = (await import("../frontend/src/stores/rosters.js")).RosterStore;
});
const byId = new Map(catalog.map((c) => [c.slug, c]));
const slugs = [
  "amazing-spider-man",
  "ultimate-spider-man",
  "ghost-spider",
  "spider-ham",
  "black-cat",
  "venom",
  "wong",
  "moon-knight",
  "daredevil",
  "silk",
];
const models = () => slugs.map((s) => byId.get(s));
const pinned = ["amazing-spider-man", "ultimate-spider-man"];
test("Spider-Man example: minimum five, both locked, exhaustive exact-threat groups", () => {
  const r = P.enumerateSquads(models(), {
    min: 5,
    from: 15,
    to: 20,
    required: pinned,
  });
  assert.deepEqual(r.errors, []);
  const groups = new Map(r.groups.map((g) => [g.threat, g.squads]));
  assert.equal(groups.get(15).length, 0);
  assert.equal(groups.get(16).length, 3);
  assert.equal(groups.get(17).length, 9);
  assert.equal(groups.get(18).length, 19);
  for (const g of r.groups)
    for (const s of g.squads) {
      assert(s.count >= 5);
      assert(pinned.every((p) => s.slugs.includes(p)));
      assert.equal(
        s.slugs.reduce((n, id) => n + byId.get(id).threatLevel, 0),
        g.threat,
      );
    }
  assert(
    r.groups.some((g) => g.squads.some((s) => s.count === 6)),
    "minimum is not an exact model count",
  );
  const six = P.enumerateSquads(models(), {
    min: 6,
    from: 17,
    to: 19,
    required: pinned,
  });
  assert.equal(six.groups[0].squads.length, 0);
  assert.equal(six.groups[2].squads.length, 3);
});
test("enumeration equals an independent bit-mask reference, has no duplicates and never modifies input", () => {
  const input = models(),
    before = JSON.stringify(input),
    r = P.enumerateSquads(input, {
      min: 4,
      from: 14,
      to: 23,
      required: [pinned[0]],
    }),
    expected = [];
  for (let bits = 1; bits < 1 << input.length; bits++) {
    const subset = input.filter((_, i) => bits & (1 << i)),
      threat = subset.reduce((n, c) => n + c.threatLevel, 0);
    if (
      subset.length >= 4 &&
      threat >= 14 &&
      threat <= 23 &&
      subset.some((c) => c.slug === pinned[0])
    )
      expected.push(subset.map((c) => c.slug).join("|"));
  }
  const actual = r.groups.flatMap((g) => g.squads.map((s) => s.key));
  assert.deepEqual(actual.sort(), expected.sort());
  assert.equal(new Set(actual).size, actual.length);
  assert.equal(JSON.stringify(input), before);
});
test("same alter ego cannot occupy two slots; the two Prime Sentinel entries retain their explicit exception", () => {
  const peter = [
    byId.get("amazing-spider-man"),
    byId.get("spider-man"),
    byId.get("wong"),
  ];
  const r = P.enumerateSquads(peter, { min: 1, from: 1, to: 20 });
  assert(
    r.groups.every((g) =>
      g.squads.every(
        (s) =>
          !(
            s.slugs.includes("spider-man") &&
            s.slugs.includes("amazing-spider-man")
          ),
      ),
    ),
  );
  const conflict = P.enumerateSquads(peter, {
    min: 1,
    from: 1,
    to: 20,
    required: ["amazing-spider-man", "spider-man"],
  });
  assert.equal(conflict.total, 0);
  assert.match(conflict.errors[0], /Peter Parker/);
  const primes = P.enumerateSquads(
    ["prime-sentinel-1", "prime-sentinel-2"].map((s) => byId.get(s)),
    { min: 2, from: 6, to: 6 },
  );
  assert.equal(primes.total, 1);
});
test("invalid rosters, bounds, costs and unknown locks return explanations instead of invented squads", () => {
  assert(P.enumerateSquads(models(), { from: 20, to: 15 }).errors.length);
  assert(P.enumerateSquads(models(), { required: ["unknown"] }).errors.length);
  assert(P.enumerateSquads([...models(), byId.get("hulk")]).errors.length);
  assert(
    P.enumerateSquads([{ ...models()[0], threatLevel: null }]).errors.length,
  );
  assert(P.enumerateSquads([byId.get("hand-ninjas-grunts")]).errors.length);
  assert(P.enumerateSquads([models()[0], models()[0]]).errors.length);
  const over = P.enumerateSquads(models(), {
    min: 5,
    from: 1,
    to: 8,
    required: pinned,
  });
  assert.equal(over.total, 0);
  assert.match(over.errors[0], /превышают/);
  assert.equal(P.enumerateSquads(models().slice(0, 3)).total, 0);
  assert.equal(P.squadSettings({ min: "bad", from: "", to: 1000 }).min, 5);
});
test("planner state never dirties or edits a roster; removing a model clears its lock and changing roster resets defaults", () => {
  const store = new RosterStore(
    { snapshot: { rosters: [], groups: [] } },
    { rows: catalog, byId, affiliations: [] },
    { actions: {}, notify: () => {} },
  );
  store.setDraft({ id: "x", name: "Test", characters: slugs });
  store.setSquadField("open", true);
  store.setSquadRequired(pinned[0], true);
  store.setSquadRequired(pinned[1], true);
  assert.equal(store.dirty, false);
  assert.equal(
    store.squadVariants.groups.find((g) => g.threat === 17).squads.length,
    9,
  );
  const dispose = autorun(() => store.squadVariants);
  const cached = store.squadVariants;
  store.setSquadField("threat", 18);
  store.moreSquads();
  assert.equal(
    store.squadVariants,
    cached,
    "changing displayed group or page does not re-enumerate",
  );
  store.removeItem("characters", pinned[0]);
  assert.equal(store.squads.required.includes(pinned[0]), false);
  assert.equal(
    store.squadVariants.groups.some((g) =>
      g.squads.some((s) => s.slugs.includes(pinned[0])),
    ),
    false,
  );
  dispose();
  store.setDraft({ id: "y", name: "Other", characters: ["wong"] });
  assert.equal(store.squads.min, 5);
  assert.deepEqual([...store.squads.required], []);
  assert.equal(store.squads.open, false);
});
