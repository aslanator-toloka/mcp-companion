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
const attack = (s, target, random, index = 0, damageType = "physical") =>
  act(
    s,
    "p1",
    { type: "attack", target: target.id, damageType, index },
    random,
  );

test("Speedster drops held extracts before a Long Advance without spending an action", () => {
  const s = trial([
    ["p1", "quicksilver", 8],
    ["p2", "hawkeye", 20],
  ]);
  const [pietro] = s.fighters;
  pietro.power = 6;
  s.objectives = ["a", "b"].map((id) => ({
    id,
    holder: pietro.id,
    radius: 0.5,
    role: "extract",
  }));
  activate(s);
  act(s, "p1", { type: "power", value: "Speedster" });
  assert.equal(view(s, "p2").actions.p2[0].type, "drop-objective");
  assert.equal(pietro.x, 8);
  assert.deepEqual(
    s.objectives.map((o) => o.holder),
    [null, null],
  );
  act(s, "p2", { type: "drop-objective", x: 9, y: 8 });
  act(s, "p2", { type: "drop-objective", x: 8, y: 9 });
  assert.equal(view(s, "p1").actions.p1[0].speed, "L");
  act(s, "p1", { type: "displace", x: 15, y: 8 });
  assert.equal(pietro.x, 15);
  assert.equal(pietro.power, 4);
  assert.equal(s.actionsLeft, 2);
  assert.throws(
    () => act(s, "p1", { type: "power", value: "Speedster" }),
    /недоступн/,
  );
});

test("Dash and Velocity can resolve in either order, and Velocity can chain to the prior target", () => {
  const s = trial([
    ["p1", "quicksilver", 8],
    ["p2", "hawkeye", 12],
    ["p2", "hulk", 12],
  ]);
  const [, hawkeye, hulk] = s.fighters;
  hulk.y = 11;
  hulk.power = 0;
  hawkeye.power = 0;
  activate(s);
  attack(s, hawkeye, dice(0, 4, 1, 2));
  assert.deepEqual(
    view(s, "p1").actions.p1[0].options.map((o) => o.label),
    ["Dash первым", "Velocity первым"],
  );
  act(s, "p1", { type: "strike-order", value: "0" });
  act(s, "p1", { type: "displace", x: 9, y: 8 });
  assert.deepEqual(
    view(s, "p1").actions.p1[0].attacks[0].targets.map((t) => t.value),
    [hulk.id],
  );
  attack(s, hulk, dice(1, 2));
  assert.deepEqual(
    view(s, "p1").actions.p1[0].attacks[0].targets.map((t) => t.value),
    [hawkeye.id],
  );
  attack(s, hawkeye, dice());
  assert.equal(s.actionsLeft, 1);
});

test("Cyclonic Vortex grants a Medium Advance after resolving the attack", () => {
  const s = trial([
    ["p1", "quicksilver", 8],
    ["p2", "hulk", 12],
  ]);
  const [pietro, hulk] = s.fighters;
  hulk.power = 0;
  activate(s);
  attack(s, hulk, dice(), 1);
  assert.equal(view(s, "p1").actions.p1[0].speed, "M");
  act(s, "p1", { type: "displace", x: 8, y: 13 });
  assert.equal(pietro.y, 13);
  assert.equal(pietro.power, 1);
  assert.equal(s.actionsLeft, 1);
});

test("Can’t Catch Me avoids an out-of-range paid attack and preserves the attacker’s Power", () => {
  const s = trial([
    ["p1", "scarlet-witch", 8],
    ["p2", "quicksilver", 15],
  ]);
  const [witch, pietro] = s.fighters;
  witch.power = 6;
  activate(s);
  attack(s, pietro, dice(), 1, "mystic");
  act(s, "p2", { type: "reaction", value: "cant-catch-me" });
  act(s, "p2", { type: "displace", x: 18, y: 8 }, dice());
  assert.equal(witch.power, 6);
  assert.equal(s.actionsLeft, 2);
  assert.equal(pietro.power, 0);
  assert.ok(!s.log.some((e) => e.attack === "Cruel Twist"));
  pietro.x = 15;
  pietro.power = 3;
  attack(s, pietro, dice(), 1, "mystic");
  assert.equal(s.pendingAttack, null);
  assert.equal(witch.power, 0);
});

test("Can’t Catch Me cancels just its beam target, leaving other targets and the cost", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "quicksilver", 12],
    ["p2", "hawkeye", 14],
  ]);
  const [, pietro, hawkeye] = s.fighters;
  hawkeye.power = 0;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", index: 1, angle: 0, damageType: "energy" },
    dice(),
  );
  act(s, "p1", { type: "volley-target", value: pietro.id }, dice());
  act(s, "p2", { type: "reaction", value: "cant-catch-me" });
  act(s, "p2", { type: "displace", x: 12, y: 11 }, dice());
  assert.equal(s.actionsLeft, 1);
  assert.equal(s.fighters[0].power, 0);
  assert.deepEqual(
    s.log.filter((e) => e.attack === "Thunder Clap").map((e) => e.target),
    [hawkeye.id],
  );
});

test("Supersonic Reflexes rerolls selected defense and dodge dice", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "quicksilver", 12],
  ]);
  const [, pietro] = s.fighters;
  pietro.power = 0;
  activate(s);
  attack(s, pietro, dice(2, 2));
  const defense = view(s, "p2").actions.p2[0];
  assert.equal(defense.label, "Supersonic Reflexes");
  act(s, "p2", { type: "modify-dice", indices: [0, 1] }, () => 4);
  assert.equal(s.log.at(-1).dealt, 0);
  s.terrain = [
    { id: "truck", name: "Truck", size: 4, x: 8, y: 10, w: 2, h: 2 },
  ];
  act(s, "p1", {
    type: "power",
    value: "Strongest One There Is",
    target: "truck",
  });
  act(s, "p1", { type: "throw-terrain", angle: 0 }, dice(5));
  const dodge = view(s, "p2").actions.p2[0];
  assert.equal(dodge.label, "Supersonic Reflexes · Уклонение");
  assert.ok(!dodge.eligible.includes(0));
  act(
    s,
    "p2",
    { type: "modify-dice", indices: dodge.eligible.slice(0, 2) },
    () => 4,
  );
  assert.equal(pietro.damage, 1);
});

test("Can’t Catch Me resolves Kill Box first and grants no extra action when it KOs Quicksilver", () => {
  const s = trial([
    ["p1", "winter-soldier-operative", 8],
    ["p2", "quicksilver", 13],
    ["p2", "hulk", 22],
  ]);
  const [, pietro] = s.fighters;
  pietro.injured = true;
  pietro.damage = 5;
  s.terrain = [{ id: "car", name: "Car", size: 2, x: 14, y: 10, w: 2, h: 2 }];
  activate(s);
  attack(s, pietro, dice());
  act(s, "p2", { type: "reaction", value: "cant-catch-me" });
  act(s, "p2", { type: "displace", x: 14.5, y: 8 });
  assert.equal(view(s, "p1").actions.p1[0].type, "kill-box");
  act(s, "p1", { type: "kill-box", value: "car" }, dice());
  act(s, "p2", { type: "skip-effect" }, dice());
  assert.equal(pietro.ko, true);
  assert.equal(s.actionsLeft, 1);
  assert.ok(!s.log.some((e) => e.attack === "Spec Ops Rifle"));
});

test("Wall Crawler lets Quicksilver Advance through Size 5 terrain", () => {
  const s = trial([
    ["p1", "quicksilver", 8],
    ["p2", "hawkeye", 20],
  ]);
  s.terrain = [{ id: "wall", name: "Wall", size: 5, x: 10, y: 0, w: 1, h: 36 }];
  activate(s);
  act(s, "p1", { type: "advance", x: 14, y: 8 });
  assert.equal(s.fighters[0].x, 14);
});
