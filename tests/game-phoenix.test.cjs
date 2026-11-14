const test = require("node:test");
const assert = require("node:assert/strict");
const { act, view, create } = require("../game/engine.cjs");
const combat = require("../game/combat.cjs");
const { pool } = require("../game/catalog.cjs");
const { trial } = require("./helpers/game.cjs");

const dice =
  (...rolls) =>
  () =>
    rolls.shift() ?? 7;
const actions = (s, side = "p1") => view(s, side).actions[side];
const activate = (s, fighter = s.fighters[0]) =>
  act(s, fighter.side, { type: "activate", value: fighter.id });
const skipDice = (s, random) => {
  for (const side of ["p1", "p2"])
    while (actions(s, side)?.[0]?.type === "modify-dice")
      act(s, side, { type: "skip-effect" }, random);
};

test("Bolts of Flame build Power and Incinerate; Phoenix ignores Incinerate and Poison", () => {
  const s = trial([
    ["p1", "phoenix", 8],
    ["p2", "hulk", 12],
  ]);
  const [phoenix, hulk] = s.fighters;
  hulk.power = 0;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "energy" },
    dice(1, 2),
  );
  skipDice(s);
  assert.ok(hulk.conditions.includes("incinerate"));
  assert.equal(phoenix.power, 3 + hulk.damage);
  combat.condition(phoenix, "poison");
  combat.condition(phoenix, "incinerate");
  assert.deepEqual(phoenix.conditions || [], []);
});

test("Firestorm lets allies within range remove 1 damage", () => {
  const s = trial([
    ["p1", "phoenix", 8],
    ["p1", "hawkeye", 8],
    ["p2", "hulk", 11],
  ]);
  const [phoenix, ally] = s.fighters;
  ally.y = 10;
  ally.damage = 2;
  phoenix.power = 6;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", index: 1, angle: 0, damageType: "energy" },
    dice(),
  );
  assert.equal(ally.damage, 1);
});

test("Rejuvenating Flames heals 2 and removes a condition, once per target per Turn", () => {
  const s = trial([
    ["p1", "phoenix", 8],
    ["p1", "hawkeye", 10],
    ["p2", "hulk", 20],
  ]);
  const [phoenix, ally] = s.fighters;
  phoenix.power = 6;
  ally.damage = 3;
  ally.conditions = ["bleed", "slow"];
  activate(s);
  act(s, "p1", {
    type: "power",
    value: "Rejuvenating Flames",
    target: ally.id,
  });
  assert.equal(ally.damage, 1);
  assert.equal(ally.conditions.length, 1);
  const again = actions(s)
    .find((a) => a.type === "power")
    ?.powers.find((p) => p.value === "Rejuvenating Flames");
  assert.ok(!again?.targets?.some((t) => t.value === ally.id));
  assert.ok(again?.targets?.some((t) => t.value === phoenix.id));
});

test("Burning Resolve stops an enemy Push on a nearby ally", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "hawkeye", 10.5],
    ["p2", "phoenix", 13],
  ]);
  const [hulk, hawkeye, phoenix] = s.fighters;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hawkeye.id, index: 0, damageType: "physical" },
    dice(1),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice(1));
  skipDice(s);
  act(s, "p1", { type: "start-displacement" });
  const option = actions(s, "p2")
    .flatMap((a) => a.options || [])
    .find((o) => o.label?.startsWith("Burning Resolve"));
  assert.ok(option, JSON.stringify(actions(s, "p2")));
  act(s, "p2", { type: "shield-mind", value: option.value });
  assert.equal(hawkeye.x, 10.5);
  assert.equal(phoenix.power, 0);
  void hulk;
});

test("Phoenix gains tokens from fallen allies and her own Daze, then becomes Phoenix Unleashed at the start of her side’s Turn", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "phoenix", 12],
    ["p2", "hawkeye", 16],
  ]);
  const [hulk, phoenix, hawkeye] = s.fighters;
  hawkeye.damage = 4;
  combat.damage(s, hawkeye, 1, hulk);
  assert.equal(phoenix.phoenix, 1);
  phoenix.damage = 7;
  combat.damage(s, phoenix, 1, hulk);
  assert.ok(phoenix.dazed);
  assert.equal(phoenix.phoenix, 4);
  activate(s, hulk);
  act(s, "p1", { type: "end" });
  hawkeye.dazed = false;
  hawkeye.damage = 0;
  act(s, "p2", { type: "activate", value: hawkeye.id });
  assert.ok(phoenix.injured);
  assert.ok(!phoenix.dazed);
  assert.equal(phoenix.damage, 0);
  assert.equal(phoenix.size, 4);
});

test("Phoenix Blast destroys terrain for dice, raises a Flame Pillar and gains a token", () => {
  const s = trial([
    ["p1", "phoenix", 8],
    ["p2", "hulk", 13],
  ]);
  const [phoenix, hulk] = s.fighters;
  phoenix.injured = true;
  phoenix.phoenix = 1;
  s.terrain = [{ id: "car", name: "Car", size: 3, x: 9, y: 10, w: 1, h: 1 }];
  activate(s);
  act(s, "p1", {
    type: "attack",
    target: hulk.id,
    index: 0,
    damageType: "energy",
  });
  while (s.pendingAttack) act(s, "p2", { type: "reaction", value: "skip" });
  assert.equal(actions(s)[0].type, "selffriend");
  act(s, "p1", { type: "selffriend", value: "car" }, dice());
  skipDice(s);
  assert.equal(
    s.log.findLast((e) => e.attack === "Phoenix Blast").rolled.length,
    6 + 3,
  );
  assert.deepEqual(
    s.terrain.map((p) => p.name),
    ["Flame Pillar"],
  );
  assert.equal(phoenix.phoenix, 2);
});

test("Temporal Domination rerolls up to 3 dice for a Phoenix token once per Turn", () => {
  const s = trial([
    ["p1", "phoenix", 8],
    ["p2", "hulk", 13],
  ]);
  const [phoenix, hulk] = s.fighters;
  phoenix.injured = true;
  s.terrain = [];
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "energy" },
    () => 7,
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, () => 7);
  const option = actions(s)[0];
  assert.equal(option.label, "Temporal Domination");
  assert.equal(option.max, 3);
  act(s, "p1", { type: "modify-dice", indices: [0, 1, 2] }, () => 2);
  assert.equal(phoenix.phoenix, 2);
});

test("Untamed Cosmic Entity adds Power per token and explodes at 5 tokens after her Activation", () => {
  const s = trial([
    ["p1", "phoenix", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [phoenix, hawkeye] = s.fighters;
  phoenix.injured = true;
  phoenix.phoenix = 5;
  s.terrain = [{ id: "rock", name: "Rock", size: 2, x: 10, y: 10, w: 1, h: 1 }];
  activate(s);
  act(s, "p1", { type: "end" }, dice(0, 1, 2, 7, 7));
  assert.ok(phoenix.ko);
  assert.ok(hawkeye.damage >= 3 || hawkeye.dazed);
  assert.equal(s.terrain.length, 0);
});

test("Phoenix fits in a saved Uncanny X-Men roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["phoenix", "cyclops", "storm"];
  const s = create(
    {
      p1: {
        ...preset,
        characters: [...newcomers, ...preset.characters.slice(0, 7)],
      },
      p2: "cabal",
    },
    1,
  );
  Object.assign(s, {
    phase: "squad",
    threat: 17,
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
  assert.deepEqual(
    view(s, "p1")
      .fighters.filter((f) => f.side === "p1")
      .map((f) => f.slug),
    newcomers,
  );
});
