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

test("Darkchylde counts Failures in both rolls as successes and applies Bleed and Incinerate", () => {
  const s = trial([
    ["p1", "magik", 8],
    ["p2", "hulk", 11],
  ]);
  const [magik, hulk] = s.fighters;
  magik.power = 4;
  hulk.power = 0;
  activate(s);
  attack(s, hulk, 2, "mystic", dice(5, 5, 7, 7, 7, 7, 5));
  assert.equal(hulk.damage, 3);
  assert.deepEqual(hulk.conditions.sort(), ["bleed", "incinerate"]);
});

test("Bolts of Oshtur Hexes on Critical and Wild; Limbo Step Places up to the Power spent", () => {
  const s = trial([
    ["p1", "magik", 8],
    ["p2", "hawkeye", 14],
  ]);
  const [magik, hawkeye] = s.fighters;
  activate(s);
  attack(s, hawkeye, 1, "energy", dice(0, 1));
  assert.ok(hawkeye.conditions.includes("hex"));
  assert.equal(magik.power, 4);
  act(s, "p1", { type: "power", value: "Limbo Step", amount: 2 });
  const place = actions(s)[0];
  assert.equal(place.mode, "place");
  assert.equal(place.range, 2);
  assert.equal(magik.power, 2);
});

test("Scrying Mirrors of Limbo blanks attack dice only against mystic attacks; Magik ignores Incinerate", () => {
  for (const [attacker, type, offered] of [
    ["scarlet-witch", "mystic", true],
    ["hawkeye", "physical", false],
  ]) {
    const s = trial([
      ["p1", attacker, 8],
      ["p2", "magik", 12],
    ]);
    const [, magik] = s.fighters;
    activate(s);
    const roll = dice(2, 2, 2, 2, 2, 1, 1);
    act(
      s,
      "p1",
      { type: "attack", target: magik.id, index: 0, damageType: type },
      roll,
    );
    while (s.pendingAttack)
      act(s, "p2", { type: "reaction", value: "skip" }, roll);
    for (let i = 0; i < 4 && actions(s, "p1")[0]?.type === "modify-dice"; i++)
      act(s, "p1", { type: "skip-effect" });
    assert.equal(
      actions(s, "p2").some((a) => a.label === "Scrying Mirrors of Limbo"),
      offered,
    );
    condition(magik, "incinerate");
    assert.ok(!(magik.conditions || []).includes("incinerate"));
  }
});

test("Plasma Rifle rerolls up to 2 dice only against a defender within range 3", () => {
  for (const [x, offered] of [
    [12, true],
    [17.5, false],
  ]) {
    const s = trial([
      ["p1", "cable", 8],
      ["p2", "hulk", x],
    ]);
    const [, hulk] = s.fighters;
    activate(s);
    act(
      s,
      "p1",
      { type: "attack", target: hulk.id, index: 0, damageType: "energy" },
      dice(),
    );
    const option = actions(s).find((a) => a.label === "Plasma Rifle");
    assert.equal(!!option, offered);
    if (option) assert.equal(option.max, 2);
  }
});

test("Askani‘Son heals Cable once per damaging target", () => {
  const s = trial([
    ["p1", "cable", 8],
    ["p2", "hulk", 10],
  ]);
  const [cable] = s.fighters;
  cable.power = 5;
  cable.damage = 3;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", index: 1, angle: 0, damageType: "mystic" },
    dice(2, 2, 2, 2, 2),
  );
  skipDice(s);
  assert.equal(cable.damage, 2);
});

test("Omega Level Threat pays at least the terrain Size; Body Slide Places; Techno-Organic adds Power", () => {
  const s = trial([
    ["p1", "cable", 8],
    ["p2", "hulk", 20],
  ]);
  const [cable] = s.fighters;
  s.terrain = [{ id: "car", name: "Car", size: 3, x: 9, y: 10, w: 1, h: 1 }];
  cable.power = 6;
  activate(s);
  const threat = actions(s)
    .find((a) => a.type === "power")
    .powers.find((p) => p.value === "Omega Level Threat");
  assert.equal(threat.targets[0].minPower, 3);
  assert.throws(() =>
    act(s, "p1", {
      type: "power",
      value: "Omega Level Threat",
      target: "car",
      amount: 2,
    }),
  );
  act(s, "p1", {
    type: "power",
    value: "Omega Level Threat",
    target: "car",
    amount: 3,
  });
  assert.equal(cable.power, 3);
  assert.equal(actions(s)[0].speed, "M");
});

test("Wetworks rerolls one attack die including a Failure once per Turn and strips close Cover", () => {
  const s = trial([
    ["p1", "domino", 8],
    ["p1", "cable", 6],
    ["p2", "hulk", 11],
  ]);
  const [domino, cable, hulk] = s.fighters;
  s.leaders.p1 = cable.slug + ":Wetworks";
  domino.power = 0;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "physical" },
    dice(5),
  );
  const option = actions(s)[0];
  assert.equal(option.label, "Wetworks");
  assert.ok(option.eligible.includes(0));
  act(s, "p1", { type: "modify-dice", indices: [0] }, () => 2);
  skipDice(s);
  assert.ok(s.reactionUses.includes(domino.id + ":wetworks"));
});

test("X-Slash Places Logan next to the defender; On the Hunt rerolls only when he is alone", () => {
  const s = trial([
    ["p1", "logan-the-wolverine", 8],
    ["p2", "hulk", 13],
  ]);
  const [logan, hulk] = s.fighters;
  hulk.power = 0;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "physical" },
    dice(),
  );
  assert.equal(actions(s)[0].label, "On the Hunt");
  skipDice(s);
  const place = actions(s)[0];
  assert.equal(place.mode, "place");
  assert.equal(place.mover, logan.id);
  assert.equal(place.reference.x, 13);

  const pack = trial([
    ["p1", "logan-the-wolverine", 8],
    ["p1", "hawkeye", 9.5],
    ["p2", "hulk", 13],
  ]);
  activate(pack);
  act(
    pack,
    "p1",
    {
      type: "attack",
      target: pack.fighters[2].id,
      index: 0,
      damageType: "physical",
    },
    dice(),
  );
  assert.ok(!actions(pack).some((a) => a.label === "On the Hunt"));
});

test("What I Do Isn‘t Very Nice spends an Action on X-Slash, then offers a Short Throw", () => {
  const s = trial([
    ["p1", "logan-the-wolverine", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [logan, hawkeye] = s.fighters;
  activate(s);
  const actionsBefore = s.actionsLeft;
  act(s, "p1", { type: "power", value: "What I Do Isn‘t Very Nice" });
  assert.equal(s.actionsLeft, actionsBefore - 1);
  assert.equal(logan.power, 0);
  const granted = actions(s).find((a) => a.type === "attack");
  assert.deepEqual(
    granted.attacks.map((a) => a.name),
    ["X-Slash"],
  );
  attack(s, hawkeye, 0, "physical", dice(2));
  const names = s.effects.map((e) => e.name);
  assert.ok(names.includes("What I Do Isn‘t Very Nice"));
  assert.equal(s.actionsLeft, actionsBefore - 1);
});

test("Get Out of my Head! hurts and powers nearby allies after the first mystic damage each Turn", () => {
  const s = trial([
    ["p1", "magik", 8],
    ["p2", "logan-the-wolverine", 11],
    ["p2", "hawkeye", 13],
  ]);
  const [, logan, hawkeye] = s.fighters;
  hawkeye.power = 0;
  activate(s);
  attack(s, logan, 0, "mystic", dice(2, 2));
  assert.ok(logan.damage > 0);
  assert.equal(hawkeye.damage, 1);
  assert.equal(hawkeye.power, 1);
  condition(logan, "stun");
  assert.ok(!(logan.conditions || []).includes("stun"));
});

test("Magik, Cable and Logan fit in a saved Game roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["magik", "cable", "logan-the-wolverine"];
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
