const test = require("node:test");
const assert = require("node:assert/strict");
const { act, view } = require("../game/engine.cjs");
const { condition } = require("../game/combat.cjs");
const { trial } = require("./helpers/game.cjs");

const dice =
  (...rolls) =>
  () =>
    rolls.shift() ?? 7;
const activate = (s) =>
  act(s, "p1", { type: "activate", value: s.fighters[0].id });
const actions = (s, side = "p1") => view(s, side).actions[side];
const attack = (s, target, index = 0, random = dice()) =>
  act(
    s,
    "p1",
    { type: "attack", target: target.id, index, damageType: "physical" },
    random,
  );

test("Acrobatic Strike places Beast after damage; his Wall Crawler lets him cross Size 5 terrain", () => {
  const s = trial([
    ["p1", "beast", 8],
    ["p2", "hawkeye", 14],
  ]);
  const [beast, target] = s.fighters;
  activate(s);
  attack(s, target, 0, dice(1));
  assert.equal(target.damage, 1);
  act(s, "p1", { type: "displace", x: 12, y: 8 });
  s.terrain = [{ id: "wall", size: 5, x: 13, y: 10, w: 1, h: 2 }];
  act(s, "p1", { type: "advance", x: 15, y: 12 });
  assert.equal(beast.x, 15);
  assert.equal(beast.power, 4);
});

test("Animalistic Freestyle pushes before damage, applies Bleed and grants Medium Advance", () => {
  const s = trial([
    ["p1", "beast", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [beast, target] = s.fighters;
  beast.power = 4;
  activate(s);
  attack(s, target, 1, dice(1));
  assert.equal(actions(s)[0].direction, "away");
  assert.equal(target.damage || 0, 0);
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(target.damage, 1);
  assert.deepEqual(target.conditions, ["bleed"]);
  assert.equal(actions(s)[0].speed, "M");
  act(s, "p1", { type: "displace", x: 12.5, y: 8 });
  assert.equal(beast.x, 12.5);
});

test("Adamantium Skeleton prevents Beast’s Size 2 throw from targeting Wolverine", () => {
  const s = trial([
    ["p1", "beast", 8],
    ["p2", "wolverine", 11],
    ["p2", "hawkeye", 11],
  ]);
  const [, wolverine, hawkeye] = s.fighters;
  hawkeye.y = 10;
  activate(s);
  const power = actions(s)
    .find((a) => a.type === "power")
    .powers.find((p) => p.value === "Baser Instincts");
  assert.deepEqual(
    power.targets.map((t) => t.value),
    [hawkeye.id],
  );
  act(s, "p1", { type: "power", value: "Baser Instincts", target: hawkeye.id });
  assert.equal(actions(s)[0].speed, "S");
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(hawkeye.x, 14.25);
  assert.equal(wolverine.x, 11);
});

test("Stars and Garters pays per rerolled defense die; Disconcerting gains Power once for multiple Failures", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "beast", 12],
  ]);
  const [, beast] = s.fighters;
  activate(s);
  attack(s, beast, 0, dice(2, 7, 7, 7, 7, 5, 5));
  const effect = actions(s, "p2")[0];
  assert.equal(effect.label, "Stars and Garters");
  assert.ok(!effect.eligible.includes(0));
  assert.ok(!effect.eligible.includes(1));
  act(s, "p2", { type: "modify-dice", indices: [effect.eligible[0]] }, () => 4);
  assert.equal(beast.damage || 0, 0);
  assert.equal(beast.power, 3);
  assert.ok(
    s.log.some((e) => e.text.includes("Disconcerting, Yet Provocative!")),
  );
});

test("Stars and Garters allows paid dodge rerolls including a die added by a critical", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "beast", 12],
  ]);
  const [, beast] = s.fighters;
  s.terrain = [{ id: "car", name: "Car", size: 3, x: 8, y: 10, w: 1, h: 1 }];
  activate(s);
  act(s, "p1", {
    type: "power",
    value: "Strongest One There Is",
    target: "car",
  });
  act(s, "p1", { type: "throw-terrain", angle: 0 }, dice(0));
  const effect = actions(s, "p2")[0];
  assert.equal(effect.label, "Stars and Garters · Уклонение");
  const last = effect.dice.length - 1;
  act(s, "p2", { type: "modify-dice", indices: [1, last] }, () => 4);
  assert.equal(beast.damage || 0, 0);
  assert.equal(beast.power, 1);
});

test("The Best At What I Do grants Move and Attack and doubles only the granted attack's Wild successes", () => {
  const s = trial([
    ["p1", "wolverine", 8],
    ["p2", "hawkeye", 13],
  ]);
  const [wolverine, target] = s.fighters;
  activate(s);
  act(s, "p1", { type: "power", value: "The Best At What I Do . . ." });
  act(s, "p1", { type: "granted-move", x: 10, y: 8 });
  attack(s, target, 0, dice(1));
  assert.equal(s.log.at(-1).rollSummary.attackHits, 2);
  assert.deepEqual(target.conditions, ["bleed"]);
  attack(s, target, 0, dice(1));
  assert.equal(s.log.at(-1).rollSummary.attackHits, 1);
  assert.equal(wolverine.power, 4);
  assert.equal(s.actionsLeft, 0);
});

test("Berserker Barrage places before damage and can throw the damaged defender afterward", () => {
  const s = trial([
    ["p1", "wolverine", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [wolverine, target] = s.fighters;
  activate(s);
  attack(s, target, 1, dice(2));
  assert.equal(actions(s)[0].mode, "place");
  assert.equal(target.damage || 0, 0);
  act(s, "p1", { type: "displace", x: 10, y: 8 });
  assert.equal(wolverine.x, 10);
  assert.equal(target.damage, 1);
  assert.equal(actions(s)[0].mode, "throw");
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(target.x, 15.25);
});

test("injured Wolverine gains a die per damage, cannot Interact, ignores Stun and Stagger and heals two", () => {
  const s = trial([
    ["p1", "wolverine", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [wolverine, target] = s.fighters;
  wolverine.injured = true;
  wolverine.damage = 3;
  s.objectives = [
    { id: "book", name: "Spellbook", role: "extract", x: 8, y: 9, radius: 0.5 },
  ];
  condition(wolverine, "stun");
  condition(wolverine, "stagger");
  assert.deepEqual(wolverine.conditions || [], []);
  activate(s);
  assert.ok(!actions(s).some((a) => a.type === "interact"));
  attack(s, target, 0, dice());
  assert.equal(s.log.at(-1).rolled.length, 8);
  act(s, "p1", { type: "end" });
  assert.equal(wolverine.damage, 1);
});
