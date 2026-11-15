const test = require("node:test");
const assert = require("node:assert/strict");
const { act, view } = require("../game/engine.cjs");
const tactics = require("../game/tactics.cjs");
const { trial } = require("./helpers/game.cjs");

// Dice faces by random index: 0 critical, 1 wild, 2–3 hit, 4 block, 5 failure, 6–7 blank.
const squad = (s, side, cards, affiliation = "") => {
  s.squads[side] = { characters: [], tactics: cards, affiliation };
};
const card = (s, side, id) =>
  view(s, side)
    .actions[side].find((a) => a.type === "tactic")
    ?.cards.find((c) => c.value === id);
const activate = (s, side, f) => {
  s.decisionSide = side;
  act(s, side, { type: "activate", value: f.id });
};

test("Children of the Atom removes all conditions and pays 1 Power each", () => {
  const s = trial([
    ["p1", "shadowcat", 8],
    ["p2", "mystique", 30],
  ]);
  const [kitty] = s.fighters;
  squad(s, "p1", ["children-of-the-atom"], "Uncanny X-Men");
  activate(s, "p1", kitty);
  assert.equal(card(s, "p1", "children-of-the-atom"), undefined);
  kitty.conditions = ["stagger", "bleed"];
  act(s, "p1", { type: "tactic", value: "children-of-the-atom" });
  assert.deepEqual(kitty.conditions, []);
  assert.equal(kitty.power, 5);
  assert.deepEqual(s.playedTactics.p1, ["children-of-the-atom"]);
});

test("Magnetic Refraction gives cover near Magneto and returns to a Brotherhood squad in Cleanup", () => {
  const s = trial([
    ["p1", "magneto", 8],
    ["p1", "toad", 11],
    ["p2", "hawkeye", 19],
  ]);
  const [magneto, toad, hawkeye] = s.fighters;
  squad(s, "p1", ["magnetic-refraction"], "Brotherhood of Mutants");
  activate(s, "p1", magneto);
  act(s, "p1", { type: "tactic", value: "magnetic-refraction" });
  assert.equal(magneto.power, 1);
  act(s, "p1", { type: "end" });
  activate(s, "p2", hawkeye);
  act(
    s,
    "p2",
    { type: "attack", index: 0, target: toad.id, damageType: "physical" },
    () => 2,
  );
  const mods = view(s, "p1").actions.p1.filter((a) => a.type === "modify-dice");
  assert.ok(mods.some((m) => m.id === "cover"));
  tactics.cleanupEffects(s);
  assert.deepEqual(s.playedTactics.p1, []);
});

test("Do You Know Who I Am? throws an enemy of Size 4 or less Long", () => {
  const s = trial([
    ["p1", "juggernaut", 8],
    ["p2", "mystique", 11],
  ]);
  const [juggernaut, mystique] = s.fighters;
  squad(s, "p1", ["do-you-know-who-i-am"]);
  activate(s, "p1", juggernaut);
  assert.throws(() =>
    act(s, "p1", { type: "tactic", value: "do-you-know-who-i-am", choice: "nobody" }),
  );
  act(s, "p1", { type: "tactic", value: "do-you-know-who-i-am", choice: mystique.id });
  assert.equal(juggernaut.power, 0);
  assert.equal(s.effects[0].type, "displace");
  assert.equal(s.effects[0].mode, "throw");
  assert.equal(s.effects[0].speed, "L");
  assert.equal(s.effects[0].mover, mystique.id);
});

test("Journey Through Limbo places a nearby character within Range 3 and Incinerates it", () => {
  const s = trial([
    ["p1", "magik", 8],
    ["p2", "mystique", 11],
  ]);
  const [magik, mystique] = s.fighters;
  squad(s, "p1", ["journey-through-limbo"]);
  activate(s, "p1", magik);
  act(s, "p1", { type: "tactic", value: "journey-through-limbo", choice: mystique.id });
  assert.deepEqual(mystique.conditions, ["incinerate"]);
  assert.equal(s.effects[0].mode, "place");
  assert.equal(s.effects[0].range, 3);
  act(s, "p1", { type: "displace", x: 16, y: 8 });
  assert.equal(mystique.x, 16);
});

test("Hold Still spends an action, places Shadowcat and grants Phase Disruption only against the chosen enemy", () => {
  const s = trial([
    ["p1", "shadowcat", 8],
    ["p2", "mystique", 12],
    ["p2", "sabretooth", 13],
  ]);
  const [kitty, mystique] = s.fighters;
  squad(s, "p1", ["hold-still"]);
  activate(s, "p1", kitty);
  act(s, "p1", { type: "tactic", value: "hold-still", choice: mystique.id });
  assert.equal(s.actionsLeft, 1);
  assert.equal(kitty.power, 0);
  act(s, "p1", { type: "displace", x: 12, y: 10 });
  const attack = view(s, "p1").actions.p1.find((a) => a.type === "attack");
  const phase = attack.attacks.find((a) => a.index === 104);
  assert.equal(phase.name, "Phase Disruption");
  assert.deepEqual(
    phase.targets.map((t) => t.value),
    [mystique.id],
  );
});

test("Pyrotechnics drops a token and pushes each chosen Incinerated enemy, 1 Power per target", () => {
  const s = trial([
    ["p1", "pyro", 8],
    ["p2", "mystique", 11],
  ]);
  const [pyro, mystique] = s.fighters;
  mystique.conditions = ["incinerate"];
  s.objectives = [
    { id: "book", name: "Spellbook", role: "extract", radius: 0.5, holder: mystique.id },
  ];
  squad(s, "p1", ["pyrotechnics"]);
  activate(s, "p1", pyro);
  act(s, "p1", { type: "tactic", value: "pyrotechnics", targets: [mystique.id] });
  assert.equal(pyro.power, 2);
  assert.equal(s.objectives[0].holder, null);
  assert.ok(s.effects.some((e) => e.mode === "push" && e.mover === mystique.id));
});

test("Headmistress lets an Uncanny X-Men ally without a token Advance Medium per Power", () => {
  const s = trial([
    ["p1", "emma-frost", 8],
    ["p1", "storm", 11],
    ["p1", "cyclops", 14],
    ["p2", "mystique", 30],
  ]);
  const [emma, storm, cyclops] = s.fighters;
  s.objectives = [
    { id: "book", name: "Spellbook", role: "extract", radius: 0.5, holder: cyclops.id },
  ];
  squad(s, "p1", ["headmistress"], "Uncanny X-Men");
  activate(s, "p1", emma);
  const option = card(s, "p1", "headmistress");
  assert.deepEqual(
    option.targets.map((t) => t.value),
    [emma.id, storm.id],
  );
  assert.throws(() =>
    act(s, "p1", { type: "tactic", value: "headmistress", targets: [cyclops.id] }),
  );
  act(s, "p1", { type: "tactic", value: "headmistress", targets: [storm.id] });
  assert.equal(emma.power, 2);
  assert.equal(s.effects[0].mover, storm.id);
  assert.equal(s.effects[0].speed, "M");
});

test("To Me, My X-Men! advances allies Short toward the leader", () => {
  const s = trial([
    ["p1", "cyclops", 8],
    ["p1", "storm", 14],
    ["p2", "mystique", 30],
  ]);
  const [cyclops, storm] = s.fighters;
  squad(s, "p1", ["to-me-my-x-men"], "Uncanny X-Men");
  activate(s, "p1", cyclops);
  act(s, "p1", { type: "tactic", value: "to-me-my-x-men", targets: [storm.id] });
  assert.equal(cyclops.power, 2);
  assert.equal(s.effects[0].direction, "toward");
  assert.equal(s.effects[0].speed, "S");
  assert.equal(s.effects[0].reference.x, cyclops.x);
});

test("Pardon Me, Sugah with Storm adds 2 dice to Rogue's next attack and damages Storm", () => {
  const s = trial([
    ["p1", "rogue", 8],
    ["p1", "storm", 10],
    ["p2", "mystique", 11.5],
  ]);
  const [rogue, storm, mystique] = s.fighters;
  squad(s, "p1", ["pardon-me-sugah"]);
  activate(s, "p1", rogue);
  act(s, "p1", { type: "tactic", value: "pardon-me-sugah", choice: "storm" });
  assert.equal(storm.damage, 1);
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: mystique.id, damageType: "physical" },
    () => 6,
  );
  const roll = s.log.findLast((e) => e.rolled);
  assert.equal(roll.rolled.length, 5 + 2);
});

test("Pardon Me, Sugah with Cyclops grants Rogue his Optic Blast", () => {
  const s = trial([
    ["p1", "rogue", 8],
    ["p1", "cyclops", 10],
    ["p2", "mystique", 13],
  ]);
  const [rogue, cyclops] = s.fighters;
  squad(s, "p1", ["pardon-me-sugah"]);
  activate(s, "p1", rogue);
  act(s, "p1", { type: "tactic", value: "pardon-me-sugah", choice: "cyclops" });
  assert.equal(cyclops.damage, 1);
  const attacks = view(s, "p1").actions.p1.find((a) => a.type === "attack").attacks;
  assert.ok(attacks.some((a) => a.index === 105 && a.name === "Optic Blast"));
});

test("Patch Up heals the chosen ally by the Power another ally within Range 2 spends", () => {
  const s = trial([
    ["p1", "toad", 8],
    ["p1", "pyro", 10],
    ["p2", "mystique", 30],
  ]);
  const [toad, pyro] = s.fighters;
  toad.damage = 3;
  squad(s, "p1", ["patch-up-cp143"]);
  activate(s, "p1", toad);
  const choice = toad.id + "|" + pyro.id;
  assert.throws(() =>
    act(s, "p1", { type: "tactic", value: "patch-up-cp143", choice, amount: 4 }),
  );
  act(s, "p1", { type: "tactic", value: "patch-up-cp143", choice, amount: 2 });
  assert.equal(toad.damage, 1);
  assert.equal(pyro.power, 1);
  assert.equal(toad.power, 3);
});

test("Indomitable stops an enemy throw for 2 Power", () => {
  const s = trial([
    ["p1", "juggernaut", 8],
    ["p2", "mystique", 11],
  ]);
  const [juggernaut, mystique] = s.fighters;
  squad(s, "p1", ["do-you-know-who-i-am"]);
  squad(s, "p2", ["indomitable"]);
  activate(s, "p1", juggernaut);
  act(s, "p1", { type: "tactic", value: "do-you-know-who-i-am", choice: mystique.id });
  const reaction = view(s, "p2").actions.p2[0];
  assert.ok(reaction.options.some((o) => o.value === "indomitable"));
  act(s, "p2", { type: reaction.type, value: "indomitable" });
  assert.equal(mystique.x, 11);
  assert.equal(mystique.power, 1);
  assert.deepEqual(s.playedTactics.p2, ["indomitable"]);
  assert.equal(s.effects.length, 0);
});

test("Xavier's Dream reduces attack damage by 1 for each ally that pays 1 Power", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "storm", 11],
    ["p2", "cyclops", 14],
  ]);
  const [hawkeye, storm, cyclops] = s.fighters;
  squad(s, "p2", ["xaviers-dream"], "Uncanny X-Men");
  activate(s, "p1", hawkeye);
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: storm.id, damageType: "physical" },
    () => 2,
  );
  let dream;
  for (let i = 0; i < 10 && !dream; i++) {
    const options = [...view(s, "p1").actions.p1, ...view(s, "p2").actions.p2];
    dream = options.find((a) => a.type === "modify-dice" && a.id === "xaviers-dream");
    if (dream) break;
    const next = options.find((a) => ["modify-dice", "reaction"].includes(a.type));
    const who = view(s, "p1").actions.p1.includes(next) ? "p1" : "p2";
    act(s, who, next.type === "reaction" ? { type: "reaction", value: "skip" } : { type: "skip-effect" }, () => 2);
  }
  assert.ok(dream);
  const before = storm.damage || 0;
  act(s, "p2", { type: "modify-dice", amount: 1 }, () => 2);
  assert.equal(cyclops.power, 2);
  assert.deepEqual(s.playedTactics.p2, ["xaviers-dream"]);
  const hit = s.log.findLast((e) => e.dealt != null);
  assert.equal(hit.dealt, hit.rollSummary.incoming - 1);
  assert.equal(storm.damage, before + hit.dealt);
});

test("The Books of Truth rerolls every attack die including failures for 2 Power", () => {
  const s = trial([
    ["p1", "pyro", 8],
    ["p2", "hawkeye", 11],
  ]);
  const [pyro, hawkeye] = s.fighters;
  squad(s, "p1", ["the-books-of-truth"], "Brotherhood of Mutants");
  activate(s, "p1", pyro);
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: hawkeye.id, damageType: "energy" },
    () => 5,
  );
  const books = view(s, "p1").actions.p1.find(
    (a) => a.type === "modify-dice" && a.id === "books-rolled",
  );
  assert.ok(books);
  assert.throws(() =>
    act(s, "p1", { type: "modify-dice", indices: [0] }, () => 0),
  );
  const before = pyro.power;
  act(s, "p1", { type: "modify-dice", indices: books.eligible }, () => 0);
  const paid = s.log.find((e) => e.text === "The Books of Truth");
  assert.ok(paid);
  assert.ok(pyro.power <= before - 2 + 1);
  assert.deepEqual(s.playedTactics.p1, ["the-books-of-truth"]);
});

test("Sacrifice moves the attack to an ally within Range 2, who adds no defense dice", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "toad", 14],
    ["p2", "the-blob", 16],
  ]);
  const [hawkeye, toad, blob] = s.fighters;
  squad(s, "p2", ["sacrifice-ca10"]);
  activate(s, "p1", hawkeye);
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: toad.id, damageType: "physical" },
    () => 6,
  );
  const reactions = view(s, "p2").actions.p2.filter((a) => a.type === "reaction");
  assert.ok(reactions.some((o) => o.value === "sacrifice:" + blob.id));
  act(s, "p2", { type: "reaction", value: "sacrifice:" + blob.id }, () => 6);
  assert.equal(toad.power, 2);
  assert.equal(blob.power, 2);
  assert.deepEqual(s.playedTactics.p2, ["sacrifice-ca10"]);
  const roll = s.log.findLast((e) => e.defense);
  assert.equal(roll.target, blob.id);
});

test("First Class lets Uncanny X-Men Interact once this round without Power", () => {
  const s = trial([
    ["p1", "storm", 8],
    ["p2", "mystique", 30],
  ]);
  const [storm] = s.fighters;
  storm.power = 0;
  s.objectives = [{ id: "book", name: "Spellbook", role: "extract", x: 9, y: 8, radius: 0.5 }];
  squad(s, "p1", ["first-class"], "Uncanny X-Men");
  const effect = tactics.phaseEffects(s).find((e) => e.card === "first-class");
  s.effects = [effect];
  act(s, "p1", { type: "phase-choice", value: storm.id });
  activate(s, "p1", storm);
  act(s, "p1", { type: "interact", value: "book" });
  assert.equal(storm.power, 0);
  assert.equal(s.objectives[0].holder, storm.id);
});

test("Asteroid M drops the chosen character's tokens and Places it next to the other payer", () => {
  const s = trial([
    ["p1", "toad", 4],
    ["p1", "magneto", 20],
    ["p2", "mystique", 30],
  ]);
  const [toad, magneto] = s.fighters;
  s.objectives = [{ id: "book", name: "Spellbook", role: "extract", radius: 0.5, holder: toad.id }];
  squad(s, "p1", ["asteroid-m"], "Brotherhood of Mutants");
  s.effects = [tactics.phaseEffects(s).find((e) => e.card === "asteroid-m")];
  act(s, "p1", { type: "phase-choice", value: toad.id + "|" + magneto.id });
  assert.equal(toad.power, 1);
  assert.equal(magneto.power, 1);
  assert.equal(s.objectives[0].holder, null);
  assert.equal(s.effects.at(-1).mode, "place");
  assert.equal(s.effects.at(-1).range, 1);
});

test("The Pawns Go First lets a Threat 3- Brotherhood character give Power to a Threat 5+ ally", () => {
  const s = trial([
    ["p1", "toad", 8],
    ["p1", "magneto", 11],
    ["p2", "mystique", 30],
  ]);
  const [toad, magneto] = s.fighters;
  squad(s, "p1", ["the-pawns-go-first"], "Brotherhood of Mutants");
  s.effects = tactics.cleanupEffects(s);
  assert.equal(s.effects[0].card, "the-pawns-go-first");
  act(s, "p1", { type: "phase-choice", value: toad.id + "|" + magneto.id + "|power" });
  assert.equal(toad.power, 2);
  assert.equal(magneto.power, 4);
});

test("Genetic Superiority gives 1 Power to a Threat 5+ Brotherhood ally once per turn", () => {
  const combat = require("../game/combat.cjs");
  const s = trial([
    ["p1", "toad", 8],
    ["p1", "magneto", 11],
    ["p1", "exodus", 20],
    ["p2", "hawkeye", 14],
  ]);
  const [toad, magneto, , hawkeye] = s.fighters;
  squad(s, "p1", ["genetic-superiority"], "Brotherhood of Mutants");
  s.effects = [tactics.phaseEffects(s).find((e) => e.card === "genetic-superiority")];
  act(s, "p1", { type: "phase-choice", value: "play" });
  combat.damage(s, toad, 1, hawkeye);
  combat.damage(s, toad, 1, hawkeye);
  assert.equal(magneto.power, 4);
  tactics.resetTurn(s);
  combat.damage(s, toad, 1, hawkeye);
  assert.equal(magneto.power, 5);
});

test("No More Mutants cancels an enemy superpower but the enemy still pays", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "scarlet-witch", 14],
  ]);
  const [hulk, witch] = s.fighters;
  hulk.power = 8;
  squad(s, "p2", ["no-more-mutants"]);
  activate(s, "p1", hulk);
  act(s, "p1", { type: "power", value: "Gamma Leap", x: 10, y: 8 });
  assert.equal(view(s, "p2").actions.p2[0].type, "no-more-mutants");
  act(s, "p2", { type: "no-more-mutants" });
  assert.equal(hulk.x, 8);
  assert.equal(hulk.power, 4);
  assert.equal(witch.power, 0);
  assert.throws(() => act(s, "p1", { type: "power", value: "Gamma Leap", x: 10, y: 8 }));
});

test("Declining No More Mutants resolves the superpower normally", () => {
  const s = trial([
    ["p1", "hulk", 8],
    ["p2", "scarlet-witch", 14],
  ]);
  const [hulk] = s.fighters;
  hulk.power = 8;
  squad(s, "p2", ["no-more-mutants"]);
  activate(s, "p1", hulk);
  act(s, "p1", { type: "power", value: "Gamma Leap", x: 10, y: 8 });
  act(s, "p2", { type: "skip-effect" });
  assert.equal(hulk.x, 10);
  assert.equal(hulk.power, 4);
});

test("tournament presets load with their tactics and an Uncanny X-Men squad can take team cards", () => {
  const { create } = require("../game/engine.cjs");
  const s = create({ p1: "x-men-tournament", p2: "brotherhood-tournament" }, 1);
  assert.equal(s.rosters.p1.tactics.length, 10);
  assert.equal(s.rosters.p2.tactics.length, 10);
  Object.assign(s, { phase: "squad", threat: 18 });
  act(s, "p1", {
    type: "squad",
    characters: ["cyclops", "storm", "emma-frost", "shadowcat", "magik"],
    tactics: ["first-class", "headmistress", "xaviers-dream"],
    affiliation: "Uncanny X-Men",
  });
  assert.ok(s.commits.p1);
});
