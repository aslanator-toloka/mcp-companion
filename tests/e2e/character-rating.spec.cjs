const { test, expect } = require("@playwright/test"),
  express = require("express"),
  http = require("node:http"),
  path = require("node:path"),
  fs = require("node:fs"),
  vm = require("node:vm");
const ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.resolve(__dirname, "../../tournaments/data.js"), "utf8"),
  ctx,
);
const archive = JSON.parse(JSON.stringify(ctx.window.ROSTER_ATLAS));
let server, origin, fit, prepare;
test.beforeAll(async () => {
  ({ fitCharacterRating: fit, prepareRatingRows: prepare } =
    await import("../../frontend/src/character-rating.js"));
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
const panel = (page) =>
  page.getByRole("region", {
    name: "Рейтинг с поправкой на игрока",
    exact: true,
  });
async function ready(page) {
  await expect(panel(page)).toHaveAttribute("aria-busy", "false");
  await expect
    .poll(() => page.evaluate(() => MCPStores.tournaments.ratingStatus))
    .toBe("ready");
}
const selectedRating = (page) =>
  page.evaluate(() => {
    const t = MCPStores.tournaments;
    return { ...t.activeRating.ratings[t.selected] };
  });
test("worker matches pure estimator, sorting has stable history and selection doesn't recalculate", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "#screen=tournaments&character=wong");
  await ready(page);
  const model = fit(archive);
  expect(await selectedRating(page)).toEqual(model.ratings.wong);
  await expect(panel(page)).toContainText(
    `${model.diagnostics.performances} выступлений`,
  );
  await expect(
    page.locator('[data-character="wong"] .at-adjusted-value').first(),
  ).toContainText("R ");
  const before = await page.evaluate(() => MCPStores.tournaments.ratingRequest);
  await page.locator("#at-character-sort").selectOption("rating");
  const rows = await page.evaluate(() =>
    MCPStores.tournaments.characterRows.map((r) => ({
      id: r.id,
      value: r.rating?.value ?? null,
    })),
  );
  expect(
    rows
      .filter((r) => r.value !== null)
      .every((r, i, a) => !i || a[i - 1].value >= r.value),
  ).toBe(true);
  await expect(page).toHaveURL(/sort=rating/);
  await page.locator('#at-character-list [data-character="angel"]').click();
  await expect(panel(page).locator("[data-character-rating]")).toHaveAttribute(
    "data-character-rating",
    "angel",
  );
  expect(await page.evaluate(() => MCPStores.tournaments.ratingRequest)).toBe(
    before,
  );
  await page.goBack();
  await expect(panel(page).locator("[data-character-rating]")).toHaveAttribute(
    "data-character-rating",
    "wong",
  );
  expect(await selectedRating(page)).toEqual(model.ratings.wong);
  await page.reload();
  await ready(page);
  await expect(page.locator("#at-character-sort")).toHaveValue("rating");
  expect(await selectedRating(page)).toEqual(model.ratings.wong);
  expect(errors).toEqual([]);
});
test("affiliation and country refit the cohort, while selecting one pilot preserves the comparison; empty cohort is honest", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    origin +
      "#screen=tournaments&character=wong&affiliation=Web+Warriors&sort=rating",
  );
  await ready(page);
  const eligible = prepare(archive).rows;
  const affiliated = eligible.filter((r) =>
    r.affiliations.includes("Web Warriors"),
  );
  const expected = fit({ ...archive, rosters: affiliated });
  expect(await selectedRating(page)).toEqual(expected.ratings.wong);
  const before = await page.evaluate(() => MCPStores.tournaments.ratingRequest);
  const pilot = affiliated.find((r) =>
    r.characterIds.includes("wong"),
  ).playerId;
  await page.evaluate(
    (pilot) => MCPStores.tournaments.choosePlayer(String(pilot)),
    pilot,
  );
  expect(await page.evaluate(() => MCPStores.tournaments.ratingRequest)).toBe(
    before,
  );
  await expect(panel(page)).toContainText(
    "рейтинг остаётся сравнением всех игроков",
  );
  expect(
    await page.evaluate(() => MCPStores.tournaments.activeRating.ratings.wong),
  ).toEqual(expected.ratings.wong);
  await page.locator("#at-event-country").selectOption("russia");
  await ready(page);
  const russian = affiliated.filter((r) =>
    r.location.trim().endsWith("Russia"),
  );
  const country = fit({ ...archive, rosters: russian });
  expect(
    await page.evaluate(() => MCPStores.tournaments.activeRating.ratings.wong),
  ).toEqual(country.ratings.wong);
  await page.locator("#at-event-country").selectOption("__unknown__");
  await ready(page);
  await expect(panel(page)).toContainText("0 выступлений");
  expect((await selectedRating(page)).value).toBeNull();
  await page.goBack();
  await ready(page);
  expect(
    await page.evaluate(() => MCPStores.tournaments.activeRating.ratings.wong),
  ).toEqual(country.ratings.wong);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto(origin + "#screen=tournaments&character=wong&sort=rating");
  await ready(page);
  await panel(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "previews/character-rating-mobile.png" });
  expect(errors).toEqual([]);
});
test("worker failure leaves old points and rosters usable, with explicit retry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.Worker = undefined;
  });
  await page.goto(origin + "#screen=tournaments&character=wong");
  await expect(panel(page)).toContainText("Браузер не поддерживает");
  await expect(panel(page)).toHaveAttribute("aria-busy", "false");
  await expect(
    page.locator("#at-roster-list [data-roster]").first(),
  ).toBeVisible();
  const oldPoints = await page.evaluate(
    () => MCPStores.tournaments.overview.stats.points,
  );
  expect(Number.isFinite(oldPoints)).toBe(true);
  await panel(page)
    .getByRole("button", { name: "Повторить", exact: true })
    .click();
  await expect(panel(page)).toContainText("Браузер не поддерживает");
  await page.locator("#at-character-sort").selectOption("average");
  expect(
    await page.evaluate(() => MCPStores.tournaments.overview.stats.points),
  ).toBe(oldPoints);
});
