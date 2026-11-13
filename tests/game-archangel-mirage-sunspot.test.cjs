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

test("Razor Wing Strike picks a condition per Wild and Overwing Places Archangel on a Critical", () => {
  const s = trial([
    ["p1", "archangel", 8],
    ["p2", "hulk", 12],
  ]);
  const [archangel, hulk] = s.fighters;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "physical" },
    dice(1, 1, 0),
  );
  const change = actions(s)[0];
  assert.equal(change.label, "Chosen of Apocalypse");
  assert.equal(change.max, 2);
  act(s, "p1", { type: "skip-effect" });
  skipDice(s);
  const kinds = s.effects.map((e) => e.type);
  assert.equal(kinds.filter((k) => k === "choose-condition").length, 2);
  const place = s.effects.find((e) => e.mode === "place");
  assert.equal(place.mover, archangel.id);
});

test("Avatar of Death Activates a Bleeding and Poisoned defender instead of Staggering it", () => {
  for (const toxic of [true, false]) {
    const s = trial([
      ["p1", "archangel", 8],
      ["p2", "hawkeye", 11],
    ]);
    const [archangel, hawkeye] = s.fighters;
    archangel.power = 3;
    if (toxic) hawkeye.conditions = ["bleed", "poison"];
    activate(s);
    attack(s, hawkeye, 1, "physical", dice(1));
    assert.equal(!!hawkeye.activated, toxic);
    assert.equal((hawkeye.conditions || []).includes("stagger"), !toxic);
  }
});

test("Wing Shield adds 2 defense dice to Archangel only", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "archangel", 12],
  ]);
  const [, archangel] = s.fighters;
  activate(s);
  act(s, "p1", {
    type: "attack",
    target: archangel.id,
    index: 0,
    damageType: "physical",
  });
  const shield = actions(s, "p2").find((a) =>
    a.label?.startsWith("Wing Shield"),
  );
  assert.ok(shield);
  act(s, "p2", { type: "reaction", value: shield.value }, dice());
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  skipDice(s);
  assert.equal(lastAttack(s, "Arrow Shot").defense.length, 4 + 2);
  assert.equal(archangel.power, 1 + (archangel.damage || 0));
  assert.equal(s.pendingAttack?.cantTouch, undefined);
});

test("Neural Connection lets Figment of Fantasy reach range 5 and then clears the token", () => {
  const s = trial([
    ["p1", "mirage", 8],
    ["p2", "hawkeye", 14],
  ]);
  const [mirage, hawkeye] = s.fighters;
  mirage.power = 2;
  activate(s);
  const figment = () =>
    actions(s)
      .find((a) => a.type === "power")
      ?.powers.find((p) => p.value === "Figment of Fantasy");
  assert.ok(!figment()?.targets?.some((t) => t.value === hawkeye.id));
  attack(s, hawkeye, 0, "mystic", dice(1));
  assert.equal(s.neural[mirage.id], hawkeye.id);
  assert.ok(figment().targets.some((t) => t.value === hawkeye.id));
  act(s, "p1", {
    type: "power",
    value: "Figment of Fantasy",
    target: hawkeye.id,
  });
  assert.equal(actions(s)[0].mover, hawkeye.id);
  assert.equal(s.neural[mirage.id], undefined);
});

test("Telepathic Emotion Manifestation rerolls a Neural-linked enemy’s attack dice", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "mirage", 16],
    ["p2", "hulk", 12],
  ]);
  const [hawkeye, mirage, hulk] = s.fighters;
  s.neural = { [mirage.id]: hawkeye.id };
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "physical" },
    () => 2,
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, () => 2);
  const option = actions(s, "p2").find(
    (a) => a.label === "Telepathic Emotion Manifestation",
  );
  assert.ok(option);
  assert.equal(option.max, 2);
  act(s, "p2", { type: "modify-dice", indices: [0, 1] }, () => 7);
  assert.equal(mirage.power, 1);
  assert.equal(s.neural[mirage.id], undefined);
});

test("Psionic Salvo grants a free follow-up on Critical and Wild that must pick a new target", () => {
  const s = trial([
    ["p1", "mirage", 8],
    ["p2", "hulk", 11],
    ["p2", "hawkeye", 11],
  ]);
  const [mirage, hulk, hawkeye] = s.fighters;
  hawkeye.y = 10;
  mirage.power = 3;
  activate(s);
  attack(s, hulk, 1, "mystic", dice(0, 1));
  const follow = actions(s).find((a) => a.type === "attack");
  const salvo = follow.attacks.find((a) => a.name === "Psionic Salvo");
  assert.deepEqual(
    salvo.targets.map((t) => t.value),
    [hawkeye.id],
  );
});

test("Flare State gains a token after movement, capped at 3; UV Strike adds one on Wild and Hit", () => {
  const s = trial([
    ["p1", "sunspot", 8],
    ["p2", "hawkeye", 14],
  ]);
  const [sunspot, hawkeye] = s.fighters;
  activate(s);
  act(s, "p1", { type: "advance", x: 11, y: 8 });
  assert.equal(sunspot.flares, 1);
  attack(s, hawkeye, 0, "energy", dice(1, 2));
  assert.equal(sunspot.flares, 2);
  sunspot.flares = 3;
  combat.addFlare(sunspot);
  assert.equal(sunspot.flares, 3);
});

test("Thermokinesis spends Flares for dice and Incinerates the defender", () => {
  const s = trial([
    ["p1", "sunspot", 8],
    ["p2", "hulk", 10.5],
  ]);
  const [sunspot, hulk] = s.fighters;
  sunspot.flares = 2;
  activate(s);
  const option = actions(s)
    .find((a) => a.type === "attack")
    .attacks.find((a) => a.name === "UV Strike");
  assert.equal(option.flareMax, 2);
  attack(s, hulk, 0, "energy", dice(), { flares: 2 });
  assert.equal(lastAttack(s, "UV Strike").rolled.length, 7);
  assert.equal(sunspot.flares, 0);
  assert.ok(hulk.conditions.includes("incinerate"));
});

test("Dark Solar Blast hurts everyone near the defender without granting Power", () => {
  const s = trial([
    ["p1", "sunspot", 8],
    ["p1", "hawkeye", 12],
    ["p2", "hulk", 11.5],
  ]);
  const [sunspot, ally, hulk] = s.fighters;
  ally.y = 10;
  ally.power = 0;
  sunspot.power = 3;
  activate(s);
  attack(s, hulk, 1, "energy", dice(1, 2));
  assert.equal(ally.damage, 1);
  assert.equal(ally.power, 0);
});

test("Sunburn Advances Long with 3 Flares, then grants an attack", () => {
  const s = trial([
    ["p1", "sunspot", 8],
    ["p2", "hawkeye", 18],
  ]);
  const [sunspot] = s.fighters;
  sunspot.flares = 3;
  activate(s);
  act(s, "p1", { type: "power", value: "Sunburn" });
  const move = actions(s)[0];
  assert.equal(move.speed, "L");
  assert.ok(sunspot.sunburnFlight);
  assert.equal(s.effects[1].type, "granted-attack");
});

test("Flare State spends all Flares to damage enemies when Sunspot is Dazed", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "sunspot", 11],
  ]);
  const [hawkeye, sunspot] = s.fighters;
  sunspot.flares = 2;
  sunspot.damage = 6;
  combat.damage(s, sunspot, 1, hawkeye);
  assert.ok(sunspot.dazed);
  assert.equal(sunspot.flares, 0);
  assert.equal(hawkeye.damage, 1);
});

test("Coming of Age gives 3 Power and Self-Discovery dice when an ally flips to Injured", () => {
  const powers = [true, false].map((leader) => {
    const s = trial([
      ["p1", "mirage", 8],
      ["p1", "sunspot", 6],
      ["p2", "hawkeye", 14],
    ]);
    const [mirage, sunspot, hawkeye] = s.fighters;
    if (leader) s.leaders.p1 = mirage.slug + ":Coming of Age";
    sunspot.damage = 6;
    combat.damage(s, sunspot, 1, hawkeye);
    assert.ok(sunspot.dazed);
    activate(s, mirage);
    act(s, "p1", { type: "end" });
    activate(s, hawkeye);
    act(s, "p2", { type: "end" });
    assert.equal(s.round, 2);
    assert.ok(sunspot.injured);
    assert.equal(!!sunspot.selfDiscovery, leader);
    return sunspot.power;
  });
  assert.equal(powers[0] - powers[1], 3);
});

test("Archangel, Mirage and Sunspot fit in a saved X-Force roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["archangel", "sunspot", "cable"];
  const s = create(
    {
      p1: {
        ...preset,
        characters: [...newcomers, "mirage", ...preset.characters.slice(0, 6)],
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
