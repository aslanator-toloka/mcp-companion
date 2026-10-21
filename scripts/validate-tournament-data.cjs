const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const core = require("../tournaments/core.js");
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(process.argv[2], "utf8"), ctx);
const data = JSON.parse(JSON.stringify(ctx.window.ROSTER_ATLAS)),
  root = process.argv[3];
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json")));
const source = JSON.parse(fs.readFileSync(path.join(root, "results.json")));
const sourceRosters = JSON.parse(
  fs.readFileSync(path.join(root, "rosters.json")),
);
assert(manifest.complete);
assert.equal(manifest.errors, 0);
assert.equal(data.meta.end, manifest.end);
assert.equal(data.meta.rosters, manifest.roster_variants);
assert.equal(data.rosters.length, manifest.roster_variants);
assert.equal(new Set(data.rosters.map((r) => r.id)).size, data.rosters.length);
const appearances = new Map();
for (const r of data.rosters) {
  const key = r.eventId + ":" + r.playerId;
  if (!appearances.has(key)) appearances.set(key, []);
  appearances.get(key).push(r);
  assert(r.date <= manifest.end);
  assert(
    r.characterIds.every((id) => data.characters.some((c) => c.id === id)),
  );
  const score = core.performanceScore(r);
  assert.equal(r.performancePoints, score?.points ?? null);
}
assert.equal(appearances.size, manifest.results);
assert.equal(new Set(data.rosters.map((r) => r.eventId)).size, manifest.events);
for (const r of source) {
  const rows = appearances.get(r.event_id + ":" + r.player_id);
  assert(rows?.length);
  assert.equal(rows.length, r.roster_count);
  assert(rows.every((x) => x.variantCount === rows.length));
  if (rows[0].performancePoints !== null)
    assert(
      Math.abs(
        rows.reduce((s, x) => s + x.pointsShare, 0) - rows[0].performancePoints,
      ) < 1e-7,
    );
}
assert.deepEqual(
  data.players.map((p) => p.id).sort(),
  [...new Set(data.rosters.map((r) => String(r.playerId)))].sort(),
);
const byId = new Map(data.rosters.map((r) => [r.id, r]));
for (const original of sourceRosters) {
  const row = byId.get(
    `${original.event_id}-${original.participant_id}-${original.list_id}`,
  );
  assert(row);
  if (original.status === "encoded")
    assert.deepEqual(
      row.characters.map((c) => c.name),
      original.lists.flatMap((group) =>
        (group.Characters || []).map((c) => c.name),
      ),
    );
  if (row.characters.some((c) => !c.id))
    assert.equal(row.inventoryComplete, false);
}
assert.equal(JSON.stringify(core.scoreData(data)), JSON.stringify(data));
console.log(
  `Validated ${manifest.events} events, ${manifest.results} performances, ${data.rosters.length} rosters, ${data.players.length} players, signed scoring and variant weights.`,
);
