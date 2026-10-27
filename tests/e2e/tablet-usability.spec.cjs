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

test("tournament roster opens the populated builder through the bundled application", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "#screen=tournaments&character=wong");
  await page.locator(".at-roster-card").first().locator("summary").click();
  await page.locator(".at-roster-card[open] [data-tournament-import]").click();
  await expect(page.locator("#editor-name")).toBeVisible();
  await expect(page.locator("#rosters-screen .selected-row")).toHaveCount(10);
  await expect(
    page.getByRole("button", { name: "Сохранить ростер", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("form controls share readable geometry across catalog, calculator and tournament pickers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1194, height: 834 });
  for (const screen of ["catalog", "calculator", "tournaments"]) {
    await page.goto(origin + "#screen=" + screen);
    if (screen === "catalog")
      await expect(page.locator("#search")).toBeEnabled();
    if (screen === "calculator")
      await expect(
        page.getByRole("combobox", { name: "Первый персонаж", exact: true }),
      ).toBeVisible();
    if (screen === "tournaments") {
      await expect(page.locator("#at-character-list")).toBeVisible();
      await page.locator(".at-filter-panel > summary").click();
      const info = await page
        .locator(".at-country-help > summary")
        .evaluate((el) => {
          const frame = el.getBoundingClientRect(),
            glyph = el.querySelector("svg").getBoundingClientRect();
          return {
            horizontal: Math.abs(
              frame.x + frame.width / 2 - glyph.x - glyph.width / 2,
            ),
            vertical: Math.abs(
              frame.y + frame.height / 2 - glyph.y - glyph.height / 2,
            ),
          };
        });
      expect(info.horizontal).toBeLessThanOrEqual(1);
      expect(info.vertical).toBeLessThanOrEqual(1);
    }
    const controls = await page.locator("select").evaluateAll((elements) =>
      elements
        .filter(
          (el) =>
            el.getBoundingClientRect().width &&
            el.getBoundingClientRect().height,
        )
        .map((el) => {
          const style = getComputedStyle(el);
          return {
            label: el.getAttribute("aria-label"),
            height: el.getBoundingClientRect().height,
            appearance: style.appearance,
            hasArrow: style.backgroundImage !== "none",
            paddingRight: parseFloat(style.paddingRight),
          };
        }),
    );
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.height, control.label).toBeGreaterThanOrEqual(44);
      expect(control.height, control.label).toBeLessThanOrEqual(46);
      expect(control.appearance, control.label).toBe("none");
      expect(control.hasArrow, control.label).toBe(true);
      expect(control.paddingRight, control.label).toBeGreaterThanOrEqual(40);
    }
    for (const selector of [".at-affiliation-picker", ".combat-picker-input"]) {
      const pickers = await page.locator(selector).evaluateAll((elements) =>
        elements
          .filter((el) => el.getBoundingClientRect().width)
          .map((el) => {
            const control = el.getBoundingClientRect(),
              icon = el.querySelector(".ui-chevron, .combat-picker-chevron");
            const arrow = icon?.getBoundingClientRect();
            return {
              height: control.height,
              arrowWidth: arrow?.width,
              right: arrow ? control.right - arrow.right : 0,
              center: arrow
                ? Math.abs(
                    control.y +
                      control.height / 2 -
                      (arrow.y + arrow.height / 2),
                  )
                : 100,
            };
          }),
      );
      for (const picker of pickers) {
        expect(picker.height).toBe(44);
        expect(picker.arrowWidth).toBeGreaterThanOrEqual(18);
        expect(picker.right).toBeGreaterThanOrEqual(12);
        expect(picker.center).toBeLessThanOrEqual(1);
      }
    }
  }
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(origin + "#screen=catalog");
  await expect(page.locator("#search")).toBeEnabled();
  const fields = await page
    .locator("#catalog-screen .filter-row select")
    .evaluateAll((elements) => {
      const context = document.createElement("canvas").getContext("2d");
      return elements.map((el) => {
        const style = getComputedStyle(el);
        context.font = style.font;
        return {
          label: el.getAttribute("aria-label"),
          available:
            el.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight),
          text: context.measureText(el.selectedOptions[0].textContent.trim())
            .width,
        };
      });
    });
  for (const field of fields)
    expect(field.available, field.label).toBeGreaterThanOrEqual(field.text);
});

test("long set keeps its close action reachable; backdrop dismisses only the top dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(origin + "#screen=purchases");
  await page
    .getByRole("button", { name: "Выбрать наборы →", exact: true })
    .click();
  await page.locator("#purchase-search").fill("CP143");
  await page
    .getByRole("button", { name: "Посмотреть набор CP143", exact: true })
    .click();
  const box = page.locator("#box-set-dialog");
  await box.locator(".box-set-member").last().scrollIntoViewIfNeeded();
  const bounds = await box.boundingBox();
  const close = await box
    .getByRole("button", { name: "Закрыть набор", exact: true })
    .boundingBox();
  expect(close.y).toBeGreaterThanOrEqual(bounds.y);
  expect(close.y + close.height).toBeLessThan(bounds.y + 150);
  // Releasing a drag outside is not a backdrop tap.
  await page.mouse.move(close.x - 50, close.y + 20);
  await page.mouse.down();
  await page.mouse.move(3, close.y + 20);
  await page.mouse.up();
  await expect(box).toBeVisible();
  await page.touchscreen.tap(3, 600);
  await expect(box).not.toBeVisible();
  await expect(page.locator("#purchase-search")).toHaveValue("CP143");

  await page.goto(origin + "#screen=catalog&card=spider-man-noir");
  const character = page.locator("#character-dialog");
  await character.locator('[data-box-code="CP170"]').click();
  await expect(box).toBeVisible();
  await page.touchscreen.tap(3, 600);
  await expect(box).not.toBeVisible();
  await expect(character).toBeVisible();
  await page.touchscreen.tap(3, 600);
  await expect(character).not.toBeVisible();
});

test("picker recovers from empty filters without losing selections or card statistics", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1194, height: 834 });
  await page.goto(origin + "#screen=rosters");
  await page
    .getByRole("button", { name: "Новый ростер +", exact: true })
    .click();
  await page.locator('[data-rs="pick"]').first().click();
  await page.locator("#roster-picker-search").fill("Hulk");
  await page.locator('.picker-result input[value="hulk"]').check();
  await page.locator("#roster-picker-owned").check();
  await expect(page.locator(".picker-results")).toContainText(
    "Ничего не найдено",
  );
  await page
    .getByRole("button", { name: "Показать все позиции", exact: true })
    .click();
  await expect(page.locator("#roster-picker-owned")).not.toBeChecked();
  await expect(page.locator("#roster-picker-search")).toHaveValue("");
  await expect(
    page.locator('.picker-result input[value="hulk"]'),
  ).toBeChecked();
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить карты Hulk", exact: true })
    .click();
  await page
    .locator("#roster-picker-stats-affiliation")
    .selectOption("Avengers");
  await page.locator("#roster-picker-sort").selectOption("average");
  await page.locator("#roster-picker-search").fill("no-such-card-xx");
  await page
    .getByRole("button", { name: "Показать все позиции", exact: true })
    .click();
  await expect(page.locator("#roster-picker-related")).not.toBeChecked();
  await expect(page.locator("#roster-picker-stats-character")).toHaveValue(
    "hulk",
  );
  await expect(page.locator("#roster-picker-stats-affiliation")).toHaveValue(
    "Avengers",
  );
  await expect(page.locator("#roster-picker-sort")).toHaveValue("average");
  await expect(page.locator(".picker-result").first()).toBeVisible();
});

test("crisis filter reset restores Challenger and keeps the statistics context", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(origin + "#screen=rosters");
  await page
    .getByRole("button", { name: "Новый ростер +", exact: true })
    .click();
  await page.locator('[data-rs="tab"][data-tab="crises"]').click();
  await page.locator('[data-rs="pick"]').first().click();
  await page.locator("#roster-picker-challenger").uncheck();
  await page.locator("#roster-picker-type").selectOption("Secure");
  await page.locator("#roster-picker-stats-character").selectOption("hulk");
  await page.locator("#roster-picker-search").fill("no-such-crisis-xx");
  await page
    .getByRole("button", { name: "Показать кризисы Challenger", exact: true })
    .click();
  await expect(page.locator("#roster-picker-type")).toHaveValue("");
  await expect(page.locator("#roster-picker-challenger")).toBeChecked();
  await expect(page.locator("#roster-picker-stats-character")).toHaveValue(
    "hulk",
  );
  await expect(page.locator(".picker-result").first()).toBeVisible();
});

test("tablet navigation reveals the current section after a direct link and rotation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 744, height: 1133 });
  await page.goto(origin + "#screen=purchases");
  const active = page.locator('nav [aria-current="page"]');
  await expect(active).toHaveAttribute("data-action", "purchases");
  const fullyVisible = () =>
    active.evaluate((el) => {
      const r = el.getBoundingClientRect(),
        n = el.closest("nav").getBoundingClientRect();
      return r.left >= n.left && r.right <= n.right;
    });
  await expect.poll(fullyVisible).toBe(true);
  await page.setViewportSize({ width: 1194, height: 834 });
  await expect.poll(fullyVisible).toBe(true);
  await page.setViewportSize({ width: 744, height: 1133 });
  await expect.poll(fullyVisible).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test("modal backdrop scrolling retains the page position and nested windows keep it locked", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1194, height: 834 });
  await page.goto(origin + "#screen=catalog");
  const row = page.locator("#characters .row-open").nth(12);
  await row.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => ({
    y: scrollY,
    width: document.documentElement.clientWidth,
  }));
  expect(before.y).toBeGreaterThan(0);
  await row.click();
  await expect(page.locator("#character-dialog")).toBeVisible();
  const opened = await page.evaluate(() => ({
    y: scrollY,
    width: document.documentElement.clientWidth,
  }));
  expect(opened).toEqual(before);
  await page.mouse.move(3, 500);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => scrollY)).toBe(before.y);
  await page.locator("#character-dialog [data-box-code]").first().click();
  await expect(page.locator("#box-set-dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Закрыть набор", exact: true })
    .click();
  await expect(page.locator("#character-dialog")).toBeVisible();
  await page.mouse.move(3, 500);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => scrollY)).toBe(before.y);
  await page
    .getByRole("button", { name: "Закрыть карточку", exact: true })
    .click();
  expect(await page.evaluate(() => scrollY)).toBe(before.y);
  await page.mouse.wheel(0, 300);
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(before.y);
});
