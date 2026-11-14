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

test("Assassin rerolls freely against objective holders and never takes tokens; Nebula heals 1 when she activates", () => {
  const s = trial([
    ["p1", "nebula", 8],
    ["p2", "hulk", 10.5],
  ]);
  const [nebula, hulk] = s.fighters;
  nebula.damage = 2;
  s.objectives = [
    { id: "e", name: "Token", role: "extract", holder: hulk.id, radius: 0.5 },
    { id: "f", name: "Token", role: "extract", x: 8, y: 9, radius: 0.5 },
  ];
  assert.ok(!combat.canHoldExtract(s, nebula, s.objectives[1]));
  activate(s);
  assert.equal(nebula.damage, 1);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "physical" },
    dice(),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  assert.equal(actions(s)[0].label, "Assassin");
  assert.equal(actions(s)[0].max, 4);
});

test("Shock Sword Assault Places Nebula by the target and Stuns on a Wild", () => {
  const s = trial([
    ["p1", "nebula", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [nebula, hawkeye] = s.fighters;
  activate(s);
  attack(s, hawkeye, 2, "energy", dice(1));
  assert.ok(hawkeye.conditions.includes("stun"));
  assert.equal(actions(s)[0].mode, "place");
  assert.equal(actions(s)[0].mover, nebula.id);
});

test("Psychosis turns Failures into successes and blocks objectives; the Cleanup roll may restore it", () => {
  const s = trial([
    ["p1", "cosmic-ghost-rider", 8],
    ["p2", "hulk", 11],
  ]);
  const [rider, hulk] = s.fighters;
  rider.psychosis = true;
  hulk.power = 0;
  activate(s);
  attack(s, hulk, 0, "energy", dice(5, 5, 5, 7, 7, 7));
  assert.equal(hulk.damage, 3);
  s.objectives = [
    { id: "e", name: "Token", role: "extract", x: 8, y: 9.5, radius: 0.5 },
  ];
  assert.deepEqual(mission.interacts(s, rider), []);
  s.mission = {};
  rider.power = 3;
  mission.cleanup(s, dice(2, 2, 7, 7, 7));
  assert.equal(rider.power, 5);
  assert.ok(rider.psychosis);
});

test("Penance Stare turns every defensive Block to a Failure on its combo and denies Power", () => {
  const s = trial([
    ["p1", "cosmic-ghost-rider", 8],
    ["p2", "hulk", 11],
  ]);
  const [rider, hulk] = s.fighters;
  rider.power = 8;
  hulk.power = 0;
  activate(s);
  attack(
    s,
    hulk,
    1,
    "mystic",
    dice(0, 1, 2, 4, 5, 7, 7, 7, 7, 7, 7, 7, 7, 4, 4, 4, 4),
  );
  assert.ok(
    !lastAttack(s, "Power Cosmic Penance Stare").defense.includes("block"),
  );
  assert.equal(hulk.power, 0);
});

test("Interstellar Hellcycle Places up to 5; Chains of Cyttorak pulls and Incinerates", () => {
  const s = trial([
    ["p1", "cosmic-ghost-rider", 8],
    ["p2", "hawkeye", 13],
  ]);
  const [rider, hawkeye] = s.fighters;
  rider.power = 8;
  activate(s);
  act(s, "p1", {
    type: "power",
    value: "Chains of Cyttorak",
    target: hawkeye.id,
  });
  assert.ok(hawkeye.conditions.includes("incinerate"));
  assert.equal(actions(s)[0].direction, "toward");
  act(s, "p1", { type: "displace", angle: 180 });
  act(s, "p1", { type: "power", value: "Interstellar Hellcycle", amount: 5 });
  assert.equal(actions(s)[0].range, 5);
});

test("Cosmic Justice on Wheels retaliates with Hellfire Blasters when an ally is Dazed", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "hawkeye", 10.5],
    ["p2", "cosmic-ghost-rider", 13],
  ]);
  const [hulk, hawkeye, rider] = s.fighters;
  hawkeye.damage = 4;
  combat.damage(s, hawkeye, 1, hulk);
  assert.ok(hawkeye.dazed);
  s.decisionSide = "p2";
  const option = actions(s, "p2")[0];
  assert.equal(option.type, "cosmic-justice");
  act(s, "p2", { type: "cosmic-justice" }, dice(2, 2, 2));
  while (s.pendingAttack)
    act(s, "p1", { type: "reaction", value: "skip" }, dice(2, 2, 2));
  skipDice(s);
  assert.ok(lastAttack(s, "Hellfire Blasters"));
  assert.equal(rider.power, 1);
});

test("Death’s Decree adds dice to an ally’s attack once per Turn; Thanos shrugs off 1 damage", () => {
  const s = trial([
    ["p1", "nebula", 8],
    ["p1", "thanos-the-mad-titan", 6],
    ["p2", "hulk", 10.5],
  ]);
  const [nebula, thanos, hulk] = s.fighters;
  activate(s, nebula);
  const strike = actions(s)
    .find((a) => a.type === "attack")
    .attacks.find((a) => a.name === "Strike");
  assert.ok(strike.decree);
  attack(s, hulk, 0, "physical", dice(), { decree: true });
  assert.equal(lastAttack(s, "Strike").rolled.length, 6);
  assert.equal(thanos.power, 1);
  combat.damage(s, thanos, 1, hulk);
  assert.equal(thanos.damage || 0, 0);
});

test("Death’s Agenda scores a VP when an enemy is KO’d; Cosmic Blast takes extra Power and Pushes plus Slows", () => {
  const s = trial([
    ["p1", "thanos-the-mad-titan", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [thanos, hawkeye] = s.fighters;
  s.leaders.p1 = thanos.slug + ":Death‘s Agenda";
  s.score = { p1: 0, p2: 0 };
  hawkeye.injured = true;
  hawkeye.damage = 5;
  combat.damage(s, hawkeye, 3, thanos);
  assert.ok(hawkeye.ko);
  assert.equal(s.score.p1, 1);

  const blast = trial([
    ["p1", "thanos-the-mad-titan", 8],
    ["p2", "hulk", 12],
  ]);
  const [titan, hulk] = blast.fighters;
  titan.power = 3;
  activate(blast);
  attack(blast, hulk, 1, "energy", dice(1), { boost: 3 });
  assert.equal(lastAttack(blast, "Cosmic Blast").rolled.length, 8);
  assert.ok(hulk.conditions.includes("slow"));
  assert.ok(
    blast.effects.some((e) => e.mode === "push" && e.mover === hulk.id),
  );
});

test("Cosmic Portal Places another ally within 2", () => {
  const s = trial([
    ["p1", "thanos-the-mad-titan", 8],
    ["p1", "nebula", 11],
    ["p2", "hulk", 25],
  ]);
  const [, nebula] = s.fighters;
  activate(s);
  act(s, "p1", { type: "power", value: "Cosmic Portal", target: nebula.id });
  const place = actions(s)[0];
  assert.equal(place.mover, nebula.id);
  assert.equal(place.range, 2);
});

test("Nebula, Cosmic Ghost Rider and Thanos fit in a saved Black Order roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["nebula", "thanos-the-mad-titan", "corvus-glaive"];
  const s = create(
    {
      p1: {
        ...preset,
        characters: [
          ...newcomers,
          "cosmic-ghost-rider",
          ...preset.characters.slice(0, 6),
        ],
      },
      p2: "cabal",
    },
    1,
  );
  Object.assign(s, {
    phase: "squad",
    threat: 20,
    priority: "p1",
    terrain: [],
    deployment: { p1: "south", p2: "north" },
  });
  act(s, "p1", {
    type: "squad",
    characters: newcomers,
    tactics: [],
    affiliation: "Black Order",
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
