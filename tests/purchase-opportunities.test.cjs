const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { availability } = require("../tournaments/collection-core.js");
let create;
test.before(async () => {
  create = (await import("../frontend/src/purchase-opportunities.js"))
    .createPurchaseOpportunities;
});
const box = (code, ids) => ({
  code,
  characters: ids.map((slug) => ({ slug })),
});
const character = (id, inventoryIds = [id]) => ({ id, name: id, inventoryIds });
const roster = (id, ids, wins = 4, losses = 1, extra = {}) => ({
  id,
  characters: ids.map((id) => ({ id })),
  inventoryComplete: true,
  wins,
  losses,
  provisional: false,
  ...extra,
});
const chars = ["h", "a", "b", "c", "d"].map((id) => character(id));
test("counts only newly unlocked or useful two-box completions; OR thresholds and alternative boxes do not inflate totals", () => {
  const boxes = [
    box("A", ["a", "b"]),
    box("C", ["c"]),
    box("D", ["d"]),
    box("CD", ["c", "d"]),
    box("EMPTY", []),
  ];
  const rows = [
    roster("one", ["h", "a"]),
    roster("two", ["h", "a", "c"], 3, 0),
    roster("three", ["h", "b", "d"], 4, 0),
    roster("four", ["h", "a", "c", "d"], 5, 1),
    roster("irrelevant", ["h", "c"]),
    roster("ready", ["h"]),
  ];
  const index = create(
    { characters: chars, rosters: [...rows, rows[0]] },
    boxes,
    availability,
  );
  const stats = index.evaluate(new Set(["h"])).get("A");
  assert.deepEqual(stats.unlocked, ["one"]);
  assert.deepEqual(stats.almost, ["two", "three", "four"]);
  assert.deepEqual(stats.complements.get("CD"), ["two", "three", "four"]);
  assert.deepEqual(stats.complements.get("C"), ["two"]);
  assert.deepEqual(stats.complements.get("D"), ["three"]);
  assert(!stats.complements.has("A"));
  assert.equal(index.evaluate(new Set(["h"])).get("EMPTY").almost.length, 0);
});
test("rejects losing/lower records, provisional/unresolved/incomplete lists; respects exact win/loss boundary", () => {
  const rows = [
    roster("3-0", ["a"], 3, 0),
    roster("4-1", ["a"]),
    roster("8-1", ["a"], 8, 1),
    roster("4-0", ["a"], 4, 0),
    roster("3-1", ["a"], 3, 1),
    roster("2-0", ["a"], 2, 0),
    roster("4-2", ["a"], 4, 2),
    roster("pending", ["a"], 4, 0, { provisional: true }),
    roster("partial", ["a"], 4, 0, { inventoryComplete: false }),
    roster("unknown", ["missing"]),
    roster("invalid", ["a"], null, 0),
  ];
  const stats = create(
    { characters: chars, rosters: rows },
    [box("A", ["a"])],
    availability,
  )
    .evaluate(new Set())
    .get("A");
  assert.deepEqual(stats.unlocked, ["3-0", "4-1", "8-1", "4-0"]);
});
test("owning or purchasing models recalculates marginal value; planned boxes are not assumed owned", () => {
  const index = create(
    { characters: chars, rosters: [roster("r", ["h", "a", "c"])] },
    [box("A", ["a"]), box("C", ["c"])],
    availability,
  );
  assert.equal(index.evaluate(new Set(["h"])).get("A").almost.length, 1);
  assert.equal(index.evaluate(new Set(["h", "c"])).get("A").unlocked.length, 1);
  const owned = index.evaluate(new Set(["h", "a", "c"]));
  assert.equal(owned.get("A").unlocked.length, 0);
  assert.equal(owned.get("C").almost.length, 0);
});
test("multiple inventory alternatives preserve physical copy constraints for duplicate Sentinel entries", () => {
  const archive = {
    characters: [character("sentinel", ["s1", "s2"]), character("a")],
    rosters: [roster("twins", ["sentinel", "sentinel", "a"])],
  };
  const boxes = [
    box("ONE", ["s1"]),
    box("TWO", ["s2"]),
    box("BOTH", ["s1", "s2"]),
    box("A", ["a"]),
  ];
  const result = create(archive, boxes, availability).evaluate(new Set(["a"]));
  assert.equal(result.get("ONE").unlocked.length, 0);
  assert.deepEqual(result.get("ONE").complements.get("TWO"), ["twins"]);
  assert.deepEqual(result.get("BOTH").unlocked, ["twins"]);
  const complete = create(archive, boxes, availability).evaluate(
    new Set(["a", "s2"]),
  );
  assert.deepEqual(complete.get("ONE").unlocked, ["twins"]);
});
test("MobX results react to manual ownership and box purchases, but not wishlist or search changes", async () => {
  const { LibraryStore } = await import("../frontend/src/stores/library.js");
  const { PurchaseStore } = await import("../frontend/src/stores/purchases.js");
  const { autorun } = await import("mobx");
  const library = new LibraryStore(),
    purchases = new PurchaseStore(library);
  const boxes = [box("A", ["a"]), box("C", ["c"])];
  purchases.load({ sets: boxes });
  library.configure({
    boxes: purchases.byCode,
    characters: new Map(chars.map((c) => [c.id, c])),
  });
  purchases.configureArchive(
    { characters: chars, rosters: [roster("r", ["a", "c"])] },
    availability,
  );
  let runs = 0,
    current;
  const stop = autorun(() => {
    current = purchases.opportunities;
    runs++;
  });
  assert.equal(current.get("A").almost.length, 1);
  const initial = current;
  library.toggleWishlist("C");
  purchases.setQuery("C");
  assert.equal(current, initial);
  assert.equal(runs, 1);
  library.togglePurchased("C");
  assert.equal(current.get("A").unlocked.length, 1);
  library.setOwned("a", true);
  assert.equal(current.get("A").unlocked.length, 0);
  stop();
});
test("alternate-sculpt boxes unlock and own canonical characters consistently", async () => {
  const { LibraryStore } = await import("../frontend/src/stores/library.js");
  const boxes = require("../data/box-sets.json").sets;
  const ids = ["doctor-octopus", "spider-man"];
  const set = boxes.find((b) => b.code === "CPE01");
  assert.deepEqual(set.characters.map((c) => c.slug).sort(), ids);
  assert(set.characters.every((c) => c.sourceSlug.startsWith("rival-panel-")));
  const characters = ids.map((id) => character(id));
  const index = create(
    { characters, rosters: [roster("r", ids)] },
    boxes,
    availability,
  );
  assert.deepEqual(index.evaluate(new Set()).get("CPE01").unlocked, ["r"]);
  const library = new LibraryStore();
  library.configure({
    boxes: new Map(boxes.map((b) => [b.code, b])),
    characters: new Map(characters.map((c) => [c.id, c])),
  });
  library.togglePurchased("CPE01");
  assert(ids.every((id) => library.owned.has(id)));
  assert.equal(
    index.evaluate(new Set(library.owned.keys())).get("CPE01").unlocked.length,
    0,
  );
});
