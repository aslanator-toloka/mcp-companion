// Resources pack power in the low four bits. Upper bits remember fixed paid
// abilities with multiple clauses so one activation is never charged twice.
// Roll masks are separate: a die remembers only reroll names that can recur.
import {
  WEIGHTS,
  FACES,
  partition,
  addState,
  states,
  faceCount,
  valueOf,
  replacements,
  changeFaces,
  project,
} from "./exact-dice.js";
export const FACE = {
  blank: 0,
  hit: 1,
  block: 2,
  wild: 3,
  critical: 4,
  failure: 5,
};
const PRE = new Set([
  "dice",
  "setDefense",
  "blankSuccess",
  "failureSuccess",
  "enemyFailureSuccess",
  "ronin",
  "doubleWild",
]);
export const power = (resource) => resource & 15;
export function score(face, role, flags) {
  if (face === 4) return flags.noCritSuccess ? 0 : 1;
  if (face === 3) return flags.noWildSuccess ? 0 : flags.doubleWild ? 2 : 1;
  if (face === (role === "attack" ? 1 : 2)) return 1;
  return (face === 0 && flags.blankSuccess) ||
    (face === 5 && flags.failureSuccess)
    ? 1
    : 0;
}
export function pay(resource, effect, unit, amount = 1) {
  if (effect.paid && !effect.variable && effect.mask && resource & effect.mask)
    return resource;
  const price = effect.cost * amount + (effect.paid ? unit.tax : 0);
  if (price > power(resource)) return -1;
  return (
    (resource - price) |
    (effect.paid && !effect.variable ? effect.mask || 0 : 0)
  );
}
export function prepare(p, rules, amount, tax, role) {
  const frequencies = new Map();
  for (const e of rules.effects)
    if (e.paid && !e.variable)
      frequencies.set(e.name, (frequencies.get(e.name) || 0) + 1);
  const paidMasks = new Map();
  let bit = 16;
  for (const [name, count] of frequencies)
    if (count > 1) {
      paidMasks.set(name, bit);
      bit *= 2;
    }
  const unit = {
    profile: p,
    role,
    tax: tax + (p.state.conditions.includes("root") ? 1 : 0),
    resource: amount,
    effects: rules.effects.map((e) => ({
      ...e,
      mask: paidMasks.get(e.name) || 0,
    })),
    flags: Object.fromEntries(
      rules.effects.filter((e) => !e.paid).map((e) => [e.kind, true]),
    ),
    bonus: 0,
    cover: false,
  };
  for (const e of unit.effects)
    if (
      e.kind === "dice" ||
      e.kind === "setDefense" ||
      (e.paid && PRE.has(e.kind))
    ) {
      const next = pay(unit.resource, e, unit);
      if (next < 0) continue;
      unit.resource = next;
      if (e.kind === "dice") unit.bonus += e.amount;
      else if (e.kind === "setDefense") unit.override = e.amount;
      else unit.flags[e.kind] = true;
    }
  if (p.state.conditions.includes("hex")) unit.flags.noCrit = true;
  if (role === "attack" && p.state.conditions.includes("shock")) unit.bonus--;
  if (role === "defense" && p.state.conditions.includes("incinerate"))
    unit.bonus--;
  return unit;
}
export function ownOperations(unit, attack) {
  if (unit.flags.banned) return [];
  const ops = [];
  if (unit.role === "attack" && attack.reroll)
    ops.push({
      kind: "reroll",
      key: "attack-special-reroll",
      cost: 0,
      amount: attack.reroll,
      failures: attack.failures,
    });
  if (unit.role === "attack" && attack.allReroll)
    ops.push({
      kind: "allReroll",
      key: "attack-special-reroll",
      cost: 0,
      failures: attack.failures,
    });
  for (const e of unit.effects
    .filter((e) =>
      ["reroll", "allReroll", "rerollPerEnemyCrit"].includes(e.kind),
    )
    .sort((a, b) => a.cost - b.cost))
    if (pay(unit.resource, e, unit) >= 0) ops.push({ ...e, key: e.name });
  return ops;
}
export function opponentOperations(unit) {
  return unit.effects
    .filter(
      (e) =>
        ["opponentReroll", "blankEnemyWilds", "cancelWithWilds"].includes(
          e.kind,
        ) && pay(unit.resource, e, unit) >= 0,
    )
    .map((e) => ({ ...e, key: e.name }));
}
export function bindRerollMasks(own, incoming) {
  const names = new Map();
  for (const e of [
    ...own,
    ...incoming.filter((e) => e.kind === "opponentReroll"),
  ])
    names.set(e.key, (names.get(e.key) || 0) + 1);
  let bit = 1;
  const masks = new Map();
  for (const [name, n] of names)
    if (n > 1) {
      masks.set(name, bit);
      bit *= 2;
    }
  for (const e of [...own, ...incoming]) e.mark = masks.get(e.key) || 0;
  return incoming.reduce((n, e) => n | e.mark, 0);
}
export function needsEnemyCriticals(unit, ops) {
  return (
    !unit.flags.banned &&
    (unit.flags.echo || ops.some((e) => e.kind === "rerollPerEnemyCrit"))
  );
}
const modifierAllowed = (face, unit, e = {}) =>
  face !== 5 || unit.flags.failureAllowed || e.failures;
export function partitions(
  unit,
  own,
  incoming,
  actor,
  attack,
  { initialCrit = false, postCrit = false, incomingMask = 0 } = {},
) {
  const weights = FACES.map((face) => score(face, unit.role, unit.flags));
  const attackRole = unit.role === "attack";
  const endConversion =
    attackRole && unit.effects.some((e) => e.kind === "failureToWild");
  const enemyFailures = attackRole
    ? actor.flags.enemyFailures
    : actor.flags.enemyFailures ||
      actor.flags.addEnemyFailures ||
      actor.flags.enemyFailureSuccess;
  const hitSwap =
    attackRole &&
    !unit.flags.banned &&
    unit.effects.some(
      (e) => e.kind === "swapHits" && pay(unit.resource, e, unit) >= 0,
    );
  const wildObserved = attackRole
    ? attack.sap || incoming.some((e) => e.kind === "blankEnemyWilds")
    : incoming.some((e) => e.kind === "cancelWithWilds") ||
      opponentOperations(unit).some((e) => e.kind === "cancelWithWilds");
  const hasPierce = unit.role === "defense" && attack.pierce.length > 0;
  const ownForceWild = incoming.some((e) => e.kind === "blankEnemyWilds");
  const postFeatures = (face) => [
    weights[face],
    (enemyFailures || endConversion) && face === 5,
    (wildObserved || (endConversion && attack.sap)) && face === 3,
    hitSwap && face === 1,
    hitSwap && face === 2,
    postCrit && face === 4,
    hasPierce && [2, 3, 4].includes(face),
    ...incoming
      .filter((e) => e.kind === "opponentReroll")
      .map((e) => weights[face] > 0 && modifierAllowed(face, actor, e)),
    incoming.some((e) => e.kind === "cancelWithWilds") &&
      [1, 3, 4].includes(face),
    ownForceWild && face === 3,
  ];
  const postVisible = (face) =>
    weights[face] !== 0 ||
    ((enemyFailures || endConversion) && face === 5) ||
    (wildObserved && face === 3) ||
    (hitSwap && [1, 2].includes(face)) ||
    (postCrit && face === 4) ||
    (ownForceWild && face === 3);
  const after = partition(postFeatures, postVisible);
  const changing =
    !unit.flags.banned && (unit.flags.echo || unit.flags.ronin || unit.cover);
  const hitToWild =
    !unit.flags.banned &&
    unit.effects.some(
      (e) => e.kind === "hitToWild" && pay(unit.resource, e, unit) >= 0,
    );
  const triggerFaces = attackRole
    ? new Set(attack.pierce.map((s) => FACE[s]))
    : new Set();
  const canSelect = (face, e) =>
    modifierAllowed(face, unit, e) &&
    (e.kind === "allReroll" || weights[face] === 0);
  const features = (face) => [
    postVisible(face) ? postFeatures(face) : null,
    weights[face],
    ...own.map((e) => canSelect(face, e)),
    own.some((e) => e.conditional) && face === (attackRole ? 1 : 2),
    changing && weights[face] === 0 && modifierAllowed(face, unit),
    unit.flags.ronin && [3, 4].includes(face),
    unit.flags.ronin && face === 4,
    hitToWild && face === 1,
    triggerFaces.has(face) ? face : -1,
    initialCrit && face === 4,
  ];
  const visible = (face) =>
    postVisible(face) ||
    own.some((e) => canSelect(face, e)) ||
    (changing && weights[face] === 0 && modifierAllowed(face, unit)) ||
    (unit.flags.ronin && [3, 4].includes(face)) ||
    (hitToWild && face === 1) ||
    triggerFaces.has(face) ||
    (initialCrit && face === 4);
  return { before: partition(features, visible), after, weights, incomingMask };
}
function select(state, p, predicate, max, order = () => 0) {
  const indices = [];
  for (let i = 0; i < state.counts.length; i++)
    if (
      state.counts[i] &&
      predicate(p.groups[i % p.width].face, Math.floor(i / p.width))
    )
      indices.push(i);
  indices.sort(
    (a, b) =>
      order(p.groups[b % p.width].face) - order(p.groups[a % p.width].face) ||
      p.groups[a % p.width].face - p.groups[b % p.width].face ||
      a - b,
  );
  const selected = [];
  for (const i of indices) {
    const n = Math.min(max, state.counts[i]);
    if (n) selected.push([i, n]);
    max -= n;
    if (!max) break;
  }
  return selected;
}
export function reroll(
  distribution,
  unit,
  p,
  effect,
  { enemyCriticals = 0, opponent = false, target = unit } = {},
) {
  const result = new Map(),
    weights = FACES.map((f) => score(f, target.role, target.flags));
  const meanNumerator = WEIGHTS.reduce((n, w, f) => n + w * weights[f], 0);
  for (const state of distribution) {
    let max =
      effect.kind === "allReroll"
        ? Infinity
        : effect.kind === "rerollPerEnemyCrit"
          ? enemyCriticals
          : effect.amount;
    const eligible = (face, mask) =>
      !(mask & effect.mark) &&
      modifierAllowed(face, unit, effect) &&
      (effect.kind === "allReroll" ||
        (opponent ? weights[face] > 0 : weights[face] === 0));
    if (
      effect.conditional &&
      faceCount(state, p, target.role === "attack" ? 1 : 2)
    ) {
      addState(
        result,
        state.counts,
        state.resource,
        state.probability,
        state.tag,
        state.trigger,
      );
      continue;
    }
    if (effect.variable)
      max = Math.min(
        max,
        effect.max || 99,
        Math.max(
          0,
          Math.floor(
            (power(state.resource) - (effect.paid ? unit.tax : 0)) /
              (effect.cost || 1),
          ),
        ),
      );
    const selected = select(
      state,
      p,
      eligible,
      max,
      opponent ? (face) => weights[face] : undefined,
    );
    const n = selected.reduce((sum, [, n]) => sum + n, 0);
    const value = selected.reduce(
      (sum, [i, n]) => sum + n * weights[p.groups[i % p.width].face],
      0,
    );
    const resource = n
      ? pay(state.resource, effect, unit, effect.variable ? n : 1)
      : -1;
    if (
      !n ||
      resource < 0 ||
      (effect.kind === "allReroll" && 8 * value >= n * meanNumerator)
    ) {
      addState(
        result,
        state.counts,
        state.resource,
        state.probability,
        state.tag,
        state.trigger,
      );
      continue;
    }
    for (const next of replacements(
      { ...state, resource },
      selected,
      p,
      effect.mark,
    ))
      addState(
        result,
        next.counts,
        next.resource,
        next.probability,
        next.tag,
        next.trigger,
      );
  }
  return states(result);
}
export function selfModify(distribution, unit, p, operations, enemyCriticals) {
  let current = distribution;
  for (const effect of operations)
    current = reroll(current, unit, p, effect, { enemyCriticals });
  if (unit.flags.banned) return current;
  const result = new Map();
  const weights = FACES.map((face) => score(face, unit.role, unit.flags));
  for (let s of current) {
    if (unit.flags.echo || unit.flags.ronin) {
      const amount =
        (unit.flags.echo ? enemyCriticals : 0) +
        (unit.flags.ronin ? faceCount(s, p, 3) + faceCount(s, p, 4) : 0);
      s = changeFaces(s, p, {
        eligible: (f) => weights[f] === 0 && modifierAllowed(f, unit),
        amount,
        target: unit.role === "attack" ? 1 : 2,
      });
    }
    for (const e of unit.effects)
      if (e.kind === "hitToWild" && faceCount(s, p, 1)) {
        const resource = pay(s.resource, e, unit);
        if (resource < 0) continue;
        s = changeFaces({ ...s, resource }, p, {
          eligible: (f) => f === 1,
          amount: 1,
          target: 3,
        });
      }
    if (unit.cover)
      s = changeFaces(s, p, {
        eligible: (f) => weights[f] === 0 && modifierAllowed(f, unit),
        amount: 1,
        target: 2,
      });
    addState(result, s.counts, s.resource, s.probability, s.tag, s.trigger);
  }
  return states(result);
}
export function hasTrigger(state, p, faces) {
  const required = new Map();
  for (const name of faces) {
    const face = FACE[name];
    required.set(face, (required.get(face) || 0) + 1);
  }
  return [...required].every(([face, n]) => faceCount(state, p, face) >= n);
}
export function afterSelf(
  distribution,
  unit,
  partitions,
  operations,
  criticals,
  attack,
) {
  const own = selfModify(
    distribution,
    unit,
    partitions.before,
    operations,
    criticals,
  );
  return project(own, partitions.before, partitions.after, {
    mask: partitions.incomingMask,
    trigger: (s) =>
      unit.role === "attack" &&
      attack.pierce.length > 0 &&
      hasTrigger(s, partitions.before, attack.pierce),
  });
}
export const total = (state, p, unit) =>
  valueOf(
    state,
    p,
    FACES.map((face) => score(face, unit.role, unit.flags)),
  );
export function groupBy(distribution, key) {
  const groups = new Map();
  for (const state of distribution) {
    const value = key(state);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(state);
  }
  return groups;
}
