import fs from "node:fs";
import vm from "node:vm";
import {
  fitCharacterRating,
  prepareRatingRows,
  predictRating,
} from "../frontend/src/character-rating.js";
const context = { window: {} };
vm.runInNewContext(fs.readFileSync("tournaments/data.js", "utf8"), context);
const data = JSON.parse(JSON.stringify(context.window.ROSTER_ATLAS));
const model = fitCharacterRating(data),
  prepared = prepareRatingRows(data);
const sorted = [...prepared.rows].sort((a, b) => a.date.localeCompare(b.date));
const cutoff = sorted[Math.floor(sorted.length * 0.8)].date;
const train = sorted.filter((r) => r.date < cutoff),
  test = sorted.filter((r) => r.date >= cutoff);
const fitted = fitCharacterRating({ ...data, rosters: train });
const baseline = fitCharacterRating(
  { ...data, rosters: train },
  { characterPenalty: 1e8 },
);
function error(model, rows) {
  let squared = 0,
    weight = 0;
  for (const row of rows) {
    const n = row.wins + row.losses;
    squared += n * (predictRating(model, row) - row.wins / n) ** 2;
    weight += n;
  }
  return Math.sqrt(squared / weight);
}
// Cluster bootstrap: sample pilots, retaining each sampled pilot's full history.
// This measures sampling stability only, not unobserved selection confounding.
const byPlayer = new Map();
for (const r of prepared.rows) {
  const id = String(r.playerId);
  if (!byPlayer.has(id)) byPlayer.set(id, []);
  byPlayer.get(id).push(r);
}
const pilots = [...byPlayer.values()],
  bootstrap = new Map(data.characters.map((c) => [c.id, []]));
let seed = 20261022;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
}
const iterations = 100;
for (let k = 0; k < iterations; k++) {
  const rosters = [];
  for (let i = 0; i < pilots.length; i++) {
    const history = pilots[Math.floor(random() * pilots.length)];
    for (const r of history) rosters.push({ ...r, playerId: "bootstrap-" + i });
  }
  const sampled = fitCharacterRating({ ...data, rosters });
  for (const [id, rating] of Object.entries(sampled.ratings))
    bootstrap.get(id).push(rating.value ?? 0);
}
const estimates = Object.entries(model.ratings)
  .filter(([, r]) => r.value !== null)
  .map(([id, r]) => {
    const values = bootstrap.get(id).sort((a, b) => a - b);
    return {
      id,
      ...r,
      bootstrap90: [values[5], values[94]],
      signAgreement:
        values.filter((v) => Math.sign(v) === Math.sign(r.value)).length /
        iterations,
    };
  })
  .sort((a, b) => b.value - a.value);
const audit = {
  version: model.parameters.version,
  archivePeriod: [data.meta.start, data.meta.end],
  parameters: model.parameters,
  diagnostics: model.diagnostics,
  validation: {
    cutoff,
    train: train.length,
    test: test.length,
    knownPlayers: test.filter((r) => fitted.players[String(r.playerId)]).length,
    adjustedWinFractionRMSE: error(fitted, test),
    skillOnlyWinFractionRMSE: error(baseline, test),
    note: "Chronological, whole events; win-fraction prediction is not validation of causal character effects. Baseline uses the same player/event model with character coefficients suppressed.",
  },
  bootstrap: {
    seed: 20261022,
    iterations,
    unit: "player history",
    note: "90% empirical sampling ranges, not calibrated causal confidence intervals. Missing characters in a sample have estimate 0. Parameter choices fixed, not optimized on the holdout.",
  },
  estimates,
};
fs.writeFileSync(
  "data/character-rating-audit.json",
  JSON.stringify(audit, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      diagnostics: audit.diagnostics,
      validation: audit.validation,
      top: estimates.slice(0, 5),
      wong: estimates.find((r) => r.id === "wong"),
    },
    null,
    2,
  ),
);
