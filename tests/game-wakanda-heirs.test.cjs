const test = require("node:test");
const assert = require("node:assert/strict");
const { act, view, create } = require("../game/engine.cjs");
const mission = require("../game/mission.cjs");
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

test("Spirit Predator’s Finisher grants a Panther Strike with free rerolls", () => {
  const s = trial([
    ["p1", "black-panther-chosen-of-bast", 8],
    ["p2", "hulk", 10.5],
  ]);
  const [bast, hulk] = s.fighters;
  bast.power = 4;
  activate(s);
  attack(s, hulk, 1, "mystic", dice(1, 2));
  const bonus = s.effects.find((e) => e.type === "bonus-attack");
  assert.equal(bonus.kind, "finisher");
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "mystic" },
    dice(5),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  const option = actions(s)[0];
  assert.equal(option.type, "modify-dice");
  assert.equal(option.eligible.length, 4);
});

test("Superior Agility stops enemies modifying attack dice against Chosen of Bast", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p1", "professor-x", 10],
    ["p2", "black-panther-chosen-of-bast", 11],
  ]);
  const [, , bast] = s.fighters;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: bast.id, index: 0, damageType: "physical" },
    dice(),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  assert.ok(!actions(s).some((a) => a.type === "modify-dice"));
});

test("Covert Armament and K‘Liluna‘s Fury lock defense dice; the Fury adds dice per damage", () => {
  const s = trial([
    ["p1", "killmonger-usurper", 8],
    ["p2", "beast", 11],
  ]);
  const [usurper, beast] = s.fighters;
  usurper.damage = 3;
  usurper.power = 3;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: beast.id, index: 2, damageType: "physical" },
    dice(),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  assert.ok(!actions(s, "p2").some((a) => a.label === "Stars and Garters"));
  skipDice(s);
  assert.equal(lastAttack(s, "K‘Liluna‘s Fury").rolled.length, 9);
});

test("Strength of the New Generation hands out Herb tokens for a die, or 1 damage and 1 Power at Cleanup", () => {
  const s = trial([
    ["p1", "killmonger-usurper", 8],
    ["p1", "okoye", 6],
    ["p2", "hulk", 10.5],
  ]);
  const [usurper, okoye, hulk] = s.fighters;
  s.leaders.p1 = usurper.slug + ":Strength of the New generation";
  s.effects = [{ type: "herb", side: "p1", remaining: 3 }];
  act(s, "p1", { type: "herb", value: usurper.id });
  act(s, "p1", { type: "herb", value: okoye.id });
  assert.ok(!s.effects.length);
  assert.ok(usurper.herb && okoye.herb);
  activate(s, usurper);
  attack(s, hulk, 0, "energy");
  assert.equal(lastAttack(s, "Vibranium Weapons").rolled.length, 6);
  assert.ok(!usurper.herb);
  s.mission = {};
  const power = okoye.power;
  mission.cleanup(s, dice());
  assert.equal(okoye.damage, 1);
  assert.equal(okoye.power, power + 1);
});

test("Chosen of Bast and Killmonger Usurper fit in a saved Wakanda roster", () => {
  const preset = pool.presets[0];
  const newcomers = [
    "black-panther-chosen-of-bast",
    "killmonger-usurper",
    "shuri",
  ];
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
    affiliation: "Wakanda",
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
