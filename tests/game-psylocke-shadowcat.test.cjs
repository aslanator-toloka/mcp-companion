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
  skipDice(s, random);
};
const lastAttack = (s, name) => s.log.findLast((e) => e.attack === name);

test("Telekinetic Combat Enhancement Advances Psylocke and adds 2 dice to her next Katana only", () => {
  const s = trial([
    ["p1", "psylocke", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [psylocke, hawkeye] = s.fighters;
  psylocke.power = 2;
  activate(s);
  act(s, "p1", {
    type: "power",
    value: "Telekinetic Combat Enhancement",
    x: 9,
    y: 8,
  });
  assert.equal(psylocke.x, 9);
  assert.equal(psylocke.power, 0);
  assert.ok(
    !actions(s)
      .find((a) => a.type === "power")
      ?.powers.some((p) => p.value === "Telekinetic Combat Enhancement"),
  );
  attack(s, hawkeye, 0, "mystic", dice(2, 2));
  assert.equal(lastAttack(s, "Telekinetic Katana").rolled.length, 7);
  assert.equal(psylocke.power, hawkeye.damage);
  attack(s, hawkeye, 0, "energy");
  assert.equal(lastAttack(s, "Telekinetic Katana").rolled.length, 5);
});

test("Neural Disruption removes 1 defender Power per Wild before damage", () => {
  const s = trial([
    ["p1", "psylocke", 8],
    ["p2", "hawkeye", 10],
  ]);
  const [, hawkeye] = s.fighters;
  hawkeye.power = 3;
  activate(s);
  attack(s, hawkeye, 0, "energy", dice(1, 1));
  assert.ok(hawkeye.damage > 0);
  assert.equal(hawkeye.power, 1 + hawkeye.damage);
});

test("Psi-Bow offers Pursuit toward the defender on a Hit; Psionic Assault Stuns before damage", () => {
  const s = trial([
    ["p1", "psylocke", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [psylocke, hawkeye] = s.fighters;
  activate(s);
  attack(s, hawkeye, 1, "mystic", dice(2));
  const pursuit = actions(s)[0];
  assert.equal(pursuit.mode, "advance");
  assert.equal(pursuit.mover, psylocke.id);
  assert.equal(pursuit.direction, "toward");
  act(s, "p1", { type: "skip-effect" });
  assert.equal(psylocke.power, 4);

  const assault = trial([
    ["p1", "psylocke", 8],
    ["p2", "hawkeye", 11],
  ]);
  activate(assault);
  attack(assault, assault.fighters[1], 2, "mystic");
  assert.ok(assault.fighters[1].conditions.includes("stun"));
});

test("Telepathic Precognition spends any Power to reroll Psylocke’s own dice, once per Turn", () => {
  const s = trial([
    ["p1", "psylocke", 8],
    ["p2", "hulk", 10],
  ]);
  const [psylocke, hulk] = s.fighters;
  psylocke.power = 5;
  hulk.power = 0;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "energy" },
    () => 7,
  );
  const option = actions(s)[0];
  assert.equal(option.label, "Telepathic Precognition");
  assert.equal(option.max, 5);
  act(s, "p1", { type: "modify-dice", indices: [0, 1, 2, 3] }, () => 2);
  assert.equal(psylocke.power, 1 + hulk.damage);
  attack(s, hulk, 0, "energy", () => 7);
  assert.ok(!actions(s).some((a) => a.label === "Telepathic Precognition"));

  const defense = trial([
    ["p1", "hawkeye", 8],
    ["p2", "psylocke", 12],
  ]);
  activate(defense);
  act(
    defense,
    "p1",
    {
      type: "attack",
      target: defense.fighters[1].id,
      index: 0,
      damageType: "physical",
    },
    () => 2,
  );
  const guard = actions(defense, "p2")[0];
  assert.equal(guard.label, "Telepathic Precognition");
  assert.equal(guard.role, "defense");
});

test("Phasing Strike ignores defensive Criticals and Sidesteps Shadowcat on a Wild", () => {
  const s = trial([
    ["p1", "shadowcat", 8],
    ["p2", "hawkeye", 10],
  ]);
  const [shadowcat, hawkeye] = s.fighters;
  activate(s);
  attack(s, hawkeye, 0, "physical", dice(1, 2, 2, 2, 0, 0));
  const result = lastAttack(s, "Phasing Strike");
  assert.equal(result.defense.length, 4);
  const sidestep = actions(s)[0];
  assert.equal(sidestep.mode, "place");
  assert.equal(sidestep.mover, shadowcat.id);
  assert.equal(sidestep.range, 1);
  assert.equal(sidestep.reference.x, 8);
  act(s, "p1", { type: "displace", x: 7, y: 8 });
  assert.equal(shadowcat.x, 7);
  assert.ok(hawkeye.damage >= 4);
});

test("Get‘em Lockheed! builds Power and Incinerates; Phase Rush Places within 2", () => {
  const s = trial([
    ["p1", "shadowcat", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [shadowcat, hawkeye] = s.fighters;
  activate(s);
  attack(s, hawkeye, 1, "energy", dice(1));
  assert.ok(hawkeye.conditions.includes("incinerate"));
  assert.equal(shadowcat.power, 4);
  act(s, "p1", { type: "power", value: "Phase Rush", x: 6.5, y: 8 });
  assert.equal(shadowcat.x, 6.5);
  assert.equal(shadowcat.power, 2);
});

test("Can‘t Touch This adds 2 defense dice for an ally within 2 against physical or energy attacks", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "beast", 12],
    ["p2", "shadowcat", 13.5],
  ]);
  const [, beast, shadowcat] = s.fighters;
  activate(s);
  attack(s, beast, 0, "physical");
  const reaction = actions(s, "p2").find((a) =>
    a.value?.startsWith("cant-touch:"),
  );
  assert.ok(reaction);
  act(s, "p2", { type: "reaction", value: reaction.value }, dice());
  while (actions(s, "p2")[0]?.type === "modify-dice")
    act(s, "p2", { type: "skip-effect" });
  assert.equal(
    lastAttack(s, "Arrow Shot").defense.length,
    view(s, "p2").fighters[1].defenses.physical + 2,
  );
  assert.equal(shadowcat.power, 1);
});

test("Can‘t Touch This lets a Pushed ally Place within 1 after the Push", () => {
  const s = trial([
    ["p1", "invincible-iron-man", 8],
    ["p2", "shadowcat", 11],
  ]);
  const [, shadowcat] = s.fighters;
  activate(s);
  act(s, "p1", {
    type: "attack",
    target: shadowcat.id,
    index: 0,
    damageType: "energy",
  });
  const roll = dice(1);
  act(s, "p2", { type: "reaction", value: "cant-touch:" + shadowcat.id }, roll);
  skipDice(s, roll);
  const push = actions(s)[0];
  assert.equal(push.mode, "push");
  act(s, "p1", { type: "displace", angle: 0 });
  const place = actions(s, "p2")[0];
  assert.equal(place.mode, "place");
  assert.equal(place.name, "Can‘t Touch This");
  assert.equal(place.range, 1);
});

test("Psylocke and Shadowcat fit in a saved Game roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["psylocke", "shadowcat", "professor-x"];
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
