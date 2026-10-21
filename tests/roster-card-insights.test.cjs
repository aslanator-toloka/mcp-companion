"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const Insights = require("../roster-card-insights.js"),
  Core = require("../tournaments/core.js"),
  Import = require("../tournament-import.js");
const cards = {
  tactics: [
    {
      slug: "alpha-new",
      name: "Alpha",
      cardFamily: "alpha",
      requirementsItems: { mandatory_character: ["hulk"] },
    },
    { slug: "beta", name: "Beta", cardFamily: "beta", requirementsItems: {} },
  ],
  crises: [{ slug: "crisis", name: "Crisis Name", cardFamily: "crisis" }],
};
const chars = [
  { slug: "hulk", actAs: "hulk", alterEgo: "Bruce Banner" },
  { slug: "iron-man", actAs: "iron-man", alterEgo: "Tony Stark" },
];
const row = (id, fields = {}) => ({
  id,
  eventId: id,
  playerId: "player",
  variantCount: 1,
  characterIds: ["hulk"],
  affiliations: ["Avengers"],
  tactics: ["Alpha", "Beta"],
  crises: ["Crisis Name"],
  wins: 3,
  losses: 1,
  draws: 0,
  fieldSize: 16,
  place: 3,
  sharedPlaceCount: 1,
  provisional: false,
  ...fields,
});
function index(rows) {
  return Insights.create({
    archive: {
      meta: {},
      characters: chars.map((c) => ({ id: c.slug, inventoryIds: [c.slug] })),
      rosters: rows,
    },
    catalog: chars,
    cardLists: cards,
    core: Core,
    resolveCard: Import.resolveCard,
  });
}
test("related cards follow Jarvis actAs, alter ego, either-character and combined requirements", () => {
  const hulk = chars[0],
    hulkbuster = {
      slug: "hulkbuster",
      actAs: "hulkbuster",
      alterEgo: "Tony Stark",
    };
  assert.equal(Insights.related(cards.tactics[0], hulk), true);
  assert.equal(Insights.related(cards.tactics[0], chars[1]), false);
  assert.equal(
    Insights.related(
      { requirementsItems: { optional_character: ["iron-man"] } },
      hulkbuster,
    ),
    true,
  );
  assert.equal(
    Insights.related(
      { requirementsItems: { mandatory_alter_ego: ["Tony Stark"] } },
      hulkbuster,
    ),
    true,
  );
  assert.equal(
    Insights.related(
      {
        requirementsItems: {
          mandatory_character_with_alter_ego: ["iron-man|Tony Stark"],
        },
      },
      hulkbuster,
    ),
    true,
  );
  assert.equal(
    Insights.related(
      {
        requirementsItems: {
          mandatory_character_with_alter_ego: ["iron-man|James Rhodes"],
        },
      },
      hulkbuster,
    ),
    false,
  );
  assert.equal(
    Insights.related(
      { requirementsItems: { mandatory_character: ["captain-america"] } },
      {
        slug: "captain-america-sam-wilson",
        actAs: "captain-america",
        alterEgo: "Sam Wilson",
      },
    ),
    true,
  );
  assert.equal(
    Insights.related(
      { affiliation: { name: "Avengers" }, requirementsItems: {} },
      hulk,
    ),
    false,
  );
});
test("popularity and scores use the same intersected cohort; variants are fractional and duplicates count once", () => {
  const rows = [
    row("a", { variantCount: 2, tactics: ["Alpha", "Alpha"] }),
    row("b", { variantCount: 2, tactics: ["Beta"] }),
    row("c", {
      characterIds: ["iron-man"],
      affiliations: ["Web Warriors"],
      tactics: ["Beta"],
    }),
  ];
  const insight = index(rows),
    all = insight.statistics("tactics"),
    hulk = insight.statistics("tactics", { character: "hulk" }),
    none = insight.statistics("tactics", {
      character: "hulk",
      affiliation: "Web Warriors",
    });
  assert.equal(all.covered, 3);
  assert.equal(all.cards.get("alpha-new").share, 25);
  assert.equal(hulk.cards.get("alpha-new").share, 50);
  assert.equal(hulk.cards.get("alpha-new").count, 1);
  assert.equal(none.covered, 0);
  assert.equal(none.cards.get("alpha-new").points, 0);
  assert.equal(
    hulk.cards.get("alpha-new").points,
    Core.scoreData({ meta: {}, characters: [], rosters: [rows[0]] }).rosters[0]
      .pointsShare,
  );
});
test("missing and unrecognised lists are excluded, not treated as absence; text lists are parsed exactly", () => {
  const insight = index([
    row("missing", { tactics: [], crises: [], rawText: "" }),
    row("partial", { tactics: ["Alpha", "Unknown card"] }),
    row("text", {
      tactics: [],
      crises: [],
      rawText:
        "Characters 10\nHulk 6\nTeam Tactics 2\nAlpha R\nBeta\nSecure Crisis\nCrisis Name A, 17",
    }),
  ]);
  const t = insight.statistics("tactics");
  assert.equal(t.total, 3);
  assert.equal(t.covered, 1);
  assert.equal(t.excluded, 2);
  assert.equal(t.cards.get("alpha-new").share, 100);
  assert.equal(insight.statistics("crises").cards.get("crisis").count, 2);
});
test("score totals retain negative results; smoothed average is zero below four distinct scored performances", () => {
  const rows = Array.from({ length: 4 }, (_, i) =>
    row("e" + i, { wins: 1, losses: 3, place: 12 }),
  );
  assert.ok(
    index(rows).statistics("tactics").cards.get("alpha-new").average < 0,
  );
  assert.equal(
    index(rows.slice(0, 3)).statistics("tactics").cards.get("alpha-new")
      .average,
    0,
  );
  const provisional = row("provisional", { provisional: true });
  assert.equal(
    index([provisional]).statistics("tactics").cards.get("alpha-new").points,
    0,
  );
  assert.equal(
    index([provisional]).statistics("tactics").cards.get("alpha-new").share,
    100,
  );
});

test("owner labels come from card requirements, not from the statistics cohort or affiliation", () => {
  const angel = {
      slug: "angel",
      actAs: "angel",
      name: "Angel",
      alterEgo: "Warren Worthington III",
    },
    hulk = { ...chars[0], name: "Hulk" };
  const sacrifice = { requirementsItems: { mandatory_character: ["angel"] } };
  assert.deepEqual(Insights.owners(sacrifice, [angel, hulk]), ["Angel"]);
  assert.deepEqual(
    Insights.owners(
      { requirementsItems: { optional_character: ["angel", "hulk"] } },
      [angel, hulk],
    ),
    ["Angel", "Hulk"],
  );
  assert.deepEqual(
    Insights.owners(
      { affiliation: { name: "Avengers" }, requirementsItems: {} },
      [angel, hulk],
    ),
    [],
  );
});
