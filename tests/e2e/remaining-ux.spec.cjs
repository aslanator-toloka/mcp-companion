const { test, expect } = require("@playwright/test"),
  express = require("express"),
  http = require("node:http"),
  path = require("node:path"),
  fs = require("node:fs");
const fixture = require("../helpers/remaining-ux.cjs");
test.use({ hasTouch: true });
let server, origin;
test.beforeAll(async () => {
  const app = express();
  app.use("/mcp-companion", express.static(path.resolve(__dirname, "../..")));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${server.address().port}/mcp-companion/`;
});
test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
});
async function seeded(page) {
  await page.addInitScript((data) => {
    const { battles, ...library } = data;
    if (!localStorage.getItem("mcp-companion-catalog-v1"))
      localStorage.setItem("mcp-companion-catalog-v1", JSON.stringify(library));
    if (!localStorage.getItem("mcp-companion-battles-v1"))
      localStorage.setItem("mcp-companion-battles-v1", JSON.stringify(battles));
  }, fixture());
}
async function dataDialog(page) {
  await page.locator('nav [data-action="data"]').click();
  return page.locator("#data-dialog");
}
const upload = async (page, value, name = "audit.json") =>
  page.locator("#import-file").setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(
      typeof value === "string" ? value : JSON.stringify(value),
    ),
  });

test("import reviews the file and counts, keeps invalid-file errors visible, and cancellation preserves current data", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await seeded(page);
  await page.goto(origin + "#screen=rosters");
  const dialog = await dataDialog(page);
  await upload(page, "not valid json", "broken.json");
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect.poll(() => dialog.getByRole("alert").innerText()).toBeTruthy();
  await upload(page, fixture(), "large-audit.json");
  await expect(dialog.locator(".import-file-name")).toHaveText(
    "large-audit.json",
  );
  const summary = dialog.getByLabel("Содержимое файла");
  await expect(summary).toContainText("210");
  await expect(summary).toContainText("40");
  await expect(summary).toContainText("24");
  await dialog
    .getByRole("button", { name: "Выбрать другой файл", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Импорт JSON", exact: true }),
  ).toBeVisible();
  const noMatches = fixture();
  delete noMatches.battles;
  await upload(page, noMatches);
  await expect(summary).toContainText("останутся текущие");
  await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("mcp-companion-catalog-v1")).rosters
          .length,
    ),
  ).toBe(40);
  await dataDialog(page);
  const downloadP = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Экспорт JSON", exact: true })
    .click();
  const download = await downloadP;
  const value = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  expect(value.rosters).toHaveLength(40);
  expect(value.battles.matches[0].log).toHaveLength(200);
});

test("long group manager has search, retained edit context and usable deletion without wrapping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await seeded(page);
  await page.goto(origin + "#screen=rosters");
  await page.getByRole("button", { name: "Группы", exact: true }).click();
  const dialog = page.locator("#roster-action-dialog");
  await dialog.locator(".group-row").last().scrollIntoViewIfNeeded();
  const close = await dialog
      .getByRole("button", { name: "Закрыть окно", exact: true })
      .boundingBox(),
    bounds = await dialog.boundingBox();
  expect(close.y).toBeGreaterThan(bounds.y);
  expect(close.y).toBeLessThan(bounds.y + 150);
  const row = dialog.locator(".group-row").last();
  const actions = await row
    .locator("button")
    .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().toJSON()));
  expect(Math.abs(actions[0].y - actions[1].y)).toBeLessThan(2);
  expect(actions[1].height).toBeGreaterThanOrEqual(44);
  await dialog
    .getByRole("searchbox", { name: "Найти группу", exact: true })
    .fill("Группа 07");
  await expect(dialog.locator(".group-row")).toHaveCount(1);
  await dialog.locator('[data-rs="rename-group"]').click();
  await dialog.locator('input[name="name"]').fill("Группа 07 обновлена");
  await dialog
    .getByRole("button", { name: "Сохранить название", exact: true })
    .click();
  await expect(dialog.locator(".group-manager")).toBeVisible();
  await expect(dialog.getByRole("searchbox")).toHaveValue("Группа 07");
  await expect(dialog.locator(".group-row")).toContainText("обновлена");
  await dialog.locator('[data-rs="rename-group"]').click();
  await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(dialog.locator(".group-manager")).toBeVisible();
  await dialog.locator('[data-rs="delete-group"]').click();
  await dialog
    .getByRole("button", { name: "Удалить группу", exact: true })
    .click();
  await expect(dialog.locator(".group-row")).toHaveCount(0);
  expect(await page.evaluate(() => MCPStores.rosters.records.length)).toBe(40);
});

test("large collection retains its stage filter and updates results after a model changes stage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await seeded(page);
  await page.goto(origin + "#screen=catalog&collection=owned");
  await page
    .getByRole("button", { name: "Моя коллекция", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Этап модели", exact: true })
    .selectOption("painted");
  const count = await page.locator("#characters .character-row").count();
  expect(count).toBeGreaterThan(40);
  const row = page.locator("#characters .row-open").first();
  await row.click();
  const stage = page.locator(
    '#character-dialog select[aria-label^="Этап модели"]',
  );
  await stage.selectOption("primed");
  await page
    .getByRole("button", { name: "Закрыть карточку", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Этап модели", exact: true }),
  ).toHaveValue("painted");
  await expect(page.locator("#characters .character-row")).toHaveCount(
    count - 1,
  );
  await expect(page.locator("#result")).toContainText(String(count - 1));
  await page.reload();
  await expect(page.locator("#characters .character-row")).toHaveCount(
    count - 1,
  );
});

test("200-event journal filters by round and text and keeps close visible after scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1194, height: 834 });
  await seeded(page);
  await page.goto(origin + "#screen=battle&match=audit-match&view=active");
  await page.getByRole("button", { name: "Журнал", exact: true }).click();
  const dialog = page.locator("#battle-dialog");
  await expect(dialog.locator(".battle-log-list > p")).toHaveCount(200);
  await dialog.locator(".battle-log-list > p").last().scrollIntoViewIfNeeded();
  const close = await dialog
    .getByRole("button", { name: "Закрыть окно партии", exact: true })
    .boundingBox();
  expect(close.y).toBeGreaterThan(0);
  expect(close.y).toBeLessThan(180);
  await dialog
    .getByRole("combobox", { name: "Раунд журнала", exact: true })
    .selectOption("2");
  await expect(dialog.locator(".battle-log-list > p")).toHaveCount(50);
  await dialog
    .getByRole("searchbox", { name: "Поиск по журналу", exact: true })
    .fill("Событие 80 ");
  await expect(dialog.locator(".battle-log-list > p")).toHaveCount(1);
  await dialog.getByRole("searchbox").fill("нет-такого");
  await expect(dialog.locator(".battle-log-list")).toContainText(
    "Ничего не найдено",
  );
  await dialog
    .getByRole("button", { name: "Сбросить поиск и раунд", exact: true })
    .click();
  await expect(dialog.locator(".battle-log-list > p")).toHaveCount(200);
  await page.screenshot({ path: "previews/complete-audit/journal.png" });
  await dialog
    .getByRole("button", { name: "Закрыть окно партии", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Карточка Amazing Spider-Man", exact: true })
    .click();
  const frame = await dialog.boundingBox(),
    title = await dialog.locator(".battle-character-heading h2").boundingBox();
  expect(title.x - frame.x).toBeGreaterThanOrEqual(12);
  expect(title.y - frame.y).toBeGreaterThanOrEqual(10);
});

for (const width of [820, 1194])
  test(`map ${width} keeps mission configuration compact and offers cancel for renaming`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 820 ? 1180 : 834 });
    await seeded(page);
    await page.goto(origin + "#screen=battle&match=audit-match&view=map");
    await expect(page.locator("#battle-map-svg")).toBeVisible();
    await expect(page.locator(".map-configuration")).not.toHaveAttribute(
      "open",
      "",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const zoom = await page.locator(".map-zoom").boundingBox(),
      map = await page.locator("#battle-map-svg").boundingBox();
    expect(zoom.y).toBeLessThan(map.y);
    await page.locator("#map-origin").selectOption("audit-pin0");
    await page.locator('[data-ma="rename-pin"]').click();
    const dialog = page.getByRole("dialog", {
      name: "Название точки",
      exact: true,
    });
    await dialog.locator("input").fill("Не сохранять");
    await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("#map-origin")).toContainText("Точка 1");
    if (width === 820) {
      await page
        .getByRole("button", { name: "К карте ↑", exact: true })
        .click();
      await page
        .getByRole("button", { name: "К точке и расстояниям ↓", exact: true })
        .click();
      const point = await page.locator("#map-origin").boundingBox();
      expect(point.y).toBeGreaterThan(114);
      expect(point.y).toBeLessThan(350);
    }
    await page.locator(".map-configuration > summary").click();
    await page.locator("#map-unit").selectOption("cm");
    await expect(page.locator(".map-configuration > summary")).toContainText(
      "сантиметры",
    );
    await page.screenshot({ path: `previews/complete-audit/map-${width}.png` });
  });
