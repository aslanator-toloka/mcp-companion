const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const exhaustive = require("./helpers/combat-exhaustive.cjs");
let E, P, R, D;
test.before(async () => {
  E = await import("../frontend/src/combat/engine.js");
  P = await import("../frontend/src/combat/profile.js");
  R = await import("../frontend/src/combat/rules.js");
  D = await import("../frontend/src/combat/exact-dice.js");
});
const power = (name, body, cost = null, type = "innate") => ({
  name,
  body,
  powerCost: cost,
  type,
});
const make = ({
  dice = 1,
  defense = 1,
  powers = [],
  steps = [],
  cost = 0,
  context = {},
} = {}) =>
  P.profile(
    { slug: "fixture", name: "Fixture", size: 2, threatLevel: 3 },
    {
      statCard: {
        frontSide: {
          stamina: 10,
          size: 2,
          threatLevel: 3,
          physicalDefense: defense,
          energyDefense: defense,
          mysticDefense: defense,
          superPowers: powers,
          attacks: [
            {
              name: "Strike",
              type: "physical",
              strength: dice,
              range: 5,
              powerCost: cost,
              steps,
            },
          ],
        },
      },
    },
    context,
  );
const attack = (p) => P.attackVariants(p)[0];
const exact = (a, d) => E.calculateAttack(a, d, attack(a));
function close(a, b, label = "") {
  assert(Math.abs(a - b) < 2e-11, `${label}: ${a} != ${b}`);
}
function same(actual, expected) {
  close(actual.mean, expected.mean, "mean");
  close(actual.chance, expected.chance, "chance");
  for (
    let i = 0;
    i < Math.max(actual.distribution.length, expected.distribution.length);
    i++
  )
    close(
      actual.distribution[i] || 0,
      expected.distribution[i] || 0,
      `damage ${i}`,
    );
  close(
    actual.distribution.reduce((n, p) => n + p, 0),
    1,
    "mass",
  );
  assert.equal(actual.method, "exact");
  assert.equal(Object.hasOwn(actual, "error"), false);
  assert.equal(Object.hasOwn(actual, "samples"), false);
}
const cloak = () =>
  power(
    "Cloak of Shadows",
    "Treat failure results as critical results.",
    "100",
    "reactive",
  );
const rr = (id, n, role = "attack", failures = false) =>
  power(
    id,
    `This character may reroll up to ${n} of its ${role} dice${failures ? ", including failure results" : ""}.`,
  );
const eye = () =>
  power(
    "Eye of Agamotto",
    "This character can modify and reroll failure results. When this character is attacking, defending, or dodging, it may reroll all of its dice.",
  );
const pierce =
  "|!wild| |*Pierce|: Change 1 of the defender's |!critical|, |!wild|, or |!block| results to a Blank.";
const absorption = () =>
  power(
    "Energy absorption test",
    "When this character is defending against a physical attack, for each wild in the defense roll, it may change 1 of the attacker's critical, wild, or hit results to a Blank.",
  );
const force = () =>
  power(
    "Witty Banter",
    "If an enemy character within range 3 of this character is attacking an allied character, this character may use this superpower during the Modify Opponent's Dice step of the attack. You may reroll 1 die in the attack roll.",
    1,
    "reactive",
  );
const convolution = (a, b) => {
  const out = Array(a.length + b.length - 1).fill(0);
  a.forEach((p, i) => b.forEach((q, j) => (out[i + j] += p * q)));
  return out;
};
const raise = (polynomial, n) => {
  let p = [1];
  for (let i = 0; i < n; i++) p = convolution(p, polynomial);
  return p;
};
test("ordinary attacks equal the independent closed-form generating polynomials, including large pools", () => {
  for (const [a, d] of [
    [1, 1],
    [2, 3],
    [8, 5],
    [30, 30],
  ]) {
    const ap = raise([1 / 2, 7 / 16, 1 / 16], a),
      dp = raise([5 / 8, 21 / 64, 3 / 64], d),
      hist = [];
    ap.forEach((p, i) =>
      dp.forEach((q, j) => {
        const damage = Math.max(0, i - j);
        hist[damage] = (hist[damage] || 0) + p * q;
      }),
    );
    const expected = {
      mean: hist.reduce((n, p, i) => n + p * i, 0),
      chance: hist.slice(1).reduce((n, p) => n + p, 0),
      distribution: hist,
    };
    const result = exact(make({ dice: a }), make({ defense: d }));
    same(result.base, expected);
    same(result.full, expected);
    assert(
      result.base.distribution[2 * a] > 0,
      "rare maximum-damage tail must not be pruned",
    );
  }
});
test("ordered exhaustive face enumeration independently verifies own modifications, budgets, cross-roll effects and armor", () => {
  const cases = [
    { label: "plain", a: {}, d: {}, oracle: {} },
    {
      label: "Cloak both sides",
      a: { powers: [cloak()] },
      d: { powers: [cloak()] },
      oracle: {
        a: { cloak: true, energy: 10 },
        d: { cloak: true, energy: 10 },
      },
    },
    {
      label: "Cloak can buy only one initial skull",
      a: { dice: 2, cost: 9, powers: [cloak()] },
      d: {},
      oracle: { attackDice: 2, a: { cloak: true, energy: 1 } },
    },
    {
      label: "Root surcharge blocks last power for Cloak",
      a: { cost: 9, powers: [cloak()], context: { conditions: ["root"] } },
      d: {},
      oracle: { a: { cloak: true, energy: 1, tax: 1 } },
    },
    {
      label: "ordinary reroll",
      a: { powers: [rr("First", 1)] },
      d: { powers: [rr("Guard", 1, "defense")] },
      oracle: { a: { rerolls: [{ n: 1 }] }, d: { rerolls: [{ n: 1 }] } },
    },
    {
      label: "two different rerolls",
      a: { powers: [rr("First", 1), rr("Second", 1)] },
      d: {},
      oracle: { a: { rerolls: [{ n: 1 }, { n: 1 }] } },
    },
    {
      label: "same reroll cannot reuse a die",
      a: { powers: [rr("First", 1), rr("First", 1)] },
      d: {},
      oracle: {
        a: {
          rerolls: [
            { n: 1, id: "same" },
            { n: 1, id: "same" },
          ],
        },
      },
    },
    {
      label: "Eye full reroll",
      a: { powers: [eye()] },
      d: { powers: [eye()] },
      oracle: {
        a: { allowFailures: true, rerolls: [{ all: true }] },
        d: { allowFailures: true, rerolls: [{ all: true }] },
      },
    },
    {
      label: "conditional all reroll",
      a: {
        powers: [
          power(
            "Plucky Attitude",
            "When attacking, if this character rolled no hit, it may reroll all of its current attack dice.",
          ),
        ],
      },
      d: {},
      oracle: { a: { rerolls: [{ all: true, conditional: true }] } },
    },
    { label: "pierce", a: { steps: [pierce] }, d: {}, oracle: { pierce: [3] } },
    {
      label: "no extra pierce during opponent reroll",
      a: {},
      d: { powers: [force()] },
      oracle: { d: { energy: 10, opponentReroll: { n: 1, cost: 1 } } },
    },
    {
      label: "own reroll then opponent reroll",
      a: { powers: [rr("First", 1)] },
      d: { powers: [force(), rr("Guard", 1, "defense")] },
      oracle: {
        a: { rerolls: [{ n: 1 }] },
        d: {
          energy: 10,
          rerolls: [{ n: 1 }],
          opponentReroll: { n: 1, cost: 1 },
        },
      },
    },
    {
      label: "wild cancellation",
      a: {},
      d: { powers: [absorption()] },
      oracle: { d: { cancelWilds: true } },
    },
    {
      label: "pierce removes defensive wild first",
      a: { steps: [pierce] },
      d: { powers: [absorption()] },
      oracle: { pierce: [3], d: { cancelWilds: true } },
    },
    {
      label: "double wilds and cancellation",
      a: {
        powers: [
          power(
            "The Cards Always Be In My Favor",
            "When this character is attacking, defending or dodging, each wild in its roll counts as 2 successes.",
          ),
        ],
      },
      d: { powers: [absorption()] },
      oracle: { a: { doubleWild: true }, d: { cancelWilds: true } },
    },
    {
      label: "blank attacker wilds",
      a: {},
      d: {
        powers: [
          power(
            "Psionic Force Field",
            "When defending against an attack, this character changes wild results in the attack roll to Blanks.",
          ),
        ],
      },
      oracle: { d: { blankWilds: true } },
    },
    {
      label: "Eye defense versus attacker pierce",
      a: { steps: [pierce] },
      d: { powers: [eye()] },
      oracle: {
        pierce: [3],
        d: { allowFailures: true, rerolls: [{ all: true }] },
      },
    },
    {
      label: "echo on both sides",
      a: {
        powers: [
          power(
            "Death Dancer",
            "While attacking, change 1 die to a hit for each opposing critical.",
          ),
        ],
      },
      d: {
        powers: [
          power(
            "Death Dancer",
            "While defending, change 1 die to a block for each opposing critical.",
          ),
        ],
      },
      oracle: { a: { echo: true }, d: { echo: true } },
    },
    {
      label: "reroll count depends on opposing initial criticals",
      a: {
        powers: [
          power(
            "Analyze and Annihilate",
            "While attacking, this character may reroll 1 of its attack dice for each critical in the opposing defense roll.",
          ),
        ],
      },
      d: { powers: [rr("Guard", 1, "defense")] },
      oracle: {
        a: { rerolls: [{ enemyCriticals: true }] },
        d: { rerolls: [{ n: 1 }] },
      },
    },
    {
      label: "critical immunity still supplies criticals to Echo",
      a: {
        steps: [
          "The defender does not add critical results in its defense roll to its total successes and cannot add additional dice to its defense roll as a result of critical results.",
        ],
        powers: [
          power(
            "Death Dancer",
            "While attacking, change 1 die to a hit for each opposing critical.",
          ),
        ],
      },
      d: {
        powers: [
          power(
            "Death Dancer",
            "While defending, change 1 die to a block for each opposing critical.",
          ),
        ],
      },
      oracle: {
        a: { echo: true },
        d: { echo: true, noCriticalSuccess: true, noCriticalDice: true },
      },
    },
    {
      label: "innate reduction min one",
      a: {},
      d: {
        powers: [
          power(
            "Armor",
            "When this character would suffer damage, reduce the amount suffered by 1, to a minimum of 1.",
          ),
        ],
      },
      oracle: { d: { reduction: 1, minimum: 1 } },
    },
    {
      label: "paid reduction min zero",
      a: {},
      d: {
        powers: [
          power(
            "Armor",
            "When this character would suffer damage, reduce the amount suffered by 1.",
            1,
            "reactive",
          ),
        ],
      },
      oracle: { d: { energy: 10, reduction: 1, reductionCost: 1, minimum: 0 } },
    },
  ];
  cases.push(
    {
      label: "two additional non-expanding critical dice",
      a: {
        steps: [
          "When rolling additional dice for critical results during this attack, roll 2 additional dice instead of 1 for each critical.",
        ],
      },
      d: {},
      oracle: { a: { criticalExtra: 2 } },
    },
    {
      label: "Cloak before a double critical expansion",
      a: {
        cost: 9,
        powers: [cloak()],
        steps: [
          "When rolling additional dice for critical results during this attack, roll 2 additional dice instead of 1 for each critical.",
        ],
      },
      d: {},
      oracle: { a: { criticalExtra: 2, cloak: true, energy: 1 } },
    },
    {
      label: "defending wilds do not count, but remain available for reroll",
      a: {
        steps: [
          "The defender does not count wild results as successes when defending against this attack.",
        ],
      },
      d: {
        context: { conditions: ["bleed"] },
        powers: [rr("Guard", 1, "defense")],
      },
      oracle: { d: { noWildSuccess: true, rerolls: [{ n: 1 }] } },
    },
    {
      label: "duplicate limited rerolls use different dice",
      a: { dice: 2, powers: [rr("First", 1), rr("First", 1)] },
      d: {},
      oracle: {
        attackDice: 2,
        a: {
          rerolls: [
            { n: 1, id: "same" },
            { n: 1, id: "same" },
          ],
        },
      },
    },
    {
      label: "second ability can reroll skulls protected from the first",
      a: { powers: [rr("First", 1), rr("Second", 1, "attack", true)] },
      d: {},
      oracle: { a: { rerolls: [{ n: 1 }, { n: 1, failures: true }] } },
    },
    {
      label:
        "attacker observes initial defense criticals before Eye rerolls them",
      a: {
        powers: [
          power(
            "Analyze and Annihilate",
            "While attacking, this character may reroll 1 of its attack dice for each critical in the opposing defense roll.",
          ),
        ],
        steps: [
          "The defender does not add critical results in its defense roll to its total successes and cannot add additional dice to its defense roll as a result of critical results.",
        ],
      },
      d: { powers: [eye()] },
      oracle: {
        a: { rerolls: [{ enemyCriticals: true }] },
        d: {
          allowFailures: true,
          rerolls: [{ all: true }],
          noCriticalSuccess: true,
          noCriticalDice: true,
        },
      },
    },
    {
      label: "block substitution after opponent rerolls",
      a: {
        powers: [
          power(
            "Special Forces",
            "When this character is attacking, it may count block results instead of hit results as successes.",
            1,
            "reactive",
          ),
        ],
      },
      d: { powers: [force()] },
      oracle: {
        a: { energy: 10, swap: true, swapCost: 1 },
        d: { energy: 10, opponentReroll: { n: 1, cost: 1 } },
      },
    },
    {
      label: "wild conversion then defensive cancellation",
      a: {
        powers: [
          power(
            "The Cards Always Be In My Favor",
            "When attacking, each wild counts as 2 successes.",
          ),
          power(
            "A Little Something Extra",
            "When attacking, change 1 hit to a wild.",
            1,
            "reactive",
          ),
        ],
      },
      d: { powers: [absorption()] },
      oracle: {
        a: { doubleWild: true, hitToWild: true, hitToWildCost: 1, energy: 10 },
        d: { cancelWilds: true },
      },
    },
    {
      label: "one tax payment for bounded Cloak",
      a: {
        dice: 2,
        cost: 8,
        powers: [cloak()],
        context: { conditions: ["root"] },
      },
      d: {},
      oracle: { attackDice: 2, a: { cloak: true, energy: 2, tax: 1 } },
    },
    {
      label: "one activation price for two Arrogance clauses",
      a: {
        powers: [
          power(
            "Attack prep",
            "During the next attack made by this character, add 2 dice to the attack roll.",
            9,
            "active",
          ),
          power(
            "Arrogance",
            "When attacking, add failure results to the attack and defense rolls.",
            1,
            "reactive",
          ),
        ],
      },
      d: {},
      oracle: { attackDice: 3, a: { skulls: true }, d: { skulls: true } },
    },
  );
  for (const c of cases) {
    const actual = exact(make(c.a), make(c.d)).full;
    try {
      same(actual, exhaustive(c.oracle));
    } catch (e) {
      throw new Error(c.label + ": " + e.message);
    }
  }
});
test("opponent reroll does not introduce Pierce: the one-vs-one mean is an exact rational", () => {
  const result = exact(make(), make({ powers: [force()] }));
  close(result.base.mean, 0.3720703125);
  close(result.full.mean, 0.20556640625);
});
test("nonrecursive doubled criticals and bounded Cloak preserve all probability mass", () => {
  const p = D.partition((face) => face),
    unit = { resource: 2, tax: 0, effects: [{ kind: "cloak" }], flags: {} };
  const full = D.initialRoll(1, unit, p, { critExtra: 2 });
  close(
    full.reduce((n, s) => n + s.probability, 0),
    1,
  );
  assert(full.every((s) => s.counts.reduce((n, v) => n + v, 0) <= 3));
  // An added skull remains a skull even though one power remains after converting the initial skull.
  assert(full.some((s) => s.resource === 1 && s.counts[5] > 0));
  const bounded = D.initialRoll(2, { ...unit, resource: 1 }, p);
  assert(bounded.every((s) => (s.resource & 15) >= 0));
  close(
    bounded.reduce((n, s) => n + s.probability, 0),
    1,
  );
});
test("all retained probabilities, not a seed or RNG, determine the answer", () => {
  const saved = Math.random;
  Math.random = () => {
    throw Error("No random numbers permitted");
  };
  try {
    const p = make({ powers: [rr("Unique exact deterministic test", 1)] }),
      result = exact(p, make());
    assert.equal(result.full.method, "exact");
    assert.equal(result.full.error, undefined);
    assert.equal(result.full.samples, undefined);
    same(result.full, exhaustive({ a: { rerolls: [{ n: 1 }] } }));
  } finally {
    Math.random = saved;
  }
});
test("typed defensive rerolls stay defensive, including Hulk Not Puny Banner", () => {
  const characters = require("../data/catalog.json").characters;
  for (const [slug, name] of [
    ["hulk", "Hulk Not Puny Banner"],
    ["blade", "Supernatural Senses"],
    ["blue-marvel", "Anti-Matter Barrier"],
    ["spider-man-2099", "Acceleration Decoy"],
  ]) {
    const c = characters.find((c) => c.slug === slug),
      p = P.profile(
        c,
        require("../data/cards/" + slug + ".json"),
        P.initialState(slug),
      ),
      a = attack(make());
    assert(
      !R.powerRules(p, make(), a, "attack", 2).effects.some(
        (e) => e.name === name,
      ),
      slug + " attack",
    );
    assert(
      R.powerRules(p, make(), a, "defense", 2).effects.some(
        (e) => e.name === name,
      ),
      slug + " defense",
    );
  }
  const c = characters.find((c) => c.slug === "hulk"),
    p = P.profile(
      c,
      require("../data/cards/hulk.json"),
      P.initialState("hulk"),
    ),
    result = exact(p, p);
  assert(result.full.mean < result.base.mean);
});

test("end-of-step count-as works through a modification ban, and Moon Knight is an exact weighted mixture", () => {
  const mummy = make({
    defense: 0,
    powers: [
      power(
        "Undead Empowerment",
        "At the end of Modify Dice, count failure results as wild results.",
        0,
        "reactive",
      ),
    ],
    context: { tokens: 1 },
  });
  const bare = make({ defense: 0 });
  close(exact(mummy, bare).base.mean, 45 / 64);
  const cat = make({
    defense: 0,
    powers: [
      power(
        "Bad Luck",
        "When targeting this character, enemies cannot modify dice or add critical dice.",
      ),
    ],
  });
  close(exact(mummy, cat).base.mean, 5 / 8);
  const moon = make({
    powers: [
      power(
        "Multiple Personalities",
        "At the start of Activation, roll one die.",
      ),
    ],
  });
  const one = raise([1 / 2, 7 / 16, 1 / 16], 1),
    three = raise([1 / 2, 7 / 16, 1 / 16], 3),
    distribution = three.map((p, i) => (p * 3) / 8 + ((one[i] || 0) * 5) / 8);
  same(exact(moon, bare).base, {
    distribution,
    mean: 63 / 64,
    chance: 1 - distribution[0],
  });
});
test("Dormammu's copied failures are actual additional faces for Loki's opposing-failure count", () => {
  const characters = require("../data/catalog.json").characters;
  const load = (slug) =>
    P.profile(
      characters.find((c) => c.slug === slug),
      require("../data/cards/" + slug + ".json"),
      P.initialState(slug),
    );
  const a = load("dormammu"),
    d = load("loki-prince-of-lies");
  const result = exact(a, d),
    plain = exact({ ...a, powers: [] }, { ...d, powers: [] });
  close(result.base.mean, plain.base.mean);
});

test("an attack-action reroll cannot strengthen defense, including For Midgard", () => {
  const characters = require("../data/catalog.json").characters,
    c = characters.find((c) => c.slug === "mighty-thor"),
    p = P.profile(
      c,
      require("../data/cards/mighty-thor.json"),
      P.initialState("mighty-thor"),
    ),
    a = attack(make());
  assert(
    R.powerRules(p, make(), a, "attack", 2).effects.some(
      (e) => e.name === "For Midgard!",
    ),
  );
  assert(
    !R.powerRules(p, make(), a, "defense", 2).effects.some(
      (e) => e.name === "For Midgard!",
    ),
  );
});

test("case-insensitive role detection retains a combined Attack or Defense reroll", () => {
  const p = make({
    powers: [
      power(
        "Hybrid reroll",
        "This character may reroll 1 die in its Attack or Defense dice.",
      ),
    ],
  });
  for (const role of ["attack", "defense"])
    assert(
      R.powerRules(p, make(), attack(p), role, 2).effects.some(
        (e) => e.kind === "reroll",
      ),
    );
});
