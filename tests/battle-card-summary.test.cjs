"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const Core = require("../battle-core.js"),
  Summary = require("../battle-card-summary.js");
const root = path.resolve(__dirname, "../data"),
  catalog = JSON.parse(fs.readFileSync(path.join(root, "catalog.json")));
function fighter(slug) {
  const detail = JSON.parse(
    fs.readFileSync(path.join(root, "cards", slug + ".json")),
  );
  const f = Core.fighter(
    catalog.characters.find((c) => c.slug === slug),
    detail,
    slug,
  );
  return [{ references: { [slug]: detail } }, f];
}
test("energy indicators distinguish free, passive, fixed and variable costs without claiming 100 power is needed", () => {
  assert.deepEqual(Summary.energy("3", 2), {
    kind: "fixed",
    cost: 3,
    power: 2,
    missing: 1,
  });
  assert.equal(Summary.energy(3, 5).missing, 0);
  assert.equal(Summary.energy(0, 0).missing, 0);
  assert.equal(Summary.energy(null, 0).kind, "none");
  for (const value of [100, "100", "X"])
    assert.equal(Summary.energy(value, 2).kind, "variable");
});
test("printed stats and all abilities follow the battle side and form, not the viewer; reads never mutate state", () => {
  const [m, f] = fighter("ant-man"),
    before = JSON.stringify([m, f]);
  const normal = Summary.describe(m, f);
  assert.equal(normal.stats.move, "M");
  assert(normal.abilities.some((a) => a.name === "Bullet Ant Barrage"));
  assert.equal(JSON.stringify([m, f]), before);
  f.form = 1;
  const tiny = Summary.describe(m, f);
  assert.equal(tiny.stats.move, "S");
  assert(tiny.abilities.some((a) => a.name === "Ant-Sized Uppercut"));
  assert(!tiny.abilities.some((a) => a.name === "Bullet Ant Barrage"));
  assert.notEqual(tiny.abilities[0].key, normal.abilities[0].key);
  f.face = "back";
  assert.equal(Summary.describe(m, f).face.type, "injured");
});
test("keyword groups keep bracketed condition lists together and explain traits without card bodies", () => {
  const traits = Summary.keywords("Flight, Immunity [Poison, Stun], Peerless");
  assert.equal(traits.length, 3);
  assert.equal(traits[1].name, "Immunity [Poison, Stun]");
  assert(traits.every((t) => t.body));
  assert(Summary.keywords("Wallcrawler")[0].body);
});
