const test = require("node:test");
const assert = require("node:assert/strict");
const { act, view, create } = require("../game/engine.cjs");
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
const xavier = "professor-x:Xavier's School for Gifted Youngsters";

test("Psychic Dart gains Power equal to damage and Roots the defender on a Wild", () => {
  const s = trial([
    ["p1", "professor-x", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [professor, hawkeye] = s.fighters;
  hawkeye.power = 0;
  activate(s);
  attack(s, hawkeye, 0, "mystic", dice(1, 2, 2));
  assert.ok(hawkeye.damage > 0);
  assert.equal(professor.power, 3 + hawkeye.damage);
  assert.ok(hawkeye.conditions.includes("root"));
});

test("Mental Suggestion Advances a damaged defender its own Speed, but not an Omega-Level Telepath", () => {
  const s = trial([
    ["p1", "professor-x", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [, hawkeye] = s.fighters;
  activate(s);
  attack(s, hawkeye, 1, "mystic", dice(2, 2, 2));
  assert.ok(hawkeye.damage > 0);
  const move = actions(s)[0];
  assert.equal(move.mode, "advance");
  assert.equal(move.speed, hawkeye.speed);
  assert.equal(move.mover, hawkeye.id);

  const duel = trial([
    ["p1", "professor-x", 8],
    ["p2", "professor-x", 11],
  ]);
  const enemy = duel.fighters[1];
  activate(duel);
  attack(duel, enemy, 1, "mystic", dice(2, 2, 2));
  assert.ok(enemy.damage > 0);
  assert.ok(!duel.effects.some((e) => e.mode === "advance"));
});

test("Astral Duel adds dice equal to Mystic defense and locks defensive rerolls", () => {
  const s = trial([
    ["p1", "professor-x", 8],
    ["p2", "beast", 11],
  ]);
  const [professor, beast] = s.fighters;
  activate(s);
  attack(s, beast, 2, "mystic");
  assert.ok(!actions(s, "p2").some((a) => a.label === "Stars and Garters"));
  const result = s.log.find((e) => e.attack === "Astral Duel");
  assert.equal(
    result.rolled.length,
    4 + view(s, "p1").fighters[1].defenses.mystic,
  );
  assert.equal(professor.power, 0);
});

test("Telepathic Lock lets Professor X defend with Mystic unless the attacker pays 2 Power", () => {
  for (const pays of [true, false]) {
    const s = trial([
      ["p1", "hawkeye", 8],
      ["p2", "professor-x", 12],
    ]);
    const [hawkeye, professor] = s.fighters;
    activate(s);
    attack(s, professor, 0, "physical");
    const lock = actions(s, "p2").find((a) => a.value === "mental-lock");
    assert.match(lock.label, /^Telepathic Lock/);
    act(s, "p2", { type: "reaction", value: "mental-lock" });
    assert.match(actions(s)[0].label, /Telepathic Lock$/);
    act(
      s,
      "p1",
      {
        type: "reaction",
        value: pays ? "mental-lock-pay" : "mental-lock-accept",
      },
      dice(5, 5),
    );
    const result = s.log.find((e) => e.attack === "Arrow Shot");
    assert.equal(result.defense.length, pays ? 2 : 6);
    assert.equal(hawkeye.power, pays ? 1 : 3);
  }
});

test("Professor's Guidance pays per die rerolled for an attacking or defending ally, once per Turn", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p1", "professor-x", 10],
    ["p2", "hulk", 13],
  ]);
  const [, professor, hulk] = s.fighters;
  hulk.power = 0;
  activate(s);
  attack(s, hulk, 0, "physical", () => 7);
  const guidance = actions(s)[0];
  assert.equal(guidance.label, "Professor's Guidance");
  assert.equal(guidance.max, 3);
  act(s, "p1", { type: "modify-dice", indices: [0, 2] }, () => 2);
  assert.equal(professor.power, 1);
  assert.deepEqual(s.log.findLast((e) => e.attack).rolled.slice(0, 3), [
    "hit",
    "blank",
    "hit",
  ]);
  attack(s, hulk, 0, "physical", () => 7);
  assert.ok(!actions(s).some((a) => a.label === "Professor's Guidance"));

  const defense = trial([
    ["p1", "hawkeye", 8],
    ["p2", "hulk", 12],
    ["p2", "professor-x", 14],
  ]);
  const [, defender, ally] = defense.fighters;
  activate(defense);
  attack(defense, defender, 0, "physical", () => 2);
  const guide = actions(defense, "p2")[0];
  assert.equal(guide.label, "Professor's Guidance");
  assert.equal(guide.role, "defense");
  act(defense, "p2", { type: "modify-dice", indices: [0] }, () => 4);
  assert.equal(ally.power, 2);
});

test("Xavier's School gives another ally 1 Power after a superpower spend, once per Turn", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p1", "professor-x", 10],
    ["p1", "beast", 6],
    ["p2", "hulk", 13],
  ]);
  const [hawkeye, professor, beast, hulk] = s.fighters;
  s.leaders.p1 = xavier;
  hulk.power = 0;
  activate(s);
  attack(s, hulk, 0, "physical", () => 7);
  act(s, "p1", { type: "modify-dice", indices: [0] }, () => 2);
  const school = actions(s).find((a) => a.type === "xavier-school");
  assert.deepEqual(
    school.options.map((o) => o.value).sort(),
    [beast.id, hawkeye.id].sort(),
  );
  act(s, "p1", { type: "xavier-school", value: beast.id });
  assert.equal(beast.power, 4);
  assert.equal(professor.power, 2);
  assert.ok(!s.effects.length);
  assert.ok(s.leadershipUses.p1.includes("xavier"));
});

test("Xavier's School ignores Power spent on attacks", () => {
  const s = trial([
    ["p1", "professor-x", 8],
    ["p1", "beast", 6],
    ["p2", "hawkeye", 11],
  ]);
  const [professor, , hawkeye] = s.fighters;
  s.leaders.p1 = xavier;
  activate(s);
  attack(s, hawkeye, 1, "mystic", dice(7, 7, 7, 7, 7, 7));
  assert.equal(professor.power, 2);
  assert.ok(!s.effects.some((e) => e.type === "xavier-school"));
});

test("Professor X fits in a saved Game roster and unlocks Xavier's School", () => {
  const preset = pool.presets[0];
  const newcomers = ["professor-x", "beast", "iceman"];
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
  s.phase = "leadership";
  assert.ok(
    actions(s)[0].options.some(
      (o) => o.label === "Xavier's School for Gifted Youngsters",
    ),
  );
});
