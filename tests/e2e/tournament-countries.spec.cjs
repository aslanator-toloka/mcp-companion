const { test, expect } = require("@playwright/test"),
  express = require("express"),
  http = require("node:http"),
  path = require("node:path"),
  fs = require("node:fs"),
  vm = require("node:vm");
const Core = require("../../tournaments/core.js"),
  ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.resolve(__dirname, "../../tournaments/data.js"), "utf8"),
  ctx,
);
const archive = JSON.parse(JSON.stringify(ctx.window.ROSTER_ATLAS));
let server, origin;
test.beforeAll(async () => {
  if (process.env.MCP_REACT_TEST_ORIGIN) {
    origin = process.env.MCP_REACT_TEST_ORIGIN;
    return;
  }
  const app = express();
  app.use("/mcp-companion", express.static(path.resolve(__dirname, "../..")));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${server.address().port}/mcp-companion/`;
});
test.afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
async function state(page) {
  return page.evaluate(() => {
    const t = MCPStores.tournaments;
    return {
      ids: t.rosterRows.map((r) => r.id),
      stats: t.overview.stats,
      characters: t.characterRows.map((c) => ({
        id: c.id,
        points: c.points,
        count: c.count,
      })),
      playerRows: t.playerRows.map((p) => ({
        id: p.id,
        country: p.countryCode,
        points: p.points,
      })),
      total: t.total,
    };
  });
}
const forCharacter = (rows, id) =>
  rows.filter((r) => r.characterIds.includes(id));
const ids = (rows) =>
  Core.rosterList(Core.createIndex({ ...archive, rosters: rows }), "wong").map(
    (r) => r.id,
  );
test("event country scopes roster lists and every score; history and reload restore it alongside affiliations", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "#screen=tournaments&character=wong");
  await page.locator("#at-event-country").selectOption("russia");
  const inRussia = archive.rosters.filter((r) =>
      r.location.trim().endsWith("Russia"),
    ),
    wong = forCharacter(inRussia, "wong"),
    expected = Core.scoreSummary(wong);
  expect(wong.length).toBeGreaterThan(0);
  await expect.poll(async () => (await state(page)).ids).toEqual(ids(inRussia));
  expect((await state(page)).stats.points).toBeCloseTo(expected.points, 7);
  expect((await state(page)).stats.average).toBeCloseTo(expected.average, 7);
  const visible = await page
    .locator("#at-roster-list [data-roster]")
    .evaluateAll((es) => es.map((e) => e.dataset.roster));
  expect(visible).toEqual(ids(inRussia).slice(0, 20));
  await expect(page).toHaveURL(/event-country=russia/);
  const saved = page.url();
  await page.locator("#at-affiliation-picker").click();
  await page
    .locator('#at-affiliation-options input[value="Web Warriors"]')
    .check();
  await page.locator("#at-affiliation-done").click();
  const affiliated = inRussia.filter((r) =>
    r.affiliations.includes("Web Warriors"),
  );
  await expect
    .poll(async () => (await state(page)).ids)
    .toEqual(ids(affiliated));
  expect((await state(page)).stats.points).toBeCloseTo(
    Core.scoreSummary(forCharacter(affiliated, "wong")).points,
    7,
  );
  await page.goto(saved);
  await expect(page.locator("#at-event-country")).toHaveValue("russia");
  await expect.poll(async () => (await state(page)).ids).toEqual(ids(inRussia));
  await page.locator("#at-event-country").selectOption("united_states");
  await expect(page).toHaveURL(/event-country=united_states/);
  await page.goBack();
  await expect(page.locator("#at-event-country")).toHaveValue("russia");
  await page.goForward();
  await expect(page.locator("#at-event-country")).toHaveValue("united_states");
  await page.reload();
  await expect(page.locator("#at-event-country")).toHaveValue("united_states");
  expect(errors).toEqual([]);
});
test("player country is independent of event country and scopes the player picker and roster statistics", async ({
  page,
}) => {
  await page.goto(origin + "#screen=tournaments&character=wong");
  await page.locator("#at-roster-country").selectOption("russia");
  const russianIds = new Set(
    archive.players
      .filter((p) => p.countryCode === "russia")
      .map((p) => String(p.id)),
  );
  const rows = archive.rosters.filter((r) =>
    russianIds.has(String(r.playerId)),
  );
  await expect.poll(async () => (await state(page)).ids).toEqual(ids(rows));
  expect((await state(page)).stats.points).toBeCloseTo(
    Core.scoreSummary(forCharacter(rows, "wong")).points,
    7,
  );
  await page.locator("#at-event-country").selectOption("united_states");
  const both = rows.filter((r) => r.location.trim().endsWith("United States"));
  await expect.poll(async () => (await state(page)).ids).toEqual(ids(both));
  await page.locator("#at-player-picker").click();
  const players = (await state(page)).playerRows;
  expect(players.every((p) => p.country === "russia")).toBe(true);
  await page.locator("#at-player-done").click();
  await page.reload();
  await expect(page.locator("#at-event-country")).toHaveValue("united_states");
  await expect(page.locator("#at-roster-country")).toHaveValue("russia");
  await page
    .getByRole("button", { name: "Сбросить страны", exact: true })
    .click();
  await expect(page.locator("#at-event-country")).toHaveValue("");
  await expect(page.locator("#at-roster-country")).toHaveValue("");
  await expect
    .poll(async () => (await state(page)).ids)
    .toEqual(ids(archive.rosters));
});
test("unknown event country leaves selected player visible with zero scores; controls fit mobile", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const player = archive.rosters[0].playerId;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + `#screen=tournaments&player=${player}`);
  await expect(page.locator("#at-character-overview")).toContainText(
    "Все ростеры игрока",
  );
  await page.locator("#at-event-country").selectOption("__unknown__");
  await expect(page.locator("#at-roster-list .at-empty-state")).toBeVisible();
  const s = await state(page);
  expect(s.stats.points).toBe(0);
  expect(s.stats.average).toBe(0);
  expect(s.stats.count).toBe(0);
  await expect(page.locator("#at-character-overview")).toContainText(
    "Все ростеры игрока",
  );
  await page.locator(".at-country-bar").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "previews/tournament-countries-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
