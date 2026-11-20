const { test } = require("node:test"),
  assert = require("node:assert/strict");
let A;
test.before(async () => {
  A = await import("../frontend/src/tactics-album.js");
});
const characters = [
  { slug: "carnage", name: "Carnage", affiliations: [{ name: "Spider Foes" }, { name: "Cabal" }] },
  { slug: "loki", name: "Loki, God of Mischief", alterEgo: "Loki Laufeyson", affiliations: [{ name: "Asgard" }] },
];
const cards = {
  "foes-plan": { name: "Foes Plan", affiliation: { name: "Spider Foes" } },
  "carnage-rules": { name: "Carnage Rules", requirementsItems: { mandatory_character: ["carnage"] } },
  "trick": { name: "Trick", requirementsItems: { mandatory_alter_ego: ["Loki Laufeyson"] } },
  "dig-in": { name: "Dig In", requirementsItems: {} },
};
const boxes = {
  A: { name: "Box A", tactics: [{ slug: "dig-in", name: "Dig In", amount: 1 }, { slug: "carnage-rules", name: "Carnage Rules", amount: 1 }] },
  B: { name: "Box B", tactics: [{ slug: "foes-plan", name: "Foes Plan", amount: 2 }, { slug: "trick", name: "Trick", amount: 1 }, { slug: "dig-in", name: "Dig In", amount: 1, artwork: "dig-in-2" }] },
};
const build = (codes) => A.buildTacticsAlbum(codes, (c) => boxes[c], (s) => cards[s], characters);
test("each distinct artwork gets its own number, grouped by affiliation", () => {
  boxes.E = { name: "Box E", tactics: [{ slug: "dig-in", name: "Dig In", amount: 1 }] };
  const album = build(["A", "B", "E"]);
  assert.deepEqual(
    album.map((s) => [s.number, s.group, s.name, s.box]),
    [
      [1, "Asgard", "Trick", "B"],
      [2, "Spider Foes", "Foes Plan", "B"],
      [3, "Spider Foes", "Carnage Rules", "A"],
      [4, A.GENERAL_GROUP, "Dig In", "A"],
      [5, A.GENERAL_GROUP, "Dig In", "B"],
    ],
  );
  assert.equal(album[4].artwork, "dig-in-2");
  assert.match(album[4].art, /card_backs\/dig-in-2\.png$/);
  assert.match(album[3].art, /card_backs\/dig-in\.png$/);
  assert.equal(album[2].character, "Carnage");
});
test("pages hold eight pockets, two pages per sheet", () => {
  boxes.C = {
    name: "Big",
    tactics: Array.from({ length: 17 }, (_, i) => ({ slug: "dig-in", name: "Dig In", amount: 1, artwork: "dig-in-" + (i + 10) })),
  };
  const album = build(["C"]);
  assert.deepEqual(
    [album[0], album[7], album[8], album[16]].map((s) => [s.page, s.sheet, s.side, s.pocket]),
    [[1, 1, "А", 1], [1, 1, "А", 8], [2, 1, "Б", 1], [3, 2, "А", 1]],
  );
  assert.equal(A.pageLabel(4), "Лист 2 · сторона Б");
});
test("search matches names case-insensitively and ignores curly quotes", () => {
  cards["giants"] = { name: "Giant‘s Blood", affiliation: { name: "Asgard" } };
  boxes.D = { name: "D", tactics: [{ slug: "giants", name: "Giant‘s Blood", amount: 1 }] };
  const album = build(["A", "D"]);
  assert.deepEqual(A.searchAlbum(album, "CARN").map((s) => s.name), ["Carnage Rules"]);
  assert.deepEqual(A.searchAlbum(album, "giant's").map((s) => s.name), ["Giant‘s Blood"]);
  assert.deepEqual(A.searchAlbum(album, "  "), []);
});
test("saved order keeps numbers; new cards go to the end, missing ones leave holes", () => {
  const sorted = (codes) => A.collectTactics(codes, (c) => boxes[c], (s) => cards[s], characters);
  const first = A.numberAlbum(sorted(["B"]));
  assert.deepEqual(first.added, first.order);
  const later = A.numberAlbum(sorted(["A", "B"]), first.order);
  assert.deepEqual(
    later.slots.map((s) => [s.number, s.name, s.box]),
    [
      [1, "Trick", "B"],
      [2, "Foes Plan", "B"],
      [3, "Dig In", "B"],
      [4, "Carnage Rules", "A"],
      [5, "Dig In", "A"],
    ],
  );
  assert.deepEqual(later.added, ["carnage-rules", "dig-in"]);
  const without = A.numberAlbum(sorted(["A"]), later.order);
  assert.deepEqual(without.slots.map((s) => s.number), [4, 5]);
  assert.deepEqual(without.added, []);
});
test("search also finds cards by the characters they name", () => {
  cards["fan"] = {
    name: "Fan Club",
    requirementsItems: { mandatory_character_with_alter_ego: ["carnage|Cletus Kasady"] },
  };
  boxes.F = { name: "F", tactics: [{ slug: "fan", name: "Fan Club", amount: 1 }] };
  const album = build(["F"]);
  assert.deepEqual(A.searchAlbum(album, "cletus").map((s) => s.name), ["Fan Club"]);
  assert.deepEqual(A.searchAlbum(album, "carnage").map((s) => s.name), ["Fan Club"]);
});
