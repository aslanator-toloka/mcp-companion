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
const attack = (s, target, index, damageType, random = dice(), extra = {}) => {
  act(
    s,
    s.fighters.find((f) => f.id === s.active).side,
    { type: "attack", target: target.id, index, damageType, ...extra },
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

test("Faithful Assistant gives an ally Power once per Round; Meditate is an Action for 1 Power", () => {
  const s = trial([
    ["p1", "wong", 8],
    ["p1", "hawkeye", 10],
    ["p2", "hulk", 25],
  ]);
  const [wong, ally] = s.fighters;
  wong.power = 4;
  activate(s);
  act(s, "p1", { type: "power", value: "Faithful Assistant", target: ally.id });
  assert.equal(ally.power, 4);
  const again = actions(s)
    .find((a) => a.type === "power")
    .powers.find((p) => p.value === "Faithful Assistant");
  assert.ok(!again?.targets?.some((t) => t.value === ally.id));
  act(s, "p1", { type: "power", value: "Meditate" });
  assert.equal(wong.power, 3);
  assert.equal(s.actionsLeft, 1);
});

test("The Vishanti‘s Blessing heals 2 or removes a condition; Servant adds a die near Strange", () => {
  const s = trial([
    ["p1", "wong", 8],
    ["p1", "hawkeye", 10],
    ["p2", "hulk", 25],
  ]);
  const [, ally] = s.fighters;
  ally.damage = 3;
  activate(s);
  act(s, "p1", {
    type: "power",
    value: "The Vishanti‘s Blessing",
    target: ally.id,
  });
  assert.equal(ally.damage, 1);

  const guard = trial([
    ["p1", "hawkeye", 8],
    ["p2", "wong", 12],
    ["p2", "doctor-strange", 14],
  ]);
  activate(guard);
  attack(guard, guard.fighters[1], 0, "physical");
  assert.equal(lastAttack(guard, "Arrow Shot").defense.length, 3 + 1);
});

test("Icy Tendrils stack Slow, Stun and Stagger by their combos", () => {
  const s = trial([
    ["p1", "clea", 8],
    ["p2", "hulk", 12],
  ]);
  const [clea, hulk] = s.fighters;
  clea.power = 3;
  hulk.power = 0;
  activate(s);
  attack(s, hulk, 1, "mystic", dice(0, 1, 2));
  assert.deepEqual(hulk.conditions.sort(), ["slow", "stagger"]);
});

test("Descendant of the Faltine gives 3 Power but hurts on a Failure; Vapors of Dormammu Places an ally", () => {
  const s = trial([
    ["p1", "clea", 8],
    ["p1", "hawkeye", 11],
    ["p2", "hulk", 25],
  ]);
  const [clea, ally] = s.fighters;
  clea.power = 0;
  s.rng = dice(5);
  activate(s);
  act(s, "p1", { type: "power", value: "Descendant of the Faltine" });
  assert.equal(clea.power, 3);
  assert.equal(clea.damage, 2);
  act(s, "p1", { type: "power", value: "Vapors of Dormammu", target: ally.id });
  assert.equal(actions(s)[0].range, 2);
  assert.equal(actions(s)[0].mover, ally.id);
});

test("Talons of Farallah adds 2 dice and Judges a high-threat defender after damage", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p1", "clea", 6],
    ["p2", "hulk", 12],
  ]);
  const [hawkeye, clea, hulk] = s.fighters;
  activate(s, hawkeye);
  attack(s, hulk, 0, "physical", dice(2, 2, 2), { decree: true });
  assert.equal(lastAttack(s, "Arrow Shot").rolled.length, 5 + 2);
  assert.equal(clea.power, 0);
  assert.ok(hulk.conditions.includes("judgment"));
});

test("Bolts of Bedevilment Pierce on a Block and may Push after damage; Shield of the Seraphim pays for Blocks", () => {
  const s = trial([
    ["p1", "doctor-strange", 8],
    ["p2", "hulk", 12],
  ]);
  const [strange, hulk] = s.fighters;
  hulk.power = 0;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "energy" },
    dice(4, 2, 2, 2, 2, 4, 4, 4, 4),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  const labels = [];
  while (actions(s)[0]?.type === "modify-dice") {
    const option = actions(s)[0];
    labels.push(option.label);
    if (option.label === "Pierce")
      act(s, "p1", { type: "modify-dice", indices: [option.eligible[0]] });
    else act(s, "p1", { type: "skip-effect" });
  }
  assert.ok(labels.includes("Pierce"), labels.join());
  assert.ok(labels.includes("Eye of Agamotto · все кубики"));
  assert.ok(hulk.damage > 0);
  assert.equal(strange.power, 3 + hulk.damage + 1);
  assert.equal(actions(s)[0].mode, "push");
});

test("Crimson Bands Staggers, or Activates on its combo; Judgment of the Vishanti Hexes once per Turn", () => {
  const s = trial([
    ["p1", "doctor-strange", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [strange, hawkeye] = s.fighters;
  s.leaders.p1 = strange.slug + ":Judgment of the Vishanti";
  strange.power = 4;
  activate(s);
  attack(s, hawkeye, 1, "mystic", dice(0, 1, 2));
  assert.ok(hawkeye.activated);
  assert.ok(hawkeye.conditions.includes("hex"));
});

test("Hoggoth‘s Hoary Wisdom adds 2 dice to an ally’s defense against any attack", () => {
  const s = trial([
    ["p1", "scarlet-witch", 8],
    ["p2", "hulk", 12],
    ["p2", "doctor-strange", 14],
  ]);
  const [, hulk, strange] = s.fighters;
  activate(s);
  act(s, "p1", {
    type: "attack",
    target: hulk.id,
    index: 0,
    damageType: "mystic",
  });
  const option = actions(s, "p2").find(
    (a) => a.key === "hoggoth:" + strange.id,
  );
  assert.ok(option);
});

test("Oshtur‘s Refuge heals up to 3", () => {
  const s = trial([
    ["p1", "doctor-strange", 8],
    ["p2", "hulk", 25],
  ]);
  const [strange] = s.fighters;
  strange.damage = 4;
  activate(s);
  act(s, "p1", { type: "power", value: "Oshtur‘s Refuge", target: strange.id });
  assert.equal(strange.damage, 1);
});

test("Wong, Clea and Doctor Strange fit in a saved Convocation roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["wong", "clea", "doctor-strange"];
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
    affiliation: "Convocation",
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
