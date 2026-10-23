// Exact finite-state probability model for the implemented single-attack policy.
// Conditioning order: defense initial criticals -> attacker self modifications ->
// attacker modified criticals -> defender self modifications -> opponent changes.
// No draws, seeds, sampled confidence intervals, or probability cutoffs.
import { attackVariants, clean } from "./profile.js";
import { powerRules, attackRules } from "./rules.js";
import {
  initialRoll,
  faceCount,
  addState,
  states,
  project,
  changeFaces,
} from "./exact-dice.js";
import {
  FACE,
  prepare,
  pay,
  power,
  ownOperations,
  opponentOperations,
  bindRerollMasks,
  needsEnemyCriticals,
  partitions,
  afterSelf,
  groupBy,
  reroll,
  score,
  total,
} from "./exact-policy.js";
export { FACE };
const scenarioCache = new Map();
function scenario(p, q, attack, ar, dr, r, distance, full) {
  const aTax = dr.effects.find((e) => e.kind === "taxEnemy")?.amount || 0,
    dTax = ar.effects.find((e) => e.kind === "taxEnemy")?.amount || 0;
  let amount = full ? 10 - Number(attack.powerCost) : 0,
    defense = q.defense[attack.type];
  if (
    dr.effects.some((e) => e.kind === "smoke") &&
    q.defense.mystic > defense
  ) {
    if (amount >= 2) amount -= 2;
    else defense = q.defense.mystic;
  }
  const a = prepare(p, ar, amount, aTax, "attack"),
    d = prepare(q, dr, full ? 10 : 0, dTax, "defense");
  a.flags.banned = dr.effects.some((e) => e.kind === "banEnemyMod");
  d.flags.banned =
    r.banDefenseMod || ar.effects.some((e) => e.kind === "banEnemyMod");
  a.flags.noCrit ||= dr.effects.some((e) => e.kind === "banEnemyCrit");
  d.flags.noCrit ||=
    r.noDefenseCrit || ar.effects.some((e) => e.kind === "banEnemyCrit");
  d.flags.noCritSuccess = r.noDefenseCrit;
  d.flags.noWildSuccess = r.noDefenseWild;
  a.flags.doubleWild ||= r.doubleWild;
  d.cover =
    q.state.cover &&
    distance > 2 &&
    !/does not benefit from cover/i.test(clean(attack.steps.join(" "))) &&
    !p.powers.some((e) =>
      /defender does not benefit from Cover/i.test(clean(e.body)),
    );
  let na =
    Number(attack.strength) +
    r.bonus +
    a.bonus +
    (r.enemyPowerBonus ? Math.min(5, power(d.resource)) : 0);
  if (r.extras) {
    const n = Math.min(r.extras, power(a.resource));
    a.resource -= n;
    na += n;
  }
  na = Math.max(1, na);
  const nd =
    defense === 0 && d.bonus === 0 && !d.override
      ? 0
      : Math.max(1, (d.override ?? defense) + d.bonus);
  // After pools are created, unused power has no observable effect. Marginalize it.
  const resourceKinds = new Set([
    "cloak",
    "cloakAll",
    "reroll",
    "allReroll",
    "rerollPerEnemyCrit",
    "opponentReroll",
    "blankEnemyWilds",
    "reduce",
    "failureToWild",
    "hitToWild",
    "swapHits",
  ]);
  for (const unit of [a, d])
    if (
      !unit.effects.some(
        (e) => resourceKinds.has(e.kind) && e.paid && (e.cost || unit.tax),
      )
    )
      unit.resource = 0;
  const ao = ownOperations(a, r),
    do_ = ownOperations(d, r),
    ax = opponentOperations(a),
    dx = opponentOperations(d);
  const ma = bindRerollMasks(ao, dx),
    md = bindRerollMasks(do_, ax);
  const needsA = needsEnemyCriticals(a, ao),
    needsD = needsEnemyCriticals(d, do_);
  const pa = partitions(a, ao, dx, d, r, {
    postCrit: needsD,
    incomingMask: ma,
  });
  const paFinal = needsD
    ? partitions(a, ao, dx, d, r, { incomingMask: ma }).after
    : pa.after;
  const pd = partitions(d, do_, ax, a, r, {
    initialCrit: needsA,
    incomingMask: md,
  });
  return {
    a,
    d,
    ao,
    do_,
    ax,
    dx,
    pa,
    paFinal,
    pd,
    na,
    nd,
    needsA,
    needsD,
    r,
    moon: a.effects.some((e) => e.kind === "moonKnight"),
  };
}
function initialAttack(c) {
  const regular = initialRoll(c.na, c.a, c.pa.before, {
    critExtra: c.r.critExtra,
  });
  if (!c.moon) return regular;
  const boosted = initialRoll(c.na + 2, c.a, c.pa.before, {
      critExtra: c.r.critExtra,
    }),
    result = new Map();
  for (const [distribution, weight] of [
    [regular, 5 / 8],
    [boosted, 3 / 8],
  ])
    for (const s of distribution)
      addState(result, s.counts, s.resource, s.probability * weight);
  return states(result);
}
function summary(state, p, unit, other, r, { pierce = false } = {}) {
  const attack = unit.role === "attack";
  const failNeeded = attack
    ? other.flags.enemyFailures ||
      unit.effects.some((e) => e.kind === "failureToWild")
    : other.flags.enemyFailures ||
      other.flags.addEnemyFailures ||
      other.flags.enemyFailureSuccess;
  const swap =
    attack &&
    !unit.flags.banned &&
    unit.effects.some(
      (e) => e.kind === "swapHits" && pay(unit.resource, e, unit) >= 0,
    );
  let gain = 0;
  if (pierce)
    for (const face of [2, 3, 4])
      if (faceCount(state, p, face))
        gain = Math.max(
          gain,
          score(face, "defense", unit.flags) - score(0, "defense", unit.flags),
        );
  return {
    resource: state.resource,
    success: total(state, p, unit),
    failures: failNeeded ? faceCount(state, p, 5) : 0,
    wilds: attack && r.sap ? faceCount(state, p, 3) : 0,
    swap: swap
      ? Math.max(0, faceCount(state, p, 2) - faceCount(state, p, 1))
      : 0,
    gain,
    trigger: state.trigger,
    probability: state.probability,
  };
}
function summaries(distribution, p, unit, other, r, pierce) {
  const map = new Map();
  for (const state of distribution) {
    const s = summary(state, p, unit, other, r, { pierce });
    const key = [
      s.resource,
      s.success,
      s.failures,
      s.wilds,
      s.swap,
      s.gain,
      +s.trigger,
    ].join(",");
    const old = map.get(key);
    if (old) old.probability += s.probability;
    else map.set(key, s);
  }
  return [...map.values()];
}
function damage(sa, sd, c, pierce) {
  const { a, d, r } = c;
  let av = sa.success,
    dv = sd.success,
    af = sa.failures,
    aw = sa.wilds,
    ra = sa.resource,
    rd = sd.resource;
  for (const e of a.effects)
    if (e.kind === "failureToWild") {
      const n = Math.min(e.amount, af),
        paid = n ? pay(ra, e, a) : -1;
      if (paid >= 0) {
        ra = paid;
        av += n * (score(3, "attack", a.flags) - score(5, "attack", a.flags));
        af -= n;
        aw += n;
      }
    }
  if (a.flags.addEnemyFailures) {
    av += sd.failures * score(5, "attack", a.flags);
    af += sd.failures;
  }
  if (a.flags.enemyFailures) av += sd.failures;
  if (d.flags.enemyFailures) dv += af;
  if (a.flags.enemyFailureSuccess) dv += sd.failures;
  if (pierce && c.r.pierce.length && sa.trigger) dv -= sd.gain;
  if (!a.flags.banned && sa.swap)
    for (const e of a.effects)
      if (e.kind === "swapHits") {
        const paid = pay(ra, e, a);
        if (paid >= 0) {
          ra = paid;
          av += sa.swap;
        }
      }
  if (r.sap) rd = rd - power(rd) + Math.max(0, power(rd) - aw);
  let result = Math.max(0, av - dv);
  if (r.noDamage) return 0;
  if (r.cap !== null) result = Math.min(r.cap, result);
  if (!a.flags.noReduction) {
    for (const e of d.effects)
      if (e.kind === "capDamage") result = Math.min(e.amount, result);
    for (const e of d.effects
      .filter((e) => e.kind === "reduce")
      .sort((a, b) => a.cost - b.cost))
      if (result > (e.minimum || 0)) {
        const paid = pay(rd, e, d);
        if (paid >= 0) {
          rd = paid;
          result = Math.max(e.minimum || 0, result - e.amount);
        }
      }
  }
  return result;
}
function stateKey(s) {
  return s.resource + ":" + s.counts.join(",");
}
function mergeTransitions(values) {
  const map = new Map();
  for (const value of values) {
    const key = value.resource + "/" + stateKey(value.roll);
    const old = map.get(key);
    if (old) old.probability += value.probability;
    else map.set(key, value);
  }
  return [...map.values()];
}
function modifyOpponent(roll, ownWilds, resource, actor, target, p, e) {
  if (e.kind === "opponentReroll") {
    return reroll([{ ...roll, resource, probability: 1 }], actor, p, e, {
      opponent: true,
      target,
    }).map((s) => ({
      roll: { ...s, resource: roll.resource, probability: 1 },
      resource: s.resource,
      probability: s.probability,
    }));
  }
  const forced = e.kind === "blankEnemyWilds";
  const eligible = (f) =>
    forced
      ? f === 3
      : [1, 3, 4].includes(f) &&
        score(f, target.role, target.flags) >
          score(0, target.role, target.flags);
  let available = 0;
  for (let i = 0; i < roll.counts.length; i++)
    if (eligible(p.groups[i % p.width].face)) available += roll.counts[i];
  let n = Math.min(available, forced ? e.amount : ownWilds);
  if (e.variable)
    n = Math.min(
      n,
      Math.max(
        0,
        Math.floor(
          (power(resource) - (e.paid ? actor.tax : 0)) / (e.cost || 1),
        ),
      ),
    );
  const paid = n ? pay(resource, e, actor, e.variable ? n : 1) : -1;
  if (paid < 0) return [{ roll, resource, probability: 1 }];
  return [
    {
      roll: changeFaces(roll, p, {
        eligible,
        amount: n,
        target: 0,
        order: (f) => score(f, target.role, target.flags),
      }),
      resource: paid,
      probability: 1,
    },
  ];
}
function changes(roll, ownWilds, resource, actor, target, p, ops) {
  let current = [{ roll, resource, probability: 1 }];
  for (const e of ops) {
    const next = [];
    for (const value of current)
      for (const result of modifyOpponent(
        value.roll,
        ownWilds,
        value.resource,
        actor,
        target,
        p,
        e,
      ))
        next.push({
          ...result,
          probability: result.probability * value.probability,
        });
    current = mergeTransitions(next);
  }
  return current;
}
function pierce(roll, c) {
  const { d, pd } = c,
    p = pd.after;
  const benefit = (face) =>
    score(face, "defense", d.flags) -
    score(0, "defense", d.flags) +
    (face === 3 && c.dx.some((e) => e.kind === "cancelWithWilds") ? 1 : 0);
  return changeFaces(roll, p, {
    eligible: (f) => [2, 3, 4].includes(f) && benefit(f) > 0,
    amount: 1,
    target: 0,
    order: benefit,
  });
}
function exactScenario(c) {
  const first = initialAttack(c),
    second = initialRoll(c.nd, c.d, c.pd.before);
  // Keep the joint dependency rather than multiplying unconditional marginals.
  const byDCrit = groupBy(second, (s) =>
    c.needsA ? faceCount(s, c.pd.before, 4) : 0,
  );
  const histogram = [];
  const simple = !c.ax.length && !c.dx.length;
  const cacheA = new Map(),
    cacheD = new Map(),
    summaryA = new Map(),
    summaryD = new Map();
  const remember = (cache, key, fn) => {
    if (cache.has(key)) return cache.get(key);
    const result = fn();
    if (cache.size < 10000) cache.set(key, result);
    return result;
  };
  let combinations = 0;
  for (const [dc, initialD] of byDCrit) {
    const modifiedA = afterSelf(first, c.a, c.pa, c.ao, dc, c.r);
    const byACrit = groupBy(modifiedA, (s) =>
      c.needsD ? faceCount(s, c.pa.after, 4) : 0,
    );
    for (const [ac, groupA] of byACrit) {
      const finalA = c.needsD
        ? project(groupA, c.pa.after, c.paFinal, {
            mask: c.pa.incomingMask,
            trigger: (s) => s.trigger,
          })
        : groupA;
      const finalD = afterSelf(initialD, c.d, c.pd, c.do_, ac, c.r);
      if (simple) {
        const as = summaries(finalA, c.paFinal, c.a, c.d, c.r, false),
          ds = summaries(
            finalD,
            c.pd.after,
            c.d,
            c.a,
            c.r,
            !!c.r.pierce.length,
          );
        for (const sa of as)
          for (const sd of ds) {
            const result = damage(sa, sd, c, true);
            histogram[result] =
              (histogram[result] || 0) + sa.probability * sd.probability;
          }
        continue;
      }
      for (const sa of finalA)
        for (const sd of finalD) {
          if (++combinations > 10000000)
            throw Error(
              "Слишком много взаимодействующих состояний для точного расчёта этого сочетания",
            );
          const aw = c.ax.some((e) => e.kind === "cancelWithWilds")
            ? faceCount(sa, c.paFinal, 3)
            : 0;
          const aKey =
            stateKey(sd) + "/" + sa.resource + "/" + +sa.trigger + "/" + aw;
          const afterA = remember(cacheA, aKey, () =>
            changes(
              sa.trigger && c.r.pierce.length
                ? pierce({ ...sd, probability: 1 }, c)
                : { ...sd, probability: 1 },
              aw,
              sa.resource,
              c.a,
              c.d,
              c.pd.after,
              c.ax,
            ),
          );
          for (const da of afterA) {
            const dw = c.dx.some((e) => e.kind === "cancelWithWilds")
              ? faceCount(da.roll, c.pd.after, 3)
              : 0;
            const aRoll = { ...sa, resource: da.resource, probability: 1 };
            const dKey = stateKey(aRoll) + "/" + da.roll.resource + "/" + dw;
            const afterD = remember(cacheD, dKey, () =>
              changes(aRoll, dw, da.roll.resource, c.d, c.a, c.paFinal, c.dx),
            );
            for (const ad of afterD) {
              const dRoll = { ...da.roll, resource: ad.resource };
              const asum = remember(summaryA, stateKey(ad.roll), () =>
                summary(ad.roll, c.paFinal, c.a, c.d, c.r),
              );
              const dsum = remember(summaryD, stateKey(dRoll), () =>
                summary(dRoll, c.pd.after, c.d, c.a, c.r),
              );
              const result = damage(asum, dsum, c, false);
              histogram[result] =
                (histogram[result] || 0) +
                sa.probability *
                  sd.probability *
                  da.probability *
                  ad.probability;
            }
          }
        }
    }
  }
  for (let i = 0; i < histogram.length; i++) histogram[i] ||= 0;
  const mass = histogram.reduce((n, p) => n + p, 0);
  if (!Number.isFinite(mass) || Math.abs(mass - 1) > 1e-9)
    throw Error("Ошибка сохранения вероятности в точном расчёте");
  // Correct floating-point summation drift only; every outcome has been retained.
  const distribution = histogram.map((p) => p / mass);
  return {
    mean: distribution.reduce((n, p, damage) => n + damage * p, 0),
    chance: distribution.slice(1).reduce((n, p) => n + p, 0),
    distribution,
    method: "exact",
  };
}
function cachedScenario(c) {
  if (c.r.noDamage)
    return { mean: 0, chance: 0, distribution: [1], method: "exact" };
  const compact = (u) => ({
    flags: u.flags,
    resource: u.resource,
    tax: u.tax,
    cover: u.cover,
    effects: u.effects,
  });
  const key = JSON.stringify({
    a: compact(c.a),
    d: compact(c.d),
    na: c.na,
    nd: c.nd,
    r: c.r,
    moon: c.moon,
  });
  if (scenarioCache.has(key)) return scenarioCache.get(key);
  const value = exactScenario(c);
  if (scenarioCache.size >= 64)
    scenarioCache.delete(scenarioCache.keys().next().value);
  scenarioCache.set(key, value);
  return value;
}
export function calculateAttack(p, q, attack, { distance = 2 } = {}) {
  distance = Math.max(1, Math.min(5, Number(distance) || 2));
  const ar = powerRules(p, q, attack, "attack", distance),
    dr = powerRules(q, p, attack, "defense", distance),
    r = attackRules(p, q, attack, distance);
  const reach = Number(String(attack.range).replace(/[AB]/gi, ""));
  const stealth =
    q.powers.some((e) => /(?:^|, )Stealth(?:,|$)/.test(clean(e.name))) ||
    (q.slug === "omega-sentinel" && q.state.stance === "energy");
  const ignores =
    /ignores.*Stealth/i.test(clean(attack.steps.join(" "))) ||
    p.powers.some((e) => /ignores (?:the )?Stealth/i.test(clean(e.body)));
  const unavailable =
    !Number.isInteger(Number(attack.strength)) ||
    Number(attack.strength) < 0 ||
    !Number.isInteger(Number(attack.powerCost)) ||
    Number(attack.powerCost) < 0 ||
    +attack.powerCost > 10
      ? "Переменная сила или цена атаки требует отдельного правила"
      : distance > reach
        ? "Вне дальности атаки"
        : distance > 3 && stealth && !ignores
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
  ])
    result[key] = cachedScenario(
      scenario(p, q, attack, ar, dr, r, distance, full),
    );
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
      calculateAttack(attacker, defender, a, options),
    ),
  }));
}
