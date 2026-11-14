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
const attack = (s, target, index, damageType, random = dice()) => {
  act(
    s,
    s.fighters.find((f) => f.id === s.active).side,
    { type: "attack", target: target.id, index, damageType },
    random,
  );
  while (s.pendingAttack)
    act(
      s,
      s.fighters.find((f) => f.id === s.pendingAttack.target).side,
      { type: "reaction", value: "skip" },
      random,
    );
  skipDice(s, random);
};
const lastAttack = (s, name) => s.log.findLast((e) => e.attack === name);

test("Red Guardian’s Strike always Pushes a small defender; Shield Throw Ricochets on a Wild", () => {
  const s = trial([
    ["p1", "red-guardian", 8],
    ["p2", "hawkeye", 10.5],
    ["p2", "hulk", 13],
  ]);
  const [guardian, hawkeye, hulk] = s.fighters;
  activate(s);
  attack(s, hawkeye, 0, "physical");
  const push = actions(s)[0];
  assert.equal(push.mode, "push");
  assert.equal(push.mover, hawkeye.id);
  act(s, "p1", { type: "displace", angle: 0 });
  attack(s, hulk, 1, "physical", dice(1));
  const bounce = s.effects.find((e) => e.type === "bonus-attack");
  assert.equal(bounce.kind, "bounce");
  assert.equal(guardian.power, 5);
});

test("Focused Repulsion Field counts defensive Blanks; Red Guardian’s Suit pays Power for any damage", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "red-guardian", 12],
  ]);
  const [hawkeye, guardian] = s.fighters;
  activate(s);
  act(s, "p1", {
    type: "attack",
    target: guardian.id,
    index: 0,
    damageType: "physical",
  });
  act(
    s,
    "p2",
    { type: "reaction", value: "repulsion:" + guardian.id },
    dice(2, 2, 2, 7, 7, 7, 7, 7),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice(2, 2, 2));
  skipDice(s);
  assert.equal(guardian.damage || 0, 0);
  assert.equal(guardian.power, 1);
  combat.damage(s, guardian, 1, guardian);
  assert.equal(guardian.power, 2);
  void hawkeye;
});

test("Bear-Armed Brawler may Throw a Size 4 defender before damage and always Staggers", () => {
  const s = trial([
    ["p1", "ursa-major", 8],
    ["p2", "hawkeye", 10.5],
  ]);
  const [ursa, hawkeye] = s.fighters;
  ursa.power = 3;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hawkeye.id, index: 1, damageType: "physical" },
    dice(),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  skipDice(s);
  const throwMove = actions(s)[0];
  assert.equal(throwMove.mode, "throw");
  act(s, "p1", { type: "skip-effect" });
  assert.ok(hawkeye.conditions.includes("stagger"));
  void ursa;
});

test("Ursine Temper Throws terrain Medium; Bear-Handed Slap Bleeds on a Wild", () => {
  const s = trial([
    ["p1", "ursa-major", 8],
    ["p2", "hawkeye", 10.5],
  ]);
  const [ursa, hawkeye] = s.fighters;
  s.terrain = [{ id: "car", name: "Car", size: 3, x: 8, y: 10, w: 1, h: 1 }];
  activate(s);
  attack(s, hawkeye, 0, "physical", dice(1));
  assert.ok(hawkeye.conditions.includes("bleed"));
  act(s, "p1", { type: "power", value: "Ursine Temper", target: "car" });
  assert.equal(actions(s)[0].speed, "M");
  void ursa;
});

test("Darkforce Strike may reroll every attack die, but only all of them", () => {
  const s = trial([
    ["p1", "darkstar", 8],
    ["p2", "hulk", 12],
  ]);
  const [, hulk] = s.fighters;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "energy" },
    dice(5, 5),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice(5, 5));
  const option = actions(s)[0];
  assert.equal(option.label, "Darkforce Strike · все кубики");
  assert.throws(() => act(s, "p1", { type: "modify-dice", indices: [0] }));
  act(s, "p1", { type: "modify-dice", indices: [0, 1, 2, 3, 4] }, () => 2);
  skipDice(s);
  assert.deepEqual(lastAttack(s, "Darkforce Strike").rolled, [
    "hit",
    "hit",
    "hit",
    "hit",
    "hit",
  ]);
});

test("Darkforce Barrier adds 2 dice and stops the attack from moving the defender", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "hawkeye", 10.5],
    ["p2", "darkstar", 12],
  ]);
  const [, hawkeye, darkstar] = s.fighters;
  activate(s);
  act(s, "p1", {
    type: "attack",
    target: hawkeye.id,
    index: 0,
    damageType: "physical",
  });
  act(s, "p2", { type: "reaction", value: "barrier:" + darkstar.id }, dice(1));
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice(1));
  skipDice(s);
  assert.equal(lastAttack(s, "Strike").defense.length, 4 + 2);
  assert.ok(!s.effects.some((e) => e.mover === hawkeye.id));
  assert.equal(darkstar.power, 0);
});

test("Dimensional Portal Places Darkstar or an ally within 3, once per target per Turn", () => {
  const s = trial([
    ["p1", "darkstar", 8],
    ["p1", "hawkeye", 10],
    ["p2", "hulk", 20],
  ]);
  const [darkstar, ally] = s.fighters;
  darkstar.power = 6;
  activate(s);
  act(s, "p1", { type: "power", value: "Dimensional Portal", target: ally.id });
  const place = actions(s)[0];
  assert.equal(place.mode, "place");
  assert.equal(place.range, 3);
  assert.equal(place.mover, ally.id);
  act(s, "p1", { type: "displace", x: 12, y: 8 });
  const again = actions(s)
    .find((a) => a.type === "power")
    ?.powers.find((p) => p.value === "Dimensional Portal");
  assert.ok(!again?.targets?.some((t) => t.value === ally.id));
  assert.ok(again?.targets?.some((t) => t.value === darkstar.id));
});

test("Red Guardian, Ursa Major and Darkstar fit in a saved Winter Guard roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["red-guardian", "ursa-major", "darkstar"];
  const s = create(
    {
      p1: {
        ...preset,
        characters: [
          ...newcomers,
          "omega-red",
          ...preset.characters.slice(0, 6),
        ],
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
    affiliation: "Winter Guard",
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
