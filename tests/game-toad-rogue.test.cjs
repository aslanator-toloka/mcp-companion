const test = require("node:test");
const assert = require("node:assert/strict");
const { act, view } = require("../game/engine.cjs");
const { trial } = require("./helpers/game.cjs");

const activate = (s) =>
  act(s, "p1", { type: "activate", value: s.fighters[0].id });
const dice =
  (...rolls) =>
  () =>
    rolls.shift() ?? 7;
const action = (s, side = "p1") => view(s, side).actions[side][0];
const attack = (s, target, index, damageType, random) =>
  act(
    s,
    "p1",
    { type: "attack", target: target.id, index, damageType },
    random,
  );
const token = (id, x, name, holder) => ({
  id,
  name,
  holder,
  x,
  y: 8,
  radius: 0.5,
  role: "extract",
});

test("Prehensile Tongue reaches Range 2 while a normal character cannot Interact there", () => {
  for (const [slug, expected] of [
    ["toad", true],
    ["hawkeye", false],
  ]) {
    const s = trial([
      ["p1", slug, 8],
      ["p2", "quicksilver", 18],
    ]);
    s.objectives = [token("book", 11, "Spellbook")];
    activate(s);
    assert.equal(
      view(s, "p1").actions.p1.some((a) => a.type === "interact"),
      expected,
    );
    if (expected) {
      act(s, "p1", { type: "interact", value: "book" });
      assert.equal(s.objectives[0].holder, s.fighters[0].id);
    }
  }
});

test("Finders Keepers takes a nearby ally’s extract and respects token limits", () => {
  const s = trial([
    ["p1", "toad", 8],
    ["p1", "hawkeye", 11],
    ["p2", "quicksilver", 14],
  ]);
  const [toad, ally, enemy] = s.fighters;
  s.objectives = [
    token("mine", 8, "Spellbook", toad.id),
    token("second", 11, "Spellbook", ally.id),
    token("cube", 11, "Cosmic Cube", ally.id),
    token("enemy", 14, "Cosmic Cube", enemy.id),
  ];
  activate(s);
  const power = view(s, "p1")
    .actions.p1.find((a) => a.type === "power")
    .powers.find((p) => p.value === "Finders Keepers");
  assert.deepEqual(
    power.targets.map((t) => t.value),
    ["cube"],
  );
  act(s, "p1", { type: "power", value: "Finders Keepers", target: "cube" });
  assert.equal(s.objectives[2].holder, toad.id);
  assert.equal(ally.power, 3);
  assert.equal(toad.power, 1);
  assert.equal(s.actionsLeft, 1);
});

test("Hop places Toad without spending an action and Wall Crawler permits the following Advance", () => {
  const s = trial([
    ["p1", "toad", 8],
    ["p2", "hawkeye", 21],
  ]);
  const [toad] = s.fighters;
  s.terrain = [{ id: "wall", size: 5, x: 13, y: 0, w: 1, h: 36 }];
  activate(s);
  act(s, "p1", { type: "power", value: "Hop", x: 12, y: 8 });
  assert.equal(toad.x, 12);
  assert.equal(s.actionsLeft, 2);
  assert.equal(toad.power, 1);
  act(s, "p1", { type: "advance", x: 16, y: 8 });
  assert.equal(toad.x, 16);
});

test("Slippery offers a paid Medium Advance only after a damaging attack", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "toad", 12],
  ]);
  const [, toad] = s.fighters;
  activate(s);
  attack(s, toad, 0, "physical", dice());
  assert.deepEqual(view(s, "p2").actions.p2, []);
  attack(s, toad, 0, "physical", dice(2));
  assert.equal(action(s, "p2").type, "slippery");
  act(s, "p2", { type: "slippery" });
  assert.equal(action(s, "p2").speed, "M");
  act(s, "p2", { type: "displace", x: 17, y: 8 });
  assert.equal(toad.power, 2);
  assert.equal(toad.x, 17);
});

test("Tongue Lash builds Power and poisons on Wild, Spit Acid Incinerates without a trigger", () => {
  const s = trial([
    ["p1", "toad", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [toad, target] = s.fighters;
  activate(s);
  attack(s, target, 0, "physical", dice(1, 2));
  assert.equal(toad.power, 5);
  assert.deepEqual(target.conditions, ["poison"]);
  attack(s, target, 1, "energy", dice());
  assert.deepEqual(target.conditions, ["poison", "incinerate"]);
});

test("Rogue’s Charge grants a move and an Absorbing Strike with selectable damage type and Sap Power", () => {
  const s = trial([
    ["p1", "rogue", 8],
    ["p2", "hawkeye", 13],
  ]);
  const [rogue, target] = s.fighters;
  activate(s);
  act(s, "p1", { type: "power", value: "Charge" });
  act(s, "p1", { type: "granted-move", x: 10, y: 8 });
  assert.deepEqual(action(s).attacks[0].types, ["physical", "energy"]);
  attack(s, target, 0, "energy", dice(1, 1));
  assert.equal(rogue.power, 5);
  assert.equal(target.damage, 2);
  assert.equal(s.actionsLeft, 1);
});

test("Southern Hospitality grants a Short throw; Marvelous Strength throws terrain Medium", () => {
  const s = trial([
    ["p1", "rogue", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [rogue, target] = s.fighters;
  rogue.power = 6;
  s.terrain = [{ id: "car", name: "Car", size: 4, x: 8, y: 10, w: 1, h: 1 }];
  activate(s);
  act(s, "p1", { type: "power", value: "Marvelous Strength", target: "car" });
  assert.equal(action(s).speed, "M");
  act(s, "p1", { type: "throw-terrain", angle: 180 });
  assert.equal(s.terrain.length, 0);
  attack(s, target, 1, "physical", dice());
  assert.equal(action(s).speed, "S");
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(target.x, 14.25);
  assert.equal(rogue.power, 0);
  assert.equal(s.actionsLeft, 1);
});

test("Mutant Absorption rolls five dice, converts excess successes to damage without giving Power", () => {
  const s = trial([
    ["p1", "rogue", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [rogue, target] = s.fighters;
  target.power = 1;
  activate(s);
  act(
    s,
    "p1",
    { type: "power", value: "Mutant Absorption", target: target.id },
    dice(0, 1, 2, 5, 7),
  );
  assert.equal(target.power, 0);
  assert.equal(target.damage, 2);
  assert.equal(rogue.power, 1);
  assert.equal(s.actionsLeft, 2);
  assert.equal(
    s.log.find((e) => e.rolls?.[0].label === "Mutant Absorption").rolls[0].faces
      .length,
    5,
  );
});

test("Rogue reduces enemy damage, ignores Poison and can fly over tall terrain", () => {
  const s = trial([
    ["p1", "toad", 8],
    ["p2", "rogue", 11],
  ]);
  const [, rogue] = s.fighters;
  activate(s);
  attack(s, rogue, 0, "physical", dice(1, 2));
  assert.equal(rogue.damage, 1);
  assert.ok(!rogue.conditions?.includes("poison"));
  act(s, "p1", { type: "end" });
  s.terrain = [{ id: "wall", size: 5, x: 13, y: 0, w: 1, h: 36 }];
  act(s, "p2", { type: "activate", value: rogue.id });
  act(s, "p2", { type: "advance", x: 16, y: 8 });
  assert.equal(rogue.x, 16);
});
