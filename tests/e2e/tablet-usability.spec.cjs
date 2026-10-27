const { test, expect } = require("@playwright/test");
const express = require("express"),
  http = require("node:http"),
  path = require("node:path");
test.use({ hasTouch: true });
let server, origin;
test.beforeAll(async () => {
  if (process.env.MCP_REACT_TEST_ORIGIN) {
    origin = process.env.MCP_REACT_TEST_ORIGIN;
    return;
  }
  const app = express();
  app.use("/mcp-companion", express.static(path.resolve(__dirname, "../..")));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}/mcp-companion/`;
});
test.afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

for (const size of [
  { width: 820, height: 1180 },
  { width: 1194, height: 834 },
]) {
  test(`iPad ${size.width}: archive fits the viewport and leaves room for results`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto(origin + "#screen=tournaments&character=wong");
    await expect(page.locator("#at-character-list")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(size.width);
    const nav = await page.locator("nav").boundingBox();
    expect(nav.height).toBeLessThanOrEqual(70);
    const layout = await page.locator(".at-archive-layout").boundingBox();
    expect(layout.y).toBeLessThan(size.height - 180);
    const firstRoster = await page
      .locator(".at-roster-card")
      .first()
      .boundingBox();
    expect(firstRoster.y).toBeLessThan(size.height - 40);
    await expect(page.locator(".at-rating-disclosure")).not.toHaveAttribute(
      "open",
      "",
    );
    const filters = page.locator(".at-filter-panel");
    if (!(await filters.evaluate((el) => el.open)))
      await filters.locator("summary").first().click();
    await expect(page.locator("#at-event-country")).toBeVisible();
    await expect(page.locator("#at-roster-country")).toBeVisible();
    await page.locator("#at-event-country").selectOption("russia");
    await expect(page).toHaveURL(/event-country=russia/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(size.width);
    await page
      .getByRole("button", { name: "Сбросить страны", exact: true })
      .click();
    await expect(page.locator("#at-event-country")).toHaveValue("");
    await page.goBack();
    await expect(page.locator("#at-event-country")).toHaveValue("russia");
  });
}

test("catalog restrictions are removable individually and preserve the other criteria", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(origin + "#screen=catalog");
  await expect(page.locator("#search")).toBeEnabled();
  await page.locator("#affiliation").selectOption("Web Warriors");
  await page.locator("#search").fill("Spider");
  await page.locator("#only-owned").check();
  await expect(page.locator("#result")).toContainText("0 записей");
  await page
    .getByRole("button", { name: "Снять фильтр: Есть у меня", exact: true })
    .click();
  await expect(page.locator("#affiliation")).toHaveValue("Web Warriors");
  await expect(page.locator("#search")).toHaveValue("Spider");
  await expect(
    page.locator("#characters .character-row").first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Снять фильтр: Поиск: Spider", exact: true })
    .click();
  await expect(page.locator("#search")).toHaveValue("");
  await expect(page.locator("#affiliation")).toHaveValue("Web Warriors");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(820);
});

test("tablet card opens fitted without an unsolicited role tooltip and can enlarge then fit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(origin + "#screen=catalog&q=Wong");
  await page.locator('#characters [data-slug="wong"]').click();
  await expect(page.locator("#character-dialog .sc-card")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Закрыть карточку", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".character-role-tooltip")).not.toBeVisible();
  const surface = page.locator("#character-dialog .stat-card-surface");
  await expect
    .poll(() => surface.evaluate((e) => e.scrollWidth <= e.clientWidth + 1))
    .toBe(true);
  await page
    .getByRole("button", { name: "Увеличить карту", exact: true })
    .click();
  await expect
    .poll(() => surface.evaluate((e) => e.scrollWidth > e.clientWidth + 50))
    .toBe(true);
  await page
    .getByRole("button", { name: "Вписать карту", exact: true })
    .click();
  await expect
    .poll(() => surface.evaluate((e) => e.scrollWidth <= e.clientWidth + 1))
    .toBe(true);
  await page
    .getByRole("button", { name: "Закрыть карточку", exact: true })
    .click();
  await expect(page.locator("#character-dialog")).not.toBeVisible();
  await expect(page.locator("#search")).toHaveValue("Wong");
});

test("roster picker keeps the Done action visible after scrolling on a landscape tablet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1194, height: 834 });
  await page.goto(origin + "#screen=rosters");
  await page
    .getByRole("button", { name: "Новый ростер +", exact: true })
    .click();
  await page
    .getByRole("button", { name: "+ Добавить", exact: true })
    .first()
    .click();
  const dialog = page.locator("dialog[open]");
  await expect(
    dialog.getByRole("button", { name: "Готово", exact: true }),
  ).toBeVisible();
  await dialog.locator(".picker-result").last().scrollIntoViewIfNeeded();
  const footer = await dialog.locator(".picker-footer").boundingBox();
  const bounds = await dialog.boundingBox();
  expect(footer.y).toBeGreaterThan(bounds.y);
  expect(footer.y + footer.height).toBeLessThanOrEqual(
    bounds.y + bounds.height + 1,
  );
  await dialog.getByRole("button", { name: "Готово", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Новый ростер", exact: true }),
  ).toBeVisible();
});
