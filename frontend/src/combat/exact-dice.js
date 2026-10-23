// Finite probability distributions. No sampling, probability cutoffs or tail truncation.
// Counts are over equivalent face classes; an unobserved class is marginalized out.
// A roll state is {counts, resource, probability, tag, trigger}. Histogram bin
// mask*partition.width+class retains per-rule reroll history only when needed.
export const FACES = [0, 1, 2, 3, 4, 5];
export const WEIGHTS = [2, 2, 1, 1, 1, 1];
const multinomials = new Map();
let cachedStates = 0;
const choices = [[1]];
function choose(n, k) {
  while (choices.length <= n) {
    const prev = choices.at(-1),
      row = [1];
    for (let j = 1; j < prev.length; j++) row[j] = prev[j - 1] + prev[j];
    row.push(1);
    choices.push(row);
  }
  return choices[n][k];
}
export function multinomial(n, masses) {
  n = Math.max(0, Math.floor(n));
  const key = n + ":" + masses.join(",");
  if (multinomials.has(key)) return multinomials.get(key);
  const ignored = 8 - masses.reduce((s, v) => s + v, 0);
  if (ignored < 0) throw Error("Invalid dice partition");
  const probabilities = [...masses, ...(ignored ? [ignored] : [])].map(
    (v) => v / 8,
  );
  const result = [],
    counts = Array(masses.length).fill(0);
  const walk = (i, left, probability) => {
    if (i === probabilities.length) {
      if (!left) result.push({ counts: [...counts], probability });
      return;
    }
    const last = i === probabilities.length - 1;
    for (let count = last ? left : 0; count <= left; count++) {
      if (i < masses.length) counts[i] = count;
      walk(
        i + 1,
        left - count,
        probability * choose(left, count) * probabilities[i] ** count,
      );
    }
  };
  if (!probabilities.length) result.push({ counts: [], probability: 1 });
  else walk(0, n, 1);
  // Cache is bounded by state count, not by a probability threshold.
  if (result.length <= 100000) {
    while (cachedStates + result.length > 200000 && multinomials.size) {
      const first = multinomials.keys().next().value;
      cachedStates -= multinomials.get(first).length;
      multinomials.delete(first);
    }
    multinomials.set(key, result);
    cachedStates += result.length;
  }
  return result;
}
export function partition(features, visible = () => true) {
  const groups = [],
    lookup = new Map(),
    faceToGroup = Array(6).fill(-1);
  for (const face of FACES) {
    if (!visible(face)) continue;
    const key = JSON.stringify(features(face));
    let index = lookup.get(key);
    if (index === undefined) {
      index = groups.length;
      lookup.set(key, index);
      groups.push({ face, mass: 0 });
    }
    groups[index].mass += WEIGHTS[face];
    faceToGroup[face] = index;
  }
  return {
    groups,
    faceToGroup,
    width: groups.length,
    masses: groups.map((g) => g.mass),
  };
}
export function addState(
  map,
  counts,
  resource,
  probability,
  tag = 0,
  trigger = false,
) {
  if (!probability) return;
  const key = resource + "/" + tag + "/" + +trigger + "/" + counts.join(",");
  const old = map.get(key);
  if (old) old.probability += probability;
  else map.set(key, { counts, resource, probability, tag, trigger });
  if (map.size > 500000)
    throw Error(
      "Слишком много различных состояний для точного расчёта этого сочетания",
    );
}
export const states = (map) => [...map.values()];
export function faceCount(state, p, face) {
  const group = p.faceToGroup[face];
  if (group < 0) return 0;
  let n = 0;
  for (let i = group; i < state.counts.length; i += p.width)
    n += state.counts[i];
  return n;
}
export function valueOf(state, p, weights) {
  let value = 0;
  for (let i = 0; i < state.counts.length; i++)
    if (state.counts[i])
      value += state.counts[i] * weights[p.groups[i % p.width].face];
  return value;
}
export function initialRoll(n, unit, p, { critExtra = 1 } = {}) {
  const width = p.width;
  const cloak = unit.effects.find(
    (e) => e.kind === "cloak" || e.kind === "cloakAll",
  );
  const startPower = unit.resource & 15;
  const atoms = new Map();
  const outcomes = (resource) => {
    if (atoms.has(resource)) return atoms.get(resource);
    const next = new Map();
    for (const original of FACES) {
      let face = original,
        updated = resource;
      if (original === 5 && cloak) {
        const active = (resource & 15) < startPower;
        const cost =
          cloak.kind === "cloakAll"
            ? active
              ? 0
              : 2 + unit.tax
            : 1 + (active ? 0 : unit.tax);
        if ((resource & 15) >= cost) {
          face = 4;
          updated = resource - cost;
        }
      }
      const extra = face === 4 && !unit.flags.noCrit ? critExtra : 0;
      for (const bonus of multinomial(extra, p.masses)) {
        const counts = [...bonus.counts];
        const index = p.faceToGroup[face];
        if (index >= 0) counts[index]++;
        addState(
          next,
          counts,
          updated,
          (WEIGHTS[original] / 8) * bonus.probability,
        );
      }
    }
    const result = states(next);
    atoms.set(resource, result);
    return result;
  };
  let current = [
    {
      counts: Array(width).fill(0),
      resource: unit.resource,
      probability: 1,
      tag: 0,
      trigger: false,
    },
  ];
  for (let die = 0; die < n; die++) {
    const next = new Map();
    for (const state of current)
      for (const atom of outcomes(state.resource)) {
        const counts = state.counts.map((count, i) => count + atom.counts[i]);
        addState(
          next,
          counts,
          atom.resource,
          state.probability * atom.probability,
        );
      }
    current = states(next);
  }
  return current;
}
export function project(
  distribution,
  from,
  to,
  { trigger = () => false, tag = (state) => state.tag, mask = 0 } = {},
) {
  const result = new Map();
  for (const state of distribution) {
    const counts = [];
    for (let i = 0; i < state.counts.length; i++) {
      if (!state.counts[i]) continue;
      const oldMask = Math.floor(i / from.width),
        face = from.groups[i % from.width].face,
        group = to.faceToGroup[face];
      if (group < 0) continue;
      const target = (oldMask & mask) * to.width + group;
      counts[target] = (counts[target] || 0) + state.counts[i];
    }
    const length = Math.max(to.width, counts.length);
    for (let i = 0; i < length; i++) counts[i] ||= 0;
    addState(
      result,
      counts,
      state.resource,
      state.probability,
      tag(state),
      trigger(state),
    );
  }
  return states(result);
}
// Transform a fixed selected multiset. Every replacement is a fresh MCP die, with no extra critical dice.
export function replacements(state, selected, p, mark = 0) {
  if (!selected.length) return [state];
  const base = [...state.counts],
    groups = new Map();
  for (const [index, count] of selected) {
    base[index] -= count;
    const mask = Math.floor(index / p.width) | mark;
    groups.set(mask, (groups.get(mask) || 0) + count);
  }
  let current = [{ ...state, counts: base }];
  for (const [mask, n] of groups) {
    const next = new Map();
    for (const s of current)
      for (const outcome of multinomial(n, p.masses)) {
        const counts = [...s.counts];
        const offset = mask * p.width,
          length = offset + p.width;
        while (counts.length < length) counts.push(0);
        for (let i = 0; i < p.width; i++)
          counts[offset + i] += outcome.counts[i];
        addState(
          next,
          counts,
          s.resource,
          s.probability * outcome.probability,
          s.tag,
          s.trigger,
        );
      }
    current = states(next);
  }
  return current;
}
export function changeFaces(
  state,
  p,
  { eligible, amount, target, order = () => 0 },
) {
  const indices = [];
  for (let i = 0; i < state.counts.length; i++)
    if (state.counts[i] && eligible(p.groups[i % p.width].face))
      indices.push(i);
  indices.sort(
    (a, b) =>
      order(p.groups[b % p.width].face) - order(p.groups[a % p.width].face) ||
      p.groups[a % p.width].face - p.groups[b % p.width].face ||
      a - b,
  );
  const counts = [...state.counts],
    group = p.faceToGroup[target];
  for (const i of indices) {
    const n = Math.min(amount, counts[i]);
    if (!n) continue;
    counts[i] -= n;
    if (group >= 0) {
      const dest = Math.floor(i / p.width) * p.width + group;
      while (counts.length <= dest) counts.push(0);
      counts[dest] += n;
    }
    amount -= n;
    if (!amount) break;
  }
  return { ...state, counts };
}
