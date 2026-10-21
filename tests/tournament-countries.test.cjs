const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const Core = require("../tournaments/core.js");
let geography, TournamentStore;
test.before(async () => {
  geography = (await import("../frontend/src/tournament-countries.js"))
    .tournamentGeography;
  TournamentStore = (await import("../frontend/src/stores/tournaments.js"))
    .TournamentStore;
});
const fixture = () => ({
  meta: {},
  characters: [
    {
      id: "hero",
      name: "Hero",
      alterEgo: "Hero",
      inventoryIds: ["hero"],
      count: 5,
    },
  ],
  players: [
    { id: "1", countryCode: "russia", country: "Russia" },
    { id: "2", countryCode: "united_states", country: "United States" },
  ],
  rosters: [
    [1, 1, "Dallas, United States", 10],
    [2, 2, "Baza Club Russia", 20],
    [3, 1, "Moscow Russia", 30],
    [4, 1, "Russia", 40],
    [5, 1, "Russia", 50],
  ].map(([eventId, playerId, location, points]) => ({
    id: String(eventId),
    eventId,
    playerId,
    player: "Player " + playerId,
    date: "2026-10-01",
    event: "Event " + eventId,
    location,
    characterIds: ["hero"],
    affiliations: ["Avengers"],
    performancePoints: points,
    pointsShare: points,
    variantCount: 1,
    wins: 3,
    losses: 1,
    draws: 0,
  })),
});
test("event locations and player nationalities remain separate, including missing and misleading locations", () => {
  const data = fixture();
  data.rosters.push(
    { ...data.rosters[0], eventId: 6, playerId: 999, location: "Online" },
    { ...data.rosters[0], eventId: 7, location: "NotRussia" },
    { ...data.rosters[0], eventId: 8, location: "Store,\u00a0United States" },
  );
  const g = geography(data);
  assert(g.matches(data.rosters[0], "united_states", "russia"));
  assert(!g.matches(data.rosters[0], "russia", "russia"));
  assert.equal(g.events.get(2), "russia");
  assert.equal(g.events.get(6), "");
  assert.equal(g.events.get(7), "");
  assert.equal(g.events.get(8), "united_states");
  assert.equal(g.unknownEvents, 2);
  assert(g.matches(data.rosters[5], "__unknown__", "__unknown__"));
  assert.equal(g.options.find((c) => c.code === "russia").count, 4);
});
test("all archived events resolve to an event country and counts deduplicate roster variants", () => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync("tournaments/data.js", "utf8"), ctx);
  const data = JSON.parse(JSON.stringify(ctx.window.ROSTER_ATLAS)),
    g = geography(data);
  assert.equal(g.unknownEvents, 0);
  assert.equal(g.events.size, new Set(data.rosters.map((r) => r.eventId)).size);
  assert.equal(
    g.options.reduce((n, c) => n + c.count, 0),
    g.events.size,
  );
  assert.equal(g.options.find((c) => c.code === "russia").count, 7);
});
function store() {
  const t = new TournamentStore(
    { owned: new Map([["hero", true]]), status: () => ({}) },
    { notify: () => {} },
  );
  const previous = global.location;
  global.location = { hash: "" };
  try {
    t.configure(fixture(), Core, { availability: () => ({ ready: true }) });
  } finally {
    if (previous) global.location = previous;
    else delete global.location;
  }
  return t;
}
test("country cohort updates character, affiliation, player and roster scores together and composes with existing filters", () => {
  const t = store();
  t.setField("eventCountry", "russia");
  assert.equal(t.countryRows.length, 4);
  assert.equal(t.rosterRows.length, 4);
  assert.equal(t.total, 4);
  assert.equal(t.scopedCharacters[0].points, 140);
  assert.equal(t.scopedCharacters[0].average, 28);
  assert.equal(t.affiliationRows[0].points, 140);
  assert.equal(t.overview.stats.points, 140);
  assert.equal(t.playerRows.find((p) => p.id === "1").points, 120);
  t.setField("rosterCountry", "russia");
  assert.equal(t.rosterRows.length, 3);
  assert.equal(t.scopedCharacters[0].points, 120);
  assert.equal(t.scopedCharacters[0].average, 0);
  assert.equal(t.playerRows.length, 1);
  t.toggleAffiliation("Other", true);
  assert.equal(t.rosterRows.length, 0);
  assert.equal(t.overview.stats.count, 0);
  t.clearAffiliations();
  t.choosePlayer("1", true);
  assert.equal(t.overview.stats.points, 120);
  assert.equal(t.overview.stats.average, 30);
  t.setField("eventCountry", "__unknown__");
  assert.equal(t.overview.stats.points, 0);
  assert.equal(t.overview.stats.count, 0);
  assert.equal(t.rosterRows.length, 0);
  t.clearCountries();
  assert.equal(t.rosterRows.length, 4);
  assert.equal(t.overview.stats.points, 130);
  t.chooseCollection();
  assert.equal(t.overview.available.count, 4);
  t.setField("eventCountry", "united_states");
  assert.equal(t.overview.available.count, 1);
});
