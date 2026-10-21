"use strict";
const { test, expect } = require("@playwright/test");
const http = require("node:http"),
  path = require("node:path"),
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
test("buying a box inside a scrolled character card retains scroll, focus and the same card DOM", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    }),
    page = await context.newPage();
  try {
    await page.goto(origin + "#screen=catalog");
    await expect(page.locator("#search")).toBeEnabled();
    await page
      .locator(
        '#characters [data-slug="spider-man-noir"][data-action="character"]',
      )
      .click();
    const dialog = page.locator("#character-dialog"),
      buy = dialog.locator('[data-purchased-code="CP170"]');
    await expect(buy).toBeVisible();
    await buy.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      window.__cardBefore = document.querySelector(
        "#character-dialog .sc-card",
      );
      window.__buyBefore = document.querySelector(
        '#character-dialog [data-purchased-code="CP170"]',
      );
    });
    const before = await dialog.evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(150);
    await buy.click();
    await expect(buy).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(180);
    const after = await dialog.evaluate((el) => el.scrollTop);
    console.log(JSON.stringify({ before, after }));
    expect(Math.abs(after - before)).toBeLessThan(8);
    expect(
      await page.evaluate(
        () =>
          __cardBefore.isConnected &&
          __cardBefore === document.querySelector("#character-dialog .sc-card"),
      ),
    ).toBe(true);
    await expect(buy).toBeFocused();
  } finally {
    await context.close();
  }
});
test("collection checkboxes update one retained row without moving the document or rewriting live HTML", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    }),
    page = await context.newPage();
  try {
    await page.addInitScript(() => {
      window.__liveHTMLWrites = [];
      const descriptor = Object.getOwnPropertyDescriptor(
        Element.prototype,
        "innerHTML",
      );
      Object.defineProperty(Element.prototype, "innerHTML", {
        ...descriptor,
        set(value) {
          if (this.isConnected)
            __liveHTMLWrites.push(this.id || this.className);
          descriptor.set.call(this, value);
        },
      });
    });
    await page.goto(origin + "#screen=catalog");
    await expect(page.locator("#search")).toBeEnabled();
    expect(await page.evaluate(() => MCPApp.diagnostics().engine)).toBe(
      "react",
    );
    const checkbox = page.locator("#owned-yondu");
    await checkbox.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => {
      __retainedRow = document
        .querySelector("#owned-yondu")
        .closest(".character-row");
      return scrollY;
    });
    expect(before).toBeGreaterThan(1000);
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toBeFocused();
    expect(
      Math.abs((await page.evaluate(() => scrollY)) - before),
    ).toBeLessThan(8);
    expect(
      await page.evaluate(
        () =>
          __retainedRow.isConnected &&
          __retainedRow ===
            document.querySelector("#owned-yondu").closest(".character-row"),
      ),
    ).toBe(true);
    expect(await page.evaluate(() => __liveHTMLWrites)).toEqual([]);
  } finally {
    await context.close();
  }
});
test("selecting a tactic retains the picker, scroll position and focused checkbox", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 820, height: 900 },
    }),
    page = await context.newPage();
  try {
    await page.addInitScript(() =>
      localStorage.setItem(
        "mcp-companion-catalog-v1",
        JSON.stringify({
          version: 1,
          owned: ["hulk"],
          groups: [],
          rosters: [
            {
              id: "scroll",
              name: "Scroll test",
              characters: ["hulk"],
              tactics: [],
              crises: [],
              groups: [],
            },
          ],
        }),
      ),
    );
    await page.goto(origin + "#screen=rosters");
    await page.locator('[data-rs="edit"]').first().click();
    await page
      .getByRole("button", { name: "Добавить карты Hulk", exact: true })
      .click();
    await page.locator("#roster-picker-related").uncheck();
    const last = page
      .locator(".picker-result")
      .last()
      .locator("input[type=checkbox]");
    await last.scrollIntoViewIfNeeded();
    const before = await page.locator(".picker-results").evaluate((el) => {
      window.__pickerBefore = el;
      window.__pickBefore = el.lastElementChild;
      return el.scrollTop;
    });
    expect(before).toBeGreaterThan(100);
    await last.check();
    await expect(last).toBeChecked();
    await expect(last).toBeFocused();
    expect(
      Math.abs(
        (await page.locator(".picker-results").evaluate((el) => el.scrollTop)) -
          before,
      ),
    ).toBeLessThan(8);
    expect(
      await page.evaluate(
        () => __pickerBefore.isConnected && __pickBefore.isConnected,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});
test("wishlist toggles deep in the box catalog keep images, focus and document position", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    }),
    page = await context.newPage();
  try {
    await page.goto(origin + "#screen=purchases");
    await page.locator('.purchase-tabs [data-purchase-tab="all"]').click();
    const tile = page.locator('#purchases-screen [data-box-set="CP170"]'),
      button = tile.locator("[data-wishlist-code]");
    await button.scrollIntoViewIfNeeded();
    const before = await tile.evaluate((el) => {
      window.__boxBefore = el;
      window.__imageBefore = el.querySelector("img");
      return scrollY;
    });
    expect(before).toBeGreaterThan(1000);
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button).toBeFocused();
    expect(
      Math.abs((await page.evaluate(() => scrollY)) - before),
    ).toBeLessThan(8);
    expect(
      await page.evaluate(
        () => __boxBefore.isConnected && __imageBefore.isConnected,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test("navigating to another character resets detail scroll while in-place collection changes retain it", async ({
  page,
}) => {
  await page.goto(origin + "#screen=catalog");
  await expect(page.locator("#search")).toBeEnabled();
  await page
    .locator(
      '#characters [data-action="character"][data-slug="spider-man-noir"]',
    )
    .click();
  const dialog = page.locator("#character-dialog");
  const set = dialog.locator('[data-box-code="CP170"]');
  await set.scrollIntoViewIfNeeded();
  expect(await dialog.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
  await set.click();
  await page
    .locator(
      '#box-set-dialog [data-action="catalog-character"][data-slug="silk"]',
    )
    .click();
  await expect(dialog.locator("h2").first()).toHaveText("Silk");
  await expect.poll(() => dialog.evaluate((el) => el.scrollTop)).toBe(0);
});
