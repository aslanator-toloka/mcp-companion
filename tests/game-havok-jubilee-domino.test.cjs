const test = require("node:test");
const assert = require("node:assert/strict");
const { act, view, create } = require("../game/engine.cjs");
const { condition } = require("../game/combat.cjs");
const { pool } = require("../game/catalog.cjs");
const { trial } = require("./helpers/game.cjs");

const dice =
  (...rolls) =>
  () =>
    rolls.shift() ?? 7;
const actions = (s, side = "p1") => view(s, side).actions[side];
const activate = (s, fighter = s.fighters[0]) =>
  act(s, fighter.side, { type: "activate", value: fighter.id });
const attack = (s, target, index, damageType, random = dice()) =>
  act(
    s,
    s.fighters.find((f) => f.id === s.active).side,
    { type: "attack", target: target.id, index, damageType },
    random,
  );
const lastAttack = (s, name) => s.log.findLast((e) => e.attack === name);

test("Plasma Dispersion turns one die into a Hit per Wild; Plasma Blast builds Power", () => {
  const s = trial([
    ["p1", "havok", 8],
    ["p2", "hulk", 12],
  ]);
  const [havok, hulk] = s.fighters;
  hulk.power = 0;
  activate(s);
  attack(s, hulk, 0, "energy", dice(1));
  const option = actions(s)[0];
  assert.equal(option.label, "Plasma Dispersion");
  assert.equal(option.max, 1);
  assert.ok(!option.eligible.includes(0));
  act(s, "p1", { type: "modify-dice", indices: [3] });
  assert.deepEqual(lastAttack(s, "Plasma Blast").rolled, [
    "wild",
    "blank",
    "blank",
    "hit",
    "blank",
  ]);
  assert.equal(havok.power, 3 + hulk.damage);
});

test("Plasma Wave Incinerates each target and Pierces on a Wild; Havok is immune to Incinerate", () => {
  const s = trial([
    ["p1", "havok", 8],
    ["p2", "hulk", 11],
  ]);
  const [havok, hulk] = s.fighters;
  havok.power = 5;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", index: 1, angle: 0, damageType: "energy" },
    dice(1, 7, 7, 7, 7, 7, 7, 4),
  );
  while (actions(s)[0]?.type === "modify-dice") {
    const option = actions(s)[0];
    if (option.label === "Pierce")
      act(s, "p1", { type: "modify-dice", indices: [option.eligible[0]] });
    else act(s, "p1", { type: "skip-effect" });
  }
  assert.ok(lastAttack(s, "Plasma Wave").defense.includes("block") === false);
  assert.ok(hulk.conditions.includes("incinerate"));
  condition(havok, "incinerate");
  assert.ok(!(havok.conditions || []).includes("incinerate"));
});

test("Cosmic Energy Absorption is an Action for 2 Power; Blast Off Places within 2 once per Turn", () => {
  const s = trial([
    ["p1", "havok", 8],
    ["p2", "hulk", 20],
  ]);
  const [havok] = s.fighters;
  havok.power = 0;
  activate(s);
  const before = s.actionsLeft;
  act(s, "p1", { type: "power", value: "Cosmic Energy Absorption" });
  assert.equal(havok.power, 2);
  assert.equal(s.actionsLeft, before - 1);
  act(s, "p1", { type: "power", value: "Blast Off", x: 10, y: 8 });
  assert.equal(havok.x, 10);
  assert.equal(havok.power, 0);
});

test("Lumikinetic Blast Stuns only with a Wild and a Hit", () => {
  for (const [roll, stunned] of [
    [[1, 2], true],
    [[1], false],
  ]) {
    const s = trial([
      ["p1", "jubilee", 8],
      ["p2", "hawkeye", 12],
    ]);
    const [jubilee, hawkeye] = s.fighters;
    activate(s);
    attack(s, hawkeye, 0, "energy", dice(...roll));
    assert.equal((hawkeye.conditions || []).includes("stun"), stunned);
    assert.equal(jubilee.power, 4);
  }
});

test("Princess of Pyrotechnics grants a free follow-up on Wild and Hit against the same defender", () => {
  const s = trial([
    ["p1", "jubilee", 8],
    ["p2", "hulk", 11],
    ["p2", "hawkeye", 11],
  ]);
  const [jubilee, hulk, hawkeye] = s.fighters;
  hawkeye.y = 10;
  jubilee.power = 4;
  activate(s);
  attack(s, hulk, 1, "energy", dice(1, 2));
  assert.equal(jubilee.power, 0);
  const follow = actions(s).find((a) => a.type === "attack");
  const princess = follow.attacks.find(
    (a) => a.name === "Princess of Pyrotechnics",
  );
  assert.deepEqual(
    princess.targets.map((t) => t.value),
    [hulk.id],
  );
  attack(s, hulk, 1, "energy", dice(1, 2));
  assert.equal(jubilee.power, 0);
  assert.ok(!actions(s).some((a) => a.type === "attack" && s.effects.length));
});

test("Fireworks rerolls an ally’s defense dice within 2, once per Turn per defender", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "hulk", 12],
    ["p2", "jubilee", 13.5],
  ]);
  const [, hulk, jubilee] = s.fighters;
  activate(s);
  attack(s, hulk, 0, "physical", () => 2);
  const option = actions(s, "p2")[0];
  assert.equal(option.label, "Fireworks");
  assert.equal(option.max, 3);
  act(s, "p2", { type: "modify-dice", indices: [0, 1] }, () => 4);
  assert.equal(jubilee.power, 1);
  assert.ok(s.reactionUses.includes(hulk.id + ":fireworks"));
});

test("Wolverine! redirects an attack on Jubilee to a nearby James Logan Howlett", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "jubilee", 12],
    ["p2", "wolverine", 13.5],
  ]);
  const [, jubilee, logan] = s.fighters;
  activate(s);
  attack(s, jubilee, 0, "physical");
  const swap = actions(s, "p2").find((a) =>
    a.value?.startsWith("wolverine-swap:"),
  );
  assert.ok(swap);
  act(s, "p2", { type: "reaction", value: swap.value }, dice(2, 2, 2));
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice(2, 2, 2));
  for (const side of ["p1", "p2"])
    while (actions(s, side)[0]?.type === "modify-dice")
      act(s, side, { type: "skip-effect" });
  assert.equal(jubilee.damage || 0, 0);
  assert.ok(logan.damage > 0);
});

test("I Totally Meant to Do That! gains Power and drops objectives after rolling a Critical", () => {
  const s = trial([
    ["p1", "jubilee", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [jubilee, hawkeye] = s.fighters;
  s.objectives = [
    { id: "a", holder: jubilee.id, radius: 0.5, role: "extract" },
  ];
  activate(s);
  attack(s, hawkeye, 0, "energy", dice(0));
  assert.equal(jubilee.power, 5);
  assert.ok(!s.objectives[0].holder);
});

test("Automatic Pistols Rapid Fire on a Hit; Lucky Shot denies the defender Power", () => {
  const s = trial([
    ["p1", "domino", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [domino, hulk] = s.fighters;
  hulk.power = 0;
  activate(s);
  attack(s, hulk, 0, "physical", dice(2));
  assert.ok(s.effects.some((e) => e.type === "bonus-attack"));
  act(s, "p1", { type: "skip-effect" });
  domino.power = 3;
  attack(s, hulk, 2, "energy", dice(1));
  assert.ok(hulk.damage > 1);
  assert.equal(hulk.power, 1);
  assert.ok(hulk.conditions.includes("stun"));
});

test("Grenade Bounce ignores LOS, Incinerates and hurts enemies near the defender on a Wild", () => {
  const s = trial([
    ["p1", "domino", 8],
    ["p2", "hawkeye", 12],
    ["p2", "hulk", 13],
  ]);
  const [, hawkeye, hulk] = s.fighters;
  hulk.y = 9.5;
  s.terrain = [{ id: "wall", size: 5, x: 10, y: 7, w: 0.5, h: 2 }];
  activate(s);
  const grenade = actions(s)
    .find((a) => a.type === "attack")
    .attacks.find((a) => a.name === "Grenade Bounce");
  assert.ok(grenade.targets.some((t) => t.value === hawkeye.id));
  attack(s, hawkeye, 1, "energy", dice(1));
  assert.ok(hawkeye.conditions.includes("incinerate"));
  assert.equal(hulk.damage, 1);
});

test("Probability Manipulation turns paid Failures into Criticals that add dice", () => {
  const s = trial([
    ["p1", "domino", 8],
    ["p2", "hulk", 11],
  ]);
  const [domino, hulk] = s.fighters;
  activate(s);
  attack(s, hulk, 0, "physical", dice(5, 5));
  const option = actions(s)[0];
  assert.equal(option.label, "Probability Manipulation");
  assert.deepEqual(option.eligible, [0, 1]);
  act(s, "p1", { type: "modify-dice", indices: [0, 1] }, dice(2, 2));
  assert.equal(domino.power, 1 + 1);
  const rolled = lastAttack(s, "Automatic Pistols").rolled;
  assert.deepEqual(rolled.slice(0, 2), ["critical", "critical"]);
  assert.equal(rolled.length, 6);
});

test("Things Tend To Go My Way stops enemy Criticals from adding dice against Domino", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "domino", 12],
  ]);
  const [, domino] = s.fighters;
  domino.power = 0;
  activate(s);
  attack(s, domino, 0, "physical", dice(0, 0));
  for (const side of ["p1", "p2"])
    while (actions(s, side)[0]?.type === "modify-dice")
      act(s, side, { type: "skip-effect" });
  const strength = Number(
    view(s, "p1").fighters[0].attacks?.[0]?.strength ?? 4,
  );
  assert.equal(lastAttack(s, "Arrow Shot").rolled.length, strength);
});

test("Havok, Jubilee and Domino fit in a saved Game roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["havok", "jubilee", "domino"];
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
