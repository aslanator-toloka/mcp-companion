// Player-balanced, regularized within/between regression. No old points enter it.
export const RATING_PARAMETERS = Object.freeze({
  version: "player-adjusted-v1",
  betweenWeight: 0.15,
  gamesPrior: 8,
  characterPenalty: 2,
  eventPenalty: 1,
  rosterSize: 10,
});
const key = (r) => JSON.stringify([String(r.playerId), String(r.eventId)]);

export function prepareRatingRows(data, parameters = RATING_PARAMETERS) {
  const known = new Set(
    data.characters.filter((c) => !c.grunt).map((c) => c.id),
  );
  const groups = new Map(),
    excluded = {};
  for (const r of data.rosters) {
    const k = key(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const rows = [];
  for (const group of groups.values()) {
    const r = group[0],
      ids = new Set(r.characterIds);
    const reason =
      group.length !== 1 || r.variantCount > 1
        ? "variants"
        : r.provisional
          ? "provisional"
          : r.resultBasis !== "individual"
            ? "nonIndividual"
            : !r.inventoryComplete ||
                ids.size !== parameters.rosterSize ||
                ids.size !== r.characterIds.length ||
                [...ids].some((id) => !known.has(id))
              ? "incomplete"
              : r.playerId == null ||
                  r.eventId == null ||
                  !Number.isInteger(r.wins) ||
                  r.wins < 0 ||
                  !Number.isInteger(r.losses) ||
                  r.losses < 0 ||
                  r.wins + r.losses === 0
                ? "record"
                : null;
    if (reason) excluded[reason] = (excluded[reason] || 0) + 1;
    else rows.push(r);
  }
  // Stable ordering makes fits reproducible even after filters / data reordering.
  rows.sort((a, b) => key(a).localeCompare(key(b)));
  return { rows, excluded, performances: groups.size };
}
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
function sparseDot(entries, vector) {
  let sum = 0;
  for (const [i, x] of entries) sum += x * vector[i];
  return sum;
}

// Preconditioned conjugate gradient solves the positive definite normal system.
// Operating on sparse equations avoids a dense matrix and a numerical dependency.
function solve(equations, penalties) {
  const n = penalties.length,
    rhs = new Float64Array(n),
    diagonal = penalties.slice();
  for (const { x, y, weight } of equations)
    for (const [i, value] of x) {
      rhs[i] += weight * value * y;
      diagonal[i] += weight * value * value;
    }
  const multiply = (v) => {
    const out = Float64Array.from(v, (value, i) => value * penalties[i]);
    for (const { x, weight } of equations) {
      const value = weight * sparseDot(x, v);
      for (const [i, a] of x) out[i] += a * value;
    }
    return out;
  };
  const result = new Float64Array(n),
    residual = rhs.slice();
  let z = Float64Array.from(residual, (r, i) => r / (diagonal[i] || 1)),
    direction = z.slice();
  let rz = dot(residual, z),
    iterations = 0;
  const norm = Math.sqrt(dot(rhs, rhs)),
    tolerance = 1e-9 * Math.max(1, norm);
  for (
    ;
    iterations < Math.max(100, n * 2) &&
    Math.sqrt(dot(residual, residual)) > tolerance;
    iterations++
  ) {
    const ad = multiply(direction),
      denominator = dot(direction, ad);
    if (!(denominator > 0)) break;
    const alpha = rz / denominator;
    for (let i = 0; i < n; i++) {
      result[i] += alpha * direction[i];
      residual[i] -= alpha * ad[i];
    }
    z = Float64Array.from(residual, (r, i) => r / (diagonal[i] || 1));
    const next = dot(residual, z),
      beta = rz ? next / rz : 0;
    for (let i = 0; i < n; i++) direction[i] = z[i] + beta * direction[i];
    rz = next;
  }
  const error = Math.sqrt(dot(residual, residual));
  if (error > tolerance || !result.every(Number.isFinite))
    throw Error("Расчёт рейтинга не сошёлся");
  return { result, iterations, residual: error };
}

export function fitCharacterRating(data, options = {}) {
  const parameters = { ...RATING_PARAMETERS, ...options };
  for (const k of [
    "betweenWeight",
    "gamesPrior",
    "characterPenalty",
    "eventPenalty",
    "rosterSize",
  ])
    if (!Number.isFinite(parameters[k]) || parameters[k] <= 0)
      throw Error("Некорректный параметр рейтинга: " + k);
  if (parameters.betweenWeight > 1)
    throw Error("betweenWeight должен быть ≤ 1");
  const prepared = prepareRatingRows(data, parameters),
    rows = prepared.rows;
  const characters = [...data.characters].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const characterIndex = new Map(characters.map((c, i) => [c.id, i + 1]));
  const eventIds = [...new Set(rows.map((r) => String(r.eventId)))].sort();
  const eventIndex = new Map(
    eventIds.map((id, i) => [id, characters.length + 1 + i]),
  );
  const pilots = new Map(),
    support = new Map(
      characters.map((c) => [
        c.id,
        { appearances: 0, players: 0, switchers: 0, permanent: 0 },
      ]),
    );
  for (const r of rows) {
    const id = String(r.playerId),
      games = r.wins + r.losses;
    if (!pilots.has(id))
      pilots.set(id, { id, rows: [], games: 0, features: new Map(), y: 0 });
    const pilot = pilots.get(id),
      x = [
        [0, 1],
        ...r.characterIds.map((c) => [characterIndex.get(c), 1]),
        [eventIndex.get(String(r.eventId)), 1],
      ];
    pilot.rows.push({ row: r, x, games, y: r.wins / games });
    pilot.games += games;
    pilot.y += r.wins;
    for (const [i, value] of x)
      pilot.features.set(i, (pilot.features.get(i) || 0) + value * games);
    for (const c of r.characterIds) support.get(c).appearances++;
  }
  const equations = [];
  for (const p of pilots.values()) {
    p.y /= p.games;
    p.reliability = p.games / (p.games + parameters.gamesPrior);
    p.mean = [...p.features].map(([i, v]) => [i, v / p.games]);
    for (const c of characters) {
      const present = p.features.has(characterIndex.get(c.id));
      if (!present) continue;
      const s = support.get(c.id);
      s.players++;
      if (p.features.get(characterIndex.get(c.id)) < p.games) s.switchers++;
      else s.permanent++;
    }
    for (const r of p.rows) {
      const centered = new Map(r.x);
      for (const [i, x] of p.mean) centered.set(i, (centered.get(i) || 0) - x);
      equations.push({
        x: [...centered].filter(([, x]) => Math.abs(x) > 1e-12),
        y: r.y - p.y,
        weight: (p.reliability * r.games) / p.games,
      });
    }
    equations.push({
      x: p.mean,
      y: p.y,
      weight: parameters.betweenWeight * p.reliability,
    });
  }
  const penalties = new Float64Array(
    1 + characters.length + eventIds.length,
  ).fill(parameters.characterPenalty);
  penalties[0] = 0;
  penalties.fill(parameters.eventPenalty, characters.length + 1);
  const solution = rows.length
    ? solve(equations, penalties)
    : {
        result: new Float64Array(penalties.length),
        iterations: 0,
        residual: 0,
      };
  const b = solution.result;
  const ratings = Object.fromEntries(
    characters.map((c) => {
      const s = support.get(c.id);
      return [
        c.id,
        {
          ...s,
          value: s.appearances ? 100 * b[characterIndex.get(c.id)] : null,
        },
      ];
    }),
  );
  const events = Object.fromEntries(
    eventIds.map((id) => [id, b[eventIndex.get(id)]]),
  );
  const players = Object.fromEntries(
    [...pilots].map(([id, p]) => [
      id,
      {
        effect: (1 - parameters.betweenWeight) * (p.y - sparseDot(p.mean, b)),
        weight: p.reliability,
        appearances: p.rows.length,
      },
    ]),
  );
  return {
    parameters,
    ratings,
    intercept: b[0],
    events,
    players,
    diagnostics: {
      performances: rows.length,
      players: pilots.size,
      events: eventIds.length,
      excluded: prepared.excluded,
      iterations: solution.iterations,
      residual: solution.residual,
    },
  };
}

// Prediction is for audits only. The fitted linear response is not a calibrated
// probability model; clip to [0,1] for validation against held-out win fractions.
export function predictRating(model, row) {
  return Math.max(
    0,
    Math.min(
      1,
      model.intercept +
        (model.players[String(row.playerId)]?.effect || 0) +
        (model.events[String(row.eventId)] || 0) +
        row.characterIds.reduce(
          (sum, id) => sum + (model.ratings[id]?.value || 0) / 100,
          0,
        ),
    ),
  );
}
