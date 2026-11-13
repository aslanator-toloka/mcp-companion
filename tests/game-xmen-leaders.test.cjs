const test = require("node:test");
const assert = require("node:assert/strict");
const { act, create, view } = require("../game/engine.cjs");
const { pool } = require("../game/catalog.cjs");
const { trial } = require("./helpers/game.cjs");

const dice =
  (...rolls) =>
  () =>
    rolls.shift() ?? 7;
const activate = (s, fighter = s.fighters[0]) =>
  act(s, fighter.side, { type: "activate", value: fighter.id });
const options = (s, side = "p1") => view(s, side).actions[side];
const hit = (s, target, index = 0, damageType = "energy", random = dice()) =>
  act(
    s,
    "p1",
    { type: "attack", target: target.id, index, damageType },
    random,
  );

test("Optic Blast pushes before damage and Speed of Sight gives one additional attack on a different target", () => {
  const s = trial([
    ["p1", "cyclops", 8],
    ["p2", "hawkeye", 11],
    ["p2", "pyro", 12],
  ]);
  const [, original, other] = s.fighters;
  other.y = 11;
  activate(s);
  hit(s, original, 0, "energy", dice(1, 2));
  assert.equal(options(s)[0].mode, "push");
  assert.equal(original.damage || 0, 0);
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(original.damage, 2);
  assert.deepEqual(
    options(s)[0].attacks[0].targets.map((t) => t.value),
    [other.id],
  );
  hit(s, other, 0, "energy", dice(1, 2));
  assert.equal(options(s)[0].mode, "push");
  act(s, "p1", { type: "skip-effect" });
  assert.equal(s.actionsLeft, 1);
  assert.ok(!s.effects.length);
});

test("Optic Devastation removes Power gained from the attack after damage", () => {
  const s = trial([
    ["p1", "cyclops", 8],
    ["p2", "pyro", 12],
  ]);
  s.fighters[0].power = 4;
  const [, target] = s.fighters;
  target.power = 0;
  activate(s);
  act(
    s,
    "p1",
    { type: "attack", index: 1, angle: 0, damageType: "energy" },
    dice(1, 1),
  );
  assert.equal(target.damage, 2);
  assert.equal(target.power, 0);
});

test("Field Leader Advances each chosen ally once, and Hit and Run grants an attack then a move", () => {
  const s = trial([
    ["p1", "cyclops", 8],
    ["p1", "beast", 11],
    ["p2", "pyro", 15],
  ]);
  const [cyclops, ally, enemy] = s.fighters;
  cyclops.power = 8;
  activate(s);
  act(s, "p1", { type: "power", value: "Field Leader", target: ally.id });
  act(s, "p1", { type: "displace", x: 11, y: 11 });
  assert.ok(
    !options(s)
      .find((a) => a.type === "power")
      .powers.some((p) => p.value === "Field Leader"),
  );
  act(s, "p1", { type: "power", value: "Hit and Run" });
  assert.equal(options(s)[0].type, "attack");
  hit(s, enemy);
  assert.equal(options(s)[0].type, "granted-move");
  act(s, "p1", { type: "granted-move", x: 9, y: 8 });
  assert.equal(cyclops.x, 9);
  assert.equal(cyclops.power, 3);
  assert.equal(s.actionsLeft, 1);
});

test("Quick Draw uses five defense dice and retaliates only when no damage was taken", () => {
  for (const damage of [0, 1]) {
    const s = trial([
      ["p1", "hawkeye", 8],
      ["p2", "cyclops", 14],
    ]);
    const [hawkeye, cyclops] = s.fighters;
    activate(s);
    hit(s, cyclops, 0, "physical");
    act(
      s,
      "p2",
      { type: "reaction", value: "quick-draw" },
      dice(...(damage ? [2] : [])),
    );
    const result = s.log.find((e) => e.attack === "Arrow Shot");
    assert.equal(result.defense.length, 5);
    assert.equal(cyclops.damage || 0, damage);
    assert.equal(hawkeye.damage || 0, damage ? 0 : 2);
  }
});

test("X-Men Blue grants Power to another ally after damage and only once per recipient per turn", () => {
  const s = trial([
    ["p1", "cyclops", 8],
    ["p1", "beast", 11],
    ["p2", "pyro", 14],
  ]);
  const [cyclops, ally, enemy] = s.fighters;
  s.leaders.p1 = cyclops.slug + ":X-Men Blue";
  activate(s);
  hit(s, enemy, 0, "energy", dice(2));
  assert.deepEqual(
    options(s)[0].options.map((t) => t.value),
    [ally.id],
  );
  act(s, "p1", { type: "xmen-blue", value: ally.id });
  hit(s, enemy, 0, "energy", dice(2));
  assert.ok(!options(s).some((a) => a.type === "xmen-blue"));
  assert.equal(ally.power, 4);
});

test("Eye of the Storm adds two dice to every Ice Blizzard target, which only Stuns on damage", () => {
  const s = trial([
    ["p1", "storm", 8],
    ["p2", "hawkeye", 12],
    ["p2", "pyro", 14],
  ]);
  const [, hawkeye, pyro] = s.fighters;
  hawkeye.power = 0;
  activate(s);
  act(s, "p1", { type: "power", value: "Eye of the Storm" });
  act(
    s,
    "p1",
    { type: "attack", index: 1, angle: 0, damageType: "physical" },
    dice(),
  );
  act(s, "p1", { type: "volley-target", value: hawkeye.id }, dice(2));
  assert.deepEqual(
    s.log
      .filter((e) => e.attack === "Ice Blizzard")
      .map((e) => e.rolled.length),
    [6, 6],
  );
  assert.ok(hawkeye.conditions.includes("stun"));
  assert.ok(!pyro.conditions?.includes("stun"));
  hit(s, pyro, 0, "energy", dice(1));
  assert.equal(s.log.at(-1).rolled.length, 4);
  assert.ok(pyro.conditions.includes("shock"));
});

test("Hurricane ignores LOS, leaves allies alone, and deals additional damage to Flight after all targets", () => {
  const s = trial([
    ["p1", "storm", 8],
    ["p1", "exodus", 10],
    ["p2", "invincible-iron-man", 11],
    ["p2", "pyro", 11],
  ]);
  const [storm, ally, iron, pyro] = s.fighters;
  ally.y = 11;
  pyro.y = 10;
  storm.power = 4;
  iron.power = 0;
  s.terrain = [{ id: "wall", size: 5, x: 9, y: 0, w: 1, h: 36 }];
  activate(s);
  act(s, "p1", { type: "attack", index: 2, damageType: "physical" }, dice());
  assert.deepEqual(
    options(s)[0].options.map((o) => o.value),
    [iron.id, pyro.id],
  );
  act(s, "p1", { type: "volley-target", value: pyro.id }, dice());
  assert.equal(iron.damage, 1);
  assert.equal(ally.damage || 0, 0);
  assert.equal(pyro.damage || 0, 0);
});

test("Goddess of Storms forbids targets beyond Range 3 and X-Men Gold rerolls an ally's defense die", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "storm", 16],
    ["p2", "pyro", 14],
  ]);
  const [, storm, pyro] = s.fighters;
  s.leaders.p2 = storm.slug + ":X-Men Gold";
  activate(s);
  const attack = options(s).find((a) => a.type === "attack").attacks[0];
  assert.deepEqual(
    attack.targets.map((t) => t.value),
    [pyro.id],
  );
  hit(s, pyro, 0, "physical", dice(2));
  assert.equal(options(s, "p2")[0].label, "X-Men Gold");
  act(s, "p2", { type: "modify-dice", indices: [0] }, () => 4);
  assert.equal(pyro.damage || 0, 0);
  assert.equal(pyro.power, 3);
});

test("X-Men Gold places a non-carrier next to a nearby ally only once per round", () => {
  const s = trial([
    ["p1", "storm", 8],
    ["p1", "cyclops", 12],
    ["p2", "pyro", 18],
  ]);
  const [storm, cyclops, enemy] = s.fighters;
  s.leaders.p1 = storm.slug + ":X-Men Gold";
  s.objectives = [
    {
      id: "hammer",
      role: "extract",
      name: "Celestial Hammer",
      holder: storm.id,
    },
  ];
  activate(s);
  assert.ok(!options(s).some((a) => a.type === "xmen-gold"));
  s.objectives = [];
  act(s, "p1", { type: "xmen-gold", value: cyclops.id });
  act(s, "p1", { type: "displace", x: 10.25, y: 8 });
  assert.equal(storm.power, 2);
  act(s, "p1", { type: "end" });
  activate(s, enemy);
  act(s, "p2", { type: "end" });
  activate(s, cyclops);
  assert.ok(!options(s).some((a) => a.type === "xmen-gold"));
});

test("Tempest throws Size 2 terrain Short; Storm flies over tall terrain and ignores Shock", () => {
  const s = trial([
    ["p1", "storm", 8],
    ["p2", "pyro", 19],
  ]);
  const [storm] = s.fighters;
  const { condition } = require("../game/combat.cjs");
  s.terrain = [
    { id: "car", name: "Car", size: 2, x: 8, y: 10, w: 1, h: 1 },
    { id: "wall", size: 5, x: 10, y: 0, w: 1, h: 36 },
  ];
  condition(storm, "shock");
  assert.ok(!storm.conditions?.includes("shock"));
  activate(s);
  act(s, "p1", { type: "power", value: "Tempest", target: "car" });
  assert.equal(options(s)[0].speed, "S");
  act(s, "p1", { type: "throw-terrain", angle: 180 });
  act(s, "p1", { type: "advance", x: 13, y: 8 });
  assert.equal(storm.x, 13);
});

test("all four new X-Men fit in a saved Game roster and unlock both leadership choices", () => {
  const preset = pool.presets[0];
  const newcomers = ["beast", "wolverine", "cyclops", "storm"];
  const s = create(
    {
      p1: {
        ...preset,
        characters: [...newcomers, ...preset.characters.slice(0, 6)],
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
    affiliation: "Uncanny X-Men",
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
  s.phase = "leadership";
  assert.deepEqual(
    options(s)[0].options.map((o) => o.label),
    ["X-Men Blue", "X-Men Gold", "Без Leadership"],
  );
});
