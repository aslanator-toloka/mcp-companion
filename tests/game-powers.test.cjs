const test = require("node:test");
const assert = require("node:assert/strict");
const { act, view } = require("../game/engine.cjs");
const { condition } = require("../game/combat.cjs");
const { trial } = require("./helpers/game.cjs");

test("Hulk drops his extract when Dazed and is KO’d during Cleanup", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "hulk", 12],
  ]);
  const [hawkeye, hulk] = s.fighters;
  hulk.damage = 18;
  hulk.power = 0;
  s.objectives = [
    {
      id: "spellbook",
      name: "Spellbook",
      role: "extract",
      radius: 0.5,
      holder: hulk.id,
    },
  ];

  act(s, "p1", { type: "activate", value: hawkeye.id });
  act(
    s,
    "p1",
    {
      type: "attack",
      index: 0,
      target: hulk.id,
      damageType: "physical",
    },
    () => 2,
  );
  assert.equal(hulk.dazed, true);
  assert.equal(hulk.ko, false);
  assert.equal(hulk.x, 12);
  assert.equal(s.objectives[0].holder, null);
  assert.equal(view(s, "p1").actions.p1[0].type, "drop-objective");
  act(s, "p1", { type: "drop-objective", x: 14, y: 8 });
  assert.equal(hulk.dazed, true);
  assert.equal(s.phase, "activation");

  act(s, "p1", { type: "end" });
  assert.equal(hulk.dazed, false);
  assert.equal(hulk.ko, true);
  assert.equal(hulk.x, null);
  assert.equal(hulk.y, null);
  assert.equal(s.phase, "finished");
  assert.equal(s.winner, "p1");
  assert.ok(
    s.log.some(
      (entry) =>
        entry.fighter === hulk.id && entry.text === "Hulk · KO в Cleanup",
    ),
  );
});

test("Gamma Leap pays four Power, places Hulk within Range 2 and is limited to once per turn", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "hawkeye", 19],
  ]);
  const [hulk] = s.fighters;
  hulk.power = 8;
  act(s, "p1", { type: "activate", value: hulk.id });
  act(s, "p1", { type: "power", value: "Gamma Leap", x: 13, y: 8 });
  assert.equal(hulk.x, 13);
  assert.equal(hulk.power, 4);
  assert.equal(s.actionsLeft, 2);
  assert.throws(() =>
    act(s, "p1", { type: "power", value: "Gamma Leap", x: 14, y: 8 }),
  );
});

test("Strongest One There Is throws Size 4 terrain Long and leaves both actions", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "hawkeye", 15.5],
  ]);
  const [hulk, hawkeye] = s.fighters;
  s.terrain = [
    { id: "car", name: "Car", size: 4, x: 8, y: 10, w: 2, h: 2 },
    { id: "tower", name: "Tower", size: 5, x: 8, y: 4, w: 2, h: 2 },
  ];
  act(s, "p1", { type: "activate", value: hulk.id });
  const power = view(s, "p1")
    .actions.p1.find((a) => a.type === "power")
    .powers.find((p) => p.value === "Strongest One There Is");
  assert.deepEqual(
    power.targets.map((target) => target.value),
    ["car"],
  );
  act(s, "p1", { type: "power", value: power.value, target: "car" });
  act(s, "p1", { type: "throw-terrain", angle: 0 }, () => 7);
  assert.deepEqual(
    s.terrain.map((piece) => piece.id),
    ["tower"],
  );
  assert.equal(hawkeye.damage, 3);
  assert.equal(hulk.power, 1);
  assert.equal(s.actionsLeft, 2);
});

test("Hulk Not Puny Banner rerolls Failures on physical and energy defenses, but not mystic", () => {
  for (const damageType of ["physical", "energy", "mystic"]) {
    const attacker =
      damageType === "mystic" ? "red-skull-master-of-the-world" : "hawkeye";
    const s = trial([
      ["p1", attacker, 8],
      ["p2", "hulk", 12],
    ]);
    const [actor, hulk] = s.fighters;
    hulk.power = 8;
    act(s, "p1", { type: "activate", value: actor.id });
    act(
      s,
      "p1",
      { type: "attack", index: 0, target: hulk.id, damageType },
      () => 5,
    );
    const modifier = view(s, "p2").actions.p2.find(
      (a) => a.type === "modify-dice",
    );
    if (damageType === "mystic") {
      assert.equal(modifier, undefined);
      assert.equal(hulk.power, 8);
      continue;
    }
    assert.equal(modifier.label, "Hulk Not Puny Banner");
    assert.ok(modifier.dice.every((die) => die === "failure"));
    assert.equal(modifier.eligible.length, modifier.dice.length);
    act(s, "p2", { type: "modify-dice", indices: modifier.eligible }, () => 4);
    assert.deepEqual(
      s.log.at(-1).defense,
      modifier.dice.map(() => "block"),
    );
    assert.equal(hulk.power, 4);
    assert.throws(() => act(s, "p2", { type: "modify-dice", indices: [0] }));
  }
});

test("Inner Rage adds two Power above the normal Power Phase gain", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [hulk, hawkeye] = s.fighters;
  act(s, "p1", { type: "activate", value: hulk.id });
  act(s, "p1", { type: "end" });
  act(s, "p2", { type: "activate", value: hawkeye.id });
  act(s, "p2", { type: "end" });
  assert.equal(s.round, 2);
  assert.equal(hulk.power, 6);
  assert.equal(hawkeye.power, 4);
});

test("You Won’t Like Me When I’m Angry adds one attack die per complete four damage", () => {
  for (const [damage, dice] of [
    [3, 7],
    [4, 8],
    [7, 8],
    [8, 9],
  ]) {
    const s = trial([
      ["p1", "hulk", 8],
      ["p2", "hawkeye", 12],
    ]);
    const [hulk, hawkeye] = s.fighters;
    hulk.damage = damage;
    act(s, "p1", { type: "activate", value: hulk.id });
    act(
      s,
      "p1",
      { type: "attack", index: 0, target: hawkeye.id, damageType: "physical" },
      () => 7,
    );
    assert.equal(s.log.at(-1).rolled.length, dice);
  }
});

test("Hulk ignores Stun and Poison while accepting other conditions from the same attacks", () => {
  const s = trial([
    ["p1", "mystique", 8],
    ["p1", "doc-ock-sinister-scientist", 8],
    ["p2", "hulk", 12],
    ["p2", "hawkeye", 18],
  ]);
  const [mystique, ock, hulk, hawkeye] = s.fighters;
  ock.y = 10;
  ock.power = 10;
  hulk.power = 0;
  act(s, "p1", { type: "activate", value: mystique.id });
  act(
    s,
    "p1",
    { type: "attack", index: 1, target: hulk.id, damageType: "physical" },
    () => 7,
  );
  assert.ok(!hulk.conditions?.includes("stun"));
  act(s, "p1", { type: "end" });
  act(s, "p2", { type: "activate", value: hawkeye.id });
  act(s, "p2", { type: "end" });
  act(s, "p1", { type: "activate", value: ock.id });
  act(
    s,
    "p1",
    { type: "attack", index: 2, target: hulk.id, damageType: "physical" },
    () => 2,
  );
  assert.deepEqual(hulk.conditions?.sort(), ["bleed", "shock"]);
});

for (const [slug, form, immunities] of [
  ["captain-marvel-cosmic-avenger", 0, ["incinerate", "poison"]],
  [
    "captain-marvel-cosmic-avenger",
    1,
    ["incinerate", "poison", "stagger", "stun"],
  ],
  ["vision", 0, ["bleed", "poison"]],
  ["ultron-metal-tyrant", 0, ["bleed", "poison"]],
  ["ultron-drones-grunts", 0, ["bleed", "poison"]],
]) {
  test(slug + " form " + form + " rejects its listed Immunities", () => {
    const [fighter] = trial([["p1", slug, 8]]).fighters;
    fighter.form = form;
    for (const name of [...immunities, "root"]) condition(fighter, name);
    assert.deepEqual(fighter.conditions, ["root"]);
  });
}

for (const [slug, name, x] of [
  ["spectacular-spider-man", "Web-Slinger", 14],
  ["baron-helmut-zemo", "Quick Step", 14],
]) {
  test(
    name + " repositions the fighter for two Power without consuming an action",
    () => {
      const s = trial([
        ["p1", slug, 8],
        ["p2", "hawkeye", 20],
      ]);
      const [actor] = s.fighters;
      actor.power = 4;
      act(s, "p1", { type: "activate", value: actor.id });
      act(s, "p1", { type: "power", value: name, x, y: 8 });
      assert.equal(actor.x, x);
      assert.equal(actor.power, 2);
      assert.equal(s.actionsLeft, 2);
      assert.throws(() =>
        act(s, "p1", { type: "power", value: name, x: x + 1, y: 8 }),
      );
    },
  );
}

for (const [slug, name, cost, speed, targetKind] of [
  [
    "captain-marvel-cosmic-avenger",
    "I‘m Just Getting Warmed Up",
    2,
    "M",
    "fighter",
  ],
  ["doc-ock-sinister-scientist", "Ock‘s Grasp", 3, "S", "fighter"],
  ["red-skull-master-of-the-world", "Reshape the World", 3, "M", "terrain"],
  [
    "spectacular-spider-man",
    "Proportionate Strength of a Spider",
    3,
    "S",
    "fighter",
  ],
  ["ultron-metal-tyrant", "Kinetic Field Generator", 3, "M", "terrain"],
  ["vision", "Calculated Trajectory", 2, "M", "fighter"],
]) {
  test(
    name + " spends Power and resolves a throw with the card's ruler",
    () => {
      const s = trial([
        ["p1", slug, 8],
        ["p2", "hawkeye", 11.5],
      ]);
      const [actor, target] = s.fighters;
      actor.power = 8;
      if (slug === "captain-marvel-cosmic-avenger") actor.form = 1;
      s.terrain = [
        { id: "car", name: "Car", x: 8, y: 10, w: 2, h: 2, size: 3 },
      ];
      act(s, "p1", { type: "activate", value: actor.id });
      act(s, "p1", {
        type: "power",
        value: name,
        target: targetKind === "terrain" ? "car" : target.id,
      });
      const effect = view(s, "p1").actions.p1[0];
      assert.equal(effect.speed, speed);
      assert.equal(effect.mode, "throw");
      act(s, "p1", { type: effect.type, angle: 0 }, () => 7);
      if (targetKind === "terrain") {
        assert.equal(s.terrain.length, 0);
        assert.equal(target.damage, 3);
      } else {
        assert.equal(target.x, 11.5 + (speed === "S" ? 3.25 : 5));
      }
      assert.equal(actor.power, 8 - cost);
      assert.equal(s.actionsLeft, 2);
    },
  );
}

for (const [slug, name, cost, mode, x] of [
  ["ultron-metal-tyrant", "Encephalo-Beam", 2, "advance", 15],
  ["mister-sinister", "Such Fun Little Playthings", 2, "advance", 15],
  [
    "red-skull-master-of-the-world",
    "Nothing is Beyond My Reach",
    4,
    "place",
    18,
  ],
]) {
  test(
    name + " repositions the chosen character without moving its user",
    () => {
      const s = trial([
        ["p1", slug, 8],
        ["p2", "hawkeye", 12],
      ]);
      const [actor, target] = s.fighters;
      actor.power = 6;
      act(s, "p1", { type: "activate", value: actor.id });
      act(s, "p1", { type: "power", value: name, target: target.id });
      assert.equal(view(s, "p1").actions.p1[0].mode, mode);
      act(s, "p1", { type: "displace", x, y: 8 });
      assert.equal(target.x, x);
      assert.equal(actor.x, 8);
      assert.equal(actor.power, 6 - cost);
      assert.equal(s.actionsLeft, 2);
    },
  );
}

test("Trick Shot opens a blocked Arrow Shot and expires after the attack", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "mystique", 15],
  ]);
  const [actor, target] = s.fighters;
  s.terrain = [{ id: "wall", name: "Wall", x: 11, y: 0, w: 1, h: 36, size: 4 }];
  act(s, "p1", { type: "activate", value: actor.id });
  const canAttack = () =>
    view(s, "p1").actions.p1.some((a) => a.type === "attack");
  assert.equal(canAttack(), false);
  act(s, "p1", { type: "power", value: "Trick Shot" });
  assert.equal(canAttack(), true);
  assert.equal(actor.power, 2);
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: target.id, damageType: "physical" },
    () => 7,
  );
  assert.equal(canAttack(), false);
});

test("No Mercy adds at most three dice to the next attack against a damaged target", () => {
  const s = trial([
    ["p1", "sabretooth", 8],
    ["p2", "hulk", 12],
  ]);
  const [actor, target] = s.fighters;
  target.damage = 5;
  target.power = 0;
  act(s, "p1", { type: "activate", value: actor.id });
  act(s, "p1", { type: "power", value: "No Mercy" });
  assert.equal(actor.power, 0);
  const attack = {
    type: "attack",
    index: 0,
    target: target.id,
    damageType: "physical",
  };
  act(s, "p1", attack, () => 7);
  assert.equal(s.log.at(-1).rolled.length, 8);
  act(s, "p1", attack, () => 7);
  assert.equal(s.log.at(-1).rolled.length, 5);
});

test("Synthesis trades one action for two Power", () => {
  const s = trial([
    ["p1", "vision", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [vision] = s.fighters;
  act(s, "p1", { type: "activate", value: vision.id });
  act(s, "p1", { type: "power", value: "Synthesis" });
  assert.equal(vision.power, 5);
  assert.equal(s.actionsLeft, 1);
});

test("Engineered Perfection removes one condition for each Genetic Sample spent", () => {
  const s = trial([
    ["p1", "mister-sinister", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [sinister] = s.fighters;
  sinister.samples = 2;
  sinister.conditions = ["bleed", "slow", "shock"];
  act(s, "p1", { type: "activate", value: sinister.id });
  act(s, "p1", {
    type: "power",
    value: "Engineered Perfection",
    target: "bleed",
  });
  act(s, "p1", { type: "purge", value: "slow" });
  assert.deepEqual(sinister.conditions, ["shock"]);
  assert.equal(sinister.samples, 0);
  assert.equal(s.actionsLeft, 2);
});

test("Genetic Negation spends one Genetic Sample and gives Root to its target", () => {
  const s = trial([
    ["p1", "mister-sinister", 8],
    ["p2", "hawkeye", 12],
  ]);
  const [sinister, target] = s.fighters;
  act(s, "p1", { type: "activate", value: sinister.id });
  act(s, "p1", { type: "power", value: "Genetic Negation", target: target.id });
  assert.deepEqual(target.conditions, ["root"]);
  assert.equal(sinister.samples, 0);
  assert.equal(sinister.power, 2);
});

test("Expert Sabotage damages enemies beside the destroyed terrain for one action", () => {
  const s = trial([
    ["p1", "mystique", 8],
    ["p2", "hawkeye", 13],
  ]);
  const [actor, target] = s.fighters;
  s.terrain = [{ id: "car", name: "Car", x: 11, y: 8, w: 1, h: 2, size: 3 }];
  act(s, "p1", { type: "activate", value: actor.id });
  act(s, "p1", { type: "power", value: "Expert Sabotage", target: "car" });
  assert.equal(target.damage, 2);
  assert.equal(s.terrain.length, 0);
  assert.equal(actor.power, 0);
  assert.equal(s.actionsLeft, 1);
});

for (const [slug, name, cost, first, second] of [
  [
    "captain-marvel-cosmic-avenger",
    "Ready or Not . . .",
    0,
    "granted-move",
    "attack",
  ],
  ["crossbones-merciless-merc", "Hit and Run", 2, "attack", "granted-move"],
]) {
  test(
    name + " grants a move and an attack in card order for one action",
    () => {
      const s = trial([
        ["p1", slug, 8],
        ["p2", "hawkeye", 12],
      ]);
      const [actor, target] = s.fighters;
      if (slug === "captain-marvel-cosmic-avenger") actor.form = 1;
      actor.power = 6;
      act(s, "p1", { type: "activate", value: actor.id });
      act(s, "p1", { type: "power", value: name });
      assert.equal(actor.power, 6 - cost);
      const actOn = (kind) => {
        assert.equal(view(s, "p1").actions.p1[0].type, kind);
        if (kind === "granted-move") act(s, "p1", { type: kind, x: 9, y: 8 });
        else
          act(
            s,
            "p1",
            {
              type: kind,
              index: 0,
              angle: 0,
              target: target.id,
              damageType: "energy",
            },
            () => 7,
          );
      };
      actOn(first);
      actOn(second);
      assert.equal(actor.x, 9);
      assert.ok(
        s.log.some((entry) => entry.attack && entry.target === target.id),
      );
      assert.equal(s.actionsLeft, 1);
    },
  );
}

test("Fast Draw resolves Hawkeye’s reaction attack before the triggering attack", () => {
  const s = trial([
    ["p1", "captain-marvel-cosmic-avenger", 8],
    ["p2", "hawkeye", 16],
  ]);
  const [attacker, hawkeye] = s.fighters;
  act(s, "p1", { type: "activate", value: attacker.id });
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: hawkeye.id, damageType: "energy" },
    () => 7,
  );
  act(s, "p2", { type: "reaction", value: "fast-draw:physical" }, () => 7);
  assert.deepEqual(
    s.log.filter((entry) => entry.attack).map((entry) => entry.fighter),
    [hawkeye.id, attacker.id],
  );
  assert.equal(hawkeye.power, 2);
  assert.equal(s.actionsLeft, 1);
});

test("J.A.R.V.I.S. spends one of Iron Man’s Power per allied attack die rerolled", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p1", "invincible-iron-man", 11],
    ["p2", "hulk", 15],
  ]);
  const [attacker, iron, hulk] = s.fighters;
  hulk.power = 0;
  act(s, "p1", { type: "activate", value: attacker.id });
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: hulk.id, damageType: "physical" },
    () => 7,
  );
  assert.equal(view(s, "p1").actions.p1[0].label, "J.A.R.V.I.S.");
  act(s, "p1", { type: "modify-dice", indices: [0, 2] }, () => 2);
  assert.equal(iron.power, 1);
  assert.deepEqual(s.log.at(-1).rolled, [
    "hit",
    "blank",
    "hit",
    "blank",
    "blank",
  ]);
});

test("Molecular Regeneration spends Genetic Samples to reduce incoming damage", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "mister-sinister", 12],
  ]);
  const [attacker, sinister] = s.fighters;
  sinister.samples = 2;
  act(s, "p1", { type: "activate", value: attacker.id });
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: sinister.id, damageType: "physical" },
    () => 2,
  );
  assert.equal(view(s, "p2").actions.p2[0].label, "Molecular Regeneration");
  act(s, "p2", { type: "modify-dice", amount: 2 });
  assert.equal(sinister.samples, 0);
  assert.equal(sinister.damage, 3);
});

test("Rapid Phase changes the defense dice before the roll", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "vision", 12],
  ]);
  const [attacker, vision] = s.fighters;
  vision.phasing = "phased";
  act(s, "p1", { type: "activate", value: attacker.id });
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: vision.id, damageType: "physical" },
    () => 7,
  );
  act(s, "p2", { type: "reaction", value: "density" }, () => 7);
  assert.equal(vision.phasing, "density");
  assert.equal(vision.power, 1);
  assert.equal(
    s.log.at(-1).defense.length,
    view(s, "p2").fighters[1].defenses.physical + 3,
  );
});

test("I Don’t Need a Powerup to Kick Your Butt offers Normal form after spending down to three Power", () => {
  const s = trial([
    ["p1", "captain-marvel-cosmic-avenger", 8],
    ["p2", "hawkeye", 11.5],
  ]);
  const [carol, target] = s.fighters;
  carol.form = 1;
  carol.power = 5;
  act(s, "p1", { type: "activate", value: carol.id });
  act(s, "p1", {
    type: "power",
    value: "I‘m Just Getting Warmed Up",
    target: target.id,
  });
  act(s, "p1", { type: "displace", angle: 0 }, () => 7);
  assert.equal(carol.power, 3);
  assert.equal(view(s, "p1").actions.p1[0].type, "transform");
  act(s, "p1", { type: "transform", x: 8, y: 9 });
  assert.equal(carol.form, 0);
  assert.equal(view(s, "p1").fighters[0].attacks[0].name, "Photon Blast");
});

test("Untamed Force buys one Claw Slash counterattack per turn", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "sabretooth", 11],
  ]);
  const [attacker, sabretooth] = s.fighters;
  sabretooth.power = 6;
  act(s, "p1", { type: "activate", value: attacker.id });
  const attack = {
    type: "attack",
    index: 0,
    target: sabretooth.id,
    damageType: "physical",
  };
  act(s, "p1", attack, () => 7);
  act(s, "p2", { type: "untamed" }, () => 7);
  assert.equal(sabretooth.power, 4);
  assert.equal(s.log.at(-1).attack, "Claw Slash");
  assert.equal(s.log.at(-1).target, attacker.id);
  act(s, "p1", attack, () => 7);
  assert.ok(!view(s, "p2").actions.p2.some((a) => a.type === "untamed"));
});

test("Kill Box destroys nearby terrain and gives the advancing enemy a dodge roll", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "winter-soldier-operative", 14],
  ]);
  const [attacker, soldier] = s.fighters;
  s.terrain = [{ id: "car", name: "Car", x: 10, y: 10, w: 2, h: 1, size: 3 }];
  act(s, "p1", { type: "activate", value: attacker.id });
  act(s, "p1", { type: "advance", x: 10, y: 8 });
  act(s, "p2", { type: "kill-box", value: "car" }, () => 7);
  assert.equal(attacker.damage, 3);
  assert.equal(soldier.power, 0);
  assert.equal(s.terrain.length, 0);
  assert.equal(s.actionsLeft, 1);
});

test("Rough Around the Edges damages a nearby enemy and gives Ultron Power when Drones are KO’d", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "ultron-drones-grunts", 11],
    ["p2", "ultron-metal-tyrant", 16],
  ]);
  const [attacker, drone, ultron] = s.fighters;
  drone.grunt = true;
  act(s, "p1", { type: "activate", value: attacker.id });
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: drone.id, damageType: "physical" },
    () => 2,
  );
  assert.equal(drone.ko, true);
  assert.equal(drone.x, null);
  assert.equal(attacker.damage, 1);
  assert.equal(ultron.power, 4);
});

for (const [ability, defender, x, expected] of [
  ["I Can Do This All Day", "captain-america-first-avenger", 16, 4],
  ["Martial Artist", "the-black-widow", 11, 4],
  ["Martial Artist", "the-black-widow", 14, 0],
]) {
  test(
    ability + " scores " + expected + " blank defenses at the tested distance",
    () => {
      const s = trial([
        ["p1", "hawkeye", 8],
        ["p2", defender, x],
      ]);
      const [attacker, target] = s.fighters;
      target.power = 0;
      if (defender === "captain-america-first-avenger") target.injured = true;
      act(s, "p1", { type: "activate", value: attacker.id });
      act(
        s,
        "p1",
        { type: "attack", index: 0, target: target.id, damageType: "physical" },
        () => 7,
      );
      assert.equal(s.log.at(-1).rollSummary.defenseHits, expected);
    },
  );
}

test("Metal Mind counts each Wild twice on mystic defense", () => {
  const s = trial([
    ["p1", "red-skull-master-of-the-world", 8],
    ["p2", "ultron-metal-tyrant", 12],
  ]);
  const [attacker, target] = s.fighters;
  const rolls = [2, 2, 2, 2, 2, 1, 1];
  act(s, "p1", { type: "activate", value: attacker.id });
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: target.id, damageType: "mystic" },
    () => rolls.shift() ?? 7,
  );
  assert.equal(s.log.at(-1).rollSummary.defenseHits, 4);
  assert.equal(target.damage, 1);
});

test("Enhanced Energy Absorption trades each defense Wild for an attacker blank and one Power", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "captain-marvel-cosmic-avenger", 12],
  ]);
  const [attacker, target] = s.fighters;
  const rolls = [2, 2, 2, 7, 7, 1, 1, 7, 7];
  act(s, "p1", { type: "activate", value: attacker.id });
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: target.id, damageType: "energy" },
    () => rolls.shift(),
  );
  assert.equal(view(s, "p2").actions.p2[0].label, "Enhanced Energy Absorption");
  act(s, "p2", { type: "modify-dice", indices: [0, 1] });
  assert.deepEqual(s.log.at(-1).rolled, [
    "blank",
    "blank",
    "hit",
    "blank",
    "blank",
  ]);
  assert.equal(target.power, 5);
  assert.equal(s.log.at(-1).dealt, 0);
});

test("You Call That A Punch? gives Captain Marvel an extra Power after enemy damage", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "captain-marvel-cosmic-avenger", 12],
  ]);
  const [attacker, target] = s.fighters;
  const rolls = [2, 2];
  act(s, "p1", { type: "activate", value: attacker.id });
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: target.id, damageType: "physical" },
    () => rolls.shift() ?? 7,
  );
  assert.equal(target.damage, 2);
  assert.equal(target.power, 6);
});

test("Master Duelist adds two dice on a repeat Sword Strike in the same turn", () => {
  const s = trial([
    ["p1", "baron-helmut-zemo", 8],
    ["p2", "hulk", 12],
  ]);
  const [attacker, target] = s.fighters;
  target.power = 0;
  act(s, "p1", { type: "activate", value: attacker.id });
  const attack = {
    type: "attack",
    index: 0,
    target: target.id,
    damageType: "physical",
  };
  for (const dice of [5, 7]) {
    act(s, "p1", attack, () => 7);
    assert.equal(view(s, "p1").actions.p1[0].label, "Strategic Genius");
    act(s, "p1", { type: "skip-effect" }, () => 7);
    assert.equal(s.log.at(-1).rolled.length, dice);
  }
});

for (const [ability, attacker, defender, x, role, count] of [
  ["Spetsnaz Training", "winter-soldier-operative", "hulk", 10.25, "rolled", 1],
  ["Spider-Sense", "hawkeye", "spectacular-spider-man", 12, "defense", 2],
]) {
  test(
    ability + " rerolls eligible dice in its own pool without spending Power",
    () => {
      const s = trial([
        ["p1", attacker, 8],
        ["p2", defender, x],
      ]);
      const [actor, target] = s.fighters;
      target.power = 0;
      const side = role === "rolled" ? "p1" : "p2";
      const initial = Array.from({ length: 12 }, (_, i) => (i === 0 ? 5 : 7));
      act(s, "p1", { type: "activate", value: actor.id });
      act(
        s,
        "p1",
        { type: "attack", index: 0, target: target.id, damageType: "physical" },
        () => initial.shift() ?? 7,
      );
      const modifier = view(s, side).actions[side][0];
      assert.equal(modifier.label, ability);
      assert.equal(modifier.role, role);
      assert.equal(modifier.max, count);
      const indices = modifier.eligible.slice(0, count);
      act(s, side, { type: "modify-dice", indices }, () =>
        role === "rolled" ? 2 : 4,
      );
      assert.ok(
        indices.every(
          (index) =>
            s.log.at(-1)[role][index] === (role === "rolled" ? "hit" : "block"),
        ),
      );
    },
  );
}

test("Strategic Genius lets a nearby ally reroll one attack die", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p1", "baron-helmut-zemo", 11],
    ["p2", "hulk", 14],
  ]);
  const [actor, zemo, target] = s.fighters;
  target.power = 0;
  act(s, "p1", { type: "activate", value: actor.id });
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: target.id, damageType: "physical" },
    () => 7,
  );
  const modifier = view(s, "p1").actions.p1[0];
  assert.equal(modifier.label, "Strategic Genius");
  act(s, "p1", { type: "modify-dice", indices: [0] }, () => 2);
  assert.equal(s.log.at(-1).rolled[0], "hit");
  assert.equal(zemo.power, 3);
});

test("Stealth excludes a target outside Range 3 and permits it inside", () => {
  for (const [x, available] of [
    [12, true],
    [16, false],
  ]) {
    const s = trial([
      ["p1", "hawkeye", 8],
      ["p2", "mystique", x],
    ]);
    act(s, "p1", { type: "activate", value: s.fighters[0].id });
    assert.equal(
      view(s, "p1").actions.p1.some((a) => a.type === "attack"),
      available,
    );
  }
});

test("Shapeshifter prevents enemy Hulk Not Puny Banner during Mystique’s activation", () => {
  const s = trial([
    ["p1", "mystique", 8],
    ["p2", "hulk", 12],
  ]);
  const [actor, target] = s.fighters;
  target.power = 8;
  act(s, "p1", { type: "activate", value: actor.id });
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: target.id, damageType: "physical" },
    () => 7,
  );
  assert.equal(s.log.at(-1).attack, "Pistol");
  assert.equal(target.power, 8);
  assert.deepEqual(view(s, "p2").actions.p2, []);
});

test("I Can Take It reduces damage and Aggressive offers an advance toward the attacker", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "crossbones-merciless-merc", 13],
  ]);
  const [actor, target] = s.fighters;
  const rolls = [2, 2];
  act(s, "p1", { type: "activate", value: actor.id });
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: target.id, damageType: "physical" },
    () => rolls.shift() ?? 7,
  );
  assert.equal(target.damage, 1);
  const move = view(s, "p2").actions.p2[0];
  assert.equal(move.direction, "toward");
  assert.equal(move.speed, "S");
  act(s, "p2", { type: "displace", x: 11.5, y: 8 });
  assert.equal(target.x, 11.5);
});

test("Healing Factor [1] heals exactly one damage when Sabretooth ends his activation", () => {
  const s = trial([
    ["p1", "sabretooth", 8],
    ["p2", "hawkeye", 15],
  ]);
  const [sabretooth] = s.fighters;
  sabretooth.damage = 3;
  act(s, "p1", { type: "activate", value: sabretooth.id });
  act(s, "p1", { type: "end" });
  assert.equal(sabretooth.damage, 2);
});

for (const [ability, defender] of [
  ["Scientific Hubris", "doc-ock-sinister-scientist"],
  ["DNA Database", "mister-sinister"],
]) {
  test(
    ability + " gains one Power for a defense with multiple criticals",
    () => {
      const s = trial([
        ["p1", "hawkeye", 8],
        ["p2", defender, 12],
      ]);
      const [actor, target] = s.fighters;
      const rolls = [7, 7, 7, 7, 7, 0, 0];
      act(s, "p1", { type: "activate", value: actor.id });
      act(
        s,
        "p1",
        { type: "attack", index: 0, target: target.id, damageType: "physical" },
        () => rolls.shift() ?? 7,
      );
      assert.equal(s.log.at(-1).rollSummary.defenseHits, 2);
      assert.equal(target.power, 4);
    },
  );
}

test("All that Matters is the Mission lets Black Widow’s controller place her dropped extract", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "the-black-widow", 13],
  ]);
  const [actor, target] = s.fighters;
  target.power = 0;
  target.damage = 6;
  s.objectives = [
    {
      id: "book",
      name: "Spellbook",
      role: "extract",
      radius: 0.5,
      holder: target.id,
    },
  ];
  act(s, "p1", { type: "activate", value: actor.id });
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: target.id, damageType: "physical" },
    () => 2,
  );
  assert.equal(target.dazed, true);
  assert.equal(view(s, "p2").actions.p2[0].type, "drop-objective");
  act(s, "p2", { type: "drop-objective", x: 14, y: 8 });
  assert.equal(s.objectives[0].x, 14);
});

for (const [ability, slug] of [
  ["Flight", "invincible-iron-man"],
  ["Wall Crawler", "spectacular-spider-man"],
]) {
  test(
    ability + " lets an Advance cross terrain taller than the fighter",
    () => {
      const s = trial([
        ["p1", slug, 8],
        ["p2", "hawkeye", 18],
      ]);
      s.terrain = [
        { id: "wall", name: "Wall", x: 10, y: 0, w: 1, h: 36, size: 5 },
      ];
      const [actor] = s.fighters;
      act(s, "p1", { type: "activate", value: actor.id });
      act(s, "p1", { type: "advance", x: 12.5, y: 8 });
      assert.equal(actor.x, 12.5);
      assert.equal(s.actionsLeft, 1);
    },
  );
}

test("Phasing chooses a new form during the Power Phase", () => {
  const s = trial([
    ["p1", "vision", 8],
    ["p2", "hawkeye", 16],
  ]);
  const [vision, hawkeye] = s.fighters;
  for (const [side, fighter] of [
    ["p1", vision],
    ["p2", hawkeye],
  ]) {
    act(s, side, { type: "activate", value: fighter.id });
    act(s, side, { type: "end" });
  }
  assert.equal(view(s, "p1").actions.p1[0].type, "phase-choice");
  act(s, "p1", { type: "phase-choice", value: "phased" });
  assert.equal(vision.phasing, "phased");
});

test("I Will Create a Better Age deploys Staggered Grunts that activate before Ultron", () => {
  const s = trial([
    ["p1", "ultron-metal-tyrant", 8],
    ["p2", "hawkeye", 25],
  ]);
  const [ultron, hawkeye] = s.fighters;
  s.terrain = [{ id: "car", name: "Car", x: 8, y: 10, w: 2, h: 2, size: 3 }];
  s.deployment = { p1: "south", p2: "north" };
  act(s, "p1", { type: "activate", value: ultron.id });
  act(s, "p1", {
    type: "power",
    value: "Kinetic Field Generator",
    target: "car",
  });
  act(s, "p1", { type: "throw-terrain", angle: 0 }, () => 7);
  assert.equal(view(s, "p1").actions.p1[0].type, "spawn-drones");
  act(s, "p1", { type: "spawn-drones", x: 15, y: 8 });
  const drone = s.fighters.find((f) => f.grunt);
  assert.deepEqual(drone.conditions, ["stagger"]);
  act(s, "p1", { type: "end" });
  act(s, "p2", { type: "activate", value: hawkeye.id });
  act(s, "p2", { type: "end" });
  assert.equal(drone.power, 0);
  s.objectives = [
    {
      id: "book",
      name: "Spellbook",
      role: "extract",
      radius: 0.5,
      x: 15,
      y: 9,
    },
    { id: "secure", name: "Console", role: "secure", radius: 0.5, x: 15, y: 8 },
  ];
  const side = s.decisionSide;
  if (side === "p2") {
    act(s, "p2", { type: "activate", value: hawkeye.id });
    act(s, "p2", { type: "end" });
  }
  act(s, "p1", { type: "activate", value: ultron.id });
  assert.equal(s.active, drone.id);
  act(s, "p1", { type: "shake", value: "stagger" });
  assert.ok(
    !view(s, "p1").actions.p1.some((a) => a.type === "interact"),
    "Programmed for Destruction",
  );
  act(s, "p1", { type: "end" });
  assert.equal(s.active, ultron.id);
  act(s, "p1", { type: "end" });
  if (s.round === 2) {
    act(s, "p2", { type: "activate", value: hawkeye.id });
    act(s, "p2", { type: "end" });
  }
  assert.equal(s.round, 3);
  assert.equal(s.score.p1, 0, "Drones do not Contest");
});

test("Power is Only for the One Who Rules allows a nearby allied character to pay", () => {
  const s = trial([
    ["p1", "red-skull-master-of-the-world", 8],
    ["p1", "hawkeye", 11],
    ["p2", "hulk", 14],
  ]);
  const [skull, payer, hulk] = s.fighters;
  skull.power = 0;
  payer.power = 4;
  hulk.power = 0;
  act(s, "p1", { type: "activate", value: skull.id });
  act(s, "p1", {
    type: "power",
    value: "Nothing is Beyond My Reach",
    target: skull.id,
    payer: payer.id,
  });
  assert.equal(skull.power, 0);
  assert.equal(payer.power, 0);
  act(s, "p1", { type: "displace", x: 8, y: 11 });
  assert.equal(skull.y, 11);
});

test("Earth’s Mightiest Heroes changes one attack die for one Power and once per turn", () => {
  const s = trial([
    ["p1", "captain-america-first-avenger", 8],
    ["p2", "hulk", 12],
  ]);
  const [captain, hulk] = s.fighters;
  hulk.power = 0;
  s.leaders.p1 = captain.slug + ":Earth‘s Mightiest Heroes";
  act(s, "p1", { type: "activate", value: captain.id });
  const attack = {
    type: "attack",
    index: 0,
    target: hulk.id,
    damageType: "physical",
  };
  const roll = () => {
    let first = true;
    return () => {
      if (!first) return 7;
      first = false;
      return 2;
    };
  };
  act(s, "p1", attack, roll());
  assert.equal(view(s, "p1").actions.p1[0].id, "avengers");
  act(s, "p1", { type: "modify-dice", indices: [0], face: "blank" });
  assert.equal(captain.power, 2);
  assert.equal(s.log.at(-1).rolled[0], "blank");
  act(s, "p1", attack, roll());
  assert.ok(!view(s, "p1").actions.p1.some((a) => a.type === "modify-dice"));
});

test("Let’s Get You An Upgrade lets a S.H.I.E.L.D. ally pay for one defense reroll", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "hulk", 12],
    ["p2", "invincible-iron-man", 20],
  ]);
  const [attacker, target, leader] = s.fighters;
  s.leaders.p2 = leader.slug + ":Let‘s Get You An Upgrade";
  act(s, "p1", { type: "activate", value: attacker.id });
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: target.id, damageType: "physical" },
    () => 7,
  );
  assert.equal(view(s, "p2").actions.p2[0].id, "shield-defense");
  act(s, "p2", { type: "modify-dice", indices: [0] }, () => 4);
  assert.equal(target.power, 2);
  assert.equal(s.log.at(-1).defense[0], "block");
});

test("Sinister Six grants one Power and lets the damaged defender remove Shock", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "doc-ock-sinister-scientist", 12],
  ]);
  const [actor, target] = s.fighters;
  target.conditions = ["shock", "bleed"];
  s.leaders.p2 = target.slug + ":Sinister Six";
  act(s, "p1", { type: "activate", value: actor.id });
  const rolls = [2];
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: target.id, damageType: "physical" },
    () => rolls.shift() ?? 7,
  );
  assert.equal(target.power, 5);
  assert.equal(view(s, "p2").actions.p2[0].type, "sinister-shake");
  act(s, "p2", { type: "sinister-shake", value: "shock" });
  assert.deepEqual(target.conditions, ["bleed"]);
});

test("Freedom Force refunds the first Extract interaction and claims a Secure", () => {
  const s = trial([
    ["p1", "mystique", 8],
    ["p2", "hawkeye", 16],
  ]);
  const [actor] = s.fighters;
  s.leaders.p1 = actor.slug + ":Freedom Force";
  s.objectives = [
    {
      id: "cube",
      name: "Cosmic Cube",
      role: "extract",
      radius: 0.5,
      x: 8,
      y: 9,
    },
    { id: "secure", name: "Console", role: "secure", radius: 0.5, x: 8, y: 7 },
  ];
  act(s, "p1", { type: "activate", value: actor.id });
  act(s, "p1", { type: "interact", value: "cube" });
  assert.equal(actor.power, 3);
  assert.equal(s.objectives[0].holder, actor.id);
  act(s, "p1", { type: "interact", value: "freedom|secure" });
  assert.equal(actor.power, 2);
  assert.equal(s.objectives[1].freedom, "p1");
});

test("Army of Evil adds an unused tactic and refunds one contributor", () => {
  const s = trial([
    ["p1", "baron-helmut-zemo", 8],
    ["p2", "hawkeye", 16],
  ]);
  const [zemo, hawkeye] = s.fighters;
  s.phase = "leadership";
  [s.rosters.p1, s.rosters.p2] = [s.rosters.p2, s.rosters.p1];
  s.squads = {
    p1: {
      characters: [zemo.slug],
      affiliation: "Hydra",
      tactics: ["heavy-firepower-ca10"],
    },
    p2: { characters: [hawkeye.slug], affiliation: "", tactics: [] },
  };
  act(s, "p1", { type: "leadership", value: zemo.slug + ":Army of Evil" });
  act(s, "p2", { type: "leadership", value: "" });
  act(s, "p1", { type: "hydra-tactic", value: "reposition" });
  assert.deepEqual(s.squads.p1.tactics, ["heavy-firepower-ca10", "reposition"]);
  const rolls = [0, 0, 0, 0, 0, 7, 7, 7, 7, 7];
  act(s, "p1", { type: "roll" }, () => rolls.shift());
  act(s, "p1", { type: "activate", value: zemo.id });
  const power = zemo.power;
  act(s, "p1", { type: "tactic", value: "heavy-firepower-ca10" });
  assert.equal(zemo.power, power - 2);
  act(s, "p1", { type: "hydra-refund", value: zemo.id });
  assert.equal(zemo.power, power - 1);
});
