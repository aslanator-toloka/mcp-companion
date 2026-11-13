const test = require("node:test");
const assert = require("node:assert/strict");
const { act, view, create } = require("../game/engine.cjs");
const { condition } = require("../game/combat.cjs");
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

test("XSE Blaster Incinerates only a defender within range 3", () => {
  for (const [x, burns] of [
    [10.5, true],
    [16, false],
  ]) {
    const s = trial([
      ["p1", "bishop", 8],
      ["p2", "hawkeye", x],
    ]);
    const [bishop, hawkeye] = s.fighters;
    activate(s);
    attack(s, hawkeye, 0, "energy", dice(2, 2, 2));
    assert.ok(lastAttack(s, "XSE Blaster"));
    assert.equal((hawkeye.conditions || []).includes("incinerate"), burns);
    assert.equal(bishop.power, 3 + (hawkeye.damage || 0));
  }
});

test("Return With Interest takes a chosen type, extra Power for dice, and Pushes then Slows on a Wild", () => {
  const s = trial([
    ["p1", "bishop", 8],
    ["p2", "hawkeye", 10],
  ]);
  const [bishop, hawkeye] = s.fighters;
  bishop.power = 7;
  activate(s);
  const option = actions(s)
    .find((a) => a.type === "attack")
    .attacks.find((a) => a.name === "Return With Interest");
  assert.deepEqual(option.types, ["physical", "energy", "mystic"]);
  assert.equal(option.boostMax, 2);
  assert.throws(() =>
    act(s, "p1", {
      type: "attack",
      index: 1,
      angle: 0,
      damageType: "mystic",
      boost: 3,
    }),
  );
  act(
    s,
    "p1",
    { type: "attack", index: 1, angle: 0, damageType: "mystic", boost: 2 },
    dice(1),
  );
  skipDice(s);
  assert.equal(bishop.power, 0);
  assert.equal(lastAttack(s, "Return With Interest").rolled.length, 9);
  const push = actions(s)[0];
  assert.equal(push.mode, "push");
  assert.equal(push.mover, hawkeye.id);
  assert.ok(hawkeye.conditions.includes("slow"));
});

test("Mutant Energy Absorption blanks attack dice per defensive Wild and pays Bishop Power", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "bishop", 12],
  ]);
  const [, bishop] = s.fighters;
  bishop.power = 0;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: bishop.id, index: 0, damageType: "physical" },
    dice(2, 2, 2, 7, 7, 1, 1),
  );
  const option = actions(s, "p2").find(
    (a) => a.label === "Mutant Energy Absorption",
  );
  assert.equal(option.max, 2);
  act(s, "p2", { type: "modify-dice", indices: [0, 1] });
  skipDice(s);
  assert.equal(bishop.damage || 0, 0);
  assert.equal(bishop.power, 2);
});

test("Overload damages Bishop in Cleanup at 8 Power; immunities and Absorbed Energy Conversion work", () => {
  const s = trial([
    ["p1", "bishop", 8],
    ["p2", "hawkeye", 9.5],
  ]);
  const [bishop, hawkeye] = s.fighters;
  for (const name of ["incinerate", "poison", "stun"]) condition(bishop, name);
  assert.deepEqual(bishop.conditions || [], []);
  s.mission = {};
  bishop.power = 8;
  mission.cleanup(s, dice());
  assert.equal(bishop.damage, 1);
  bishop.power = 3;
  activate(s);
  const power = actions(s)
    .find((a) => a.type === "power")
    .powers.find((p) => p.value === "Absorbed Energy Conversion");
  assert.ok(power.targets.some((t) => t.value === hawkeye.id));
  assert.equal(power.speed, "M");
});

test("Claw Rush offers a Medium Advance; Assassin Training rerolls one die", () => {
  const s = trial([
    ["p1", "x-23", 8],
    ["p2", "hulk", 11],
  ]);
  const [laura, hulk] = s.fighters;
  hulk.power = 0;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 1, damageType: "physical" },
    dice(),
  );
  const reroll = actions(s)[0];
  assert.equal(reroll.label, "Assassin Training");
  assert.equal(reroll.max, 1);
  act(s, "p1", { type: "modify-dice", indices: [0] }, dice(2));
  skipDice(s);
  const move = actions(s)[0];
  assert.equal(move.mode, "advance");
  assert.equal(move.mover, laura.id);
  assert.equal(move.speed, "M");
});

test("Frenzy Advances X-23 and grants an Adamantium Slash after she Dazes an enemy", () => {
  const s = trial([
    ["p1", "x-23", 8],
    ["p2", "hawkeye", 10],
    ["p2", "hulk", 13],
  ]);
  const [laura, hawkeye, hulk] = s.fighters;
  hawkeye.damage = 4;
  laura.power = 2;
  activate(s);
  attack(s, hawkeye, 0, "physical", dice(2, 2, 2, 2));
  assert.ok(hawkeye.dazed);
  const frenzy = actions(s).find((a) => a.type === "frenzy");
  assert.ok(frenzy);
  act(s, "p1", { type: "frenzy" });
  const move = actions(s)[0];
  assert.equal(move.mode, "advance");
  assert.equal(move.speed, "S");
  act(s, "p1", { type: "displace", x: 9, y: 9.5 });
  const slash = actions(s).find((a) => a.type === "attack");
  assert.deepEqual(
    slash.attacks.map((a) => a.name),
    ["Adamantium Slash"],
  );
  const before = s.actionsLeft;
  attack(s, hulk, slash.attacks[0].index, "physical");
  assert.equal(s.actionsLeft, before);
});

test("Big Sis and Lil‘ Sis Advance toward whoever damages the other sister, once per Turn", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "honey-badger", 12],
    ["p2", "x-23", 14],
  ]);
  const [hawkeye, gabby, laura] = s.fighters;
  activate(s);
  attack(s, gabby, 0, "physical", dice(2, 2));
  assert.ok(gabby.damage > 0);
  const move = s.effects.find((e) => e.name === "Big Sis");
  assert.equal(move.mover, laura.id);
  assert.equal(move.direction, "toward");
  assert.equal(move.reference.x, hawkeye.x);
});

test("Hamstring Slows and Bleeds on damage; Honey Badger’s Claw Slash has no Pierce", () => {
  const s = trial([
    ["p1", "honey-badger", 8],
    ["p2", "hawkeye", 10],
  ]);
  const [gabby, hawkeye] = s.fighters;
  activate(s);
  attack(s, hawkeye, 0, "physical", dice(1, 7, 7, 7, 7, 4));
  assert.ok(!s.log.some((e) => e.text?.startsWith("Pierce")));
  assert.equal(lastAttack(s, "Claw Slash").defense[0], "block");
  gabby.power = 3;
  attack(s, hawkeye, 1, "physical", dice(2, 2));
  if (hawkeye.damage < 5) {
    assert.ok(hawkeye.conditions.includes("slow"));
    assert.ok(hawkeye.conditions.includes("bleed"));
  }
});

test("Too Dangerous to Ignore redirects an attack from an enemy within 2", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "hulk", 12],
    ["p2", "honey-badger", 9.5],
  ]);
  const [, hulk, gabby] = s.fighters;
  gabby.y = 10;
  activate(s);
  act(s, "p1", {
    type: "attack",
    target: hulk.id,
    index: 0,
    damageType: "physical",
  });
  const option = actions(s, "p2").find((a) =>
    a.value?.startsWith("too-dangerous:"),
  );
  assert.ok(option);
  act(s, "p2", { type: "reaction", value: option.value }, dice(2, 2));
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice(2, 2));
  skipDice(s);
  assert.equal(hulk.damage || 0, 0);
  assert.ok(gabby.damage > 0);
  assert.equal(gabby.power, 1 + gabby.damage);
});

test("Anklebiter costs a nearby enemy 1 defense die and keeps Honey Badger off Secure objectives", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p1", "honey-badger", 12],
    ["p2", "hulk", 13],
  ]);
  const [, gabby, hulk] = s.fighters;
  gabby.y = 9;
  activate(s);
  attack(s, hulk, 0, "physical");
  assert.equal(
    lastAttack(s, "Arrow Shot").defense.length,
    view(s, "p1").fighters[2].defenses.physical - 1,
  );
  s.objectives = [
    { id: "s", name: "Secure", role: "secure", x: 12, y: 9.5, radius: 0.5 },
  ];
  assert.deepEqual(mission.interacts(s, gabby), []);
  assert.equal(mission.secureSide(s, s.objectives[0]), "p2");
});

test("Bishop, X-23 and Honey Badger fit in a saved Game roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["bishop", "x-23", "honey-badger"];
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
