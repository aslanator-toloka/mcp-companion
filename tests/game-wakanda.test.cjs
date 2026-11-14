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

test("Black Panther’s Strike always Pushes before damage; Kinetic Burst takes extra Power and explodes", () => {
  const s = trial([
    ["p1", "black-panther", 8],
    ["p2", "hawkeye", 10.5],
  ]);
  const [panther, hawkeye] = s.fighters;
  panther.power = 6;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: hawkeye.id, index: 0, damageType: "physical" },
    dice(),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  skipDice(s);
  assert.equal(actions(s)[0].mode, "push");
  act(s, "p1", { type: "displace", angle: 0 });
  hawkeye.x = 10.5;
  const burst = actions(s)
    .find((a) => a.type === "attack")
    .attacks.find((a) => a.name === "Kinetic Burst");
  assert.equal(burst.boostMax, 3);
  attack(s, hawkeye, 1, "energy", dice(1), { boost: 2 });
  assert.equal(lastAttack(s, "Kinetic Burst").rolled.length, 8);
  assert.ok(s.effects.some((e) => e.mode === "push" && e.mover === hawkeye.id));
  assert.equal(panther.power, 1);
});

test("Mantle of the Black Panther rerolls any attack dice this Turn; Pounce Throws him Short", () => {
  const s = trial([
    ["p1", "black-panther", 8],
    ["p2", "hulk", 10.5],
  ]);
  const [panther, hulk] = s.fighters;
  panther.power = 4;
  activate(s);
  act(s, "p1", { type: "power", value: "Mantle of the Black Panther" });
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "physical" },
    dice(5, 5, 7, 7, 7),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  const option = actions(s)[0];
  assert.equal(option.label, "Mantle of the Black Panther");
  assert.ok(option.eligible.includes(0));
  assert.equal(option.max, 5);
  for (const side of ["p1", "p2"])
    while (actions(s, side)[0]?.type === "modify-dice")
      act(s, side, { type: "skip-effect" });
  if (actions(s)[0]?.mode === "push") act(s, "p1", { type: "skip-effect" });
  act(s, "p1", { type: "power", value: "Pounce" });
  assert.equal(actions(s)[0].mode, "throw");
  assert.equal(actions(s)[0].speed, "S");
});

test("Vibranium Armor counts Blanks while healthy and adds 2 dice as a reaction when injured", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "black-panther", 12],
  ]);
  const [, panther] = s.fighters;
  activate(s);
  attack(s, panther, 0, "physical", dice(2, 2, 2, 7, 7, 7, 7, 7, 7));
  assert.equal(panther.damage || 0, 0);

  const hurt = trial([
    ["p1", "hawkeye", 8],
    ["p2", "black-panther", 12],
  ]);
  hurt.fighters[1].injured = true;
  activate(hurt);
  act(hurt, "p1", {
    type: "attack",
    target: hurt.fighters[1].id,
    index: 0,
    damageType: "physical",
  });
  assert.ok(
    actions(hurt, "p2").some(
      (a) => a.value === "vibranium:" + hurt.fighters[1].id,
    ),
  );
});

test("King of Wakanda lets allies pay 1 Power to reroll a die", () => {
  const s = trial([
    ["p1", "okoye", 8],
    ["p1", "black-panther", 4],
    ["p2", "hulk", 10.5],
  ]);
  const [okoye, panther, hulk] = s.fighters;
  s.leaders.p1 = panther.slug + ":King of Wakanda";
  activate(s, okoye);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "physical" },
    dice(),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  const option = actions(s)[0];
  assert.equal(option.label, "King of Wakanda");
  act(s, "p1", { type: "modify-dice", indices: [0] }, () => 2);
  assert.equal(okoye.power, 2 + (hulk.damage ? hulk.damage : 0));
});

test("Bodyguard redirects an attack on an ally within 2; Okoye rerolls a defense die", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "shuri", 12],
    ["p2", "okoye", 13.5],
  ]);
  const [, shuri, okoye] = s.fighters;
  activate(s);
  act(s, "p1", {
    type: "attack",
    target: shuri.id,
    index: 0,
    damageType: "physical",
  });
  const guard = actions(s, "p2").find((a) => a.label?.startsWith("Bodyguard"));
  assert.ok(guard);
  act(s, "p2", { type: "reaction", value: guard.value }, dice(2, 2, 2));
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice(2, 2, 2));
  const labels = [];
  for (const side of ["p1", "p2"])
    while (actions(s, side)[0]?.type === "modify-dice") {
      labels.push(actions(s, side)[0].label);
      act(s, side, { type: "skip-effect" }, dice(2, 2, 2));
    }
  assert.ok(labels.includes("General of the Dora Milaje"), labels.join());
  assert.equal(shuri.damage || 0, 0);
  assert.ok(okoye.damage > 0);
});

test("Vibranium Spear Thrust Pierces and grants a Strike on a Wild", () => {
  const s = trial([
    ["p1", "okoye", 8],
    ["p2", "hulk", 10.5],
  ]);
  const [okoye, hulk] = s.fighters;
  okoye.power = 4;
  activate(s);
  attack(s, hulk, 2, "physical", dice(1));
  const bonus = s.effects.find((e) => e.type === "bonus-attack");
  assert.equal(bonus.kind, "spear");
  assert.equal(bonus.index, 0);
});

test("Panther Gauntlets cap damage at 1 and Push; Sonic Crush Stuns and Staggers on a Wild", () => {
  const s = trial([
    ["p1", "shuri", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [shuri, hulk] = s.fighters;
  activate(s);
  attack(s, hulk, 0, "energy", dice(1, 2, 2, 2, 2, 2));
  assert.equal(hulk.damage, 1);
  assert.equal(actions(s)[0].mode, "push");
  act(s, "p1", { type: "displace", angle: 0 });
  shuri.power = 4;
  hulk.x = 10.5;
  attack(s, hulk, 1, "energy", dice(1));
  assert.ok(hulk.conditions.includes("stagger"));
});

test("Super Genius counts Blocks instead of Hits; Head of R&D gains Power on Failures", () => {
  const s = trial([
    ["p1", "shuri", 8],
    ["p2", "hulk", 12],
  ]);
  const [shuri, hulk] = s.fighters;
  hulk.power = 0;
  activate(s);
  attack(s, hulk, 0, "energy", dice(4, 4, 4, 5, 7, 7));
  assert.ok(s.log.some((e) => e.text?.startsWith("Super Genius")));
  assert.equal(hulk.damage, 1);
  assert.equal(shuri.power, 3 - 1 + 1 + 1);
});

test("Upgrades rerolls an ally’s dice within range 4 more than once per Turn", () => {
  const s = trial([
    ["p1", "okoye", 8],
    ["p1", "shuri", 10],
    ["p2", "hulk", 10.5],
  ]);
  const [okoye, shuri, hulk] = s.fighters;
  shuri.power = 4;
  hulk.y = 9.5;
  activate(s, okoye);
  for (let i = 0; i < 2; i++) {
    act(
      s,
      "p1",
      { type: "attack", target: hulk.id, index: 0, damageType: "physical" },
      dice(),
    );
    while (s.pendingAttack)
      act(s, "p2", { type: "reaction", value: "skip" }, dice());
    const option = actions(s).find((a) => a.label === "Upgrades");
    assert.ok(option, "attack " + i);
    act(s, "p1", { type: "modify-dice", indices: [0] }, () => 7);
    skipDice(s);
  }
  assert.equal(shuri.power, 2);
});

test("Black Panther, Okoye and Shuri fit in a saved Wakanda roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["black-panther", "okoye", "shuri"];
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
    affiliation: "Wakanda",
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
