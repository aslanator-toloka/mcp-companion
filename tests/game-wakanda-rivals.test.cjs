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
const attack = (s, target, index, damageType, random = dice()) => {
  act(
    s,
    s.fighters.find((f) => f.id === s.active).side,
    { type: "attack", target: target.id, index, damageType },
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

test("Knobkerrie offers Pursuit on a Wild and then a Push on a Critical before damage", () => {
  const s = trial([
    ["p1", "mbaku", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [mbaku, hawkeye] = s.fighters;
  activate(s);
  attack(s, hawkeye, 0, "physical", dice(1, 0));
  const first = actions(s)[0];
  assert.equal(first.mode, "advance");
  assert.equal(first.mover, mbaku.id);
  act(s, "p1", { type: "skip-effect" });
  const second = actions(s)[0];
  assert.equal(second.mode, "push");
  assert.equal(second.mover, hawkeye.id);
});

test("Wrath of the Jabari: Avalanche advances then grants Knobkerrie against a different enemy", () => {
  const s = trial([
    ["p1", "mbaku", 8],
    ["p2", "hawkeye", 10.5],
    ["p2", "hulk", 13],
  ]);
  const [mbaku, hawkeye, hulk] = s.fighters;
  mbaku.power = 4;
  activate(s);
  attack(s, hawkeye, 1, "physical", dice(1, 2));
  if (actions(s)[0]?.mode === "throw") act(s, "p1", { type: "skip-effect" });
  const kinds = s.effects.map((e) => e.type + ":" + (e.mode || e.kind));
  assert.ok(kinds.includes("displace:advance"), kinds.join());
  assert.ok(kinds.includes("bonus-attack:avalanche"));
  act(s, "p1", { type: "skip-effect" });
  const follow = actions(s).find((a) => a.type === "attack");
  const knob = follow.attacks.find((a) => a.name === "Knobkerrie");
  assert.ok(!knob.targets.some((t) => t.value === hawkeye.id));
  void hulk;
});

test("Chieftain of the Jabari ignores Pushes from small physical attackers; Solid Frame ignores character collisions", () => {
  const s = trial([
    ["p1", "black-panther", 8],
    ["p2", "mbaku", 10.5],
  ]);
  const [, mbaku] = s.fighters;
  activate(s);
  attack(s, mbaku, 0, "physical");
  assert.ok(!s.effects.some((e) => e.mover === mbaku.id));
  combat.condition(mbaku, "stun");
  assert.deepEqual(mbaku.conditions || [], []);
});

test("Blessed by Ghekre turns one die to a Hit once per Turn on a Wild", () => {
  const s = trial([
    ["p1", "okoye", 8],
    ["p1", "mbaku", 4],
    ["p2", "hulk", 10.5],
  ]);
  const [okoye, mbaku, hulk] = s.fighters;
  s.leaders.p1 = mbaku.slug + ":Blessed by Ghekre";
  activate(s, okoye);
  act(
    s,
    "p1",
    { type: "attack", target: hulk.id, index: 0, damageType: "physical" },
    dice(1),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice(1));
  const labels = [];
  while (actions(s)[0]?.type === "modify-dice") {
    const option = actions(s)[0];
    labels.push(option.label);
    if (option.label === "Blessed by Ghekre")
      act(s, "p1", { type: "modify-dice", indices: [option.eligible[0]] });
    else act(s, "p1", { type: "skip-effect" });
  }
  assert.ok(labels.includes("Blessed by Ghekre"));
  assert.equal(
    lastAttack(s, "Strike").rolled.filter((d) => d === "hit").length,
    1,
  );
  assert.ok(s.leadershipUses.p1.includes("ghekre-dice"));
});

test("Black Ops Strike Places Killmonger by the defender on damage; Focused on the Kill adds 2 dice on a repeat target", () => {
  const s = trial([
    ["p1", "killmonger", 8],
    ["p2", "hulk", 10.5],
  ]);
  const [killmonger, hulk] = s.fighters;
  killmonger.power = 3;
  activate(s);
  attack(s, hulk, 0, "energy", dice(2));
  assert.equal(lastAttack(s, "Vibranium Weapons").rolled.length, 5);
  hulk.x = 13;
  attack(s, hulk, 1, "physical", dice(2, 2));
  assert.equal(lastAttack(s, "Black Ops Strike").rolled.length, 9);
  const place = actions(s)[0];
  assert.equal(place.mode, "place");
  assert.equal(place.mover, killmonger.id);
});

test("Special Forces counts Blocks; Kill Count tokens grant rerolls", () => {
  const s = trial([
    ["p1", "killmonger", 8],
    ["p2", "hawkeye", 10.5],
  ]);
  const [killmonger, hawkeye] = s.fighters;
  hawkeye.damage = 4;
  activate(s);
  attack(s, hawkeye, 0, "energy", dice(4, 4, 4, 7, 7));
  assert.ok(s.log.some((e) => e.text?.startsWith("Special Forces")));
  assert.ok(hawkeye.dazed);
  assert.equal(killmonger.killCount, 1);
});

test("Vibranium Spear rerolls close and Pulls a distant small defender", () => {
  const near = trial([
    ["p1", "king-tchalla", 8],
    ["p2", "hulk", 10.5],
  ]);
  activate(near);
  act(
    near,
    "p1",
    {
      type: "attack",
      target: near.fighters[1].id,
      index: 0,
      damageType: "energy",
    },
    dice(),
  );
  while (near.pendingAttack)
    act(near, "p2", { type: "reaction", value: "skip" }, dice());
  assert.equal(actions(near)[0].label, "Vibranium Spear");

  const far = trial([
    ["p1", "king-tchalla", 8],
    ["p2", "hawkeye", 13],
  ]);
  activate(far);
  attack(far, far.fighters[1], 0, "energy");
  const pull = actions(far)[0];
  assert.equal(pull.mode, "push");
  assert.equal(pull.direction, "toward");
});

test("Bound Places T’Challa and arms rerolls for his next Vibranium Spear", () => {
  const s = trial([
    ["p1", "king-tchalla", 8],
    ["p2", "hawkeye", 14],
  ]);
  const [king, hawkeye] = s.fighters;
  activate(s);
  act(s, "p1", { type: "power", value: "Bound", x: 10, y: 8 });
  assert.ok(king.bound);
  act(
    s,
    "p1",
    { type: "attack", target: hawkeye.id, index: 0, damageType: "energy" },
    dice(),
  );
  while (s.pendingAttack)
    act(s, "p2", { type: "reaction", value: "skip" }, dice());
  const labels = [];
  while (actions(s)[0]?.type === "modify-dice") {
    labels.push(actions(s)[0].label);
    act(s, "p1", { type: "skip-effect" });
  }
  assert.ok(labels.includes("Bound"), labels.join());
  assert.ok(!king.bound);
});

test("Royal Rebuke counters an attacker in range 3; Defender of Wakanda pays once per Turn", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "king-tchalla", 10.5],
    ["p2", "okoye", 14],
  ]);
  const [hawkeye, king, okoye] = s.fighters;
  combat.damage(s, okoye, 1, hawkeye);
  combat.damage(s, okoye, 1, hawkeye);
  assert.equal(king.power, 4);
  activate(s);
  attack(s, king, 0, "physical");
  const option = actions(s, "p2")[0];
  assert.equal(option.type, "counter-strike");
  assert.match(option.label, /Counter-Strike|Royal Rebuke/);
});

test("Strength of the Ancestors damages an enemy Pushed into terrain once per Turn", () => {
  const s = trial([
    ["p1", "black-panther", 8],
    ["p1", "king-tchalla", 4],
    ["p2", "hawkeye", 10.5],
  ]);
  const [panther, king, hawkeye] = s.fighters;
  s.leaders.p1 = king.slug + ":Strength of the Ancestors";
  s.terrain = [{ id: "wall", size: 3, x: 12, y: 7, w: 0.5, h: 2 }];
  activate(s, panther);
  attack(s, hawkeye, 0, "physical");
  const before = hawkeye.damage || 0;
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(hawkeye.damage, before + 1);
});

test("M’Baku, Killmonger and King T’Challa fit in a saved Wakanda roster", () => {
  const preset = pool.presets[0];
  const newcomers = ["mbaku", "killmonger", "king-tchalla"];
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
