const test = require("node:test");
const assert = require("node:assert/strict");
const { act, create, view } = require("../game/engine.cjs");
const { pool } = require("../game/catalog.cjs");
const { trial } = require("./helpers/game.cjs");

const blank = () => 7;
const activate = (s) =>
  act(s, "p1", { type: "activate", value: s.fighters[0].id });
const action = (s, side = "p1") => view(s, side).actions[side][0];
const attack = (s, target, index = 0, random = blank) =>
  act(
    s,
    "p1",
    { type: "attack", target: target.id, index, damageType: "physical" },
    random,
  );
const terrain = (id, x, y, size) => ({ id, name: id, x, y, size, w: 1, h: 1 });

test("Reverse Polarity rerolls attack dice inside Range 2 and pushes outside Range 2", () => {
  const s = trial([
    ["p1", "magneto", 8],
    ["p2", "hulk", 12],
  ]);
  const [magneto, hulk] = s.fighters;
  hulk.power = 0;
  activate(s);
  attack(s, hulk);
  assert.equal(action(s).label, "Reverse Polarity");
  act(s, "p1", { type: "modify-dice", indices: [0, 1] }, () => 2);
  assert.equal(magneto.power, 5);
  hulk.x = 14;
  hulk.power = 0;
  attack(s, hulk);
  assert.equal(action(s).mode, "push");
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(hulk.x, 17.25);
});

test("Magnetic Crush destroys nearby terrain, lets Magneto choose the bonus and damages bystanders", () => {
  const s = trial([
    ["p1", "magneto", 8],
    ["p2", "hulk", 13],
    ["p2", "hawkeye", 13],
  ]);
  const [magneto, hulk, hawkeye] = s.fighters;
  hawkeye.y = 11;
  hulk.power = 0;
  magneto.power = 5;
  s.terrain = [
    terrain("car", 13, 10, 3),
    terrain("bench", 14, 6, 1),
    terrain("tower", 13, 5, 4),
  ];
  activate(s);
  attack(s, hulk, 1);
  assert.deepEqual(
    s.terrain.map((t) => t.id),
    ["tower"],
  );
  assert.equal(action(s).type, "magnetic-crush");
  act(s, "p1", { type: "magnetic-crush", value: "car" }, blank);
  assert.equal(s.log.at(-1).rolled.length, 11);
  assert.equal(hawkeye.damage, 1);
  assert.equal(magneto.power, 0);
});

test("Fatal Attraction pays an increasing cost and From the Ruins gives each ally one Power per turn", () => {
  const s = trial([
    ["p1", "magneto", 8],
    ["p1", "quicksilver", 13],
    ["p2", "hawkeye", 21],
  ]);
  const [magneto, ally] = s.fighters;
  s.leaders.p1 = magneto.slug + ":From the Ruins . . .";
  magneto.power = 6;
  s.terrain = [terrain("car", 8, 10, 1), terrain("bench", 8, 12, 1)];
  activate(s);
  const use = (id) => {
    act(s, "p1", { type: "power", value: "Fatal Attraction", target: id });
    assert.equal(action(s).speed, "L");
    act(s, "p1", { type: "throw-terrain", angle: 180 });
  };
  use("car");
  assert.equal(magneto.power, 4);
  act(s, "p1", { type: "from-the-ruins", value: ally.id });
  assert.equal(ally.power, 4);
  use("bench");
  assert.equal(magneto.power, 1);
  assert.deepEqual(
    action(s).options.map((o) => o.value),
    [magneto.id],
  );
  act(s, "p1", { type: "from-the-ruins", value: magneto.id });
  assert.equal(magneto.power, 2);
  assert.equal(s.actionsLeft, 2);
});

test("Master of Magnetism places up to two Size 2 constructs and grants Power for each", () => {
  const s = trial([
    ["p1", "magneto", 8],
    ["p2", "hawkeye", 25],
  ]);
  const [magneto, hawkeye] = s.fighters;
  s.phase = "round-priority";
  const priority = [0, 0, 0, 0, 0, 7, 7, 7, 7, 7];
  act(s, "p1", { type: "roll" }, () => priority.shift());
  assert.equal(action(s).type, "place-construct");
  assert.throws(
    () => act(s, "p1", { type: "place-construct", x: 8, y: 8 }),
    /области/,
  );
  act(s, "p1", { type: "place-construct", x: 8, y: 11 });
  assert.equal(s.terrain[0].size, 2);
  assert.equal(magneto.power, 5);
  activate(s);
  act(s, "p1", { type: "end" });
  act(s, "p2", { type: "activate", value: hawkeye.id });
  act(s, "p2", { type: "end" });
  act(s, "p1", { type: "place-construct", x: 8, y: 5 });
  assert.equal(magneto.power, 8);
  assert.equal(s.terrain.filter((t) => t.construct === "p1").length, 2);
});

test("Polarity Shielding prevents the chosen displacement before Hulk resolves Strike damage", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "magneto", 12],
  ]);
  const [, magneto] = s.fighters;
  activate(s);
  const dice = [1, 2];
  attack(s, magneto, 0, () => dice.shift() ?? 7);
  assert.equal(action(s).type, "start-displacement");
  act(s, "p1", { type: "start-displacement" });
  assert.equal(action(s, "p2").type, "polarity-shielding");
  act(s, "p2", { type: "polarity-shielding", value: "pay" }, blank);
  assert.equal(magneto.x, 12);
  assert.equal(magneto.damage, 2);
  assert.equal(magneto.power, 3);
});

test("Peerless rejects Hulk and Magneto in the same squad", () => {
  const avengers = pool.presets[0];
  const roster = {
    ...avengers,
    characters: avengers.characters.map((id) =>
      id === "doc-ock-sinister-scientist" ? "magneto" : id,
    ),
  };
  const s = create({ p1: roster, p2: "cabal" }, 1);
  s.phase = "squad";
  s.threat = 17;
  assert.throws(
    () =>
      act(s, "p1", {
        type: "squad",
        characters: ["hulk", "magneto"],
        tactics: [],
      }),
    /Peerless/,
  );
  act(s, "p1", {
    type: "squad",
    characters: ["magneto", "hawkeye"],
    tactics: [],
  });
  assert.deepEqual(view(s, "p1").ownCommit.characters, ["magneto", "hawkeye"]);
});

test("Magneto’s Flight crosses Size 5 terrain and his Shock immunity survives incoming effects", () => {
  const s = trial([
    ["p1", "magneto", 8],
    ["p2", "the-black-widow", 16],
  ]);
  const [magneto, widow] = s.fighters;
  s.terrain = [{ id: "wall", size: 5, x: 10, y: 0, w: 1, h: 36 }];
  activate(s);
  act(s, "p1", { type: "advance", x: 13, y: 8 });
  act(s, "p1", { type: "end" });
  act(s, "p2", { type: "activate", value: widow.id });
  const dice = [1];
  act(
    s,
    "p2",
    { type: "attack", target: magneto.id, index: 0, damageType: "energy" },
    () => dice.shift() ?? 7,
  );
  assert.equal(magneto.damage, 1);
  assert.ok(!magneto.conditions?.includes("shock"));
});

test("all four new fighters are legal together in a saved Game roster", () => {
  const avengers = pool.presets[0];
  const characters = ["quicksilver", "magneto", "toad", "rogue"];
  const roster = {
    ...avengers,
    characters: [...characters, ...avengers.characters.slice(0, 6)],
  };
  const s = create({ p1: roster, p2: "cabal" }, 1);
  s.phase = "squad";
  s.threat = 17;
  s.priority = "p1";
  act(s, "p1", { type: "squad", characters, tactics: [] });
  act(s, "p2", {
    type: "squad",
    characters: ["crossbones-merciless-merc"],
    tactics: [],
  });
  assert.deepEqual(
    s.fighters.filter((f) => f.side === "p1").map((f) => f.slug),
    characters,
  );
});
