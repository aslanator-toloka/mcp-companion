const { test, expect } = require("@playwright/test");
const fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path"),
  http = require("node:http"),
  express = require("express");
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
test("box cards and details show collection-relative unlocks, completing boxes and reactive purchase/undo/history", async ({
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
  const owned = [
    "hulk",
    "wong",
    "black-widow",
    "baron-zemo",
    "captain-america",
    "iron-man",
    "doctor-octopus",
    "beast",
    "spider-man",
    "spider-man-miles-morales",
  ];
  const make = (id, ids, wins, losses) => ({
    ...data.rosters.find((r) => r.inventoryComplete && !r.provisional),
    id,
    wins,
    losses,
    inventoryComplete: true,
    provisional: false,
    characterIds: ids,
    characters: ids.map((id) => ({
      id,
      name: data.characters.find((c) => c.id === id).name,
      gems: [],
    })),
  });
  data.rosters = [
    make("unlock", [...owned.slice(0, 8), "silk", "spider-man-noir"], 4, 1),
    make("almost", [...owned.slice(0, 8), "silk", "ancient-one"], 3, 0),
    make("excluded", [...owned.slice(0, 8), "silk", "spider-man-noir"], 3, 1),
    make("already", owned, 4, 0),
  ];
  await page.route("**/tournaments/data.js*", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: "window.ROSTER_ATLAS=" + JSON.stringify(data) + ";",
    }),
  );
  await page.addInitScript((value) => {
    if (!localStorage.getItem("mcp-companion-catalog-v1"))
      localStorage.setItem(
        "mcp-companion-catalog-v1",
        JSON.stringify({ version: 1, owned: value, rosters: [], groups: [] }),
      );
  }, owned);
  await page.goto(origin + "#screen=purchases&tab=all&q=CP170");
  const tile = page.locator('#purchases-screen [data-box-set="CP170"]');
  await expect(tile.locator("[data-box-unlocks]")).toHaveText("1");
  await expect(tile.locator("[data-box-almost]")).toHaveText("1");
  await tile.locator("[data-show-unlocks]").click();
  await expect(page).toHaveURL(/purchase-box=CP170/);
  await expect(page.locator("[data-purchase-filter]")).toContainText(
    "Покупка откроет",
  );
  await expect(page.locator("#at-roster-list [data-roster]")).toHaveCount(1);
  await expect(page.locator("#at-roster-list [data-roster]")).toHaveAttribute(
    "data-roster",
    "unlock",
  );
  await page.reload();
  await expect(page.locator("#at-roster-list [data-roster]")).toHaveAttribute(
    "data-roster",
    "unlock",
  );
  await page.goBack();
  await expect(tile).toBeVisible();
  const purchaseUrl = page.url();
  await tile.locator("[data-show-almost]").click();
  await expect(page).toHaveURL(purchaseUrl);
  await expect(tile.locator("[data-show-almost]")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(tile.locator('[data-complement-box="CP64"]')).toBeVisible();
  await tile.locator("[data-show-almost]").click();
  await expect(page).toHaveURL(purchaseUrl);
  await expect(tile.locator("[data-show-almost]")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await tile.locator("[data-show-almost]").click();
  await tile.locator("[data-show-almost-rosters]").click();
  await expect(page).toHaveURL(/purchase-view=almost/);
  await expect(page.locator("#at-roster-list [data-roster]")).toHaveCount(1);
  await expect(page.locator("#at-roster-list [data-roster]")).toHaveAttribute(
    "data-roster",
    "almost",
  );
  await page.getByRole("button", { name: "Снять фильтр покупки" }).click();
  await expect(page).not.toHaveURL(/purchase-box=/);
  await page.goBack();
  await expect(page).toHaveURL(/purchase-view=almost/);
  await page.goBack();
  await expect(tile).toBeVisible();
  if (
    (await tile.locator("[data-show-almost]").getAttribute("aria-expanded")) !==
    "true"
  )
    await tile.locator("[data-show-almost]").click();
  await expect(tile.locator('[data-complement-box="CP64"]')).toContainText(
    "Mordo & Ancient One",
  );
  await expect(tile.locator('[data-missing-from-box="CP64"]')).toHaveText(
    "Не хватает: Ancient One",
  );
  await expect(tile.locator('[data-missing-from-box="CP221"]')).toHaveText(
    "Не хватает: Ancient One",
  );
  await tile.screenshot({ path: "previews/box-opportunities-complements.png" });
  await tile.locator('[data-show-complement="CP64"]').click();
  await expect(page).toHaveURL(/purchase-extra=CP64/);
  await expect(page.locator("[data-purchase-filter]")).toContainText(
    "Mordo & Ancient One",
  );
  await expect(page.locator("[data-purchase-filter]")).toContainText(
    "Не хватает: Ancient One",
  );
  await expect(page.locator("#at-roster-list [data-roster]")).toHaveAttribute(
    "data-roster",
    "almost",
  );
  await page.goBack();
  await expect(tile).toBeVisible();
  await tile.locator('[data-wishlist-code="CP170"]').click();
  await expect(tile.locator("[data-box-unlocks]")).toHaveText("1");
  await tile.locator('[data-box-code="CP170"]').click();
  const detail = page.locator("#box-set-dialog");
  await expect(
    detail.locator('[data-box-opportunities="CP170"] [data-box-almost]'),
  ).toHaveText("1");
  await detail.locator('[data-complement-box="CP64"]').click();
  await expect(page).toHaveURL(/box=CP64/);
  await detail.locator('[data-purchased-code="CP64"]').click();
  await page.goBack();
  await expect(page).toHaveURL(/box=CP170/);
  await expect(detail.locator("[data-box-unlocks]")).toHaveText("2");
  await expect(detail.locator("[data-box-almost]")).toHaveText("0");
  await detail.locator('[data-purchased-code="CP170"]').click();
  await expect(detail.locator("[data-box-unlocks]")).toHaveText("0");
  await detail.locator('[data-purchased-code="CP170"]').click();
  await expect(detail.locator("[data-box-unlocks]")).toHaveText("2");
  await page.reload();
  await expect(detail.locator("[data-box-unlocks]")).toHaveText("2");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await detail.screenshot({ path: "previews/box-opportunities-mobile.png" });
  await detail.locator("[data-box-close]").click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await tile.screenshot({ path: "previews/box-opportunities.png" });
  await page.goto(origin + "#screen=tournaments&character=silk");
  const tournamentRoster = page.locator(
    '#at-roster-list [data-roster="unlock"]',
  );
  await tournamentRoster.locator("summary").click();
  const needs = tournamentRoster.locator('[data-roster-box-needs="unlock"]');
  await expect(needs).toContainText("Минимум 1 коробка");
  await expect(needs).toContainText("Silk");
  await expect(needs).toContainText("Spider-Man Noir");
  await needs.scrollIntoViewIfNeeded();
  await needs.screenshot({ path: "previews/roster-missing-boxes.png" });
  const neededBox = needs.locator("[data-needed-box]").first();
  const neededCode = await neededBox.getAttribute("data-needed-box");
  await neededBox.click();
  await expect(page).toHaveURL(new RegExp("box=" + neededCode));
  await detail.locator(`[data-purchased-code="${neededCode}"]`).click();
  await expect(needs).toContainText("Все персонажи уже есть");
  await detail.locator(`[data-purchased-code="${neededCode}"]`).click();
  await expect(needs).toContainText("Минимум 1 коробка");
  await page.goBack();
  await expect(tournamentRoster).toHaveAttribute("open", "");
  const lowerResult = page.locator('#at-roster-list [data-roster="excluded"]');
  await lowerResult.locator("summary").click();
  await expect(lowerResult.locator("[data-roster-box-needs]")).toContainText(
    "Минимум 1 коробка",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await needs.screenshot({ path: "previews/roster-missing-boxes-mobile.png" });
  expect(errors).toEqual([]);
});
