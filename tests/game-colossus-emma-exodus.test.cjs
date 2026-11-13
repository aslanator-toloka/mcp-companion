const test = require("node:test");
const assert = require("node:assert/strict");
const { act, view } = require("../game/engine.cjs");
const { trial } = require("./helpers/game.cjs");

const dice =
  (...rolls) =>
  () =>
    rolls.shift() ?? 7;
const options = (s, side = "p1") => view(s, side).actions[side];
const activate = (s, fighter = s.fighters[0]) =>
  act(s, fighter.side, { type: "activate", value: fighter.id });
const attack = (
  s,
  target,
  index = 0,
  damageType = "physical",
  random = dice(),
) =>
  act(
    s,
    "p1",
    { type: "attack", target: target.id, index, damageType },
    random,
  );
const terrain = (id, size) => ({ id, name: id, x: 8, y: 10, w: 1, h: 1, size });

test("Big Brother redirects a close attack and the healthy Colossus can then use Bozhe Moi", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "colossus", 11],
    ["p2", "gambit", 14],
  ]);
  const [, colossus, gambit] = s.fighters;
  colossus.power = 5;
  activate(s);
  attack(s, gambit);
  act(s, "p2", { type: "reaction", value: "big-brother:" + colossus.id });
  assert.equal(s.pendingAttack.target, colossus.id);
  act(s, "p2", { type: "reaction", value: "bozhe-moi" }, dice(2, 2));
  assert.equal(
    s.log.at(-1).defense.length,
    view(s, "p2").fighters[1].defenses.physical + 2,
  );
  assert.equal(colossus.damage, 1);
  assert.equal(gambit.damage || 0, 0);
});

test("Big Brother grants a Short Advance toward a distant attacker after the attack", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "colossus", 16],
    ["p2", "toad", 13],
  ]);
  const [, colossus, toad] = s.fighters;
  activate(s);
  attack(s, toad);
  act(
    s,
    "p2",
    { type: "reaction", value: "big-brother:" + colossus.id },
    dice(),
  );
  assert.equal(s.log.at(-1).target, toad.id);
  assert.equal(options(s, "p2")[0].direction, "toward");
  act(s, "p2", { type: "displace", x: 14, y: 10 });
  assert.equal(colossus.x, 14);
});

test("Organic Steel stops enemy Push and Bleed immunity works; injured Bozhe Moi counts Blank defense", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "colossus", 12],
  ]);
  const [, colossus] = s.fighters;
  colossus.injured = true;
  activate(s);
  attack(s, colossus, 0, "physical", dice(1, 2, 2));
  assert.ok(!options(s).some((a) => a.type === "displace"));
  assert.equal(
    s.log.at(-1).rollSummary.defenseHits,
    view(s, "p2").fighters[1].defenses.physical,
  );
  const { condition } = require("../game/combat.cjs");
  condition(colossus, "bleed");
  assert.ok(!colossus.conditions?.includes("bleed"));
});

test("Playing Catch throws terrain; X-Slam throws before applying damage and adds Stun", () => {
  const s = trial([
    ["p1", "colossus", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [colossus, target] = s.fighters;
  colossus.power = 5;
  s.terrain = [terrain("car", 3)];
  activate(s);
  act(s, "p1", { type: "power", value: "Playing Catch", target: "car" });
  assert.equal(options(s)[0].speed, "M");
  act(s, "p1", { type: "throw-terrain", angle: 180 });
  attack(s, target, 1, "physical", dice(1));
  assert.equal(options(s)[0].mode, "throw");
  assert.equal(target.damage || 0, 0);
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(target.damage, 1);
  assert.deepEqual(target.conditions, ["stun"]);
});

test("Telekinetic Shield adds two dice to a nearby ally once per turn", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "exodus", 14],
    ["p2", "gambit", 12],
  ]);
  const [, exodus, gambit] = s.fighters;
  exodus.power = 6;
  activate(s);
  attack(s, gambit);
  act(
    s,
    "p2",
    { type: "reaction", value: "telekinetic-shield:" + exodus.id },
    dice(),
  );
  assert.equal(s.log.at(-1).defense.length, 5);
  act(s, "p2", { type: "skip-effect" });
  attack(s, gambit);
  assert.equal(s.log.at(-1).defense.length, 3);
  assert.equal(exodus.power, 4);
});

test("Exodus chooses Power for My Faith Can Move Mountains and Teleportation places him", () => {
  const s = trial([
    ["p1", "exodus", 8],
    ["p2", "hawkeye", 21],
  ]);
  const [exodus] = s.fighters;
  exodus.power = 8;
  s.terrain = [terrain("car", 3)];
  activate(s);
  assert.throws(
    () =>
      act(s, "p1", {
        type: "power",
        value: "My Faith Can Move Mountains",
        target: "car",
        amount: 2,
      }),
    /Power/,
  );
  act(s, "p1", {
    type: "power",
    value: "My Faith Can Move Mountains",
    target: "car",
    amount: 4,
  });
  assert.equal(exodus.power, 4);
  assert.equal(options(s)[0].speed, "M");
  act(s, "p1", { type: "throw-terrain", angle: 180 });
  act(s, "p1", { type: "power", value: "Teleportation", x: 11, y: 8 });
  assert.equal(exodus.x, 11);
  assert.equal(exodus.power, 1);
});

test("Psionic Vampirism saps Power and heals, Exodus also heals at turn end and gains extra Power next round", () => {
  const s = trial([
    ["p1", "exodus", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [exodus, target] = s.fighters;
  exodus.damage = 3;
  activate(s);
  attack(s, target, 0, "mystic", dice(1, 2));
  assert.equal(exodus.damage, 2);
  assert.equal(exodus.power, 6);
  act(s, "p1", { type: "end" });
  assert.equal(exodus.damage, 1);
  activate(s, target);
  act(s, "p2", { type: "end" });
  assert.equal(exodus.power, 8);
});

test("Diamond Form transforms before defense and Psychic Immunity counts Blank against Mystic", () => {
  const s = trial([
    ["p1", "red-skull-master-of-the-world", 8],
    ["p2", "emma-frost", 12],
  ]);
  const [, emma] = s.fighters;
  activate(s);
  attack(s, emma, 0, "mystic");
  act(s, "p2", { type: "reaction", value: "diamond-form" });
  assert.equal(options(s, "p2")[0].type, "transform");
  act(s, "p2", { type: "transform", x: 12, y: 9 }, dice());
  assert.equal(emma.form, 1);
  assert.equal(
    s.log.at(-1).rollSummary.defenseHits,
    view(s, "p2").fighters[1].defenses.mystic,
  );
});

test("Diamond Form can be chosen before a terrain dodge", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "emma-frost", 12],
  ]);
  const [, emma] = s.fighters;
  s.terrain = [terrain("car", 3)];
  activate(s);
  act(s, "p1", {
    type: "power",
    value: "Strongest One There Is",
    target: "car",
  });
  act(s, "p1", { type: "throw-terrain", angle: 0 });
  act(s, "p2", { type: "diamond-dodge" });
  act(s, "p2", { type: "transform", x: 12, y: 9 }, () => 4);
  assert.equal(emma.form, 1);
  assert.equal(emma.damage || 0, 0);
});

test("Far From My Best Look offers an early transformation for all Power and requires a late one if skipped", () => {
  for (const early of [true, false]) {
    const s = trial([
      ["p1", "emma-frost", 8],
      ["p2", "hawkeye", 18],
    ]);
    const [emma] = s.fighters;
    emma.form = 1;
    activate(s);
    if (early) {
      act(s, "p1", { type: "transform", x: 8, y: 9 });
      assert.equal(emma.power, 0);
    } else {
      act(s, "p1", { type: "skip-effect" });
      act(s, "p1", { type: "end" });
      assert.equal(options(s)[0].required, true);
      act(s, "p1", { type: "transform", x: 8, y: 9 });
      assert.equal(emma.power, 3);
      assert.equal(s.decisionSide, "p2");
    }
    assert.equal(emma.form, 0);
  }
});

test("Normal Emma’s Power Inhibition blocks enemy reactions and Telepathic Lash Advances after damage", () => {
  const s = trial([
    ["p1", "emma-frost", 8],
    ["p2", "juggernaut", 12],
    ["p2", "quicksilver", 14],
  ]);
  const [emma, juggernaut, quicksilver] = s.fighters;
  activate(s);
  act(
    s,
    "p1",
    { type: "power", value: "Telepathic Lash", target: juggernaut.id },
    dice(2, 2),
  );
  assert.equal(juggernaut.damage, 2);
  assert.ok(
    !options(s).some((a) => a.type === "displace"),
    "Helmet blocks the Advance",
  );
  attack(s, quicksilver, 0, "mystic", dice(1, 2));
  assert.equal(s.pendingAttack, null);
  act(s, "p1", { type: "displace", x: 15, y: 9 });
  assert.equal(quicksilver.x, 15);
  assert.equal(emma.form || 0, 0);
});

test("Shield Mind cancels an enemy superpower Advance of an ally", () => {
  const s = trial([
    ["p1", "ultron-metal-tyrant", 8],
    ["p2", "emma-frost", 15],
    ["p2", "hawkeye", 12],
  ]);
  const [, emma, target] = s.fighters;
  activate(s);
  act(s, "p1", { type: "power", value: "Encephalo-Beam", target: target.id });
  if (options(s).some((a) => a.type === "start-displacement"))
    act(s, "p1", { type: "start-displacement" });
  act(s, "p2", { type: "shield-mind", value: "shield:" + emma.id });
  assert.equal(target.x, 12);
  assert.equal(emma.power, 1);
});

test("Psionic Concussion Pulls after damage and You Can Do Nothing but Fall applies Incinerate", () => {
  const s = trial([
    ["p1", "exodus", 8],
    ["p2", "hulk", 14],
    ["p2", "hawkeye", 11],
  ]);
  const [exodus, hulk, hawkeye] = s.fighters;
  hulk.power = 0;
  hawkeye.y = 11;
  activate(s);
  attack(s, hulk, 1, "mystic", dice(1));
  assert.equal(options(s)[0].direction, "toward");
  act(s, "p1", { type: "displace", angle: 180 });
  assert.equal(hulk.x, 10.75);
  assert.equal(exodus.power, 4);
  act(s, "p1", { type: "attack", index: 2, damageType: "energy" }, dice());
  act(s, "p1", { type: "volley-target", value: hulk.id }, dice());
  assert.ok(hulk.conditions.includes("incinerate"));
  assert.ok(hawkeye.conditions.includes("incinerate"));
});

test("Hands Off Advances the defender Away at its speed and deals the Terrify damage first", () => {
  const s = trial([
    ["p1", "emma-frost", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [emma, target] = s.fighters;
  emma.power = 4;
  activate(s);
  attack(s, target, 1, "mystic", dice(1));
  assert.equal(options(s)[0].direction, "away");
  assert.equal(options(s)[0].speed, target.speed);
  assert.equal(target.damage || 0, 0);
  act(s, "p1", { type: "displace", x: 15, y: 8 });
  assert.equal(target.damage, 2);
});

test("Diamond Strike applies Pierce and Stun; Diamond Mind prevents tactic play", () => {
  const s = trial([
    ["p1", "emma-frost", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [emma, target] = s.fighters;
  emma.form = 1;
  s.squads.p1 = { tactics: ["heavy-firepower-ca10"] };
  activate(s);
  act(s, "p1", { type: "skip-effect" });
  assert.ok(!options(s).some((a) => a.type === "tactic"));
  attack(s, target, 0, "physical", dice(0, 1, 7, 7, 7, 7, 4));
  assert.equal(options(s)[0].label, "Pierce");
  act(s, "p1", { type: "modify-dice", indices: [0] });
  assert.ok(target.conditions.includes("stun"));
  assert.equal(emma.form, 1);
});

test("Shatter waits for all targets before offering the optional return to Normal", () => {
  const s = trial([
    ["p1", "emma-frost", 8],
    ["p2", "hawkeye", 11],
    ["p2", "pyro", 11],
  ]);
  const [emma, hawkeye, pyro] = s.fighters;
  emma.form = 1;
  emma.power = 5;
  pyro.y = 10;
  activate(s);
  act(s, "p1", { type: "skip-effect" });
  act(s, "p1", { type: "attack", index: 1, damageType: "physical" }, dice());
  assert.equal(options(s)[0].type, "volley-target");
  act(s, "p1", { type: "volley-target", value: hawkeye.id }, dice());
  assert.deepEqual(
    s.log.filter((e) => e.attack === "Shatter").map((e) => e.target),
    [hawkeye.id, pyro.id],
  );
  assert.equal(options(s)[0].type, "transform");
  act(s, "p1", { type: "transform", x: 8, y: 9 });
  assert.equal(emma.form, 0);
});

test("Diamond Emma can throw an enemy with Sometimes One Must Get Their Hands Dirty", () => {
  const s = trial([
    ["p1", "emma-frost", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [emma, target] = s.fighters;
  emma.form = 1;
  activate(s);
  act(s, "p1", { type: "skip-effect" });
  act(s, "p1", {
    type: "power",
    value: "Sometimes One Must Get Their Hands Dirty",
    target: target.id,
  });
  act(s, "p1", { type: "displace", angle: 0 });
  assert.equal(target.x, 17);
  assert.equal(emma.form, 1);
});
