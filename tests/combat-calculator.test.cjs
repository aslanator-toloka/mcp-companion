const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
let E, P, R;
test.before(async () => {
  E = await import("../frontend/src/combat/engine.js");
  P = await import("../frontend/src/combat/profile.js");
  R = await import("../frontend/src/combat/rules.js");
});
const card = (overrides = {}) => ({
  physicalDefense: "0",
  energyDefense: "0",
  mysticDefense: "0",
  stamina: "6",
  size: "2",
  threatLevel: "3",
  attacks: [
    {
      name: "Strike",
      type: "physical",
      strength: "1",
      range: "3",
      powerCost: 0,
      steps: [],
    },
  ],
  superPowers: [],
  ...overrides,
});
const character = (slug = "example") => ({
  slug,
  name: slug,
  alterEgo: slug,
  size: 2,
  threatLevel: 3,
});
const unit = (face = {}, options = {}, slug) =>
  P.profile(character(slug), { statCard: { frontSide: card(face) } }, options);
const load = (slug, value = {}) => {
  const c = require("../data/catalog.json").characters.find(
      (c) => c.slug === slug,
    ),
    d = require(`../data/cards/${slug}.json`);
  return P.profile(c, d, { ...P.initialState(slug), ...value });
};
const attack = (p) => P.attackVariants(p)[0];
const sim = (p, q, options = {}) =>
  E.simulateAttack(p, q, attack(p), { samples: 100000, ...options });
const near = (value, expected, tol = 0.013) =>
  assert.ok(
    Math.abs(value - expected) <= tol,
    `${value} ≠ ${expected} ± ${tol}`,
  );
const power = (name, body, cost = null, type = "innate") => ({
  name,
  body,
  powerCost: cost,
  type,
});
test("physical d8 and nonrecursive criticals agree with an independently enumerated one-die expectation", () => {
  const p = unit(),
    q = unit();
  const r = sim(p, q);
  // P(hit/wild)=3/8; P(crit)=1/8 adds 1 + a fresh die's P(success)=4/8.
  near(r.base.mean, 3 / 8 + (1 / 8) * 1.5);
  assert.equal(r.base.mean, r.full.mean);
  near(r.base.chance, 0.5);
  near(
    sim(unit({ attacks: [{ ...attack(p), strength: "4" }] }), q).base.mean,
    2.25,
    0.025,
  );
});
test("Cloak spends on initial failures before criticals, added criticals and failures do not expand", () => {
  const cloak = power(
    "Cloak of Shadows",
    "After this character rolls attack, defense, or dodge dice but before the Resolve Criticals step, it may spend any amount of power to use this superpower.",
    "100",
    "reactive",
  );
  const p = unit({ superPowers: [cloak] });
  const r = sim(p, unit());
  near(r.base.mean, 0.5625);
  near(r.full.mean, 0.75);
  const rolls = [7.5 / 8, 6.5 / 8];
  let i = 0;
  const exact = E.rollPool(1, { rng: () => rolls[i++], cloak: true, power: 1 });
  assert.equal(exact.spent, 1);
  assert.equal(exact.roll.length, 2);
  assert(exact.roll.every((d) => d.f === E.FACE.critical));
});
test("an attack's price consumes the full scenario budget; ten-cost attack cannot also buy Cloak", () => {
  const p = load("malekith-the-accursed"),
    q = unit();
  const a = { ...attack(p), strength: "1", powerCost: 10 };
  const r = E.simulateAttack(p, q, a);
  assert.deepEqual(r.base, r.full);
});
test("Cloak remains available when Black Cat bans modifications and extra critical dice", () => {
  const p = load("malekith-the-accursed"),
    q = load("black-cat");
  q.defense = { physical: 0, energy: 0, mystic: 0 };
  const r = E.simulateAttack(
    p,
    q,
    { ...attack(p), strength: "1" },
    { samples: 120000 },
  );
  near(r.base.mean, 0.5);
  near(r.full.mean, 0.625);
});
test("Spider-Sense respects damage type, modified dice stay single-use and criticals after a reroll do not explode", () => {
  const p = unit({ attacks: [{ ...attack(unit()), strength: "6" }] }),
    q = load("spider-man");
  const physical = sim(p, q),
    energy = E.simulateAttack(p, q, { ...attack(p), type: "energy" }),
    mystic = E.simulateAttack(p, q, { ...attack(p), type: "mystic" });
  assert(physical.base.mean < mystic.base.mean);
  near(physical.base.mean, energy.base.mean, 0.04);
  const rr = unit({
    superPowers: [
      power("Test", "This character may reroll any number of its attack dice."),
    ],
  });
  near(sim(rr, unit()).base.mean, 0.5625 + (0.375 + 0.125 * 0.375) * 0.5);
});
test("defender modifications are banned by Venom, while passive counting remains active", () => {
  const a = load("venom"),
    q = load("amazing-spider-man");
  const bare = { ...q, powers: [] };
  near(sim(a, q).base.mean, sim(a, bare).base.mean, 0.001);
  const martial = unit({
    physicalDefense: "3",
    superPowers: [
      power(
        "Martial Artist",
        "When defending against physical or energy attacks from within range 2, this character adds Blanks in its defense roll to its total successes.",
      ),
    ],
  });
  assert(
    sim(a, martial).base.mean < sim(a, { ...martial, powers: [] }).base.mean,
  );
});
test("defense buffs spend actual energy, type restrictions apply, and paid damage reduction differs from innate minimum one", () => {
  const p = unit();
  const cap = power(
    "Vibranium Shield",
    "When this character is targeted by a physical or energy attack, it may use this superpower. Add 2 dice to this character's defense roll against that attack.",
    "2",
    "reactive",
  );
  const r = sim(p, unit({ superPowers: [cap] }));
  assert(r.full.mean < r.base.mean);
  const mystic = E.simulateAttack(p, unit({ superPowers: [cap] }), {
    ...attack(p),
    type: "mystic",
  });
  assert.equal(mystic.base.mean, mystic.full.mean);
  const innate = unit({
    superPowers: [
      power(
        "Armor",
        "When this character would suffer damage, reduce the amount suffered by 1, to a minimum of 1.",
      ),
    ],
  });
  const paid = unit({
    superPowers: [
      power(
        "Inured to Pain",
        "If this character would suffer damage, it may use this superpower. Reduce the amount of damage suffered by 1.",
        1,
        "reactive",
      ),
    ],
  });
  const ri = sim(p, innate),
    rp = sim(p, paid);
  assert(ri.base.mean > rp.full.mean);
  assert.equal(ri.base.mean, ri.full.mean);
  near(rp.full.mean, 0.0625);
});
test("Pierce consumes exactly one successful defense symbol only with its complete trigger", () => {
  const p = unit({
      attacks: [
        {
          ...attack(unit()),
          strength: "5",
          steps: [
            "|!wild| |*Pierce|: Change 1 of the defender's |!critical|, |!wild|, or |!block| results to a Blank.",
          ],
        },
      ],
    }),
    q = unit({ physicalDefense: "4" });
  const ar = R.attackRules(p, q, attack(p), 2);
  assert.deepEqual(ar.pierce, ["wild"]);
  assert(
    sim(p, q).base.mean >
      sim({ ...p, attacks: [{ ...attack(p), steps: [] }] }, q).base.mean,
  );
  assert.deepEqual(
    R.attackRules(
      p,
      q,
      {
        ...attack(p),
        steps: ["|!wild| |!failure| |*Pierce|: Change 1 result."],
      },
      2,
    ).pierce,
    ["wild", "failure"],
  );
});
test("attack caps, no-damage attacks, and inability to reduce Namor's damage are distinct", () => {
  const q = unit(),
    shuri = load("shuri"),
    r = sim(shuri, q);
  assert(r.base.mean <= 1 && r.full.mean <= 1);
  const giant = load("supergiant");
  const a = P.attackVariants(giant).find(
    (a) => a.name === "Devastate Intellect",
  );
  assert.equal(E.simulateAttack(giant, q, a).base.mean, 0);
  const namor = load("namor-the-submariner"),
    iron = load("iron-man");
  const noArmor = { ...iron, powers: [] };
  near(sim(namor, iron).base.mean, sim(namor, noArmor).base.mean, 0.001);
});
test("health, previous attacks, token state, forms, stance and status conditions affect only applicable rules", () => {
  const h = load("hulk"),
    angry = load("hulk", { damage: 8 });
  assert(sim(angry, unit()).base.mean > sim(h, unit()).base.mean + 0.9);
  const noir = load("spider-man-noir"),
    setup = load("spider-man-noir", { attacked: true });
  assert(sim(setup, unit()).base.mean > sim(noir, unit()).base.mean + 1.5);
  const shock = load("hulk", { conditions: ["shock"] });
  assert(sim(shock, unit()).base.mean < sim(h, unit()).base.mean);
  const hex = unit({}, { conditions: ["hex"] });
  near(sim(hex, unit()).base.mean, 0.5);
  const vision = load("vision"),
    phased = load("vision", { stance: "energy" });
  const p = unit({ attacks: [{ ...attack(unit()), strength: "7" }] });
  assert(sim(p, vision).base.mean < sim(p, phased).base.mean);
  const voodoo = load("doctor-voodoo"),
    noBrother = load("doctor-voodoo", { special: false });
  assert(sim(p, voodoo).base.mean < sim(p, noBrother).base.mean);
  const hood = load("hood", { form: 1 });
  assert.notEqual(hood.name, load("hood").name);
});
test("range, Stealth, cover, flexible attack types and no silent unknown strengths", () => {
  const p = unit(),
    q = load("black-cat");
  assert.match(sim(p, q, { distance: 4 }).unavailable, /дальности/);
  const long = { ...attack(p), range: "5" };
  assert.match(
    E.simulateAttack(p, q, long, { distance: 4 }).unavailable,
    /Stealth/,
  );
  assert.match(
    E.simulateAttack(p, unit(), { ...long, strength: "*" }).unavailable,
    /Переменная/,
  );
  const covered = unit({ physicalDefense: "3" }, { cover: true });
  assert.equal(
    sim(p, covered).base.mean,
    sim(p, { ...covered, state: { ...covered.state, cover: false } }).base.mean,
  );
  assert(
    sim(p, covered, { distance: 3 }).base.mean <
      sim(
        p,
        { ...covered, state: { ...covered.state, cover: false } },
        { distance: 3 },
      ).base.mean,
  );
  assert.equal(
    P.attackVariants(load("apocalypse")).filter((a) => a.index === 0).length,
    3,
  );
});
test("fixed strategy is deterministic, both directions include every attack, warnings expose unsupported effects", () => {
  const p = load("malekith-the-accursed"),
    q = load("adam-warlock");
  assert.deepEqual(sim(p, q, { samples: 2000 }), sim(p, q, { samples: 2000 }));
  const result = E.compare(p, q, { samples: 100 });
  assert.equal(result[0].attacks.length, p.attacks.length);
  assert.equal(result[1].attacks.length, q.attacks.length);
  assert(result[0].attacks[0].warnings.some((w) => /Chronokinesis/.test(w)));
});
test("all current card faces compile, produce finite nonnegative damage, and show excluded followups", () => {
  const chars = require("../data/catalog.json").characters;
  let count = 0;
  for (const c of chars)
    for (const form of [0, 1])
      for (const side of ["front", "back"]) {
        const p = load(c.slug, { form, side });
        for (const a of P.attackVariants(p)) {
          const r = E.simulateAttack(p, unit(), a, { samples: 8 });
          assert(
            r.unavailable ||
              [r.base.mean, r.full.mean].every(
                (v) => Number.isFinite(v) && v >= 0,
              ),
            `${c.slug}/${a.name}`,
          );
          count++;
        }
      }
  assert(count > 2000);
  const widow = load("black-widow-agent-of-shield");
  const pistol = P.attackVariants(widow).find(
    (a) => a.name === "Automatic Pistol",
  );
  assert(
    E.simulateAttack(widow, unit(), pistol, { samples: 10 }).notes.some((n) =>
      /Дополнительные атаки/.test(n),
    ),
  );
});

test("Eye of Agamotto rerolls all eligible dice together; paid variable rerolls cover several dice, not one", () => {
  const eye = power(
    "Eye of Agamotto",
    "This character can modify and reroll failure results. When this character is attacking, defending, or dodging, it may reroll all of its dice.",
  );
  near(sim(unit({ superPowers: [eye] }), unit()).base.mean, 0.8125);
  const modok = load("modok"),
    zola = load("arnim-zola");
  for (const p of [modok, zola]) {
    const effects = R.powerRules(p, unit(), attack(p), "attack", 2).effects;
    const rr = effects.find((e) => e.variable && e.kind === "reroll");
    assert(rr, p.slug);
    assert.equal(rr.amount, 99, p.slug);
  }
});
test("paid blank-counting works while attacking Loki, and wilds count twice for Gambit without energy", () => {
  const loki = load("loki-god-of-mischief"),
    r = sim(loki, unit());
  assert(r.full.mean > r.base.mean);
  const gambit = load("gambit");
  const bare = { ...gambit, powers: [] };
  assert(sim(gambit, unit()).base.mean > sim(bare, unit()).base.mean);
});
test("Mysterio switches to mystic defense unless the attacker can pay; Ethereal caps Supergiant's physical damage", () => {
  const p = unit({ attacks: [{ ...attack(unit()), strength: "7" }] }),
    q = load("mysterio");
  const r = sim(p, q);
  assert(r.full.mean > r.base.mean + 0.3);
  const giant = load("supergiant");
  assert(sim(p, giant).base.mean <= 1);
  const energy = E.simulateAttack(p, giant, { ...attack(p), type: "energy" });
  assert(energy.base.mean > 1);
});
test("condition immunity and actual remaining stamina constrain combat context", () => {
  const p = load("ghost-rider", { conditions: ["hex", "shock", "incinerate"] });
  assert.deepEqual(p.state.conditions, ["shock"]);
  const hulk = load("hulk", { damage: 40 });
  assert.equal(hulk.state.damage, hulk.stamina - 1);
});
test("2026 rules allow successive different reroll abilities, but never the same ability twice on one die", () => {
  const body = "This character may reroll any number of its attack dice.";
  const single = sim(unit({ superPowers: [power("First", body)] }), unit());
  const two = sim(
    unit({ superPowers: [power("First", body), power("Second", body)] }),
    unit(),
  );
  const duplicate = sim(
    unit({ superPowers: [power("First", body), power("First", body)] }),
    unit(),
  );
  near(single.base.mean, 0.7734375);
  near(two.base.mean, 0.8525390625);
  assert(two.base.mean > single.base.mean + 0.06);
  assert.equal(duplicate.base.mean, single.base.mean);
});
test("Shock and Incinerate cannot reduce an existing dice pool below one", () => {
  const p = unit(),
    q = unit({ physicalDefense: "1" });
  assert.equal(
    sim(p, q).base.mean,
    sim(p, { ...q, state: { ...q.state, conditions: ["incinerate"] } }).base
      .mean,
  );
  assert.equal(
    sim(p, q).base.mean,
    sim({ ...p, state: { ...p.state, conditions: ["shock"] } }, q).base.mean,
  );
});
test("battle condition casing normalizes without mutating a saved fighter", () => {
  const value = {
    conditions: ["Incinerate", "Root", "incinerate", "Not a condition"],
    damage: 2,
  };
  const before = JSON.stringify(value);
  assert.deepEqual(P.state(value).conditions, ["incinerate", "root"]);
  assert.equal(JSON.stringify(value), before);
});
test("standard Flight in a combined trait group activates Summon the Storm rerolls", () => {
  const p = load("beta-ray-bill"),
    q = load("iron-man"),
    a = P.attackVariants(p).find((a) => a.name === "Summon the Storm");
  assert.equal(R.attackRules(p, q, a, 2).reroll, 2);
});
test("Dormammu retains his self-attack clause even though the same power also mentions another allied character", () => {
  const p = load("dormammu"),
    q = unit({ physicalDefense: "3", energyDefense: "3", mysticDefense: "3" });
  const effects = R.powerRules(p, q, attack(p), "attack", 2).effects;
  assert(effects.some((e) => e.kind === "failureSuccess"));
  assert(effects.some((e) => e.kind === "addEnemyFailures"));
  assert(sim(p, q).base.mean > sim({ ...p, powers: [] }, q).base.mean + 0.5);
});
