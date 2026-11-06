const { test, expect } = require("@playwright/test"),
  fs = require("node:fs"),
  vm = require("node:vm"),
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
test("personal tactics show percentages for finished character rosters with 3+/≤1 and distinguish no data from zero picks", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const ctx = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(
      path.resolve(__dirname, "../../tournaments/data.js"),
      "utf8",
    ),
    ctx,
  );
  const data = JSON.parse(JSON.stringify(ctx.window.ROSTER_ATLAS));
  const template = data.rosters.find(
    (r) => r.inventoryComplete && !r.provisional,
  );
  const make = (id, tactics, extra = {}) => ({
    ...template,
    id,
    eventId: id,
    variantCount: 1,
    wins: 3,
    losses: 1,
    provisional: false,
    characterIds: ["hulk"],
    characters: [{ id: "hulk", name: "Hulk", gems: [] }],
    tactics,
    rawText: "",
    ...extra,
  });
  data.rosters = [
    make("with-card", ["Gamma Launch", "Gamma Launch"]),
    make("without-card", ["Fall Back"], { wins: 4, losses: 0 }),
    make("too-few-wins", ["Gamma Launch"], { wins: 2, losses: 0 }),
    make("too-many-losses", ["Gamma Launch"], { wins: 4, losses: 2 }),
    make("unfinished", ["Gamma Launch"], { provisional: true }),
    make("unresolved", ["Gamma Launch", "Unknown tactic"]),
    make("missing", []),
    make("other-character", ["Gamma Launch"], {
      characterIds: ["wong"],
      characters: [{ id: "wong", name: "Wong", gems: [] }],
    }),
  ];
  await page.route("**/tournaments/data.js*", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: "window.ROSTER_ATLAS=" + JSON.stringify(data) + ";",
    }),
  );
  await page.goto(origin + "#screen=catalog&card=hulk");
  const section = page.locator('[data-character-tactics="hulk"]');
  const gamma = section.locator('[data-card-slug="gamma-launch-ca10"]');
  await expect(section.locator("[data-tactics-coverage]")).toContainText(
    "3+/≤1",
  );
  await expect(section.locator("[data-tactics-coverage]")).toContainText(
    "в 2 из 4 ростеров",
  );
  await expect(gamma.locator("[data-tactic-popularity] strong")).toHaveText(
    "50%",
  );
  await expect(gamma.locator("[data-tactic-popularity]")).toContainText(
    "1 из 2 списков",
  );
  await expect(
    section.locator(
      '[data-card-slug="anger-management-ca10"] [data-tactic-popularity] strong',
    ),
  ).toHaveText("0%");
  await gamma
    .getByRole("button", { name: "Открыть тактику Gamma Launch", exact: true })
    .click();
  await expect(page.locator("#game-card-dialog")).toBeVisible();
  await page.goBack();
  await expect(gamma.locator("[data-tactic-popularity] strong")).toHaveText(
    "50%",
  );
  await page.reload();
  await expect(gamma.locator("[data-tactic-popularity] strong")).toHaveText(
    "50%",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await gamma.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await gamma.screenshot({
    path: "previews/character-tactics-popularity-mobile.png",
  });
  await page.goto(origin + "#screen=catalog&card=angel");
  const empty = page.locator('[data-character-tactics="angel"]');
  await expect(empty.locator("[data-tactic-popularity] strong")).toHaveText(
    ["—", "—"],
  );
  await expect(empty).toContainText("Нет данных по ростерам 3+/≤1");
  expect(errors).toEqual([]);
});
test("character detail displays personal native tactics without duplicate printings; enlarged cards support history", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "#screen=catalog&card=wong");
  const section = page.locator('[data-character-tactics="wong"]');
  await expect(section.locator(".character-tactic-preview")).toHaveCount(1);
  await expect(section).toContainText("Pentagram of Farallah");
  await expect(section.locator(".gc-tactic")).toBeVisible();
  await section
    .getByRole("button", {
      name: "Открыть тактику Pentagram of Farallah",
      exact: true,
    })
    .click();
  await expect(page.locator("#game-card-dialog")).toBeVisible();
  await expect(page).toHaveURL(/game=tactics/);
  await page.goBack();
  await expect(page.locator("#game-card-dialog")).not.toBeVisible();
  await expect(page.locator("#character-dialog")).toBeVisible();
  await page.goto(origin + "#screen=catalog&card=hulk");
  const hulk = page.locator('[data-character-tactics="hulk"]');
  await expect(hulk.locator(".character-tactic-preview")).toHaveCount(3);
  await expect(hulk).toContainText("Gamma Launch");
  await expect(hulk).not.toContainText("Fall Back");
  await page.setViewportSize({ width: 390, height: 844 });
  await hulk.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "previews/character-tactics-mobile.png" });
  await page.goto(origin + "#screen=catalog&card=angel");
  await expect(page.locator('[data-character-tactics="angel"]')).toContainText(
    "Ultimate Sacrifice",
  );
  expect(errors).toEqual([]);
});
