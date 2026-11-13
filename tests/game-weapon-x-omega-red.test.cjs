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

test("Anti-Healing Factor Corrosive can stop an enemy Healing Factor in range 3", () => {
  for (const use of [true, false]) {
    const s = trial([
      ["p1", "wolverine", 8],
      ["p2", "maverick", 11],
    ]);
    const [logan, maverick] = s.fighters;
    logan.damage = 3;
    activate(s);
    act(s, "p1", { type: "end" });
    const option = actions(s, "p2")[0];
    assert.equal(option.type, "anti-healing");
    act(s, "p2", { type: use ? "anti-healing" : "skip-effect" });
    assert.equal(logan.damage, use ? 3 : 1);
    assert.equal(maverick.power, use ? 1 : 3);
  }
});

test("Kinetic Energy Absorption gives Maverick Power and an optional Advance after physical damage", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "maverick", 10.5],
  ]);
  const [, maverick] = s.fighters;
  activate(s);
  attack(s, maverick, 0, "physical", dice(2, 2));
  assert.ok(maverick.damage > 0);
  assert.equal(maverick.power, 3 + maverick.damage + 1);
  const move = s.effects.find((e) => e.name === "Kinetic Energy Absorption");
  assert.equal(move.mode, "advance");
  assert.equal(move.mover, maverick.id);
});

test("Plasma Blasters Rapid Fire on a Hit; Agent Zero Throws a small defender on a Wild", () => {
  const s = trial([
    ["p1", "maverick", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [maverick, hawkeye] = s.fighters;
  activate(s);
  attack(s, hawkeye, 0, "energy", dice(2));
  assert.ok(s.effects.some((e) => e.type === "bonus-attack"));
  act(s, "p1", { type: "skip-effect" });
  maverick.power = 3;
  attack(s, hawkeye, 2, "energy", dice(1));
  assert.ok(
    s.effects.some((e) => e.mode === "throw" && e.mover === hawkeye.id),
  );
});

test("Berserker Rage adds a die against a target already attacked this Turn", () => {
  const s = trial([
    ["p1", "weapon-x", 8],
    ["p2", "hulk", 10.5],
  ]);
  const [, hulk] = s.fighters;
  activate(s);
  attack(s, hulk, 0, "physical");
  assert.equal(lastAttack(s, "Berserker Rage").rolled.length, 5);
  attack(s, hulk, 0, "physical");
  assert.equal(lastAttack(s, "Berserker Rage").rolled.length, 6);
});

test("Uncontrollable Weapon Rampage hits everyone near Weapon X and Wild Abandon grants a free repeat", () => {
  const s = trial([
    ["p1", "weapon-x", 8],
    ["p1", "hawkeye", 8],
    ["p2", "hulk", 10.5],
  ]);
  const [weapon, ally, hulk] = s.fighters;
  ally.y = 10;
  weapon.power = 4;
  activate(s);
  attack(s, hulk, 1, "physical", dice(1, 1, 2));
  assert.equal(ally.damage, 1);
  assert.ok(s.effects.some((e) => e.type === "bonus-attack"));
  assert.equal(weapon.power, 0);
});

test("Savagery Protocols: +2 attack dice and −1 defense die near a Secure token, and no Extract tokens", () => {
  const s = trial([
    ["p1", "weapon-x", 8],
    ["p2", "hulk", 10.5],
  ]);
  const [weapon, hulk] = s.fighters;
  s.objectives = [
    { id: "s", role: "secure", x: 8, y: 9.5, radius: 0.5 },
    { id: "e", role: "extract", x: 7, y: 8, radius: 0.5 },
  ];
  assert.ok(!combat.canHoldExtract(s, weapon, s.objectives[1]));
  activate(s);
  attack(s, hulk, 0, "physical");
  assert.equal(lastAttack(s, "Berserker Rage").rolled.length, 7);
});

test("Aimless Aggression damages everyone near Weapon X when it is KO’d", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "weapon-x", 10.5],
    ["p2", "hawkeye", 10.5],
  ]);
  const [hulk, weapon, hawkeye] = s.fighters;
  hawkeye.y = 10;
  weapon.injured = true;
  weapon.damage = 4;
  s.rng = dice(0, 1, 7, 7, 7, 7);
  combat.damage(s, weapon, 1, hulk);
  assert.ok(weapon.ko);
  assert.ok(hawkeye.damage >= 2);
  assert.ok(hulk.damage >= 2);
});

test("Carbonadium Coils heal on damage; Carbonadium Armor reduces enemy damage", () => {
  const s = trial([
    ["p1", "omega-red", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [omega, hawkeye] = s.fighters;
  omega.damage = 2;
  activate(s);
  attack(s, hawkeye, 0, "physical", dice(2, 2));
  assert.ok(hawkeye.damage > 0);
  assert.equal(omega.damage, 1);
  combat.damage(s, omega, 3, hawkeye);
  assert.equal(omega.damage, 3);
});

test("Red Terror’s Absorb Essence turns a defensive success into a Failure for Power", () => {
  const s = trial([
    ["p1", "omega-red", 8],
    ["p2", "hulk", 12],
  ]);
  const [omega, hulk] = s.fighters;
  omega.power = 4;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 1, damageType: "energy" },
    dice(1, 7, 7, 7, 7, 7, 7, 4),
  );
  while (s.pendingAttack)
    act(
      s,
      "p2",
      { type: "reaction", value: "skip" },
      dice(1, 7, 7, 7, 7, 7, 7, 4),
    );
  const option = actions(s).find((a) => a.label === "Absorb Essence");
  assert.ok(option);
  act(s, "p1", { type: "modify-dice", indices: [option.eligible[0]] });
  assert.equal(omega.power, 1);
});

test("Ensnare Pushes a visible enemy toward Omega Red once per Turn; Death Factor hurts Poisoned enemies", () => {
  const s = trial([
    ["p1", "omega-red", 8],
    ["p2", "hawkeye", 14],
  ]);
  const [omega, hawkeye] = s.fighters;
  omega.power = 4;
  hawkeye.conditions = ["poison"];
  activate(s);
  act(s, "p1", { type: "power", value: "Ensnare", target: hawkeye.id });
  const push = actions(s)[0];
  assert.equal(push.mode, "push");
  assert.equal(push.direction, "toward");
  assert.equal(push.reference.x, 8);
  act(s, "p1", { type: "displace", angle: 180 });
  assert.ok(hawkeye.x < 14);
  const again = actions(s)
    .find((a) => a.type === "power")
    ?.powers.find((p) => p.value === "Ensnare");
  assert.ok(!again?.targets?.some((t) => t.value === hawkeye.id));
  act(s, "p1", { type: "power", value: "Death Factor" });
  assert.equal(hawkeye.damage, 2);
  assert.equal(omega.damage, 2);
});

test("Death Spores Poison enemies that end their Activation near Omega Red", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "omega-red", 10],
  ]);
  const [hawkeye, omega] = s.fighters;
  activate(s);
  act(s, "p1", { type: "end" });
  assert.ok(hawkeye.conditions.includes("poison"));
  combat.condition(omega, "poison");
  assert.ok(!(omega.conditions || []).includes("poison"));
});

test("Maverick, Weapon X and Omega Red fit in saved rosters", () => {
  const preset = pool.presets[0];
  for (const [newcomers, affiliation] of [
    [["maverick", "weapon-x", "x-23"], "Weapon X"],
    [["omega-red", "emma-frost", "sunspot"], "Hellfire Club"],
  ]) {
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
      affiliation,
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
  }
});
