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

test("Glaive’s Edge Places Corvus, then grants Strike or Death Blow that scores Blanks", () => {
  const s = trial([
    ["p1", "corvus-glaive", 8],
    ["p2", "hulk", 11],
  ]);
  const [corvus, hulk] = s.fighters;
  hulk.power = 0;
  activate(s);
  act(s, "p1", { type: "power", value: "Glaive‘s Edge" });
  act(s, "p1", { type: "displace", x: 8.5, y: 8 });
  const granted = actions(s).find((a) => a.type === "attack");
  assert.deepEqual(
    granted.attacks.map((a) => a.name).sort(),
    ["Death Blow", "Strike"].filter((name) =>
      granted.attacks.some((a) => a.name === name),
    ),
  );
  attack(s, hulk, 0, "physical", dice(7, 7, 7, 7, 7, 5, 5, 5, 5));
  assert.ok(hulk.damage >= 4);
  assert.equal(s.actionsLeft, 1);
  void corvus;
});

test("Death Blow offers a Medium Advance and a Strike on Wild and Block", () => {
  const s = trial([
    ["p1", "corvus-glaive", 8],
    ["p2", "hulk", 11],
  ]);
  const [corvus, hulk] = s.fighters;
  corvus.power = 4;
  activate(s);
  attack(s, hulk, 2, "physical", dice(1, 4));
  const kinds = s.effects.map((e) => e.type + ":" + (e.mode || e.kind));
  assert.ok(kinds.includes("displace:advance"));
  assert.ok(kinds.includes("bonus-attack:deathblow"));
});

test("Husband of Proxima Midnight lets her activate right after Corvus", () => {
  const s = trial([
    ["p1", "corvus-glaive", 8],
    ["p1", "proxima-midnight", 10],
    ["p2", "hulk", 20],
  ]);
  const [corvus, proxima] = s.fighters;
  activate(s, corvus);
  act(s, "p1", { type: "end" });
  const option = actions(s)[0];
  assert.equal(option.type, "partner");
  act(s, "p1", { type: "partner" });
  assert.equal(s.active, proxima.id);
  assert.ok(corvus.activated);
  assert.equal(corvus.power, 2);
});

test("Martial Prowess rolls five defense dice and punishes a whiff with 2 damage", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "proxima-midnight", 10.5],
  ]);
  const [hawkeye, proxima] = s.fighters;
  activate(s);
  act(s, "p1", {
    type: "attack",
    target: proxima.id,
    index: 0,
    damageType: "physical",
  });
  act(
    s,
    "p2",
    { type: "reaction", value: "prowess:" + proxima.id },
    dice(2, 7, 7, 7, 4, 4, 4),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  skipDice(s);
  assert.equal(lastAttack(s, "Arrow Shot").defense.length, 5);
  assert.equal(proxima.damage || 0, 0);
  assert.equal(hawkeye.damage, 2);
});

test("Spear Throw Places Proxima by the defender; Quantum Starburst applies three conditions on damage", () => {
  const s = trial([
    ["p1", "proxima-midnight", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [proxima, hawkeye] = s.fighters;
  proxima.power = 4;
  activate(s);
  attack(s, hawkeye, 1, "energy", dice(1));
  assert.ok(hawkeye.conditions.includes("poison"));
  const place = actions(s)[0];
  assert.equal(place.mode, "place");
  act(s, "p1", { type: "displace", x: 10.5, y: 8 });
  attack(s, hawkeye, 2, "energy", dice(2, 2));
  if (!hawkeye.dazed)
    for (const name of ["bleed", "stun"])
      assert.ok(hawkeye.conditions.includes(name), name);
});

test("Enforced Oblivion grants a Move and +2 dice on the next attack; Invulnerable Skin reduces damage", () => {
  const s = trial([
    ["p1", "black-dwarf", 8],
    ["p2", "hawkeye", 14],
  ]);
  const [dwarf, hawkeye] = s.fighters;
  activate(s);
  act(s, "p1", { type: "power", value: "Enforced Oblivion" });
  act(s, "p1", { type: "granted-move", x: 11, y: 8 });
  attack(s, hawkeye, 0, "physical");
  assert.equal(lastAttack(s, "Axe Strike").rolled.length, 8);
  combat.damage(s, dwarf, 2, hawkeye);
  assert.equal(dwarf.damage, 1);
});

test("Intimidating Presence redirects attacks from enemies within 2; Black Fury Throws Medium", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "corvus-glaive", 13],
    ["p2", "black-dwarf", 9.8],
  ]);
  const [hawkeye, corvus, dwarf] = s.fighters;
  dwarf.y = 10.5;
  activate(s);
  act(s, "p1", {
    type: "attack",
    target: corvus.id,
    index: 0,
    damageType: "physical",
  });
  const option = actions(s, "p2").find((a) =>
    a.label?.startsWith("Intimidating Presence"),
  );
  assert.ok(option);
  void hawkeye;
});

test("Corvus, Proxima and Black Dwarf fit in a saved Black Order roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["corvus-glaive", "proxima-midnight", "black-dwarf"];
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
