const test = require("node:test"),
  assert = require("node:assert/strict"),
  { autorun } = require("mobx");
const characters = require("../data/catalog.json").characters,
  boxes = require("../data/box-sets.json").sets;
let LibraryStore, validateLibrary;
test.before(async () => {
  ({ LibraryStore } = await import("../frontend/src/stores/library.js"));
  ({ validateLibrary } = await import("../frontend/src/validation.js"));
});
function library(write = () => {}) {
  const s = new LibraryStore({
    write,
    validate: (v) =>
      validateLibrary(v, new Map(characters.map((c) => [c.slug, c]))),
  });
  s.configure({
    characters: new Map(characters.map((c) => [c.slug, c])),
    boxes: new Map(boxes.map((b) => [b.code, b])),
  });
  return s;
}
test("legacy saves get empty progress; stages persist across export/import and reversible ownership changes", () => {
  const s = library();
  s.replace({
    version: 1,
    owned: ["wong"],
    rosters: [{ id: "x", name: "Existing", characters: ["wong"] }],
  });
  assert.deepEqual(s.serialize().hobbyProgress, {});
  for (const stage of ["assembled", "primed", "painted"]) {
    assert(s.setHobbyProgress("wong", stage));
    assert.equal(s.hobby.get("wong"), stage);
  }
  const data = JSON.parse(JSON.stringify(s.serialize())),
    next = library();
  validateLibrary(data, next.characters);
  next.replace(data);
  assert.equal(next.hobby.get("wong"), "painted");
  assert.deepEqual(next.snapshot.rosters[0].characters, ["wong"]);
  next.setOwned("wong", false);
  assert.equal(next.hobby.get("wong"), "painted");
  assert.equal(next.setHobbyProgress("wong", "primed"), false);
  next.setOwned("wong", true);
  assert.equal(next.hobby.get("wong"), "painted");
  assert(next.setHobbyProgress("wong", ""));
  assert.equal(next.hobby.has("wong"), false);
});
test("box ownership enables per-character stages, changes only the relevant observable key, and failed writes publish nothing", () => {
  let fail = false;
  const s = library(() => {
    if (fail) throw Error("quota");
  });
  s.togglePurchased("CP170");
  const unrelated = [],
    stop = autorun(() => unrelated.push(s.hobby.get("spider-ham")));
  assert(s.setHobbyProgress("silk", "primed"));
  assert(s.setHobbyProgress("spider-man-noir", "painted"));
  assert.deepEqual(unrelated, [undefined]);
  assert.equal(s.hobby.get("silk"), "primed");
  const before = JSON.stringify(s.serialize());
  fail = true;
  assert.equal(s.setHobbyProgress("silk", "painted"), false);
  assert.equal(s.hobby.get("silk"), "primed");
  assert.equal(JSON.stringify(s.serialize()), before);
  fail = false;
  s.togglePurchased("CP170");
  assert.equal(s.owned.has("silk"), false);
  assert.equal(s.hobby.get("silk"), "primed");
  s.togglePurchased("CP170");
  assert.equal(s.hobby.get("spider-man-noir"), "painted");
  stop();
});
test("imports reject malformed stages and unknown characters; only owned models can be edited", () => {
  const s = library(),
    base = { version: 1, owned: [], rosters: [] };
  for (const hobbyProgress of [
    null,
    [],
    true,
    "painted",
    { unknown: "painted" },
    { wong: "glued" },
    { wong: null },
    { wong: 3 },
  ])
    assert.throws(() =>
      validateLibrary({ ...base, hobbyProgress }, s.characters),
    );
  validateLibrary(
    { ...base, hobbyProgress: { wong: "painted" } },
    s.characters,
  );
  assert.equal(s.setHobbyProgress("wong", "assembled"), false);
  s.setOwned("wong", true);
  assert.equal(s.setHobbyProgress("wong", "bad"), false);
  assert.equal(s.setHobbyProgress("unknown", "painted"), false);
});
