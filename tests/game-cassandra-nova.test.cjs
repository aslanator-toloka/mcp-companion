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

test("Telepathic Cloak only lets attackers within range 3 target Cassandra", () => {
  for (const [x, allowed] of [
    [13, true],
    [16, false],
  ]) {
    const s = trial([
      ["p1", "hawkeye", 8],
      ["p2", "cassandra-nova", x],
    ]);
    const [, nova] = s.fighters;
    activate(s);
    const arrow = actions(s)
      .find((a) => a.type === "attack")
      ?.attacks.find((a) => a.name === "Arrow Shot");
    assert.equal(!!arrow?.targets.some((t) => t.value === nova.id), allowed);
  }
});

test("Cassandra’s Psionic Bolt saps Power on Wilds without Pierce", () => {
  const s = trial([
    ["p1", "cassandra-nova", 8],
    ["p2", "hulk", 12],
  ]);
  const [nova, hulk] = s.fighters;
  hulk.power = 3;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "mystic" },
    dice(1, 1, 5, 7, 7, 4),
  );
  assert.ok(!actions(s).some((a) => a.label === "Reality Contortion"));
  skipDice(s);
  assert.equal(nova.power, 3 + 2 + (hulk.damage || 0));
});

test("Mind Possession offers a Short Advance of the defender even without damage", () => {
  const s = trial([
    ["p1", "cassandra-nova", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [, hawkeye] = s.fighters;
  activate(s);
  attack(s, hawkeye, 1, "mystic", dice());
  const move = actions(s)[0];
  assert.equal(move.mode, "advance");
  assert.equal(move.mover, hawkeye.id);
  assert.equal(move.speed, "S");
});

test("Flesh Manipulation Pushes and damages everyone else within 2 on a Wild", () => {
  const s = trial([
    ["p1", "cassandra-nova", 8],
    ["p1", "hawkeye", 8],
    ["p2", "hulk", 10],
  ]);
  const [nova, ally, hulk] = s.fighters;
  ally.y = 10;
  nova.power = 3;
  hulk.power = 0;
  activate(s);
  attack(s, hulk, 2, "physical", dice(1));
  assert.equal(ally.damage, 1);
  const pushed = s.effects.filter((e) => e.mode === "push").map((e) => e.mover);
  assert.ok(pushed.includes(ally.id));
  assert.ok(pushed.includes(hulk.id));
});

test("Biokinesis Roots and Slows an enemy within range 3", () => {
  const s = trial([
    ["p1", "cassandra-nova", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [, hawkeye] = s.fighters;
  activate(s);
  act(s, "p1", { type: "power", value: "Biokinesis", target: hawkeye.id });
  assert.deepEqual(hawkeye.conditions.sort(), ["root", "slow"]);
});

test("Psychic Distraction punishes an enemy that ends a move nearby and may Advance Cassandra", () => {
  const s = trial([
    ["p1", "hawkeye", 6],
    ["p2", "cassandra-nova", 14],
  ]);
  const [hawkeye, nova] = s.fighters;
  activate(s);
  act(s, "p1", { type: "advance", x: 9, y: 8 });
  const option = actions(s, "p2")[0];
  assert.equal(option.type, "psychic-distraction");
  act(s, "p2", { type: "psychic-distraction" }, dice(0, 1, 7, 7));
  assert.equal(hawkeye.damage, 2);
  assert.equal(nova.power, 1);
  const move = actions(s, "p2")[0];
  assert.equal(move.mode, "advance");
  assert.equal(move.mover, nova.id);
});

test("Telekinetic Deflection prevents collision damage for 2 Power", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "cassandra-nova", 12],
  ]);
  const [hulk, nova] = s.fighters;
  s.terrain = [{ id: "car", name: "Car", size: 3, x: 8, y: 10, w: 1, h: 1 }];
  activate(s);
  act(s, "p1", {
    type: "power",
    value: "Strongest One There Is",
    target: "car",
  });
  act(s, "p1", { type: "throw-terrain", angle: 0 }, dice());
  const option = actions(s, "p2")[0];
  assert.equal(option.type, "deflection");
  act(s, "p2", { type: "deflection" });
  assert.equal(nova.damage || 0, 0);
  assert.equal(nova.power, 1);
  void hulk;
});

test("Cassandra Nova fits in saved Hellfire Club and Servants of the Apocalypse rosters", () => {
  const preset = pool.presets[0];
  for (const [newcomers, affiliation] of [
    [["cassandra-nova", "emma-frost", "omega-red"], "Hellfire Club"],
    [["cassandra-nova", "archangel", "psylocke"], "Servants of the Apocalypse"],
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
