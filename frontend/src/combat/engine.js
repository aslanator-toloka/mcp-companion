import { attackVariants, clean } from "./profile.js";
import { powerRules, attackRules } from "./rules.js";
// Physical MCP d8: 2 blanks, 2 hits, 1 block, 1 wild, 1 critical, 1 failure.
export const FACE = {
  blank: 0,
  hit: 1,
  block: 2,
  wild: 3,
  critical: 4,
  failure: 5,
};
const D8 = [0, 0, 1, 1, 2, 3, 4, 5];
const PRE = new Set([
  "dice",
  "setDefense",
  "blankSuccess",
  "failureSuccess",
  "enemyFailureSuccess",
  "ronin",
  "doubleWild",
]);
export function random(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const die = (rng) => D8[Math.floor(rng() * 8)];
const count = (roll, face) => {
  let n = 0;
  for (const d of roll) if (d.f === face) n++;
  return n;
};
const flags = (effects) =>
  Object.fromEntries(effects.filter((e) => !e.paid).map((e) => [e.kind, true]));
function success(face, role, f) {
  if (face === FACE.critical) return f.noCritSuccess ? 0 : 1;
  if (face === FACE.wild) return f.noWildSuccess ? 0 : f.doubleWild ? 2 : 1;
  if (face === (role === "attack" ? FACE.hit : FACE.block)) return 1;
  if (
    (face === FACE.blank && f.blankSuccess) ||
    (face === FACE.failure && f.failureSuccess)
  )
    return 1;
  return 0;
}
const total = (roll, role, f) =>
  roll.reduce((n, d) => n + success(d.f, role, f), 0);
const meanFace = (role, f) =>
  D8.reduce((n, face) => n + success(face, role, f), 0) / 8;
function pay(unit, e, amount = 1) {
  if (e.paid && !e.variable && unit.used.has(e.name)) return true;
  const cost = e.cost * amount + (e.paid ? unit.tax : 0);
  if (cost > unit.power) return false;
  unit.power -= cost;
  if (e.paid && !e.variable) unit.used.add(e.name);
  return true;
}
function prep(p, rules, power, tax, role) {
  const u = {
    ...p,
    effects: rules.effects,
    power,
    tax: tax + (p.state.conditions.includes("root") ? 1 : 0),
    used: new Set(),
    f: flags(rules.effects),
    bonus: 0,
  };
  for (const e of u.effects) {
    if (
      e.kind === "dice" ||
      e.kind === "setDefense" ||
      (e.paid && PRE.has(e.kind))
    ) {
      if (pay(u, e)) {
        if (e.kind === "dice") u.bonus += e.amount;
        else if (e.kind === "setDefense") u.override = e.amount;
        else u.f[e.kind] = true;
      }
    }
  }
  if (u.state.conditions.includes("hex")) u.f.noCrit = true;
  if (u.state.conditions.includes("shock") && role === "attack") u.bonus--;
  if (u.state.conditions.includes("incinerate") && role === "defense")
    u.bonus--;
  return u;
}
export function rollPool(
  n,
  {
    rng,
    power = 0,
    cloak = false,
    cloakAll = false,
    tax = 0,
    critExtra = 1,
    noCrit = false,
  } = {},
) {
  const roll = Array.from({ length: Math.max(0, Math.min(60, n)) }, () => ({
    f: die(rng),
    rerolledBy: [],
  }));
  let spent = 0;
  if ((cloak || cloakAll) && power >= (cloakAll ? 2 + tax : tax + 1)) {
    const failures = roll.filter((d) => d.f === FACE.failure);
    const used = cloakAll
      ? failures.length
      : Math.min(failures.length, Math.max(0, power - tax));
    if (used) {
      for (let i = 0; i < used; i++) failures[i].f = FACE.critical;
      spent = cloakAll ? 2 + tax : used + tax;
    }
  }
  // Only criticals in the original roll expand. Rerolls and added dice never expand.
  const extra = noCrit ? 0 : count(roll, FACE.critical) * critExtra;
  for (let i = 0; i < extra; i++) roll.push({ f: die(rng), rerolledBy: [] });
  return { roll, spent };
}
function ownReroll(roll, u, role, effect, rng, max) {
  if (u.f.banned) return;
  const failures = u.f.failureAllowed || effect.failures;
  const key = effect.name || "attack-special-reroll";
  let candidates = roll.filter(
    (d) => !d.rerolledBy.includes(key) && (d.f !== FACE.failure || failures),
  );
  if (effect.kind === "allReroll") {
    if (
      effect.conditional &&
      count(roll, role === "attack" ? FACE.hit : FACE.block)
    )
      return;
    // 'All' is indivisible: keep it unless the expected total improves.
    if (
      candidates.reduce((s, d) => s + success(d.f, role, u.f), 0) >=
      candidates.length * meanFace(role, u.f)
    )
      return;
  } else {
    candidates = candidates.filter((d) => !success(d.f, role, u.f));
    candidates.sort((a, b) => a.f - b.f);
    candidates = candidates.slice(0, max);
  }
  if (!candidates.length) return;
  if (effect.variable)
    candidates = candidates.slice(
      0,
      Math.max(
        0,
        Math.min(effect.max || 99, u.power - (effect.paid ? u.tax : 0)),
      ),
    );
  if (
    !candidates.length ||
    !pay(u, effect, effect.variable ? candidates.length : 1)
  )
    return;
  for (const d of candidates) {
    d.f = die(rng);
    d.rerolledBy.push(key);
  }
}
function modify(roll, otherRoll, u, role, attackRules, rng) {
  if (u.f.banned) return;
  if (role === "attack" && attackRules.reroll)
    ownReroll(
      roll,
      u,
      role,
      { kind: "reroll", cost: 0, failures: attackRules.failures },
      rng,
      attackRules.reroll,
    );
  if (role === "attack" && attackRules.allReroll)
    ownReroll(
      roll,
      u,
      role,
      { kind: "allReroll", cost: 0, failures: attackRules.failures },
      rng,
    );
  // Fixed/free rerolls before variable paid rerolls avoid spending on the same die.
  const effects = u.effects
    .filter((e) =>
      ["reroll", "allReroll", "rerollPerEnemyCrit"].includes(e.kind),
    )
    .sort((a, b) => a.cost - b.cost);
  for (const e of effects)
    ownReroll(
      roll,
      u,
      role,
      e,
      rng,
      e.kind === "rerollPerEnemyCrit"
        ? count(otherRoll, FACE.critical)
        : e.amount,
    );
  if (u.f.echo || u.f.ronin) {
    let n = u.f.echo ? count(otherRoll, FACE.critical) : 0;
    if (u.f.ronin) n += count(roll, FACE.critical) + count(roll, FACE.wild);
    for (const d of roll)
      if (
        n &&
        !success(d.f, role, u.f) &&
        (d.f !== FACE.failure || u.f.failureAllowed)
      ) {
        d.f = role === "attack" ? FACE.hit : FACE.block;
        n--;
      }
  }
  for (const e of u.effects) {
    if (e.kind === "hitToWild") {
      const d = roll.find((d) => d.f === FACE.hit);
      if (d && pay(u, e)) d.f = FACE.wild;
    }
  }
  if (role === "defense" && u.cover) {
    const d = roll.find(
      (d) =>
        !success(d.f, role, u.f) &&
        (d.f !== FACE.failure || u.f.failureAllowed),
    );
    if (d) d.f = FACE.block;
  }
}
function alterOpponent(roll, own, u, target, role, rng, aRules) {
  if (role === "attack" && aRules.pierce.length) {
    const wanted = aRules.pierce.map((s) => FACE[s]);
    const available = own.map((d) => d.f);
    if (
      wanted.every((f) => {
        const i = available.indexOf(f);
        if (i < 0) return false;
        available.splice(i, 1);
        return true;
      })
    ) {
      const value = (die) =>
        success(die.f, "defense", target.f) -
        success(FACE.blank, "defense", target.f) +
        (die.f === FACE.wild &&
        target.effects.some((e) => e.kind === "cancelWithWilds")
          ? 1
          : 0);
      const d = roll
        .filter(
          (d) =>
            [FACE.critical, FACE.wild, FACE.block].includes(d.f) &&
            value(d) > 0,
        )
        .sort((a, b) => value(b) - value(a))[0];
      if (d) d.f = FACE.blank;
    }
  }
  for (const e of u.effects) {
    if (e.kind === "opponentReroll") {
      const candidates = roll
        .filter(
          (d) =>
            !d.rerolledBy.includes(e.name) &&
            success(d.f, role === "attack" ? "defense" : "attack", target.f),
        )
        .sort(
          (a, b) =>
            success(b.f, role === "attack" ? "defense" : "attack", target.f) -
            success(a.f, role === "attack" ? "defense" : "attack", target.f),
        )
        .slice(0, e.amount);
      if (candidates.length && pay(u, e))
        for (const d of candidates) {
          d.f = die(rng);
          d.rerolledBy.push(e.name);
        }
    }
    if (e.kind === "blankEnemyWilds" || e.kind === "cancelWithWilds") {
      let candidates = roll.filter((d) =>
        e.kind === "blankEnemyWilds"
          ? d.f === FACE.wild
          : [FACE.critical, FACE.wild, FACE.hit].includes(d.f),
      );
      candidates = candidates.slice(
        0,
        e.kind === "cancelWithWilds" ? count(own, FACE.wild) : e.amount,
      );
      if (e.variable)
        candidates = candidates.slice(
          0,
          Math.max(0, u.power - (e.paid ? u.tax : 0)),
        );
      if (candidates.length && pay(u, e, e.variable ? candidates.length : 1))
        for (const d of candidates) d.f = FACE.blank;
    }
  }
}
export function damageForRolls(aRoll, dRoll, a, d, r) {
  let av = total(aRoll, "attack", a.f),
    dv = total(dRoll, "defense", d.f);
  if (a.f.addEnemyFailures || a.f.enemyFailures)
    av += count(dRoll, FACE.failure);
  if (d.f.enemyFailures) dv += count(aRoll, FACE.failure);
  if (a.f.enemyFailureSuccess) dv += count(dRoll, FACE.failure);
  if (!a.f.banned)
    for (const e of a.effects)
      if (
        e.kind === "swapHits" &&
        count(aRoll, FACE.block) > count(aRoll, FACE.hit) &&
        pay(a, e)
      )
        av += count(aRoll, FACE.block) - count(aRoll, FACE.hit);
  let damage = Math.max(0, av - dv);
  if (r.noDamage) return 0;
  if (r.cap !== null) damage = Math.min(r.cap, damage);
  if (!a.f.noReduction)
    for (const e of d.effects)
      if (e.kind === "capDamage") damage = Math.min(e.amount, damage);
  if (!a.f.noReduction)
    for (const e of d.effects
      .filter((e) => e.kind === "reduce")
      .sort((a, b) => a.cost - b.cost)) {
      if (damage > (e.minimum || 0) && pay(d, e))
        damage = Math.max(e.minimum || 0, damage - e.amount);
    }
  return damage;
}
function trial(p, q, attack, ar, dr, r, distance, full, rng) {
  const aTax = dr.effects.find((e) => e.kind === "taxEnemy")?.amount || 0,
    dTax = ar.effects.find((e) => e.kind === "taxEnemy")?.amount || 0;
  let attackPower = full ? 10 - Number(attack.powerCost) : 0;
  let defenseStat = q.defense[attack.type];
  if (
    dr.effects.some((e) => e.kind === "smoke") &&
    q.defense.mystic > defenseStat
  ) {
    if (attackPower >= 2) attackPower -= 2;
    else defenseStat = q.defense.mystic;
  }
  const a = prep(p, ar, attackPower, aTax, "attack"),
    d = prep(q, dr, full ? 10 : 0, dTax, "defense");
  a.f.banned = dr.effects.some((e) => e.kind === "banEnemyMod");
  d.f.banned =
    r.banDefenseMod || ar.effects.some((e) => e.kind === "banEnemyMod");
  a.f.noCrit ||= dr.effects.some((e) => e.kind === "banEnemyCrit");
  d.f.noCrit ||=
    r.noDefenseCrit || ar.effects.some((e) => e.kind === "banEnemyCrit");
  d.f.noCritSuccess = r.noDefenseCrit;
  d.f.noWildSuccess = r.noDefenseWild;
  a.f.doubleWild ||= r.doubleWild;
  d.cover =
    q.state.cover &&
    distance > 2 &&
    !/does not benefit from cover/i.test(clean(attack.steps.join(" "))) &&
    !p.powers.some((e) =>
      /defender does not benefit from Cover/i.test(clean(e.body)),
    );
  let dice =
    Number(attack.strength) +
    r.bonus +
    a.bonus +
    (r.enemyPowerBonus ? Math.min(5, d.power) : 0);
  if (r.extras) {
    const spent = Math.min(r.extras, a.power);
    a.power -= spent;
    dice += spent;
  }
  if (
    ar.effects.some((e) => e.kind === "moonKnight") &&
    [FACE.hit, FACE.wild].includes(die(rng))
  )
    dice += 2;
  const roll = (u, n, critExtra) => {
    const cloak = u.effects.find(
      (e) => e.kind === "cloak" || e.kind === "cloakAll",
    );
    const v = rollPool(n, {
      rng,
      power: u.power,
      cloak: cloak?.kind === "cloak",
      cloakAll: cloak?.kind === "cloakAll",
      tax: u.tax,
      critExtra,
      noCrit: u.f.noCrit,
    });
    u.power -= v.spent;
    return v.roll;
  };
  const aRoll = roll(a, Math.max(1, dice), r.critExtra),
    dRoll = roll(
      d,
      defenseStat === 0 && d.bonus === 0 && !d.override
        ? 0
        : Math.max(1, (d.override ?? defenseStat) + d.bonus),
      1,
    );
  modify(aRoll, dRoll, a, "attack", r, rng);
  modify(dRoll, aRoll, d, "defense", r, rng);
  alterOpponent(dRoll, aRoll, a, d, "attack", rng, r);
  alterOpponent(aRoll, dRoll, d, a, "defense", rng, r);
  // Undead Empowerment counts faces at the end of Modify Dice; it is not a modification.
  for (const e of a.effects)
    if (e.kind === "failureToWild" && pay(a, e)) {
      let n = e.amount;
      for (const die of aRoll)
        if (n && die.f === FACE.failure) {
          die.f = FACE.wild;
          n--;
        }
    }
  if (r.sap) d.power = Math.max(0, d.power - count(aRoll, FACE.wild));
  return damageForRolls(aRoll, dRoll, a, d, r);
}
export function simulateAttack(
  p,
  q,
  attack,
  { distance = 2, samples = 60000, seed = 93617 } = {},
) {
  distance = Math.max(1, Math.min(5, Number(distance) || 2));
  samples = Math.max(1, Math.min(500000, Math.floor(samples)));
  const ar = powerRules(p, q, attack, "attack", distance),
    dr = powerRules(q, p, attack, "defense", distance),
    r = attackRules(p, q, attack, distance);
  const reach = Number(String(attack.range).replace(/[AB]/gi, ""));
  const stealth =
    q.powers.some((e) => /(?:^|, )Stealth(?:,|$)/.test(clean(e.name))) ||
    (q.slug === "omega-sentinel" && q.state.stance === "energy");
  const ignoresStealth =
    /ignores.*Stealth/i.test(clean(attack.steps.join(" "))) ||
    p.powers.some((e) => /ignores (?:the )?Stealth/i.test(clean(e.body)));
  const unavailable =
    !Number.isFinite(Number(attack.strength)) ||
    !Number.isFinite(Number(attack.powerCost)) ||
    +attack.powerCost > 10
      ? "Переменная сила или цена атаки требует отдельного правила"
      : distance > reach
        ? "Вне дальности атаки"
        : distance > 3 && stealth && !ignoresStealth
          ? "Stealth: цель вне дальности 3"
          : null;
  const result = {
    id: attack.id,
    name: attack.name,
    type: attack.type,
    strength: attack.strength,
    range: attack.range,
    cost: attack.powerCost,
    unavailable,
    warnings: [...new Set([...ar.warnings, ...dr.warnings, ...r.warnings])],
    notes: [...new Set([...ar.notes, ...dr.notes, ...r.notes])],
    rules: {
      attacker: ar.effects.map((e) => ({
        name: e.name,
        cost: e.variable ? "X" : e.cost,
      })),
      defender: dr.effects.map((e) => ({
        name: e.name,
        cost: e.variable ? "X" : e.cost,
      })),
    },
  };
  if (unavailable) return result;
  for (const [key, full] of [
    ["base", false],
    ["full", true],
  ]) {
    const rng = random(seed);
    let sum = 0,
      sum2 = 0,
      hit = 0;
    for (let i = 0; i < samples; i++) {
      const damage = trial(p, q, attack, ar, dr, r, distance, full, rng);
      sum += damage;
      sum2 += damage * damage;
      if (damage) hit++;
    }
    const mean = sum / samples;
    result[key] = {
      mean,
      error:
        samples > 1
          ? 1.96 *
            Math.sqrt(Math.max(0, sum2 / samples - mean * mean) / samples)
          : 0,
      chance: hit / samples,
      samples,
    };
  }
  return result;
}
export function compare(p, q, options) {
  return [
    [p, q],
    [q, p],
  ].map(([attacker, defender]) => ({
    attacker: attacker.slug,
    defender: defender.slug,
    attacks: attackVariants(attacker).map((a) =>
      simulateAttack(attacker, defender, a, options),
    ),
  }));
}
