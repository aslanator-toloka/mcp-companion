const test = require("node:test");
const assert = require("node:assert/strict");
const { act, create, view } = require("../game/engine.cjs");
const { pool } = require("../game/catalog.cjs");
const { trial } = require("./helpers/game.cjs");

const dice =
  (...rolls) =>
  () =>
    rolls.shift() ?? 7;
const activate = (s) =>
  act(s, "p1", { type: "activate", value: s.fighters[0].id });
const options = (s, side = "p1") => view(s, side).actions[side];

test("Freeze and Fade resolves the attack before Ice Slide and permits a Size 5 Advance", () => {
  const s = trial([
    ["p1", "iceman", 8],
    ["p1", "hawkeye", 8],
    ["p2", "pyro", 8],
  ]);
  const [iceman, ally, target] = s.fighters;
  ally.y = 10;
  target.y = 14;
  s.terrain = [{ id: "wall", size: 5, x: 10, y: 0, w: 1, h: 36 }];
  activate(s);
  act(s, "p1", { type: "power", value: "Freeze and Fade" });
  assert.equal(iceman.power, 1);
  act(
    s,
    "p1",
    { type: "attack", index: 0, angle: 90, damageType: "energy" },
    dice(1),
  );
  assert.equal(iceman.power, 2);
  assert.ok(target.conditions.includes("slow"));
  assert.equal(options(s)[0].climbsOnAdvance, true);
  act(s, "p1", { type: "granted-move", x: 12, y: 8 });
  assert.equal(iceman.x, 8);
  act(s, "p1", { type: "move-reaction", value: "Ice Slide|" + ally.id });
  assert.equal(iceman.x, 12);
  assert.equal(options(s)[0].range, 2);
  act(s, "p1", { type: "displace", x: 8, y: 12 });
  assert.equal(ally.y, 12);
  assert.equal(iceman.power, 0);
  assert.equal(s.actionsLeft, 1);
});

test("Chill applies Stagger on a Wild", () => {
  const s = trial([
    ["p1", "iceman", 8],
    ["p2", "pyro", 12],
  ]);
  activate(s);
  act(
    s,
    "p1",
    {
      type: "attack",
      index: 1,
      target: s.fighters[1].id,
      damageType: "energy",
    },
    dice(1),
  );
  assert.deepEqual(s.fighters[1].conditions, ["stagger"]);
});

test("Cold Snap first Slows a nearby enemy, then damages it after its next attack action", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "iceman", 14],
  ]);
  const [hawkeye, iceman] = s.fighters;
  activate(s);
  act(s, "p1", { type: "advance", x: 11, y: 8 });
  assert.deepEqual(hawkeye.conditions, ["slow"]);
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: iceman.id, damageType: "physical" },
    dice(),
  );
  assert.equal(hawkeye.damage, 1);
  assert.equal(s.log.filter((e) => e.power === "Cold Snap").length, 2);
});

test("Cold Snap does not trigger after a granted Advance that is not a move action", () => {
  const s = trial([
    ["p1", "baron-helmut-zemo", 8],
    ["p2", "iceman", 14],
  ]);
  activate(s);
  act(s, "p1", { type: "power", value: "Quick Step", x: 11, y: 8 });
  assert.equal(s.fighters[0].x, 11);
  assert.ok(!s.fighters[0].conditions?.includes("slow"));
  assert.ok(!s.log.some((e) => e.power === "Cold Snap"));
});

test("Air Lift and Hostile Takeover choose targets before the same move and resolve after it", () => {
  const s = trial([
    ["p1", "angel", 8],
    ["p1", "hawkeye", 11],
    ["p2", "pyro", 8],
  ]);
  const [angel, ally, enemy] = s.fighters;
  angel.power = 5;
  enemy.y = 11;
  activate(s);
  act(s, "p1", { type: "advance", x: 10, y: 10 });
  assert.equal(angel.x, 8);
  assert.equal(options(s)[0].type, "move-reaction");
  act(s, "p1", { type: "move-reaction", value: "Air Lift|" + ally.id });
  assert.equal(angel.x, 8);
  act(s, "p1", {
    type: "move-reaction",
    value: "Hostile Takeover|" + enemy.id,
  });
  assert.equal(angel.x, 10);
  assert.equal(options(s)[0].mode, "place");
  act(s, "p1", { type: "displace", x: 13, y: 8 });
  assert.equal(ally.x, 13);
  assert.equal(options(s)[0].direction, "toward");
  act(s, "p1", {
    type: "displace",
    angle: (Math.atan2(-1, 2) * 180) / Math.PI,
  });
  assert.ok(enemy.x > 8 && enemy.y < 11);
  assert.equal(angel.power, 1);
  assert.equal(s.actionsLeft, 1);
});

test("Flyby places Angel beside the last target; Avenging Angel can throw and Stun", () => {
  const s = trial([
    ["p1", "angel", 8],
    ["p2", "hawkeye", 12],
    ["p2", "pyro", 14],
  ]);
  const [angel, first, last] = s.fighters;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", index: 0, angle: 0, damageType: "physical" },
    dice(),
  );
  act(s, "p1", { type: "volley-target", value: first.id }, dice());
  assert.equal(angel.power, 5);
  assert.equal(options(s)[0].reference.x, last.x);
  act(s, "p1", { type: "displace", x: 13, y: 10 });
  act(
    s,
    "p1",
    { type: "attack", index: 1, target: last.id, damageType: "physical" },
    dice(1),
  );
  assert.ok(last.conditions.includes("stun"));
  assert.equal(options(s)[0].mode, "throw");
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(last.x, 17.25);
});

test("Angel can fly over Size 5 terrain and his Healing Factor restores one damage", () => {
  const s = trial([
    ["p1", "angel", 8],
    ["p2", "pyro", 24],
  ]);
  const [angel] = s.fighters;
  angel.damage = 2;
  s.terrain = [{ id: "wall", size: 5, x: 10, y: 0, w: 1, h: 36 }];
  activate(s);
  act(s, "p1", { type: "advance", x: 13, y: 8 });
  assert.equal(angel.x, 13);
  act(s, "p1", { type: "end" });
  assert.equal(angel.damage, 1);
});

test("Iceman and Angel are available together in a saved Game roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["iceman", "angel"];
  const s = create(
    {
      p1: {
        ...preset,
        characters: [...newcomers, ...preset.characters.slice(0, 8)],
      },
      p2: "cabal",
    },
    1,
  );
  Object.assign(s, { phase: "squad", threat: 17, priority: "p1" });
  act(s, "p1", { type: "squad", characters: newcomers, tactics: [] });
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
