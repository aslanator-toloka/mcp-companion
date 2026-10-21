"use strict";
const { test, expect } = require("@playwright/test");
const http = require("node:http"),
  path = require("node:path"),
  express = require("express");
let server, origin;
test.beforeAll(async () => {
  if (process.env.MCP_SKIN_TEST_ORIGIN) {
    origin = process.env.MCP_SKIN_TEST_ORIGIN;
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
test("Noir skin layers are independent, persist, restore the original, and never change canonical rules", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(origin + "#screen=catalog");
    await expect(page.locator("#search")).toBeEnabled();
    await page.locator("#search").fill("Spider-Man Noir");
    await page
      .locator(
        '#characters [data-action="character"][data-slug="spider-man-noir"]',
      )
      .click();
    const viewer = page.locator(".stat-card-viewer"),
      name = viewer.locator('[data-card-skin-layer="name"]'),
      background = viewer.locator('[data-card-skin-layer="background"]'),
      character = viewer.locator('[data-card-skin-layer="character"]');
    await expect(name).toBeChecked();
    await expect(background).toBeChecked();
    await expect(character).toBeDisabled();
    const bg = viewer.locator(".sc-skin-background");
    await expect(bg).toBeVisible();
    await expect
      .poll(() => bg.evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(
      () => document.querySelector(".sc-card")?.style.transform,
    );
    const baselineRules = await viewer
        .locator(".sc-rules-content")
        .textContent(),
      baselineStats = await viewer.locator(".sc-stats").textContent();
    const canonical = await page.evaluate(() =>
      JSON.stringify(MCPStores.catalog.details.get("spider-man-noir")),
    );
    await page.screenshot({
      path: path.resolve(__dirname, "../../previews/noir-alternative-card.png"),
      fullPage: false,
    });
    await name.uncheck();
    await expect(bg).toBeVisible();
    await expect(viewer.locator(".sc-name-styled")).toHaveCount(0);
    await background.uncheck();
    await expect(bg).toHaveCount(0);
    await name.check();
    await expect(viewer.locator(".sc-name-noir")).toBeVisible();
    await viewer.getByRole("button", { name: "Оригинал", exact: true }).click();
    await expect(name).not.toBeChecked();
    await expect(background).not.toBeChecked();
    expect(await viewer.locator(".sc-rules-content").textContent()).toBe(
      baselineRules,
    );
    expect(await viewer.locator(".sc-stats").textContent()).toBe(baselineStats);
    await name.check();
    await background.check();
    await viewer
      .getByRole("button", { name: "Injured · ранен", exact: true })
      .click();
    await expect(viewer.locator(".sc-injured")).toBeVisible();
    await expect(name).toBeChecked();
    await expect(background).toBeChecked();
    await page.reload();
    await expect(viewer.locator(".sc-injured")).toBeVisible();
    await viewer
      .getByRole("button", { name: "Healthy · здоров", exact: true })
      .click();
    await expect(name).toBeChecked();
    await expect(background).toBeChecked();
    // A deterministic local fixture exercises the third layer, without claiming it is generated Noir artwork.
    await page.route("**/assets/card-skins/test/character.png", (route) =>
      route.fulfill({
        path: path.resolve(
          __dirname,
          "../../assets/avatars/spider-man-noir.png",
        ),
        contentType: "image/png",
      }),
    );
    await page.evaluate(() => {
      MCP_CARD_SKINS["spider-man-noir"].character = {
        front: { src: "assets/card-skins/test/character.png" },
        back: { src: "assets/card-skins/test/character.png" },
      };
      MCPStores.cardViews.configure({
        ...MCPStores.cardViews.metadata,
        skins: { ...MCP_CARD_SKINS },
      });
    });
    await expect(character).toBeEnabled();
    for (let mask = 0; mask < 8; mask++) {
      await name.setChecked(!!(mask & 1));
      await background.setChecked(!!(mask & 2));
      await character.setChecked(!!(mask & 4));
      await expect(viewer.locator(".sc-name-styled")).toHaveCount(
        mask & 1 ? 1 : 0,
      );
      await expect(bg).toHaveCount(mask & 2 ? 1 : 0);
      await expect(viewer.locator(".sc-art-alternative")).toHaveCount(
        mask & 4 ? 1 : 0,
      );
      expect(await viewer.locator(".sc-rules-content").textContent()).toBe(
        baselineRules,
      );
      expect(await viewer.locator(".sc-stats").textContent()).toBe(
        baselineStats,
      );
    }
    expect(
      await page.evaluate(() =>
        JSON.stringify(MCPStores.catalog.details.get("spider-man-noir")),
      ),
    ).toBe(canonical);
    await page.setViewportSize({ width: 820, height: 1180 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      viewer.getByRole("button", { name: "Оригинал", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Закрыть карточку", exact: true })
      .click();
    await page.locator("#search").fill("Hulk");
    await page
      .locator('#characters [data-action="character"][data-slug="hulk"]')
      .click();
    await expect(page.locator(".stat-card-skin-controls")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
