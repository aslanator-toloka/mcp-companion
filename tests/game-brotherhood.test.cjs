const test = require("node:test");
const assert = require("node:assert/strict");
const { act, view } = require("../game/engine.cjs");
const { trial } = require("./helpers/game.cjs");

const dice =
  (...rolls) =>
  () =>
    rolls.shift() ?? 7;
const activate = (s) =>
  act(s, "p1", { type: "activate", value: s.fighters[0].id });
const options = (s, side = "p1") => view(s, side).actions[side];
const hit = (s, target, index = 0, random = dice(), damageType = "physical") =>
  act(
    s,
    "p1",
    { type: "attack", target: target.id, damageType, index },
    random,
  );
const terrain = (id, x, y, size) => ({ id, name: id, x, y, size, w: 1, h: 1 });

test("Firewall gives Root and Slow; Fire Blast and Fire Manipulation spread Incinerate", () => {
  const s = trial([
    ["p1", "pyro", 8],
    ["p2", "hulk", 12],
    ["p2", "hawkeye", 12],
  ]);
  const [pyro, hulk, hawkeye] = s.fighters;
  hulk.power = 0;
  hawkeye.y = 11;
  activate(s);
  act(s, "p1", { type: "power", value: "Firewall", target: hulk.id });
  assert.deepEqual(hulk.conditions, ["root", "slow"]);
  assert.equal(pyro.power, 0);
  hit(s, hulk, 0, dice(1), "energy");
  assert.equal(pyro.power, 1);
  assert.ok(hulk.conditions.includes("incinerate"));
  act(s, "p1", { type: "fire-manipulation", value: hawkeye.id });
  assert.deepEqual(hawkeye.conditions, ["incinerate"]);
});

test("Stoke the Flames buffs every Flame Jet target and then expires", () => {
  const s = trial([
    ["p1", "pyro", 8],
    ["p2", "hulk", 12],
    ["p2", "hawkeye", 14],
  ]);
  const [pyro, hulk] = s.fighters;
  hulk.power = 0;
  activate(s);
  act(s, "p1", { type: "power", value: "Stoke the Flames" });
  act(
    s,
    "p1",
    { type: "attack", index: 1, angle: 0, damageType: "energy" },
    dice(),
  );
  act(s, "p1", { type: "volley-target", value: hulk.id }, dice());
  const beam = s.log.filter((e) => e.attack === "Flame Jet");
  assert.deepEqual(
    beam.map((e) => e.rolled.length),
    [6, 6],
  );
  assert.equal(pyro.power, 3);
  hit(s, hulk, 0, dice(), "energy");
  assert.equal(s.log.at(-1).rolled.length, 5);
});

test("Inferno Incinerates the defender without a Wild and damages nearby enemies", () => {
  const s = trial([
    ["p1", "pyro", 8],
    ["p2", "hulk", 12],
    ["p2", "hawkeye", 12],
  ]);
  const [pyro, hulk, hawkeye] = s.fighters;
  hulk.power = 0;
  hawkeye.y = 11;
  activate(s);
  hit(s, hulk, 2, dice(), "energy");
  assert.equal(hawkeye.damage, 1);
  assert.deepEqual(hulk.conditions, ["incinerate"]);
  assert.equal(pyro.power, 0);
});

test("Blob’s Strike pushes Size 3 or smaller after damage; Catch Little Man throws terrain Medium", () => {
  const s = trial([
    ["p1", "the-blob", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [blob, hawkeye] = s.fighters;
  s.terrain = [terrain("car", 8, 10, 3)];
  activate(s);
  act(s, "p1", { type: "power", value: "Catch Little Man!", target: "car" });
  assert.equal(options(s)[0].speed, "M");
  act(s, "p1", { type: "throw-terrain", angle: 180 });
  assert.equal(s.terrain.length, 0);
  hit(s, hawkeye, 0, dice(1));
  assert.equal(hawkeye.damage, 1);
  assert.equal(blob.power, 1);
  assert.equal(options(s)[0].mode, "push");
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(hawkeye.x, 14.25);
});

test("Thunderous Splash places Blob before damage and pushes characters around the landing point", () => {
  const s = trial([
    ["p1", "the-blob", 8],
    ["p2", "hawkeye", 12],
    ["p2", "pyro", 15],
  ]);
  const [blob, defender, nearby] = s.fighters;
  nearby.y = 10;
  activate(s);
  hit(s, defender, 1, dice(1, 2));
  assert.equal(options(s)[0].mode, "place");
  assert.equal(defender.damage || 0, 0);
  act(s, "p1", { type: "displace", x: 12, y: 10 }, dice());
  assert.equal(blob.y, 10);
  assert.equal(defender.damage, 2);
  assert.equal(options(s)[0].mode, "push");
  act(s, "p1", { type: "displace", angle: -90 });
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(defender.damage, 3);
  assert.equal(nearby.damage, 1);
});

test("Nothing Can Move The Blob prevents attack displacement and Tickles reduces damage to at least one", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "the-blob", 12],
  ]);
  const [hulk, blob] = s.fighters;
  activate(s);
  hit(s, blob, 0, dice(1));
  assert.match(options(s, "p2")[0].label, /That Tickles/);
  act(s, "p2", { type: "modify-dice", amount: 1 });
  assert.equal(blob.damage, 1);
  assert.equal(options(s, "p2")[0].mode, "push");
  act(s, "p2", { type: "displace", angle: 180 });
  assert.equal(blob.x, 12);
  assert.equal(hulk.x, 4.75);
});

test("Nothing Stops the Juggernaut removes Stagger, destroys small terrain and hurts a contact once", () => {
  const s = trial([
    ["p1", "juggernaut", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [juggernaut, target] = s.fighters;
  juggernaut.conditions = ["stagger"];
  juggernaut.power = 6;
  s.terrain = [terrain("car", 9.5, 7.5, 3)];
  activate(s);
  act(s, "p1", { type: "power", value: "Nothing Stops the Juggernaut!" });
  act(s, "p1", { type: "displace", angle: 0 });
  assert.deepEqual(juggernaut.conditions, []);
  assert.equal(s.terrain.length, 0);
  assert.ok(juggernaut.x > 9.5 && juggernaut.x < 12);
  assert.equal(target.damage, 1);
  assert.equal(s.actionsLeft, 2);
  act(s, "p1", { type: "power", value: "Nothing Stops the Juggernaut!" });
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(target.damage, 1);
  assert.equal(juggernaut.power, 0);
});

test("Unstoppable Momentum buffs only the next attack and Wild Rush grants a free Push", () => {
  const s = trial([
    ["p1", "juggernaut", 8],
    ["p2", "hawkeye", 13],
  ]);
  const [juggernaut, target] = s.fighters;
  activate(s);
  act(s, "p1", { type: "advance", x: 10, y: 8 });
  assert.equal(juggernaut.power, 5);
  hit(s, target, 1, dice(1));
  assert.equal(s.log.at(-1).rolled.length, 10);
  assert.equal(juggernaut.power, 1);
  assert.match(options(s)[0].name, /Nothing Stops/);
  act(s, "p1", { type: "displace", angle: 90 });
  assert.equal(juggernaut.y, 11.25);
  assert.equal(juggernaut.power, 1);
});

test("Nice Punch reduces attack damage and can separately prevent end-of-turn Bleed", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "juggernaut", 12],
  ]);
  const [, juggernaut] = s.fighters;
  activate(s);
  hit(s, juggernaut, 0, dice(2, 2));
  assert.equal(options(s, "p2")[0].label, "Nice Punch...");
  act(s, "p2", { type: "modify-dice", amount: 1 });
  assert.equal(juggernaut.damage, 1);
  act(s, "p1", { type: "end" });
  juggernaut.conditions = ["bleed"];
  act(s, "p2", { type: "activate", value: juggernaut.id });
  act(s, "p2", { type: "end" });
  assert.equal(options(s, "p2")[0].type, "nice-punch");
  assert.equal(s.round, 1);
  act(s, "p2", { type: "nice-punch" });
  assert.equal(juggernaut.damage, 1);
  assert.equal(s.round, 2);
});

test("Nice Punch resumes Cleanup and Cubes grant Power for actual damage after the decision", () => {
  const s = trial([
    ["p1", "juggernaut", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [juggernaut, hawkeye] = s.fighters;
  s.mission.extract = "struggle-for-the-cube-continues-ca09";
  s.objectives = ["a", "b"].map((id) => ({
    id,
    name: "Cosmic Cube",
    role: "extract",
    holder: juggernaut.id,
  }));
  activate(s);
  act(s, "p1", { type: "end" });
  act(s, "p2", { type: "activate", value: hawkeye.id });
  act(s, "p2", { type: "end" });
  assert.equal(s.round, 1);
  assert.equal(options(s)[0].type, "nice-punch");
  act(s, "p1", { type: "nice-punch" });
  assert.equal(juggernaut.damage, 1);
  assert.equal(juggernaut.power, 4);
  assert.equal(s.round, 2);
  assert.equal(s.score.p1, 2);
});

test("Helmet blocks enemy superpower Advance only on the healthy side", () => {
  for (const injured of [false, true]) {
    const s = trial([
      ["p1", "ultron-metal-tyrant", 8],
      ["p2", "juggernaut", 12],
    ]);
    const [, juggernaut] = s.fighters;
    juggernaut.injured = injured;
    activate(s);
    const powers = options(s).find((a) => a.type === "power")?.powers || [];
    assert.equal(
      powers.some((p) => p.value === "Encephalo-Beam"),
      injured,
    );
  }
});

test("Avatar of Cyttorak becomes available on Injured; Juggernaut is immune to Stun", () => {
  const s = trial([
    ["p1", "juggernaut", 8],
    ["p2", "the-black-widow", 12],
  ]);
  const [juggernaut, widow] = s.fighters;
  juggernaut.injured = true;
  juggernaut.power = 5;
  s.terrain = [terrain("car", 8, 10, 3)];
  activate(s);
  act(s, "p1", { type: "power", value: "Avatar of Cyttorak", target: "car" });
  assert.equal(options(s)[0].speed, "M");
  act(s, "p1", { type: "throw-terrain", angle: 180 });
  act(s, "p1", { type: "end" });
  act(s, "p2", { type: "activate", value: widow.id });
  act(
    s,
    "p2",
    { type: "attack", target: juggernaut.id, index: 1, damageType: "energy" },
    dice(1),
  );
  assert.ok(!juggernaut.conditions?.includes("stun"));
});

test("when a Juggernaut Push contacts two fighters at once, its controller chooses who takes damage", () => {
  const s = trial([
    ["p1", "juggernaut", 8],
    ["p2", "hawkeye", 12],
    ["p2", "pyro", 12],
  ]);
  const [, hawkeye, pyro] = s.fighters;
  hawkeye.y = 7;
  pyro.y = 9;
  activate(s);
  act(s, "p1", { type: "power", value: "Nothing Stops the Juggernaut!" });
  act(s, "p1", { type: "displace", angle: 0 });
  assert.deepEqual(
    options(s)[0].options.map((option) => option.value),
    [hawkeye.id, pyro.id],
  );
  act(s, "p1", { type: "juggernaut-contact", value: pyro.id });
  assert.equal(hawkeye.damage || 0, 0);
  assert.equal(pyro.damage, 1);
});

test("Blob does not push with Tickles when he is Dazed by the attack", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "the-blob", 12],
  ]);
  const [, blob] = s.fighters;
  blob.damage = view(s, "p2").fighters[1].maxHp - 1;
  activate(s);
  hit(s, blob, 0, dice(2));
  act(s, "p2", { type: "modify-dice", amount: 1 });
  assert.equal(blob.dazed, true);
  assert.ok(!options(s, "p2").some((a) => a.type === "displace"));
});

test("Pyro, Blob and Juggernaut enter a saved Game roster and can deploy together", () => {
  const { create } = require("../game/engine.cjs");
  const { pool } = require("../game/catalog.cjs");
  const preset = pool.presets[0];
  const newcomers = ["pyro", "the-blob", "juggernaut"];
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
  act(s, "p1", { type: "squad", characters: newcomers, tactics: [] });
  act(s, "p2", {
    type: "squad",
    characters: ["crossbones-merciless-merc"],
    tactics: [],
  });
  act(s, "p1", { type: "deploy", fighter: "p1:juggernaut", x: 8, y: 34 });
  assert.deepEqual(
    view(s, "p1")
      .fighters.filter((f) => f.side === "p1")
      .map((f) => f.slug),
    newcomers,
  );
});
