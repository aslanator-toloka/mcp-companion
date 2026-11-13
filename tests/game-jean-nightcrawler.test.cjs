const test = require("node:test");
const assert = require("node:assert/strict");
const { act, view } = require("../game/engine.cjs");
const { trial } = require("./helpers/game.cjs");

const dice =
  (...rolls) =>
  () =>
    rolls.shift() ?? 7;
const activate = (s, fighter = s.fighters[0]) =>
  act(s, fighter.side, { type: "activate", value: fighter.id });
const options = (s, side = "p1") => view(s, side).actions[side];
const hit = (s, target, index = 0, damageType = "physical", random = dice()) =>
  act(
    s,
    "p1",
    { type: "attack", target: target.id, index, damageType },
    random,
  );
const terrain = (id, size, x = 8, y = 10) => ({
  id,
  name: id,
  size,
  x,
  y,
  w: 1,
  h: 1,
});

test("Psionic Bolt saps on Wild and Pierce triggers on Failure", () => {
  const s = trial([
    ["p1", "jean-grey", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [jean, target] = s.fighters;
  activate(s);
  hit(s, target, 0, "mystic", dice(5, 1, 7, 7, 7, 4));
  assert.deepEqual(options(s)[0].eligible, [0]);
  act(s, "p1", { type: "modify-dice", indices: [0] });
  assert.equal(jean.power, 5);
  assert.equal(target.damage, 1);
  assert.equal(target.power, 3);
});

test("Telekinetic Force throws Away before damage and Explosive reaches other enemies", () => {
  const s = trial([
    ["p1", "jean-grey", 8],
    ["p2", "hawkeye", 12],
    ["p2", "pyro", 15],
  ]);
  const [jean, target, nearby] = s.fighters;
  jean.power = 5;
  nearby.y = 11;
  activate(s);
  hit(s, target, 1, "physical", dice(1));
  assert.equal(options(s)[0].direction, "away");
  assert.equal(target.damage || 0, 0);
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(target.x, 15.25);
  assert.equal(target.damage, 1);
  assert.equal(nearby.damage, 1);
});

test("Matter Transmutation pushes only another activated fighter and cannot repeat that target", () => {
  const s = trial([
    ["p1", "jean-grey", 8],
    ["p1", "hawkeye", 11],
    ["p2", "pyro", 12],
  ]);
  const [jean, ally, enemy] = s.fighters;
  jean.power = 8;
  ally.activated = true;
  enemy.y = 10;
  activate(s);
  const power = () =>
    options(s)
      .find((a) => a.type === "power")
      ?.powers.find((p) => p.value === "Matter Transmutation");
  assert.deepEqual(
    power().targets.map((t) => t.value),
    [ally.id],
  );
  act(s, "p1", {
    type: "power",
    value: "Matter Transmutation",
    target: ally.id,
  });
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(ally.x, 14.25);
  assert.equal(jean.power, 5);
  assert.equal(power(), undefined);
});

test("Jean can Shield Mind against a hostile push and gains two additional Power in Power Phase", () => {
  const s = trial([
    ["p1", "avalanche", 8],
    ["p2", "jean-grey", 15],
    ["p2", "hawkeye", 12],
  ]);
  const [avalanche, jean, ally] = s.fighters;
  activate(s);
  act(s, "p1", { type: "power", value: "Landslide", target: ally.id });
  if (options(s).some((a) => a.type === "start-displacement"))
    act(s, "p1", { type: "start-displacement" });
  act(s, "p2", { type: "shield-mind", value: "shield:" + jean.id });
  assert.equal(ally.x, 12);
  assert.equal(jean.power, 1);
  act(s, "p1", { type: "end" });
  for (const fighter of [jean, ally]) {
    activate(s, fighter);
    act(s, "p2", { type: "end" });
  }
  assert.equal(s.round, 2);
  assert.equal(jean.power, 4);
  assert.equal(avalanche.power, 2);
});

test("Battlefield Manipulation throws Size 4 terrain Medium; Flight crosses Size 5", () => {
  const s = trial([
    ["p1", "jean-grey", 8],
    ["p2", "pyro", 20],
  ]);
  s.terrain = [
    terrain("truck", 4),
    { id: "wall", size: 5, x: 10, y: 0, w: 1, h: 36 },
  ];
  activate(s);
  act(s, "p1", {
    type: "power",
    value: "Battlefield Manipulation",
    target: "truck",
  });
  assert.equal(options(s)[0].speed, "M");
  act(s, "p1", { type: "throw-terrain", angle: 180 });
  assert.deepEqual(
    s.terrain.map((t) => t.id),
    ["wall"],
  );
  act(s, "p1", { type: "advance", x: 12, y: 8 });
  assert.equal(s.fighters[0].x, 12);
});

test("BAMF spends up to three Power, Brimstone Blitz counts each Place and Flurry keeps the original defender", () => {
  const s = trial([
    ["p1", "nightcrawler", 8],
    ["p2", "hawkeye", 17],
    ["p2", "pyro", 17],
  ]);
  const [kurt, target, other] = s.fighters;
  other.y = 11;
  kurt.power = 6;
  activate(s);
  assert.throws(
    () => act(s, "p1", { type: "power", value: "BAMF!", amount: 4 }),
    /Power/,
  );
  act(s, "p1", { type: "power", value: "BAMF!", amount: 3 });
  assert.equal(options(s)[0].range, 3);
  act(s, "p1", { type: "displace", x: 13, y: 8 });
  hit(s, target, 1, "physical", dice(0, 2));
  assert.equal(
    s.log.at(-1).rolled.length,
    7,
    "five base, one Place, one critical die",
  );
  assert.equal(options(s)[0].type, "strike-order");
  act(s, "p1", { type: "strike-order", value: "0" });
  act(s, "p1", { type: "puff-smoke" });
  act(s, "p1", { type: "displace", x: 15, y: 9 });
  assert.ok(
    options(s)[0].attacks.every(
      (a) => a.targets.length === 1 && a.targets[0].value === target.id,
    ),
  );
  hit(s, target, 1);
  assert.equal(s.log.at(-1).rolled.length, 7);
  assert.equal(s.actionsLeft, 1);
  assert.equal(kurt.power, 1);
});

test("Teleporting Strike only Stuns when it deals damage outside Range 2", () => {
  for (const [x, expected] of [
    [11, false],
    [14, true],
  ]) {
    const s = trial([
      ["p1", "nightcrawler", 8],
      ["p2", "hawkeye", x],
    ]);
    activate(s);
    hit(s, s.fighters[1], 0, "physical", dice(2));
    assert.equal(!!s.fighters[1].conditions?.includes("stun"), expected);
  }
});

test("Unglaublich Acrobatics adds two dice to a physical defense or a collision dodge", () => {
  const defense = trial([
    ["p1", "hawkeye", 8],
    ["p2", "nightcrawler", 12],
  ]);
  activate(defense);
  hit(defense, defense.fighters[1]);
  act(defense, "p2", { type: "reaction", value: "acrobatic-defense" }, dice());
  assert.equal(defense.log.at(-1).defense.length, 6);

  const dodge = trial([
    ["p1", "hulk", 8],
    ["p2", "nightcrawler", 12],
  ]);
  dodge.terrain = [terrain("truck", 4)];
  activate(dodge);
  act(dodge, "p1", {
    type: "power",
    value: "Strongest One There Is",
    target: "truck",
  });
  act(dodge, "p1", { type: "throw-terrain", angle: 0 });
  act(dodge, "p2", { type: "acrobatic-dodge" }, () => 4);
  assert.equal(
    dodge.log.find((e) => e.rolls?.[0].label === "Уклонение").rolls[0].faces
      .length,
    6,
  );
  assert.equal(dodge.fighters[1].damage || 0, 0);
  assert.equal(dodge.fighters[1].power, 1);
});

test("Invisible in Shadow provides Stealth near qualifying terrain and Wallcrawler applies to Advance", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "nightcrawler", 16],
  ]);
  const [, kurt] = s.fighters;
  s.terrain = [terrain("near", 2, 16, 9.5)];
  activate(s);
  assert.ok(!options(s).some((a) => a.type === "attack"));
  s.terrain = [{ id: "wall", size: 5, x: 18, y: 0, w: 1, h: 36 }];
  assert.ok(options(s).some((a) => a.type === "attack"));
  act(s, "p1", { type: "end" });
  activate(s, kurt);
  act(s, "p2", { type: "advance", x: 20, y: 8 });
  assert.equal(kurt.x, 20);
});

test("six new X-Men can deploy from a saved Game roster", () => {
  const { create } = require("../game/engine.cjs");
  const { pool } = require("../game/catalog.cjs");
  const preset = pool.presets[0];
  const newcomers = [
    "beast",
    "wolverine",
    "cyclops",
    "storm",
    "jean-grey",
    "nightcrawler",
  ];
  const s = create(
    {
      p1: {
        ...preset,
        characters: [...newcomers, ...preset.characters.slice(0, 4)],
      },
      p2: "cabal",
    },
    1,
  );
  Object.assign(s, {
    phase: "squad",
    threat: 24,
    priority: "p1",
    terrain: [],
    deployment: { p1: "south", p2: "north" },
  });
  act(s, "p1", {
    type: "squad",
    characters: newcomers,
    tactics: [],
    affiliation: "Uncanny X-Men",
  });
  act(s, "p2", {
    type: "squad",
    characters: ["crossbones-merciless-merc"],
    tactics: [],
  });
  act(s, "p1", { type: "deploy", fighter: "p1:nightcrawler", x: 8, y: 34 });
  assert.deepEqual(
    view(s, "p1")
      .fighters.filter((f) => f.side === "p1")
      .map((f) => f.slug),
    newcomers,
  );
});
