const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
let fit, prepare, predict;
test.before(async () => {
  ({
    fitCharacterRating: fit,
    prepareRatingRows: prepare,
    predictRating: predict,
  } = await import("../frontend/src/character-rating.js"));
});
const filler = Array.from({ length: 9 }, (_, i) => "shared-" + i);
function fixture(histories) {
  return {
    characters: [...filler, "a", "b", "unused"].map((id) => ({ id })),
    rosters: histories.flatMap((history, p) =>
      history.map(([character, wins, losses], i) => ({
        id: `${p}-${i}`,
        playerId: p,
        eventId: i,
        date: `2026-10-${String(i + 1).padStart(2, "0")}`,
        characterIds: [...filler, character],
        wins,
        losses,
        draws: 0,
        inventoryComplete: true,
        resultBasis: "individual",
        variantCount: 1,
        provisional: false,
      })),
    ),
  };
}
const record = (character, wins, losses, n = 8) =>
  Array.from({ length: n }, () => [character, wins, losses]);
const near = (a, b, tolerance = 1e-7) =>
  assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);
test("player skill correlated with selection has weaker influence than naive win-rate difference; permanent picks still count", () => {
  const data = fixture([
      record("a", 8, 2),
      record("a", 8, 2),
      record("b", 2, 8),
      record("b", 2, 8),
    ]),
    model = fit(data);
  const a = model.ratings.a,
    b = model.ratings.b;
  assert(a.value > 0 && b.value < 0);
  assert(a.value - b.value < 15); // Raw difference is 60 percentage points.
  assert.equal(a.switchers, 0);
  assert.equal(a.permanent, 2);
  near(model.ratings["shared-0"].value, 0);
  assert.equal(model.ratings.unused.value, null);
});
test("within-player changes outweigh permanent picks; all roster slots are fitted together", () => {
  const changing = fixture(
    Array.from({ length: 12 }, (_, i) =>
      i % 2
        ? [
            ["b", 2, 8],
            ["a", 8, 2],
            ["a", 8, 2],
            ["b", 2, 8],
          ]
        : [
            ["a", 8, 2],
            ["b", 2, 8],
            ["b", 2, 8],
            ["a", 8, 2],
          ],
    ),
  );
  const constant = fixture(
    Array.from({ length: 12 }, (_, i) =>
      record(i % 2 ? "a" : "b", i % 2 ? 8 : 2, i % 2 ? 2 : 8, 4),
    ),
  );
  const a = fit(changing).ratings.a,
    b = fit(constant).ratings.a;
  assert(a.value > 2 * b.value);
  assert.equal(a.switchers, 12);
  const reversed = structuredClone(changing);
  reversed.rosters.forEach((r) => ([r.wins, r.losses] = [r.losses, r.wins]));
  near(fit(reversed).ratings.a.value, -a.value);
});
test("neutral characters remain neutral despite unequal pilot skill and an event-wide swing", () => {
  const histories = [];
  for (let i = 0; i < 20; i++) {
    histories.push([
      ["a", 9, 1],
      ["b", 7, 3],
      ["a", 7, 3],
      ["b", 9, 1],
    ]);
    histories.push([
      ["b", 5, 5],
      ["a", 3, 7],
      ["b", 3, 7],
      ["a", 5, 5],
    ]);
  }
  const m = fit(fixture(histories));
  near(m.ratings.a.value, 0);
  near(m.ratings.b.value, 0);
  assert(m.events["0"] > m.events["1"]);
});
test("one main cannot multiply their influence by repeating identical tournaments", () => {
  const a = fit(fixture([record("a", 8, 2, 30), record("b", 2, 8, 30)]));
  const b = fit(fixture([record("a", 8, 2, 300), record("b", 2, 8, 300)]));
  assert(b.ratings.a.value < a.ratings.a.value * 1.1);
  assert(b.players["0"].weight < 1);
});
test("variants, unfinished, doubles, malformed and incomplete lists are excluded without winner selection", () => {
  const data = fixture([
    [
      ["a", 0, 5],
      ["b", 1, 4],
      ["a", 5, 0],
      ["b", 2, 2],
      ["a", 0, 0],
      ["a", 2, 2],
      ["a", 2, 2],
      ["a", 2, 2],
    ],
  ]);
  data.rosters[2].provisional = true;
  data.rosters[3].resultBasis = "doubles_pair";
  data.rosters[4].draws = 5;
  data.rosters[5].inventoryComplete = false;
  data.rosters[6].variantCount = 2;
  data.rosters.push({ ...data.rosters[7], id: "second-variant" });
  const p = prepare(data),
    m = fit(data);
  assert.equal(p.rows.length, 2);
  assert(p.rows.every((r) => r.wins < r.losses));
  assert.deepEqual(p.excluded, {
    provisional: 1,
    nonIndividual: 1,
    record: 1,
    incomplete: 1,
    variants: 2,
  });
  assert.equal(m.diagnostics.performances, 2);
});
test("old points, field size, place and draws never leak into the new estimate; fits are deterministic", () => {
  const data = fixture([
    [
      ["a", 5, 1],
      ["b", 1, 5],
    ],
    [
      ["b", 1, 5],
      ["a", 5, 1],
    ],
  ]);
  const first = fit(data);
  data.rosters
    .reverse()
    .forEach((r) =>
      Object.assign(r, {
        performancePoints: 1e9,
        place: 1,
        fieldSize: 999999,
        draws: 30,
      }),
    );
  assert.deepEqual(fit(data).ratings, first.ratings);
  assert(
    predict(first, data.rosters[0]) >= 0 &&
      predict(first, data.rosters[0]) <= 1,
  );
  assert.throws(() => fit(data, { betweenWeight: 2 }));
  const empty = fit({ ...data, rosters: [] });
  assert.equal(empty.ratings.a.value, null);
  assert.equal(empty.diagnostics.performances, 0);
});
test("live archive converges, provides finite estimates, preserves single performance identity, and filters don't rescue variants", () => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync("tournaments/data.js", "utf8"), ctx);
  const data = JSON.parse(JSON.stringify(ctx.window.ROSTER_ATLAS)),
    p = prepare(data),
    m = fit(data);
  assert.equal(m.diagnostics.performances, p.rows.length);
  assert.equal(
    new Set(p.rows.map((r) => `${r.playerId}:${r.eventId}`)).size,
    p.rows.length,
  );
  assert(m.diagnostics.performances > 2000);
  assert(
    Object.values(m.ratings).every(
      (r) => r.value === null || Number.isFinite(r.value),
    ),
  );
  assert(m.ratings.wong.switchers > 50);
  const filtered = p.rows.filter((r) =>
    r.affiliations.includes("Web Warriors"),
  );
  assert(!filtered.some((r) => r.variantCount > 1));
  assert(
    fit({ ...data, rosters: filtered }).diagnostics.performances <=
      p.rows.length,
  );
});
test("async store ignores stale cohorts, uses cache and does not refit when choosing a player", async () => {
  const { TournamentStore } =
    await import("../frontend/src/stores/tournaments.js");
  const core = require("../tournaments/core.js"),
    data = fixture([[["a", 3, 2]], [["b", 2, 3]]]);
  data.characters.forEach((c) =>
    Object.assign(c, { name: c.id, alterEgo: c.id, affiliations: [] }),
  );
  data.players = [];
  data.rosters.forEach((r) =>
    Object.assign(r, {
      location: "Russia",
      player: String(r.playerId),
      affiliations: [String(r.playerId)],
    }),
  );
  const t = new TournamentStore({}, {}),
    priorLocation = global.location;
  global.location = { hash: "" };
  try {
    t.configure(data, core, {});
  } finally {
    if (priorLocation) global.location = priorLocation;
    else delete global.location;
  }
  const requests = [];
  t.ratingClient = () =>
    new Promise((resolve, reject) => requests.push({ resolve, reject }));
  const old = t.loadRating();
  t.toggleAffiliation("1", true);
  const current = t.loadRating(),
    model = fit({ ...data, rosters: [data.rosters[1]] });
  requests[1].resolve(model);
  await current;
  requests[0].resolve(fit(data));
  await old;
  assert.equal(t.activeRating, model);
  t.choosePlayer("1");
  assert.equal(t.activeRating, model);
  assert.equal(requests.length, 2);
  await t.loadRating();
  assert.equal(requests.length, 2);
  t.clearAffiliations();
  assert.equal(t.activeRating, null);
  const failure = t.loadRating();
  requests[2].reject(Error("test failure"));
  await failure;
  assert.equal(t.ratingStatus, "error");
  assert.equal(t.ratingError, "test failure");
  assert.equal(t.activeRating, null);
});
