const test = require("node:test");
const assert = require("node:assert/strict");
const { act, create, view } = require("../game/engine.cjs");
const { pool } = require("../game/catalog.cjs");
const { trial } = require("./helpers/game.cjs");

const dice =
  (...rolls) =>
  () =>
    rolls.shift() ?? 7;
const activate = (s, fighter = s.fighters[0]) =>
  act(s, fighter.side, { type: "activate", value: fighter.id });
const actions = (s, side = "p1") => view(s, side).actions[side];
const attack = (s, target, index = 0, damageType = "mystic", random = dice()) =>
  act(
    s,
    "p1",
    { type: "attack", target: target.id, index, damageType },
    random,
  );
const reality = "Your Reality is Whatever I Want it to Be";

test("Astral Fiend places a separate token, extends range and Mental Shackle applies Root then Advance", () => {
  const s = trial([
    ["p1", "shadow-king", 8],
    ["p2", "hawkeye", 20],
  ]);
  const [king, hawkeye] = s.fighters;
  activate(s);
  assert.ok(!actions(s).some((a) => a.type === "attack"));
  act(s, "p1", { type: "power", value: "Astral Fiend", x: 15, y: 8 });
  assert.equal(king.x, 8);
  assert.equal(king.projection.x, 15);
  assert.equal(s.actionsLeft, 1);
  assert.equal(king.power, 3);
  attack(s, hawkeye, 0, "mystic", dice(1, 2));
  assert.equal(king.power, 5);
  assert.equal(hawkeye.damage, 2);
  assert.deepEqual(hawkeye.conditions, ["root"]);
  assert.equal(actions(s)[0].speed, "S");
  act(s, "p1", { type: "displace", x: 22, y: 8 });
  assert.equal(hawkeye.x, 22);
});

test("only Mystic attacks may measure to an enemy Projection, and Mystic damage removes it", () => {
  const s = trial([
    ["p1", "red-skull-master-of-the-world", 8],
    ["p2", "shadow-king", 19],
  ]);
  const [skull, king] = s.fighters;
  king.projection = { x: 13, y: 8, radius: 0.5 };
  activate(s);
  const option = actions(s).find((a) => a.type === "attack").attacks[0];
  assert.deepEqual(option.targets[0].types, ["mystic"]);
  assert.throws(() => attack(s, king, 0, "energy"), /цель/);
  attack(s, king, 0, "mystic", dice(2));
  assert.equal(king.damage, 1);
  assert.equal(king.projection, undefined);
  assert.equal(skull.power, 4);
});

test("Projection does not replace the model for line of sight", () => {
  const s = trial([
    ["p1", "shadow-king", 8],
    ["p2", "hawkeye", 16],
  ]);
  const [king] = s.fighters;
  king.projection = { x: 13, y: 8, radius: 0.5 };
  s.terrain = [{ id: "wall", size: 5, x: 10, y: 0, w: 1, h: 36 }];
  activate(s);
  assert.ok(!actions(s).some((a) => a.type === "attack"));
});

test("Astral Disintegration caps bonus dice at five and prevents defense rerolls", () => {
  const s = trial([
    ["p1", "shadow-king", 8],
    ["p2", "the-black-widow", 11],
    ["p2", "invincible-iron-man", 18],
  ]);
  const [king, widow, iron] = s.fighters;
  king.power = 4;
  widow.power = 9;
  s.leaders.p2 = iron.slug + ":Let’s Get You An Upgrade";
  activate(s);
  attack(s, widow, 1, "mystic");
  assert.equal(s.log.at(-1).rolled.length, 10);
  assert.ok(!actions(s, "p2").some((a) => a.type === "modify-dice"));
});

test("Nightmare Visions rolls only four dice and grants a Short Advance after damage", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "shadow-king", 20],
  ]);
  const [hawkeye, king] = s.fighters;
  king.power = 8;
  king.projection = { x: 15, y: 8, radius: 0.5 };
  activate(s);
  act(s, "p1", { type: "advance", x: 11, y: 8 });
  assert.equal(actions(s, "p2")[0].type, "nightmare-visions");
  act(s, "p2", { type: "nightmare-visions" }, dice(0, 1, 2, 7));
  assert.equal(hawkeye.damage, 2);
  assert.equal(king.power, 4);
  act(s, "p2", { type: "displace", x: 12, y: 10 });
  act(s, "p1", { type: "advance", x: 13, y: 10 });
  assert.ok(!actions(s, "p2").some((a) => a.type === "nightmare-visions"));
});

test("Immortal Essence heals three; Projection disappears in Cleanup and Omega Level Entity gains extra Power", () => {
  const s = trial([
    ["p1", "shadow-king", 8],
    ["p2", "hawkeye", 19],
  ]);
  const [king, hawkeye] = s.fighters;
  king.damage = 4;
  activate(s);
  act(s, "p1", { type: "power", value: "Astral Fiend", x: 12, y: 8 });
  act(s, "p1", { type: "power", value: "Immortal Essence" });
  assert.equal(king.damage, 1);
  act(s, "p1", { type: "end" });
  activate(s, hawkeye);
  act(s, "p2", { type: "end" });
  assert.equal(king.projection, undefined);
  assert.equal(king.power, 2);
});

test("Deadly Illusions caps primary damage at one and Mind Over Matter separately removes two conditions", () => {
  const s = trial([
    ["p1", "lady-mastermind", 8],
    ["p2", "hulk", 12],
  ]);
  const [lady, hulk] = s.fighters;
  hulk.conditions = ["bleed", "shock", "slow"];
  activate(s);
  attack(s, hulk, 0, "mystic", dice(1, 1, 2, 2, 2));
  assert.equal(actions(s)[0].type, "mind-over-matter");
  act(s, "p1", { type: "mind-over-matter", value: "bleed|shock" });
  assert.equal(hulk.damage, 3);
  assert.equal(s.log.find((e) => e.attack === "Deadly Illusions").dealt, 1);
  act(s, "p1", { type: "choose-condition", value: "incinerate" });
  act(s, "p1", { type: "choose-condition", value: "bleed" });
  assert.deepEqual(hulk.conditions, ["slow", "incinerate", "bleed"]);
  assert.equal(lady.power, 4);
});

test("Mass Hallucinations grants a Short Advance on Wild", () => {
  const s = trial([
    ["p1", "lady-mastermind", 8],
    ["p2", "hawkeye", 11],
  ]);
  s.fighters[0].power = 4;
  activate(s);
  act(s, "p1", { type: "attack", index: 1, damageType: "mystic" }, dice(1));
  assert.equal(actions(s)[0].mode, "advance");
  act(s, "p1", { type: "displace", x: 13, y: 8 });
  assert.equal(s.fighters[1].x, 13);
});

test("Mental Lock uses Mystic defense unless the attacker pays, and multiple rolled Failures grant Lady just one Power", () => {
  for (const pays of [true, false]) {
    const s = trial([
      ["p1", "hawkeye", 8],
      ["p2", "lady-mastermind", 12],
    ]);
    const [hawkeye, lady] = s.fighters;
    activate(s);
    attack(s, lady, 0, "physical");
    act(s, "p2", { type: "reaction", value: "mental-lock" });
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
    assert.equal(
      result.defense.length,
      view(s, "p2").fighters[1].defenses[pays ? "physical" : "mystic"],
    );
    assert.equal(hawkeye.power, pays ? 1 : 3);
    assert.equal(lady.power, 4);
  }
});

test("Your Reality borrows a Dazed enemy's beam, excludes that enemy and ignores printed special rules", () => {
  const s = trial([
    ["p1", "lady-mastermind", 8],
    ["p2", "pyro", 16],
    ["p2", "hawkeye", 20],
  ]);
  const [lady, pyro, hawkeye] = s.fighters;
  pyro.dazed = true;
  lady.power = 7;
  activate(s);
  const powers = actions(s).find((a) => a.type === "power").powers;
  const power = powers.find((p) => p.value === reality);
  assert.ok(power.targets.some((t) => t.value === pyro.id));
  act(s, "p1", { type: "power", value: reality, target: pyro.id, amount: 4 });
  const beam = actions(s)[0].attacks.find((a) => a.name === "Flame Jet");
  assert.equal(beam.origin.x, 16);
  assert.deepEqual(
    beam.targets.map((t) => t.value),
    [hawkeye.id],
  );
  act(
    s,
    "p1",
    { type: "attack", index: beam.index, angle: 0, damageType: "energy" },
    dice(1),
  );
  assert.equal(s.actionsLeft, 2);
  assert.equal(lady.power, 3);
  assert.equal(hawkeye.damage, 1);
  assert.ok(!hawkeye.conditions?.includes("incinerate"));
});

test("all five new fighters fit in a saved roster and deploy through the normal squad flow", () => {
  const roster = pool.presets[0];
  const newcomers = [
    "colossus",
    "emma-frost",
    "exodus",
    "shadow-king",
    "lady-mastermind",
  ];
  const s = create(
    {
      p1: {
        ...roster,
        characters: [...newcomers, ...roster.characters.slice(0, 5)],
      },
      p2: "cabal",
    },
    1,
  );
  Object.assign(s, {
    phase: "squad",
    threat: 24,
    priority: "p1",
    terrain: [],
    deployment: { p1: "south", p2: "north" },
  });
  act(s, "p1", { type: "squad", characters: newcomers, tactics: [] });
  act(s, "p2", {
    type: "squad",
    characters: ["crossbones-merciless-merc"],
    tactics: [],
  });
  act(s, "p1", { type: "deploy", fighter: "p1:shadow-king", x: 8, y: 34 });
  assert.deepEqual(
    view(s, "p1")
      .fighters.filter((f) => f.side === "p1")
      .map((f) => f.slug),
    newcomers,
  );
});
