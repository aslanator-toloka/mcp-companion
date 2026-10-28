const { test, expect } = require("@playwright/test"),
  http = require("node:http"),
  express = require("express"),
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
test("roster/group CRUD and two-tab conflict resolution retain local draft and saved records", async ({
  browser,
}) => {
  const context = await browser.newContext(),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(origin + "#screen=rosters");
    await page
      .getByRole("button", { name: "Новый ростер +", exact: true })
      .click();
    await page.locator("#editor-name").fill("Native roster");
    await page.locator('[data-rs="new-group"]').click();
    let modal = page.locator("#roster-action-dialog");
    await modal.locator('input[name="name"]').fill("Tournament");
    await modal
      .getByRole("button", { name: "Создать группу", exact: true })
      .click();
    await expect(page.locator("[data-editor-group]")).toBeChecked();
    await page.locator('[data-rs="save"]').click();
    await expect(page.locator(".roster-tile")).toContainText("Tournament");
    await page.locator('#rosters-screen [data-rs="duplicate"]').click();
    await page.locator("#editor-name").fill("Copy");
    await page.locator('[data-rs="save"]').click();
    await expect(page.locator(".roster-tile")).toHaveCount(2);
    const id = await page
      .locator(".roster-tile")
      .filter({ hasText: "Native roster" })
      .locator('[data-rs="edit"]')
      .first()
      .getAttribute("data-id");
    await page.locator(`.roster-title[data-id="${id}"]`).click();
    await page.locator("#editor-name").fill("Local draft");
    const other = await context.newPage();
    await other.goto(origin + "#screen=rosters");
    await other.locator(`.roster-title[data-id="${id}"]`).click();
    await other.locator("#editor-name").fill("Other tab");
    await other.locator('[data-rs="save"]').click();
    await expect(page.locator("#rosters-screen .notice")).toContainText(
      "другой вкладке",
    );
    await expect(page.locator("#editor-name")).toHaveValue("Local draft");
    await page.locator('[data-rs="save"]').click();
    await expect(modal).toContainText("Ростер изменён в другой вкладке");
    await modal.locator('[data-rs="force-save"]').click();
    await expect(page.locator(".roster-tile")).toContainText([
      "Local draft",
      "Copy",
    ]);
    await expect(other.locator(".roster-tile")).toContainText([
      "Local draft",
      "Copy",
    ]);
    await other.close();
    await page.getByRole("button", { name: "Группы", exact: true }).click();
    await modal.locator('[data-rs="rename-group"]').click();
    await modal.locator('input[name="name"]').fill("League");
    await modal
      .getByRole("button", { name: "Сохранить название", exact: true })
      .click();
    await expect(page.locator(".roster-tile")).toContainText([
      "League",
      "League",
    ]);
    await expect(modal.locator(".group-manager")).toBeVisible();
    await modal.locator('[data-rs="delete-group"]').click();
    await modal.locator('[data-rs="confirm-delete-group"]').click();
    await modal.locator('[data-rs="close-action"]').click();
    await expect(page.locator(".roster-tile")).toHaveCount(2);
    await expect(page.locator(".roster-tags")).not.toContainText([
      "League",
      "League",
    ]);
    await page.locator('.roster-tile [data-rs="delete"]').first().click();
    await modal.locator('[data-rs="confirm-delete"]').click();
    await expect(page.locator(".roster-tile")).toHaveCount(1);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
test("affiliation and player country/scope/sort controls update the actual tournament cohort", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "#character=ultimate-spider-man");
  await page.locator("#at-affiliation-picker").click();
  await page.locator("#at-affiliation-sort").selectOption("name");
  const options = page.locator(
      "#at-affiliation-options .at-affiliation-name strong",
    ),
    names = await options.allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  await page
    .locator('#at-affiliation-options input[value="Web Warriors"]')
    .check();
  await page.locator("#at-affiliation-done").click();
  await expect(page.locator("#at-character-overview")).toContainText(
    "Web Warriors",
  );
  await page.locator("#at-player-picker").click();
  await page.locator("#at-player-affiliation").selectOption("Web Warriors");
  await expect(page.locator("#at-player-score-scope")).toContainText(
    "Web Warriors",
  );
  await page.locator("#at-player-sort").selectOption("average");
  const expected = await page.evaluate(
    () => MCPStores.tournaments.playerRows[0].id,
  );
  await expect(page.locator("#at-player-options input").first()).toHaveValue(
    expected,
  );
  const code = await page
    .locator("#at-player-country option")
    .evaluateAll(
      (options) =>
        options.find((o) => o.value && !o.value.startsWith("__")).value,
    );
  await page.locator("#at-player-country").selectOption(code);
  expect(
    await page.evaluate(() =>
      MCPStores.tournaments.playerRows.every(
        (p) => p.countryCode === MCPStores.tournaments.playerCountry,
      ),
    ),
  ).toBe(true);
  await page.locator("#at-player-country").selectOption("");
  await page.locator("#at-player-options input").first().check();
  await page.locator("#at-player-done").click();
  await expect(page.locator("#at-character-overview")).toContainText(
    "Все ростеры игрока",
  );
  await expect(page.locator("#at-player-label")).not.toHaveText("Все игроки");
  await page.locator("#at-player-clear").click();
  await expect(page.locator("#at-player-label")).toHaveText("Все игроки");
  expect(errors).toEqual([]);
});
test("failed collection writes roll back controls and preserve storage; malformed saves are not overwritten", async ({
  browser,
}) => {
  const context = await browser.newContext(),
    page = await context.newPage();
  try {
    await page.goto(origin + "#screen=catalog");
    await expect(page.locator("#search")).toBeEnabled();
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "mcp-companion-catalog-v1")
          throw new DOMException("Quota full", "QuotaExceededError");
        return original.call(this, key, value);
      };
    });
    await page.locator("#owned-hulk").click();
    await expect(page.locator("#owned-hulk")).not.toBeChecked();
    await expect(page.locator("#toast")).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("mcp-companion-catalog-v1"),
      ),
    ).toBe(null);
    await page.reload();
    await expect(page.locator("#search")).toBeEnabled();
    await page.evaluate(() =>
      localStorage.setItem("mcp-companion-catalog-v1", "broken JSON"),
    );
    await page.reload();
    await expect(page.locator("#search")).toBeEnabled();
    await page.locator("#owned-hulk").click();
    await expect(page.locator("#owned-hulk")).not.toBeChecked();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("mcp-companion-catalog-v1"),
      ),
    ).toBe("broken JSON");
  } finally {
    await context.close();
  }
});

test("catalog interaction waits for complete initialization and the first card stays open", async ({
  page,
}) => {
  let release;
  await page.route("**/data/box-sets.json", async (route) => {
    await new Promise((r) => (release = r));
    await route.continue();
  });
  await page.goto(origin + "#screen=catalog", {
    waitUntil: "domcontentloaded",
  });
  await expect.poll(() => !!release).toBe(true);
  await expect(page.locator("#search")).toBeDisabled();
  release();
  await expect(page.locator("#search")).toBeEnabled();
  await page.locator("#search").fill("Spider-Man Noir");
  await page.locator('#characters [data-action="character"]').click();
  await expect(page.locator("#character-dialog")).toBeVisible();
  await expect(page.locator(".stat-card-skin-controls")).toBeVisible();
  await expect(page.locator("#search")).toHaveValue("Spider-Man Noir");
});
