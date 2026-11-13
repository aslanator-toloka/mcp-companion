const test = require("node:test");
const assert = require("node:assert/strict");
const { act, create, view } = require("../game/engine.cjs");
const { pool } = require("../game/catalog.cjs");
const { trial } = require("./helpers/game.cjs");

const activate = (s, fighter) =>
  act(s, fighter.side, { type: "activate", value: fighter.id });
const dice =
  (...rolls) =>
  () =>
    rolls.shift() ?? 7;
const attack = (s, target, damageType, random, index = 0) =>
  act(
    s,
    "p1",
    { type: "attack", target: target.id, damageType, index },
    random,
  );

test("Chosen of Chthon scores Failure in both attack and defense rolls", () => {
  const offense = trial([
    ["p1", "scarlet-witch", 8],
    ["p2", "hulk", 12],
  ]);
  const [witch, hulk] = offense.fighters;
  hulk.power = 0;
  activate(offense, witch);
  attack(offense, hulk, "mystic", dice(5, 7, 5));
  const hit = offense.log.at(-1);
  assert.equal(hit.rollSummary.attackHits, 2);
  assert.equal(hit.dealt, 2);

  const defense = trial([
    ["p1", "hawkeye", 8],
    ["p2", "scarlet-witch", 12],
  ]);
  const [hawkeye, defender] = defense.fighters;
  activate(defense, hawkeye);
  attack(defense, defender, "physical", dice(2, 2, 7, 7, 7, 5, 5));
  assert.equal(defense.log.at(-1).rollSummary.defenseHits, 2);
  assert.equal(defense.log.at(-1).dealt, 0);
});

test("Hex Bolt builds Power and Chaos Magic offers one choice per Failure", () => {
  const s = trial([
    ["p1", "scarlet-witch", 8],
    ["p2", "hulk", 12],
  ]);
  const [witch, hulk] = s.fighters;
  hulk.power = 0;
  activate(s, witch);
  attack(s, hulk, "mystic", dice(5, 5, 2));
  assert.equal(witch.power, 6);
  const choose = (value) => act(s, "p1", { type: "choose-condition", value });
  assert.throws(() => choose("slow"), /вариант/);
  choose("hex");
  choose("incinerate");
  assert.deepEqual(hulk.conditions, ["hex", "incinerate"]);
  assert.throws(() => choose("bleed"), /недоступно/);
});

test("Cruel Twist suppresses defense Criticals and Reality Contortion blanks one defense die", () => {
  const s = trial([
    ["p1", "scarlet-witch", 8],
    ["p2", "hulk", 12],
  ]);
  const [witch, hulk] = s.fighters;
  witch.power = 6;
  hulk.power = 0;
  activate(s, witch);
  attack(s, hulk, "mystic", dice(5, 2, 2, 7, 7, 7, 7, 7, 0, 4, 7), 1);
  const modifier = view(s, "p1").actions.p1[0];
  assert.equal(modifier.label, "Reality Contortion");
  assert.deepEqual(modifier.dice, ["critical", "block", "blank"]);
  assert.deepEqual(modifier.eligible, [0, 1]);
  assert.throws(() => act(s, "p1", { type: "skip-effect" }), /недоступно/);
  act(s, "p1", { type: "modify-dice", indices: [1] });
  assert.equal(s.log.at(-1).rollSummary.defenseHits, 0);
  assert.equal(s.log.at(-1).dealt, 3);
  assert.equal(witch.power, 0);
});

test("Telekinesis throws a Size 4 terrain feature Medium and Flight crosses Size 5 terrain", () => {
  const s = trial([
    ["p1", "scarlet-witch", 8],
    ["p2", "hawkeye", 18],
  ]);
  const [witch] = s.fighters;
  s.terrain = [
    { id: "tower", name: "Tower", x: 10, y: 0, w: 1, h: 36, size: 5 },
    { id: "truck", name: "Truck", x: 8, y: 10, w: 2, h: 2, size: 4 },
  ];
  activate(s, witch);
  const power = view(s, "p1").actions.p1.find((a) => a.type === "power")
    .powers[0];
  assert.deepEqual(
    power.targets.map((t) => t.value),
    ["truck"],
  );
  act(s, "p1", { type: "power", value: "Telekinesis", target: "truck" });
  assert.equal(view(s, "p1").actions.p1[0].speed, "M");
  act(s, "p1", { type: "throw-terrain", angle: 180 });
  assert.deepEqual(
    s.terrain.map((t) => t.id),
    ["tower"],
  );
  assert.equal(witch.power, 0);
  assert.equal(s.actionsLeft, 2);
  act(s, "p1", { type: "advance", x: 12, y: 8 });
  assert.equal(witch.x, 12);
});

test("Hex Field prevents shaking Hex, Judgment or Poison in range of a conscious enemy Witch", () => {
  for (const [x, dazed, choices] of [
    [12, false, ["bleed"]],
    [16, false, ["hex", "judgment", "poison", "bleed"]],
    [12, true, ["hex", "judgment", "poison", "bleed"]],
  ]) {
    const s = trial([
      ["p1", "hawkeye", 8],
      ["p2", "scarlet-witch", x],
    ]);
    const [actor, witch] = s.fighters;
    witch.dazed = dazed;
    actor.conditions = ["hex", "judgment", "poison", "bleed"];
    activate(s, actor);
    const shake = view(s, "p1").actions.p1.find((a) => a.type === "shake");
    assert.deepEqual(
      shake.options.map(({ value }) => value),
      choices,
    );
    if (!choices.includes("hex"))
      assert.throws(
        () => act(s, "p1", { type: "shake", value: "hex" }),
        /вариант/,
      );
    act(s, "p1", { type: "shake", value: "bleed" });
    assert.deepEqual(actor.conditions, ["hex", "judgment", "poison"]);
  }
});

test("Curse applies Judgment to the enemy that damaged Scarlet Witch with an attack", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "scarlet-witch", 12],
  ]);
  const [attacker, witch] = s.fighters;
  witch.power = 1;
  activate(s, attacker);
  attack(s, witch, "physical", dice(2));
  assert.equal(witch.damage, 1);
  assert.equal(view(s, "p2").actions.p2[0].type, "curse");
  act(s, "p2", { type: "curse" });
  assert.equal(witch.power, 0);
  assert.deepEqual(attacker.conditions, ["judgment"]);
  assert.equal(s.active, attacker.id);
});

test("Chosen of Chthon counts Failure in a dodge and Curse can answer a terrain throw", () => {
  for (const [roll, expectedDamage] of [
    [5, 0],
    [7, 3],
  ]) {
    const s = trial([
      ["p1", "hulk", 8],
      ["p2", "scarlet-witch", 13],
    ]);
    const [hulk, witch] = s.fighters;
    s.terrain = [
      { id: "truck", name: "Truck", x: 8, y: 10, w: 2, h: 2, size: 4 },
    ];
    activate(s, hulk);
    act(s, "p1", {
      type: "power",
      value: "Strongest One There Is",
      target: "truck",
    });
    act(s, "p1", { type: "throw-terrain", angle: 0 }, () => roll);
    assert.equal(witch.damage || 0, expectedDamage);
    const commands = view(s, "p2").actions.p2;
    if (!expectedDamage) {
      assert.deepEqual(commands, []);
      continue;
    }
    assert.equal(commands[0].type, "curse");
    act(s, "p2", { type: "curse" });
    assert.equal(witch.power, 4);
    assert.deepEqual(hulk.conditions, ["judgment"]);
  }
});

test("a saved Game roster can deploy Scarlet Witch without changing the built-in presets", () => {
  const avengers = pool.presets.find((roster) => roster.id === "avengers");
  const roster = {
    ...avengers,
    characters: avengers.characters.map((slug) =>
      slug === "doc-ock-sinister-scientist" ? "scarlet-witch" : slug,
    ),
  };
  const s = create({ p1: roster, p2: "cabal" }, 1);
  s.phase = "squad";
  s.threat = 17;
  s.priority = "p1";
  s.deployment = { p1: "south", p2: "north" };
  s.terrain = [];
  act(s, "p1", { type: "squad", characters: ["scarlet-witch"], tactics: [] });
  act(s, "p2", {
    type: "squad",
    characters: ["crossbones-merciless-merc"],
    tactics: [],
  });
  act(s, "p1", { type: "deploy", fighter: "p1:scarlet-witch", x: 9, y: 34 });
  const witch = view(s, "p1").fighters.find((f) => f.slug === "scarlet-witch");
  assert.equal(witch.x, 9);
  assert.equal(witch.hp, 7);
  assert.deepEqual(
    witch.attacks.map((a) => a.name),
    ["Hex Bolt", "Cruel Twist"],
  );
  assert.ok(avengers.characters.includes("doc-ock-sinister-scientist"));
});
