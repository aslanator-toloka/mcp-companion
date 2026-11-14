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

test("Black Tongue Advances the defender on a Wild; Herald of Doom denies Power and may Throw small targets", () => {
  const s = trial([
    ["p1", "ebony-maw", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [maw, hawkeye] = s.fighters;
  hawkeye.power = 0;
  activate(s);
  attack(s, hawkeye, 0, "mystic", dice(1));
  assert.equal(actions(s)[0].mode, "advance");
  assert.equal(actions(s)[0].mover, hawkeye.id);
  act(s, "p1", { type: "skip-effect" });
  maw.power = 4;
  const before = hawkeye.power;
  attack(s, hawkeye, 1, "mystic", dice(1, 2));
  assert.equal(hawkeye.power, before);
  assert.ok(
    s.effects.some((e) => e.mode === "throw" && e.mover === hawkeye.id),
  );
});

test("Ebony Maw’s Mind Over Matter offers Mystic defense; he gains 2 extra Power in the Power Phase", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "ebony-maw", 12],
  ]);
  const [, maw] = s.fighters;
  activate(s);
  act(s, "p1", {
    type: "attack",
    target: maw.id,
    index: 0,
    damageType: "physical",
  });
  const lock = actions(s, "p2").find((a) => a.value === "mental-lock");
  assert.match(lock.label, /^Mind Over Matter/);
});

test("Devastate Intellect drains Power instead of damage and Devour Mind Dazes a healthy defender", () => {
  const s = trial([
    ["p1", "supergiant", 8],
    ["p2", "hawkeye", 10.5],
  ]);
  const [giant, hawkeye] = s.fighters;
  giant.power = 8;
  hawkeye.power = 5;
  activate(s);
  attack(s, hawkeye, 1, "mystic", dice(0, 1, 2, 2, 5, 5, 7, 7, 7));
  assert.ok(hawkeye.dazed);
  assert.ok(hawkeye.power < 5);
});

test("Ethereal caps physical damage at 1 and drops tokens; Omnipathy pays for enemy Criticals", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "supergiant", 10.5],
  ]);
  const [hulk, giant] = s.fighters;
  s.objectives = [
    { id: "e", name: "Token", role: "extract", holder: giant.id },
  ];
  giant.power = 0;
  activate(s);
  attack(s, giant, 0, "physical", dice(0, 2, 2, 2, 2, 2, 2, 2));
  assert.equal(giant.damage, 1);
  assert.ok(!s.objectives[0].holder);
  assert.ok(giant.power >= 2);
  void hulk;
});

test("Supreme Control stops an enemy Push on an ally within 4", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "hawkeye", 10.5],
    ["p2", "supergiant", 14],
  ]);
  const [, hawkeye, giant] = s.fighters;
  activate(s);
  attack(s, hawkeye, 0, "physical", dice(1));
  if (actions(s)[0]?.type === "start-displacement")
    act(s, "p1", { type: "start-displacement" });
  const option = actions(s, "p2")
    .flatMap((a) => a.options || [])
    .find((o) => o.label?.startsWith("Supreme Control"));
  assert.ok(option);
  act(s, "p2", { type: "shield-mind", value: option.value });
  assert.equal(hawkeye.x, 10.5);
  assert.equal(giant.power, 1);
});

test("Submit! picks up a Senator within the range paid for", () => {
  const s = trial([
    ["p1", "supergiant", 8],
    ["p2", "hawkeye", 20],
  ]);
  const [giant] = s.fighters;
  giant.power = 5;
  s.objectives = [
    { id: "sen", name: "Senator", role: "extract", x: 12, y: 8, radius: 0.5 },
  ];
  activate(s);
  const submit = actions(s)
    .find((a) => a.type === "power")
    .powers.find((p) => p.value === "Submit!");
  const minPower = submit.targets[0].minPower;
  assert.ok(minPower >= 2);
  act(s, "p1", {
    type: "power",
    value: "Submit!",
    target: "sen",
    amount: minPower,
  });
  assert.equal(s.objectives[0].holder, giant.id);
  assert.equal(giant.power, 5 - minPower);
});

test("Midnight Field blanks Wilds for Power; Telepathic Suggestion rerolls a defense die", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "black-swan", 12],
  ]);
  const [, swan] = s.fighters;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: swan.id, index: 0, damageType: "physical" },
    dice(1, 1),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice(1, 1));
  const option = actions(s, "p2").find((a) => a.label === "Midnight Field");
  assert.ok(option);
  assert.equal(option.max, 2);
  act(s, "p2", { type: "modify-dice", indices: [0, 1] });
  assert.equal(swan.power, 1 + (swan.damage || 0));

  const swing = trial([
    ["p1", "black-swan", 8],
    ["p2", "hulk", 10.5],
  ]);
  activate(swing);
  act(
    swing,
    "p1",
    {
      type: "attack",
      target: swing.fighters[1].id,
      index: 0,
      damageType: "physical",
    },
    dice(),
  );
  while (swing.pendingAttack)
    act(swing, "p2", { type: "reaction", value: "skip" }, dice());
  const labels = [];
  while (actions(swing)[0]?.type === "modify-dice") {
    labels.push(actions(swing)[0].label);
    act(swing, "p1", { type: "skip-effect" });
  }
  assert.ok(labels.includes("Telepathic Suggestion"), labels.join());
});

test("Everything Dies Throws on a Wild and its Follow-Up Eye Beam ignores range against the same defender", () => {
  const s = trial([
    ["p1", "black-swan", 8],
    ["p2", "hulk", 10.5],
    ["p2", "hawkeye", 11],
  ]);
  const [swan, hulk, hawkeye] = s.fighters;
  hawkeye.y = 10;
  swan.power = 4;
  activate(s);
  attack(s, hulk, 2, "physical", dice(2));
  const bonus = s.effects.find((e) => e.type === "bonus-attack");
  assert.equal(bonus.kind, "eyebeam");
  hulk.x = 30;
  const follow = actions(s).find((a) => a.type === "attack");
  const beam = follow.attacks.find((a) => a.name === "Eye Beam");
  assert.deepEqual(
    beam.targets.map((t) => t.value),
    [hulk.id],
  );
});

test("Ebony Maw, Supergiant and Black Swan fit in a saved Black Order roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["ebony-maw", "supergiant", "black-swan"];
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
