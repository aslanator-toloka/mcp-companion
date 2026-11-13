const test = require("node:test");
const assert = require("node:assert/strict");
const { act, view, create } = require("../game/engine.cjs");
const combat = require("../game/combat.cjs");
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

test("Stab, Stab needs two Wilds; Bang, Bang needs a Wild and a Hit", () => {
  for (const [index, roll, follow] of [
    [0, [1, 1], true],
    [0, [1, 2], false],
    [1, [1, 2], true],
  ]) {
    const s = trial([
      ["p1", "deadpool", 8],
      ["p2", "hulk", 10.5],
    ]);
    const [, hulk] = s.fighters;
    activate(s);
    attack(s, hulk, index, "physical", dice(...roll));
    assert.equal(
      s.effects.some((e) => e.type === "bonus-attack"),
      follow,
      String([index, roll]),
    );
  }
});

test("I Know Karate rerolls one die; Duodenum Poke Bleeds and Slows on damage", () => {
  const s = trial([
    ["p1", "deadpool", 8],
    ["p2", "hawkeye", 10.5],
  ]);
  const [deadpool, hawkeye] = s.fighters;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hawkeye.id, index: 2, damageType: "physical" },
    dice(2, 2),
  );
  const option = actions(s)[0];
  assert.equal(option.label, "I Know Karate");
  assert.equal(option.max, 1);
  skipDice(s);
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice(2, 2));
  assert.ok(hawkeye.damage > 0);
  assert.deepEqual(hawkeye.conditions.sort(), ["bleed", "slow"]);
  assert.equal(deadpool.power, 0);
});

test("Merc with a Mouth drains 2 Power from an enemy once per Round", () => {
  const s = trial([
    ["p1", "deadpool", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [deadpool, hawkeye] = s.fighters;
  deadpool.power = 6;
  activate(s);
  act(s, "p1", {
    type: "power",
    value: "Merc with a Mouth",
    target: hawkeye.id,
  });
  assert.equal(hawkeye.power, 1);
  const again = actions(s)
    .find((a) => a.type === "power")
    ?.powers.find((p) => p.value === "Merc with a Mouth");
  assert.ok(!again?.targets?.some((t) => t.value === hawkeye.id));
});

test("Maximum Effort! Dance Party damages everyone near Deadpool after the Advance and pays him Power", () => {
  const s = trial([
    ["p1", "deadpool", 8],
    ["p1", "hawkeye", 8],
    ["p2", "hulk", 10.5],
  ]);
  const [deadpool, ally, hulk] = s.fighters;
  ally.y = 10;
  deadpool.injured = true;
  deadpool.power = 4;
  hulk.power = 0;
  activate(s);
  attack(s, hulk, 2, "physical", dice(1));
  const move = actions(s)[0];
  assert.equal(move.mode, "advance");
  const powerBefore = deadpool.power;
  const hulkBefore = hulk.damage || 0;
  act(s, "p1", { type: "displace", x: 8.5, y: 8 });
  assert.equal(ally.damage, 1);
  assert.equal(hulk.damage, hulkBefore + 1);
  assert.equal(deadpool.power, powerBefore + 2);
});

test("Unicorns stop mystic Advances; Now it’s Serious keeps injured Deadpool Healthy for contesting", () => {
  const s = trial([
    ["p1", "professor-x", 8],
    ["p2", "deadpool", 11],
    ["p2", "hawkeye", 30],
    ["p1", "hulk", 11],
  ]);
  const [, deadpool] = s.fighters;
  activate(s);
  attack(s, deadpool, 1, "mystic", dice(2, 2, 2));
  assert.ok(!s.effects.some((e) => e.mode === "advance"));
  deadpool.injured = true;
  const hulk = s.fighters[3];
  hulk.injured = false;
  hulk.y = 9.2;
  deadpool.y = 9.2;
  deadpool.x = 12.6;
  const objective = { id: "o", role: "secure", x: 11.8, y: 10, radius: 0.5 };
  assert.equal(mission.secureSide(s, objective), null);
});

test("T-O Talons infect on a Wild; Warlock ignores Bleed and Poison; Unstable Outline adds a die at range", () => {
  const s = trial([
    ["p1", "warlock", 8],
    ["p2", "hawkeye", 10.5],
  ]);
  const [warlock, hawkeye] = s.fighters;
  activate(s);
  attack(s, hawkeye, 0, "physical", dice(1));
  assert.deepEqual(hawkeye.conditions.sort(), ["bleed", "poison"]);
  combat.condition(warlock, "poison");
  assert.deepEqual(warlock.conditions || [], []);

  const far = trial([
    ["p1", "hawkeye", 8],
    ["p2", "warlock", 16],
  ]);
  activate(far);
  attack(far, far.fighters[1], 0, "physical");
  assert.equal(lastAttack(far, "Arrow Shot").defense.length, 3 + 1);
});

test("Self Must Protect Selffriend destroys terrain for rerolls and Throws on a Wild", () => {
  const s = trial([
    ["p1", "warlock", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [warlock, hawkeye] = s.fighters;
  warlock.power = 4;
  s.terrain = [{ id: "car", name: "Car", size: 2, x: 8, y: 10, w: 1, h: 1 }];
  activate(s);
  act(s, "p1", {
    type: "attack",
    target: hawkeye.id,
    index: 2,
    damageType: "energy",
  });
  while (s.pendingAttack) act(s, "p2", { type: "reaction", value: "skip" });
  assert.equal(actions(s)[0].type, "selffriend");
  act(s, "p1", { type: "selffriend", value: "car" }, dice(1));
  assert.equal(s.terrain.length, 0);
  const reroll = actions(s)[0];
  assert.equal(reroll.label, "Self Must Protect Selffriend");
  assert.equal(reroll.max, 2);
  skipDice(s);
  assert.ok(
    s.effects.some((e) => e.mode === "throw" && e.mover === hawkeye.id),
  );
});

test("Techno-Organic Absorption heals by terrain size; Transmode Virus hurts Warlock and Poisoned enemies", () => {
  const s = trial([
    ["p1", "warlock", 8],
    ["p2", "hawkeye", 10],
    ["p2", "hulk", 15],
  ]);
  const [warlock, hawkeye, hulk] = s.fighters;
  warlock.power = 4;
  warlock.damage = 3;
  hawkeye.conditions = ["poison"];
  hulk.conditions = ["poison"];
  s.terrain = [{ id: "car", name: "Car", size: 3, x: 8, y: 10, w: 1, h: 1 }];
  activate(s);
  act(s, "p1", {
    type: "power",
    value: "Techno-Organic Absorption",
    target: "car",
  });
  assert.equal(warlock.damage, 0);
  act(s, "p1", { type: "power", value: "Transmode Virus Infection" });
  assert.equal(warlock.damage, 2);
  assert.equal(hawkeye.damage, 2);
  assert.equal(hulk.damage || 0, 0);
});

test("Deadpool and Warlock fit in a saved X-Force roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["deadpool", "warlock", "cable"];
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
    affiliation: "X-Force",
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
