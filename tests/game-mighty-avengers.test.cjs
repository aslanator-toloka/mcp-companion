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

test("Sweet Christmas Slows and Stuns and may Throw on a Wild; Unbreakable Skin reduces damage", () => {
  const s = trial([
    ["p1", "luke-cage", 8],
    ["p2", "hawkeye", 10.5],
  ]);
  const [luke, hawkeye] = s.fighters;
  luke.power = 4;
  activate(s);
  attack(s, hawkeye, 1, "physical", dice(1));
  assert.ok(hawkeye.conditions.includes("slow"));
  assert.ok(hawkeye.conditions.includes("stun"));
  assert.ok(s.effects.some((e) => e.mode === "throw"));
  combat.damage(s, luke, 3, hawkeye);
  assert.equal(luke.damage, 2);
});

test("The Defense Rests Staggers an already Slowed defender; Superior Weight Training adds dice by size", () => {
  const s = trial([
    ["p1", "she-hulk", 8],
    ["p2", "hulk", 10.5],
  ]);
  const [sheHulk, hulk] = s.fighters;
  sheHulk.power = 8;
  hulk.conditions = ["slow"];
  activate(s);
  act(s, "p1", { type: "power", value: "Superior Weight Training" });
  attack(s, hulk, 1, "physical", dice(2, 2, 2));
  assert.equal(
    lastAttack(s, "The Defense Rests").rolled.length,
    10 + hulk.size,
  );
  assert.ok(hulk.conditions.includes("stagger"));
});

test("Legal Defense redirects an attack; Gamma Transfusion Advances She-Hulk toward her attacker", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "spectrum", 12],
    ["p2", "she-hulk", 13.5],
  ]);
  const [, spectrum, sheHulk] = s.fighters;
  activate(s);
  act(s, "p1", {
    type: "attack",
    target: spectrum.id,
    index: 0,
    damageType: "physical",
  });
  const option = actions(s, "p2").find((a) => a.key === "legal:" + sheHulk.id);
  assert.ok(option);
  act(s, "p2", { type: "reaction", value: option.value }, dice(2, 2, 2));
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice(2, 2, 2));
  skipDice(s);
  assert.ok(sheHulk.damage > 0);
  assert.ok(
    s.effects.some((e) => e.mover === sheHulk.id && e.mode === "advance"),
  );
});

test("Defenders of Arcadia gives another ally Power after enemy damage", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "she-hulk", 12],
    ["p2", "spectrum", 14],
  ]);
  const [hawkeye, sheHulk, spectrum] = s.fighters;
  s.leaders.p2 = sheHulk.slug + ":Defenders of Arcadia";
  combat.damage(s, sheHulk, 2, hawkeye);
  s.decisionSide = "p2";
  const option = actions(s, "p2")[0];
  assert.equal(option.type, "arcadia");
  act(s, "p2", { type: "arcadia", value: spectrum.id });
  assert.equal(spectrum.power, 4);
});

test("Spectrum’s Photon Blast rerolls all dice; Energy Boost adds 2 dice; Multi-Spectrum Absorption blanks dice", () => {
  const s = trial([
    ["p1", "spectrum", 8],
    ["p2", "hulk", 12],
  ]);
  const [spectrum, hulk] = s.fighters;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", index: 1, angle: 0, damageType: "energy", decree: true },
    dice(),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  skipDice(s, dice());
  assert.equal(spectrum.power, 3 - 2 + 1);
  assert.equal(lastAttack(s, "Photon Blast").rolled.length, 6);

  const def = trial([
    ["p1", "hawkeye", 8],
    ["p2", "spectrum", 12],
  ]);
  activate(def);
  act(
    def,
    "p1",
    {
      type: "attack",
      target: def.fighters[1].id,
      index: 0,
      damageType: "physical",
    },
    dice(2, 2, 2, 7, 7, 1, 7, 7),
  );
  while (def.pendingAttack)
    act(def, "p2", { type: "reaction", value: "skip" }, dice());
  const labels = [];
  while (actions(def, "p2")[0]?.type === "modify-dice") {
    labels.push(actions(def, "p2")[0].label);
    act(def, "p2", { type: "skip-effect" });
  }
  assert.ok(labels.includes("Multi-Spectrum Energy Absorption"), labels.join());
});

test("Pulsar Wave may Throw before damage and then Places Spectrum within 1", () => {
  const s = trial([
    ["p1", "spectrum", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [spectrum, hawkeye] = s.fighters;
  spectrum.power = 4;
  activate(s);
  attack(s, hawkeye, 2, "energy", dice(1));
  assert.equal(actions(s)[0].mode, "throw");
  act(s, "p1", { type: "skip-effect" });
  const place = actions(s)[0];
  assert.equal(place.mode, "place");
  assert.equal(place.mover, spectrum.id);
});

test("Living Anti-Matter Reactor counts Failures; Let Loose pulses on Critical and Wild", () => {
  const s = trial([
    ["p1", "blue-marvel", 8],
    ["p2", "hulk", 10.5],
  ]);
  const [marvel, hulk] = s.fighters;
  hulk.power = 0;
  activate(s);
  attack(s, hulk, 0, "energy", dice(5, 5, 5, 7, 7, 7));
  assert.equal(hulk.damage, 3);
  assert.equal(marvel.power, 3 + 3 + 1);
});

test("Anti-Matter Barrier rerolls any defense dice including Failures for an ally within 3", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "spectrum", 12],
    ["p2", "blue-marvel", 14],
  ]);
  const [, spectrum, marvel] = s.fighters;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: spectrum.id, index: 0, damageType: "physical" },
    dice(2, 2, 2, 7, 7, 5),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  const labels = [];
  while (actions(s, "p2")[0]?.type === "modify-dice") {
    const option = actions(s, "p2")[0];
    labels.push(option.label);
    if (option.label === "Anti-Matter Barrier") {
      assert.ok(option.eligible.includes(0));
      act(s, "p2", { type: "modify-dice", indices: [0] }, () => 4);
    } else act(s, "p2", { type: "skip-effect" });
  }
  assert.ok(labels.includes("Anti-Matter Barrier"), labels.join());
  assert.equal(marvel.power, 0);
});

test("Luke Cage, She-Hulk, Spectrum and Blue Marvel fit in a saved Mighty Avengers roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["luke-cage", "spectrum", "blue-marvel"];
  const s = create(
    {
      p1: {
        ...preset,
        characters: [
          ...newcomers,
          "she-hulk",
          ...preset.characters.slice(0, 6),
        ],
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
    affiliation: "Mighty Avengers",
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
