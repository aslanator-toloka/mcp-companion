const test = require("node:test");
const assert = require("node:assert/strict");
const { act, create, view } = require("../game/engine.cjs");
const { pool } = require("../game/catalog.cjs");
const { trial } = require("./helpers/game.cjs");

const dice =
  (...faces) =>
  () =>
    faces.shift() ?? 7;
const activate = (s) =>
  act(s, "p1", { type: "activate", value: s.fighters[0].id });
const actions = (s, side = "p1") => view(s, side).actions[side];
const attack = (s, target, index, damageType, random = dice()) =>
  act(
    s,
    "p1",
    { type: "attack", target: target.id, index, damageType },
    random,
  );

test("Seismokinesis grants Power per defender and applies Stun on a Wild", () => {
  const s = trial([
    ["p1", "avalanche", 8],
    ["p2", "hawkeye", 12],
    ["p2", "pyro", 14],
  ]);
  const [avalanche, hawkeye, pyro] = s.fighters;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", index: 0, angle: 0, damageType: "physical" },
    dice(),
  );
  act(s, "p1", { type: "volley-target", value: hawkeye.id }, dice(1));
  assert.equal(avalanche.power, 5);
  assert.ok(hawkeye.conditions.includes("stun"));
  assert.ok(!pyro.conditions?.includes("stun"));
});

test("Epicenter of Destruction Stuns each defender without a Wild", () => {
  const s = trial([
    ["p1", "avalanche", 8],
    ["p2", "hawkeye", 11],
    ["p2", "pyro", 11],
  ]);
  const [avalanche, hawkeye, pyro] = s.fighters;
  pyro.y = 10;
  activate(s);
  act(s, "p1", { type: "attack", index: 1, damageType: "physical" }, dice());
  act(s, "p1", { type: "volley-target", value: hawkeye.id }, dice());
  assert.equal(avalanche.power, 0);
  assert.deepEqual(hawkeye.conditions, ["stun"]);
  assert.deepEqual(pyro.conditions, ["stun"]);
});

test("Landslide pushes an enemy Away Short once per turn", () => {
  const s = trial([
    ["p1", "avalanche", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [avalanche, hawkeye] = s.fighters;
  avalanche.power = 5;
  activate(s);
  act(s, "p1", { type: "power", value: "Landslide", target: hawkeye.id });
  assert.equal(actions(s)[0].direction, "away");
  assert.equal(actions(s)[0].speed, "S");
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(hawkeye.x, 15.25);
  assert.equal(avalanche.power, 3);
  assert.ok(
    !actions(s)
      .find((a) => a.type === "power")
      ?.powers.some((p) => p.value === "Landslide"),
  );
});

test("Beware Falling Debris reacts to an Advance but not a Place and causes a collision", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "avalanche", 14],
  ]);
  const [hawkeye, avalanche] = s.fighters;
  s.terrain = [{ id: "car", name: "Car", size: 3, x: 12, y: 10, w: 1, h: 1 }];
  activate(s);
  act(s, "p1", { type: "power", value: "Hook Arrow", x: 11, y: 8 });
  assert.deepEqual(actions(s, "p2"), []);
  act(s, "p1", { type: "climb", x: 11, y: 8.25 });
  assert.deepEqual(actions(s, "p2"), []);
  act(s, "p1", { type: "advance", x: 12, y: 8 });
  assert.equal(actions(s, "p2")[0].type, "falling-debris");
  act(s, "p2", { type: "falling-debris", value: "car" }, dice());
  assert.equal(hawkeye.damage, 3);
  assert.equal(avalanche.power, 0);
  assert.equal(s.terrain.length, 0);
});

test("A Little Something Extra converts exactly one Hit to a double Wild, triggering Bo Staff's Push before damage", () => {
  const s = trial([
    ["p1", "gambit", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [gambit, hawkeye] = s.fighters;
  activate(s);
  attack(s, hawkeye, 0, "physical", dice(2, 4));
  const change = actions(s)[0];
  assert.equal(change.label, "A Little Something Extra");
  assert.deepEqual(change.eligible, [0]);
  act(s, "p1", { type: "modify-dice", indices: [0] });
  assert.equal(actions(s)[0].mode, "push");
  assert.equal(hawkeye.damage || 0, 0);
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(hawkeye.damage, 2);
  assert.equal(gambit.power, 3);
});

test("Kinetic Ace deals collateral damage on a Wild and pays Power equal to damage dealt", () => {
  const s = trial([
    ["p1", "gambit", 8],
    ["p2", "hawkeye", 12],
    ["p2", "pyro", 12],
  ]);
  const [gambit, hawkeye, pyro] = s.fighters;
  pyro.y = 11;
  activate(s);
  attack(s, hawkeye, 1, "energy", dice(1));
  assert.equal(hawkeye.damage, 2);
  assert.equal(pyro.damage, 1);
  assert.equal(gambit.power, 5);
});

test("52 Card Pickup requires two Wild faces despite each Wild scoring twice", () => {
  for (const [roll, stunned] of [
    [[1], false],
    [[1, 1], true],
  ]) {
    const s = trial([
      ["p1", "gambit", 8],
      ["p2", "hawkeye", 12],
    ]);
    activate(s);
    act(
      s,
      "p1",
      { type: "attack", index: 2, angle: 0, damageType: "energy" },
      dice(...roll),
    );
    assert.equal(s.log.at(-1).rollSummary.attackHits, 2 * roll.length);
    assert.equal(!!s.fighters[1].conditions?.includes("stun"), stunned);
  }
});

test("Gambit doubles Wilds on defense, and Enhanced Agility grants an Advance when Nice Punch cancels its damage", () => {
  const s = trial([
    ["p1", "juggernaut", 8],
    ["p2", "gambit", 12],
  ]);
  const [juggernaut, gambit] = s.fighters;
  activate(s);
  attack(s, gambit, 0, "physical", dice(2, 2, 7, 7, 7, 1));
  assert.equal(s.log.at(-1).rollSummary.defenseHits, 2);
  assert.equal(gambit.damage || 0, 0);
  act(s, "p2", { type: "enhanced-agility" });
  act(s, "p1", { type: "nice-punch" });
  assert.equal(juggernaut.damage || 0, 0);
  assert.equal(actions(s, "p2")[0].speed, "S");
  act(s, "p2", { type: "displace", x: 14, y: 8 });
  assert.equal(gambit.x, 14);
  assert.equal(gambit.power, 1);
});

test("one Wild and one Block fully dodge a terrain collision for Gambit", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "gambit", 12],
  ]);
  s.terrain = [{ id: "car", name: "Car", size: 3, x: 9, y: 10, w: 1, h: 1 }];
  activate(s);
  act(s, "p1", {
    type: "power",
    value: "Strongest One There Is",
    target: "car",
  });
  act(s, "p1", { type: "throw-terrain", angle: 0 }, dice(1, 4));
  assert.equal(s.fighters[1].damage || 0, 0);
});

test("Stop Squealing and Die buffs only one Claw Slash and Healing Factor heals one at turn end", () => {
  const s = trial([
    ["p1", "sabretooth-apex-predator", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [sabretooth, target] = s.fighters;
  sabretooth.power = 4;
  sabretooth.damage = 2;
  activate(s);
  act(s, "p1", { type: "power", value: "Stop Squealing and Die" });
  attack(s, target, 0, "physical");
  assert.equal(s.log.at(-1).rolled.length, 8);
  attack(s, target, 0, "physical");
  assert.equal(s.log.at(-1).rolled.length, 5);
  act(s, "p1", { type: "end" });
  assert.equal(sabretooth.damage, 1);
});

test("Bloodthirsty Onslaught has Pierce, Bleed and placement next to the defender", () => {
  const s = trial([
    ["p1", "sabretooth-apex-predator", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [sabretooth, target] = s.fighters;
  activate(s);
  attack(s, target, 1, "physical", dice(1, 7, 7, 7, 7, 7, 4));
  assert.equal(actions(s)[0].label, "Pierce");
  act(s, "p1", { type: "modify-dice", indices: [0] });
  assert.equal(target.damage, 1);
  assert.deepEqual(target.conditions, ["bleed"]);
  assert.equal(actions(s)[0].mode, "place");
  act(s, "p1", { type: "displace", x: 10, y: 8 });
  assert.equal(sabretooth.x, 10);
});

test("Catch, Runt! throws a Size 3 or smaller enemy Medium", () => {
  const s = trial([
    ["p1", "sabretooth-apex-predator", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [, target] = s.fighters;
  activate(s);
  act(s, "p1", { type: "power", value: "Catch, Runt!", target: target.id });
  assert.equal(actions(s)[0].speed, "M");
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(target.x, 17);
});

test("Primal Pounce throws Apex Predator Medium without damage to himself", () => {
  const s = trial([
    ["p1", "sabretooth-apex-predator", 8],
    ["p2", "hawkeye", 13],
  ]);
  const [sabretooth, target] = s.fighters;
  activate(s);
  act(s, "p1", { type: "power", value: "Primal Pounce" });
  assert.equal(actions(s)[0].speed, "M");
  act(s, "p1", { type: "displace", angle: 0 }, dice());
  assert.ok(sabretooth.x > 8);
  assert.equal(sabretooth.damage || 0, 0);
  assert.equal(target.damage, 3);
});

test("the three newcomers can join one saved squad, but both Sabretooth variants cannot", () => {
  const preset = pool.presets[0];
  const characters = ["avalanche", "gambit", "sabretooth-apex-predator"];
  const roster = {
    ...preset,
    characters: [...characters, "sabretooth", ...preset.characters.slice(0, 6)],
  };
  const s = create({ p1: roster, p2: "cabal" }, 1);
  Object.assign(s, { phase: "squad", priority: "p1", threat: 17 });
  assert.throws(
    () =>
      act(s, "p1", {
        type: "squad",
        characters: [...characters, "sabretooth"],
        tactics: [],
      }),
    /Alter Ego/,
  );
  act(s, "p1", { type: "squad", characters, tactics: [] });
  act(s, "p2", {
    type: "squad",
    characters: ["crossbones-merciless-merc"],
    tactics: [],
  });
  assert.deepEqual(
    view(s, "p1")
      .fighters.filter((f) => f.side === "p1")
      .map((f) => f.slug),
    characters,
  );
});
