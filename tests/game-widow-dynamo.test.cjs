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

test("Widow’s Strike is energy, stings Power on a Wild and never Pushes; her Pistol has no Rapid Fire", () => {
  const s = trial([
    ["p1", "black-widow", 8],
    ["p2", "hawkeye", 10.5],
  ]);
  const [widow, hawkeye] = s.fighters;
  hawkeye.power = 2;
  activate(s);
  const strike = actions(s)
    .find((a) => a.type === "attack")
    .attacks.find((a) => a.name === "Strike");
  assert.deepEqual(strike.types, ["energy"]);
  attack(s, hawkeye, 0, "energy", dice(1));
  assert.equal(hawkeye.power, 2 - 1 + hawkeye.damage);
  assert.ok(!s.effects.some((e) => e.mode === "push"));
  attack(s, hawkeye, 1, "physical", dice(2));
  assert.ok(!s.effects.some((e) => e.type === "bonus-attack"));
  void widow;
});

test("Mixed Technique Staggers on damage and offers a Short Advance on a Wild", () => {
  const s = trial([
    ["p1", "black-widow", 8],
    ["p2", "hawkeye", 10.5],
  ]);
  const [widow, hawkeye] = s.fighters;
  activate(s);
  attack(s, hawkeye, 2, "physical", dice(1, 2));
  assert.ok(hawkeye.conditions.includes("stagger"));
  const move = actions(s)[0];
  assert.equal(move.mode, "advance");
  assert.equal(move.mover, widow.id);
});

test("Counter-Strike rolls 4 dice against an attacker within range 3", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "black-widow", 10.5],
  ]);
  const [hawkeye, widow] = s.fighters;
  activate(s);
  attack(s, widow, 0, "physical");
  const option = actions(s, "p2")[0];
  assert.equal(option.type, "counter-strike");
  act(s, "p2", { type: "counter-strike" }, dice(0, 1, 7, 7));
  assert.equal(hawkeye.damage, 2);
  assert.equal(widow.power, 1 + (widow.damage || 0));
});

test("Electric Blast Shocks on a Wild; Homing Rockets ignore LOS and blast nearby enemies", () => {
  const s = trial([
    ["p1", "crimson-dynamo", 8],
    ["p2", "hawkeye", 14],
    ["p2", "hulk", 15],
  ]);
  const [dynamo, hawkeye, hulk] = s.fighters;
  hulk.y = 9.5;
  dynamo.power = 2;
  s.terrain = [{ id: "wall", size: 5, x: 11, y: 7, w: 0.5, h: 2 }];
  activate(s);
  const rockets = actions(s)
    .find((a) => a.type === "attack")
    .attacks.find((a) => a.name === "Homing Rockets");
  assert.ok(rockets.targets.some((t) => t.value === hawkeye.id));
  attack(s, hawkeye, 1, "physical", dice(1));
  assert.equal(hulk.damage, 1);
});

test("Disruption Field rerolls an enemy attacker’s dice; Carborundum Matrix Alloy reduces damage", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "hulk", 12],
    ["p2", "crimson-dynamo", 10],
  ]);
  const [hawkeye, , dynamo] = s.fighters;
  dynamo.y = 10;
  activate(s);
  act(
    s,
    "p1",
    {
      type: "attack",
      target: s.fighters[1].id,
      index: 0,
      damageType: "physical",
    },
    () => 2,
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, () => 2);
  const option = actions(s, "p2").find((a) => a.label === "Disruption Field");
  assert.ok(option);
  act(s, "p2", { type: "modify-dice", indices: [0, 1] }, () => 7);
  assert.equal(dynamo.power, 1);
  combat.damage(s, dynamo, 3, hawkeye);
  assert.equal(dynamo.damage, 2);
});

test("Overcharge Capacitors spends an Action for 2 Power; Propulsion Thrusters Place within 2", () => {
  const s = trial([
    ["p1", "crimson-dynamo", 8],
    ["p2", "hawkeye", 20],
  ]);
  const [dynamo] = s.fighters;
  dynamo.power = 0;
  activate(s);
  act(s, "p1", { type: "power", value: "Overcharge Capacitors" });
  assert.equal(dynamo.power, 2);
  assert.equal(s.actionsLeft, 1);
  act(s, "p1", { type: "power", value: "Propulsion Thrusters", x: 10.5, y: 8 });
  assert.equal(dynamo.x, 10.5);
});

test("Unbreakable Red Line removes a condition at activation and resists Pushes on Secure", () => {
  const s = trial([
    ["p1", "red-guardian", 8],
    ["p1", "crimson-dynamo", 4],
    ["p2", "hulk", 10.5],
  ]);
  const [guardian, dynamo, hulk] = s.fighters;
  s.leaders.p1 = dynamo.slug + ":Unbreakable Red Line";
  guardian.conditions = ["slow", "bleed"];
  activate(s, guardian);
  const option = actions(s)[0];
  assert.equal(option.type, "red-line");
  act(s, "p1", { type: "red-line", value: "bleed" });
  assert.deepEqual(guardian.conditions, ["slow"]);
  act(s, "p1", { type: "end" });
  s.objectives = [{ id: "s", role: "secure", x: 8, y: 9.3, radius: 0.5 }];
  activate(s, hulk);
  act(
    s,
    "p2",
    { type: "attack", target: guardian.id, index: 0, damageType: "physical" },
    dice(1),
  );
  while (s.pendingAttack)
    act(s, "p1", { type: "reaction", value: "skip" }, dice(1));
  skipDice(s);
  if (actions(s, "p2")[0]?.type === "start-displacement")
    act(s, "p2", { type: "start-displacement" });
  for (const side of ["p1", "p2"])
    if (actions(s, side)[0]?.type === "shield-mind")
      act(s, side, { type: "shield-mind", value: "skip" });
  act(s, "p2", { type: "displace", angle: 180 }, () => 4);
  assert.equal(guardian.x, 8);
});

test("Black Widow and Crimson Dynamo complete a saved Winter Guard roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["black-widow", "crimson-dynamo", "darkstar"];
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
