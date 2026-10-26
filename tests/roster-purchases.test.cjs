const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { availability } = require("../tournaments/collection-core.js");
let create;
test.before(async () => {
  create = (await import("../frontend/src/purchase-opportunities.js"))
    .createPurchaseOpportunities;
});
const character = (id, inventoryIds = [id]) => ({ id, name: id, inventoryIds });
const box = (code, ids) => ({
  code,
  name: code,
  characters: ids.map((slug) => ({ slug })),
});
const roster = (ids, extra = {}) => ({
  id: "r",
  characters: ids.map((id) => ({ id })),
  inventoryComplete: true,
  wins: 0,
  losses: 5,
  ...extra,
});
function plan(
  ids,
  boxes,
  owned = [],
  characters = ids.map((id) => character(id)),
) {
  return create({ characters, rosters: [] }, boxes, availability).planRoster(
    roster(ids),
    new Set(owned),
  );
}
test("reverse planning includes poor results and finds minimum overlapping box combinations without permutations", () => {
  const result = plan(
    ["a", "b", "c"],
    [
      box("AB", ["a", "b"]),
      box("BC", ["b", "c"]),
      box("C", ["c"]),
      box("A", ["a"]),
    ],
  );
  assert.equal(result.minimum, 2);
  assert.deepEqual(
    result.plans.map((p) => p.boxes.map((b) => b.code).join("+")).sort(),
    ["A+BC", "AB+BC", "AB+C"],
  );
  assert.equal(
    new Set(result.plans.map((p) => p.boxes.map((b) => b.code).join("+"))).size,
    result.plans.length,
  );
});
test("one box may close several missing models; owned and irrelevant characters are not suggested", () => {
  const result = plan(
    ["a", "b", "c"],
    [
      box("ABC", ["a", "b", "c", "extra"]),
      box("BC", ["b", "c"]),
      box("B", ["b"]),
      box("C", ["c"]),
    ],
    ["a"],
  );
  assert.equal(result.minimum, 1);
  assert.deepEqual(
    result.missing.map((c) => c.id),
    ["b", "c"],
  );
  assert.deepEqual(result.plans.map((p) => p.boxes[0].code).sort(), [
    "ABC",
    "BC",
  ]);
  assert.deepEqual(
    result.plans
      .find((p) => p.boxes[0].code === "ABC")
      .boxes[0].needed.map((c) => c.id),
    ["b", "c"],
  );
});
test("physical Sentinel copies are combined across boxes, not ORed as interchangeable roster slots", () => {
  const chars = [character("sentinel", ["s1", "s2"])],
    boxes = [box("ONE", ["s1"]), box("TWO", ["s2"])];
  const two = plan(["sentinel", "sentinel"], boxes, [], chars);
  assert.equal(two.minimum, 2);
  assert.equal(two.missing[0].count, 2);
  assert.equal(plan(["sentinel", "sentinel"], boxes, ["s1"], chars).minimum, 1);
  assert.equal(
    plan(
      ["sentinel", "sentinel"],
      [...boxes, box("BOTH", ["s1", "s2"])],
      [],
      chars,
    ).minimum,
    1,
  );
});
test("owned roster needs no purchases; partial and unavailable catalog entries do not claim full completion", () => {
  assert.equal(plan(["a"], [box("A", ["a"])], ["a"]).minimum, 0);
  const unavailable = plan(["a", "b"], [box("A", ["a"])]);
  assert.equal(unavailable.minimum, null);
  assert.equal(unavailable.choices.find((c) => c.id === "b").boxes.length, 0);
  const index = create(
    { characters: [character("a")], rosters: [] },
    [box("A", ["a"])],
    availability,
  );
  assert.equal(
    index.planRoster(roster(["a"], { inventoryComplete: false }), new Set())
      .complete,
    false,
  );
});
test("minimum agrees with exhaustive purchase subsets on small varied catalogs", () => {
  const ids = ["a", "b", "c", "d", "e"],
    chars = ids.map((id) => character(id)),
    byId = new Map(chars.map((c) => [c.id, c]));
  for (let seed = 0; seed < 25; seed++) {
    const boxes = Array.from({ length: 7 }, (_, i) =>
      box(
        "B" + i,
        ids.filter((id, j) => (seed * 7 + i * 11 + j * 3 + 1) % 13 < 5),
      ),
    );
    const owned = new Set(seed % 2 ? ["a"] : []),
      row = roster(ids);
    let exact = Infinity;
    for (let mask = 0; mask < 1 << boxes.length; mask++) {
      const selected = boxes.filter((b, i) => mask & (1 << i));
      const inventory = new Set([
        ...owned,
        ...selected.flatMap((b) => b.characters.map((c) => c.slug)),
      ]);
      if (availability(row, byId, inventory).ready)
        exact = Math.min(exact, selected.length);
    }
    const result = create(
      { characters: chars, rosters: [] },
      boxes,
      availability,
    ).planRoster(row, owned);
    assert.equal(
      result.minimum,
      Number.isFinite(exact) ? exact : null,
      "seed " + seed,
    );
    for (const p of result.plans) {
      assert.equal(p.boxes.length, exact);
      assert(
        availability(
          row,
          byId,
          new Set([
            ...owned,
            ...p.boxes.flatMap((b) => b.characters.map((c) => c.slug)),
          ]),
        ).ready,
      );
    }
  }
});
