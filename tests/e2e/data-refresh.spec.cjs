const { test, expect } = require("@playwright/test"),
  express = require("express"),
  http = require("node:http"),
  path = require("node:path");
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
const fresh = [
  ["red-hulk", "Red Hulk", "War of the Strongest"],
  ["the-leader", "The Leader", "My Latest Invention"],
  ["sensational-she-hulk", "Sensational She-Hulk", "Hostile Witness"],
];
test("all new characters have native healthy/injured faces, local portraits, personal tactics and the right box", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [slug, name, tactic] of fresh) {
    await page.goto(origin + "#screen=catalog&card=" + slug);
    const dialog = page.locator("#character-dialog");
    await expect(dialog.locator(".detail-name h2")).toHaveText(name);
    await expect(dialog.locator(".sc-card.sc-healthy")).toBeVisible();
    const portrait = dialog.locator(".avatar.large img");
    await expect
      .poll(() => portrait.evaluate((i) => i.naturalWidth))
      .toBeGreaterThan(0);
    await expect(dialog.locator(".sc-art img")).toHaveAttribute(
      "src",
      new RegExp(slug + "_healthy_2023\\.png"),
    );
    await expect(
      dialog.locator('[data-character-tactics="' + slug + '"]'),
    ).toContainText(tactic);
    await expect(dialog.locator('[data-box-set="MCP17"]')).toContainText(
      "The Leader, Red Hulk & Sensational She-Hulk",
    );
    await dialog.locator('[data-cv="side"][data-side="back"]').click();
    await expect(dialog.locator(".sc-card.sc-injured")).toBeVisible();
    await expect(dialog.locator(".sc-art img")).toHaveAttribute(
      "src",
      new RegExp(slug + "_injured_2023\\.png"),
    );
  }
  await page.goto(origin + "#screen=catalog&card=red-hulk");
  await page.locator("#character-dialog .sc-card").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "previews/refreshed-red-hulk.png" });
  expect(errors).toEqual([]);
});
test("existing local library survives refresh; a planned/purchased MCP17 applies to all three new models", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "mcp-companion-catalog-v1",
      JSON.stringify({
        version: 1,
        owned: ["wong"],
        wishlist: ["MCP17"],
        rosters: [
          {
            id: "old-roster",
            name: "My saved roster",
            characters: ["wong"],
            tactics: [],
            crises: [],
          },
        ],
      }),
    ),
  );
  await page.goto(origin + "#screen=catalog&card=the-leader");
  await expect(page.locator("#character-dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        MCPStores.library.snapshot.rosters.find((r) => r.id === "old-roster")
          .characters,
    ),
  ).toEqual(["wong"]);
  expect(await page.evaluate(() => MCPStores.library.owned.has("wong"))).toBe(
    true,
  );
  expect(
    await page.evaluate(() =>
      ["red-hulk", "the-leader", "sensational-she-hulk"].map(
        (s) => MCPStores.library.status(s).kind,
      ),
    ),
  ).toEqual(["planned", "planned", "planned"]);
  await page.locator('#character-dialog [data-purchased-code="MCP17"]').click();
  expect(
    await page.evaluate(() =>
      ["wong", "red-hulk", "the-leader", "sensational-she-hulk"].every((s) =>
        MCPStores.library.owned.has(s),
      ),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        MCPStores.library.snapshot.rosters.find((r) => r.id === "old-roster")
          .characters,
    ),
  ).toEqual(["wong"]);
});
test("updated affiliations and tournament archive resolve new identities in published rosters", async ({
  page,
}) => {
  await page.goto(origin + "#screen=catalog&affiliation=Intelligencia");
  await expect(
    page.locator('#characters [data-slug="the-leader"]'),
  ).toBeVisible();
  await expect(
    page.locator('#characters [data-slug="abomination"]'),
  ).toBeVisible();
  await page.goto(origin + "#screen=tournaments&character=red-hulk");
  await expect(page.locator("#at-character-overview h2")).toHaveText(
    "Red Hulk",
  );
  const snapshot = await page.evaluate(() => ({
    end: MCPStores.tournaments.data.meta.end,
    scope: MCPStores.tournaments.data.meta.scope,
    rows: MCPStores.tournaments.rosterRows.length,
    score: MCPStores.tournaments.overview.stats.points,
    identity:
      MCPStores.tournaments.index.characters.get("the-leader").inventoryIds,
  }));
  const fs = require("node:fs"),
    vm = require("node:vm"),
    ctx = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(
      path.resolve(__dirname, "../../tournaments/data.js"),
      "utf8",
    ),
    ctx,
  );
  const data = ctx.window.ROSTER_ATLAS,
    published = data.rosters.filter((r) => r.characterIds.includes("red-hulk"));
  expect(published.length).toBeGreaterThan(0);
  expect(published.some((r) => r.rawText.includes("Red Hulk 5"))).toBe(true);
  expect(snapshot.end).toBe(data.meta.end);
  expect(snapshot.scope).toBe("all_played_records");
  expect(snapshot.rows).toBe(published.length);
  expect(snapshot.score).toBeCloseTo(
    published.reduce((sum, r) => sum + (r.pointsShare || 0), 0),
    7,
  );
  expect(snapshot.identity).toEqual(["the-leader"]);
});
