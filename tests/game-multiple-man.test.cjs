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
const dupeSlug = "multiple-man-duplicates-grunts";
const withDupe = (s, side, x, y = 8) => {
  const card = pool.characters[dupeSlug];
  const dupe = {
    id: side + ":" + dupeSlug,
    side,
    slug: dupeSlug,
    name: card.name,
    size: card.size,
    speed: card.speed,
    radius: card.baseSize / 50.8,
    power: 0,
    grunt: true,
    activated: false,
    x,
    y,
  };
  s.fighters.push(dupe);
  return dupe;
};

test("Kinetic Duplication Places Duplicates within 2 after Multiple Man takes damage", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "multiple-man", 12],
  ]);
  const [hawkeye, madrox] = s.fighters;
  combat.damage(s, madrox, 1, hawkeye);
  const spawn = s.effects.find((e) => e.type === "spawn-drones");
  assert.equal(spawn.model.slug, dupeSlug);
  assert.equal(spawn.range, 2);
  assert.equal(spawn.side, "p2");
  s.decisionSide = "p2";
  act(s, "p2", { type: "spawn-drones", x: 14, y: 8 });
  const dupe = s.fighters.find((f) => f.slug === dupeSlug);
  assert.equal(dupe.x, 14);
  assert.deepEqual(dupe.conditions, []);
  combat.damage(s, madrox, 1, hawkeye);
  assert.ok(!s.effects.some((e) => e.type === "spawn-drones"));
});

test("Shared Experiences pays Multiple Man when Duplicates deal or take enemy damage", () => {
  const s = trial([
    ["p1", "multiple-man", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [madrox, hawkeye] = s.fighters;
  const dupe = withDupe(s, "p1", 10);
  combat.damage(s, dupe, 1, hawkeye);
  combat.damage(s, hawkeye, 1, dupe);
  assert.equal(madrox.power, 5);
});

test("Duplicates activate before Multiple Man; Dogpile rerolls near him and Slows on a Wild", () => {
  const s = trial([
    ["p1", "multiple-man", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [madrox, hawkeye] = s.fighters;
  const dupe = withDupe(s, "p1", 9.5, 9.5);
  activate(s, madrox);
  assert.equal(s.active, dupe.id);
  act(
    s,
    "p1",
    { type: "attack", target: hawkeye.id, index: 0, damageType: "physical" },
    dice(1),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice(1));
  const option = actions(s)[0];
  assert.equal(option.label, "Dogpile");
  assert.equal(option.max, 2);
  act(s, "p1", { type: "skip-effect" });
  assert.ok(hawkeye.conditions.includes("slow"));
});

test("Madrox Monkey Pile! adds 2 dice near Duplicates and Staggers on Wild and Hit", () => {
  const s = trial([
    ["p1", "multiple-man", 8],
    ["p2", "hulk", 11],
  ]);
  const [madrox, hulk] = s.fighters;
  withDupe(s, "p1", 12.5).activated = true;
  madrox.power = 3;
  activate(s, madrox);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 1, damageType: "physical" },
    dice(1, 2),
  );
  for (const side of ["p1", "p2"])
    while (actions(s, side)[0]?.type === "modify-dice")
      act(s, side, { type: "skip-effect" });
  assert.equal(
    s.log.findLast((e) => e.attack === "Madrox Monkey Pile!").rolled.length,
    9,
  );
  assert.ok(hulk.conditions.includes("stagger"));
});

test("Duplicate Reabsorption KOs Duplicates, takes their Extract token and heals 3", () => {
  const s = trial([
    ["p1", "multiple-man", 8],
    ["p2", "hawkeye", 20],
  ]);
  const [madrox] = s.fighters;
  madrox.damage = 4;
  const dupe = withDupe(s, "p1", 10);
  dupe.activated = true;
  s.objectives = [
    { id: "e", name: "Token", role: "extract", holder: dupe.id, radius: 0.5 },
  ];
  activate(s, madrox);
  act(s, "p1", {
    type: "power",
    value: "Duplicate Reabsorption",
    target: dupe.id,
  });
  assert.ok(dupe.ko);
  assert.equal(s.objectives[0].holder, madrox.id);
  assert.equal(madrox.damage, 1);
});

test("Follow the Leads Throws Multiple Man Short", () => {
  const s = trial([
    ["p1", "multiple-man", 8],
    ["p2", "hawkeye", 20],
  ]);
  activate(s);
  act(s, "p1", { type: "power", value: "Follow the Leads" });
  const throwMove = actions(s)[0];
  assert.equal(throwMove.mode, "throw");
  assert.equal(throwMove.speed, "S");
});

test("Duplicates Interact for free only when another ally contests the objective", () => {
  const s = trial([
    ["p1", "multiple-man", 8],
    ["p2", "hawkeye", 20],
  ]);
  const [madrox] = s.fighters;
  const dupe = withDupe(s, "p1", 10);
  s.objectives = [
    { id: "e", name: "Token", role: "extract", x: 10, y: 9.3, radius: 0.5 },
  ];
  assert.deepEqual(mission.interacts(s, dupe), []);
  madrox.x = 10.5;
  madrox.y = 10.3;
  assert.equal(mission.interacts(s, dupe).length, 1);
});

test("Ultron Drones still explode while Duplicates do not", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "multiple-man", 14],
  ]);
  const [hawkeye] = s.fighters;
  const dupe = withDupe(s, "p2", 9.5);
  combat.damage(s, dupe, 5, hawkeye);
  assert.ok(dupe.ko);
  assert.equal(hawkeye.damage || 0, 0);
});

test("Multiple Man fits in saved X-Factor and Uncanny X-Men rosters", () => {
  const preset = pool.presets[0];
  for (const [newcomers, affiliation] of [
    [["multiple-man", "havok", "rogue"], "X-Factor"],
    [["multiple-man", "cyclops", "storm"], "Uncanny X-Men"],
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
