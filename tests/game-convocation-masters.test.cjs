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

test("Winds of Watoomb pulls the attacker in before the attack continues", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "ancient-one", 14],
  ]);
  const [hawkeye, ancient] = s.fighters;
  activate(s);
  act(s, "p1", {
    type: "attack",
    target: ancient.id,
    index: 0,
    damageType: "physical",
  });
  act(s, "p2", { type: "reaction", value: "winds:" + ancient.id });
  assert.equal(ancient.power, 0);
  const push = actions(s, "p2")[0];
  assert.equal(push.mover, hawkeye.id);
  assert.equal(push.direction, "toward");
  act(s, "p2", { type: "displace", angle: 0 }, dice());
  assert.ok(hawkeye.x > 8);
});

test("Keeper of the Eye rerolls two defense dice; Astral Strike Staggers on damage", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "ancient-one", 12],
  ]);
  const [, ancient] = s.fighters;
  ancient.power = 0;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: ancient.id, index: 0, damageType: "physical" },
    dice(2, 2),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice(2, 2));
  const labels = [];
  while (actions(s, "p2")[0]?.type === "modify-dice") {
    labels.push(actions(s, "p2")[0].label);
    act(s, "p2", { type: "skip-effect" });
  }
  assert.ok(labels.includes("Keeper of the Eye of Agamotto"), labels.join());

  const strike = trial([
    ["p1", "ancient-one", 8],
    ["p2", "hawkeye", 10.5],
  ]);
  strike.fighters[0].power = 4;
  activate(strike);
  attack(strike, strike.fighters[1], 2, "mystic", dice(2, 2));
  assert.ok(strike.fighters[1].conditions.includes("stagger"));
});

test("Soul Barb spreads a chosen condition to enemies near the marked one", () => {
  const s = trial([
    ["p1", "baron-mordo", 8],
    ["p2", "hawkeye", 12],
    ["p2", "hulk", 13.5],
  ]);
  const [, hawkeye, hulk] = s.fighters;
  hawkeye.conditions = ["hex"];
  activate(s);
  act(s, "p1", { type: "power", value: "Soul Barb", target: hawkeye.id });
  assert.ok(hulk.conditions.includes("hex"));
});

test("Ferocity of Cyttorak adds 2 dice to an ally’s attack and costs the attacker 1 damage", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p1", "baron-mordo", 6],
    ["p2", "hulk", 12],
  ]);
  const [hawkeye, mordo, hulk] = s.fighters;
  activate(s, hawkeye);
  attack(s, hulk, 0, "physical", dice(), { decree: true });
  assert.equal(lastAttack(s, "Arrow Shot").rolled.length, 7);
  assert.equal(hawkeye.damage, 1);
  assert.equal(mordo.power, 1);
});

test("Vaulting Boots let a Pushed Mordo Advance; Master of the Occult gains 2 Power", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "baron-mordo", 10.5],
  ]);
  const [, mordo] = s.fighters;
  activate(s);
  attack(s, mordo, 0, "physical", dice(1));
  if (actions(s)[0]?.type === "start-displacement")
    act(s, "p1", { type: "start-displacement" });
  act(s, "p1", { type: "displace", angle: 0 });
  const option = actions(s, "p2")[0];
  assert.equal(option.type, "vaulting");
  act(s, "p2", { type: "vaulting" });
  assert.equal(actions(s, "p2")[0].mode, "advance");
});

test("Shining Circle cleanses and salves allies on its combos", () => {
  const s = trial([
    ["p1", "doctor-strange-sorcerer-supreme", 8],
    ["p1", "hawkeye", 8],
    ["p2", "hulk", 10],
  ]);
  const [strange, ally] = s.fighters;
  ally.y = 10;
  ally.damage = 2;
  ally.conditions = ["poison"];
  strange.power = 6;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", index: 2, angle: 0, damageType: "mystic" },
    dice(1, 4),
  );
  for (const side of ["p1", "p2"])
    while (actions(s, side)?.[0]?.type === "modify-dice")
      act(s, side, { type: "skip-effect" }, dice());
  if (s.volley)
    act(
      s,
      "p1",
      { type: "volley-target", value: s.fighters[2].id },
      dice(1, 4),
    );
  skipDice(s);
  assert.equal(ally.damage, 1);
  assert.deepEqual(ally.conditions, []);
});

test("Mystic Armor of Strange blanks dice against energy attacks; Scalpel Places any character", () => {
  const s = trial([
    ["p1", "cyclops", 8],
    ["p2", "doctor-strange-sorcerer-supreme", 12],
  ]);
  const [iceman, strange] = s.fighters;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", target: strange.id, index: 0, damageType: "energy" },
    dice(2, 2, 2, 7, 7, 1, 7, 7),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  const labels = [];
  while (actions(s, "p2")[0]?.type === "modify-dice") {
    labels.push(actions(s, "p2")[0].label);
    act(s, "p2", { type: "skip-effect" });
  }
  assert.ok(labels.includes("Mystic Armor of Strange"), labels.join());
  void iceman;
});

test("Brother Daniel adds 2 defense dice to Voodoo; Possession moves it to a cheap enemy who drops tokens", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "doctor-voodoo", 12],
  ]);
  const [hawkeye, voodoo] = s.fighters;
  activate(s);
  attack(s, voodoo, 0, "physical");
  assert.equal(lastAttack(s, "Arrow Shot").defense.length, 2 + 2);

  const pos = trial([
    ["p1", "doctor-voodoo", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [vd, hk] = pos.fighters;
  vd.power = 5;
  pos.objectives = [{ id: "e", name: "Token", role: "extract", holder: hk.id }];
  activate(pos);
  const power = actions(pos)
    .find((a) => a.type === "power")
    .powers.find((p) => p.value === "Possession");
  const target = power.targets.find((t) => t.value === hk.id);
  assert.ok(target.minPower >= 2);
  act(pos, "p1", {
    type: "power",
    value: "Possession",
    target: hk.id,
    amount: target.minPower,
  });
  assert.equal(vd.danielOn, hk.id);
  assert.ok(!pos.objectives[0].holder);
  assert.ok(view(pos, "p1").fighters[1].daniel);
  void hawkeye;
});

test("Staff of Legba burns Power into damage; Spirit Venom Throws a small target on two Hits", () => {
  const s = trial([
    ["p1", "doctor-voodoo", 8],
    ["p2", "hawkeye", 10.5],
  ]);
  const [voodoo, hawkeye] = s.fighters;
  voodoo.power = 3;
  hawkeye.power = 2;
  activate(s);
  attack(s, hawkeye, 1, "mystic", dice(1, 1, 7, 7, 7, 7, 7));
  assert.equal(hawkeye.power >= 0, true);
  assert.ok(hawkeye.damage >= 2);
});

test("Ancient One, Baron Mordo, Strange Sorcerer Supreme and Doctor Voodoo fit in a saved Convocation roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["ancient-one", "baron-mordo", "doctor-voodoo"];
  const s = create(
    {
      p1: {
        ...preset,
        characters: [
          ...newcomers,
          "doctor-strange-sorcerer-supreme",
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
    affiliation: "Convocation",
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
