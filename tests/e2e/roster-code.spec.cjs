const { test, expect } = require("@playwright/test");
const express = require("express"),
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
const seed = {
  version: 1,
  owned: ["hulk"],
  groups: [{ id: "local-group", name: "Локальная группа" }],
  rosters: [
    {
      id: "original",
      name: "Халк и Железный человек 🟢",
      affiliation: "Avengers",
      characters: ["hulk", "iron-man"],
      tactics: ["gamma-launch"],
      crises: ["infinity-formula-goes-missing"],
      groups: ["local-group"],
    },
  ],
};
const saved = (page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("mcp-companion-catalog-v1")) || {
        rosters: [],
        owned: [],
      },
  );
const seedPage = (page) =>
  page.addInitScript((value) => {
    if (!localStorage.getItem("mcp-companion-catalog-v1"))
      localStorage.setItem("mcp-companion-catalog-v1", JSON.stringify(value));
  }, seed);

test("saved and unsaved rosters export to copyable codes; importing on another device creates an independent draft", async ({
  browser,
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seedPage(page);
  await page.goto(origin + "#screen=rosters");
  await page.locator('.roster-tile [data-rs="export-code"]').click();
  const dialog = page.locator("#roster-action-dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/roster-dialog=code-export/);
  const code = await dialog.locator("#roster-code-text").inputValue();
  expect(code.split(",")).toHaveLength(4);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await dialog
    .getByRole("button", { name: "Копировать код", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(code);
  await dialog.locator("#roster-code-format").selectOption("companion");
  const nativeCode = await dialog.locator("#roster-code-text").inputValue();
  expect(nativeCode).toMatch(/^MCP1\./);
  await page.reload();
  await expect(dialog.locator("#roster-code-format")).toHaveValue("companion");
  await expect(dialog.locator("#roster-code-text")).toHaveValue(nativeCode);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await dialog.screenshot({ path: "previews/roster-code-export-mobile.png" });
  await dialog.getByRole("button", { name: "Готово", exact: true }).click();
  await page.locator('.roster-title[data-id="original"]').click();
  await page.locator("#editor-name").fill("Несохранённый ростер");
  await page.locator('#rosters-screen [data-rs="export-code"]').click();
  await dialog.locator("#roster-code-format").selectOption("companion");
  const unsavedCode = await dialog.locator("#roster-code-text").inputValue();
  expect(unsavedCode).not.toBe(nativeCode);
  expect((await saved(page)).rosters[0].name).toBe(seed.rosters[0].name);

  const otherContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const other = await otherContext.newPage();
  other.on("pageerror", (e) => errors.push(e.message));
  try {
    await other.goto(origin + "#screen=rosters");
    await other.locator('[data-rs="import-code"]').click();
    const otherDialog = other.locator("#roster-action-dialog");
    await otherDialog.locator("#roster-code-text").fill(unsavedCode);
    expect(other.url()).not.toContain("MCP1");
    await otherDialog
      .getByRole("button", { name: "Открыть ростер", exact: true })
      .click();
    await expect(other.locator("#editor-name")).toHaveValue(
      "Несохранённый ростер",
    );
    await expect(other.locator("#editor-affiliation")).toHaveValue("Avengers");
    await expect(
      other.locator('[data-rs="remove-item"][data-kind="characters"]'),
    ).toHaveCount(2);
    expect((await saved(other)).rosters).toHaveLength(0);
    await other.locator('[data-rs="save"]').click();
    const imported = (await saved(other)).rosters[0];
    expect(imported.id).not.toBe("original");
    expect(imported.groups).toEqual([]);
    expect(imported.characters).toEqual(["hulk", "iron-man"]);
    expect(imported.tactics).toEqual(["gamma-launch-ca10"]);
    expect(imported.crises).toEqual(["infinity-formula-goes-missing-ca09"]);
    expect((await saved(other)).owned).toEqual([]);
    await other.reload();
    await expect(other.locator(".roster-title")).toHaveText(
      "Несохранённый ростер",
    );
  } finally {
    await otherContext.close();
  }
  expect(errors).toEqual([]);
});

test("invalid imports do not mutate saved data; URLs, Back, reload, copy fallback and dirty-draft guards work", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seedPage(page);
  await page.goto(origin + "#screen=rosters");
  await page.locator('[data-rs="import-code"]').click();
  const dialog = page.locator("#roster-action-dialog");
  await dialog.locator("#roster-code-text").fill("00040101,99999999");
  await dialog
    .getByRole("button", { name: "Открыть ростер", exact: true })
    .click();
  await expect(dialog.locator('[role="alert"]')).toContainText(
    "Неизвестные коды",
  );
  expect((await saved(page)).rosters).toEqual(seed.rosters);
  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await page.goForward();
  await expect(dialog.locator("#roster-code-text")).toHaveValue(
    "00040101,99999999",
  );
  await page.reload();
  await expect(dialog.locator("#roster-code-text")).toHaveValue(
    "00040101,99999999",
  );
  await dialog
    .locator("#roster-code-text")
    .fill(
      "https://www.jarvis-protocol.com/roster-validator?mctCode=00040101%2C00010201%2C00010302",
    );
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.screenshot({ path: "previews/roster-code-import-mobile.png" });
  await dialog
    .getByRole("button", { name: "Открыть ростер", exact: true })
    .click();
  await expect(page.locator("#editor-name")).toHaveValue("Ростер по коду");
  await page.locator("#editor-name").fill("Не терять эти правки");
  await page.locator('#rosters-screen [data-rs="import-code"]').click();
  await dialog.locator("#roster-code-text").fill("00010107");
  await dialog
    .getByRole("button", { name: "Открыть ростер", exact: true })
    .click();
  await expect(dialog).toContainText("Есть несохранённые изменения");
  await dialog
    .getByRole("button", { name: "Продолжить редактирование", exact: true })
    .click();
  await expect(page.locator("#editor-name")).toHaveValue(
    "Не терять эти правки",
  );
  await page.locator('#rosters-screen [data-rs="export-code"]').click();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(Error("blocked")) },
    }),
  );
  await dialog
    .getByRole("button", { name: "Копировать код", exact: true })
    .click();
  expect(
    await dialog
      .locator("#roster-code-text")
      .evaluate((el) => el.selectionEnd - el.selectionStart),
  ).toBe((await dialog.locator("#roster-code-text").inputValue()).length);
  await dialog.getByRole("button", { name: "Готово", exact: true }).click();
  await page.locator('#rosters-screen [data-rs="import-code"]').click();
  await dialog.locator("#roster-code-text").fill("00010107");
  await dialog
    .getByRole("button", { name: "Открыть ростер", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Выйти без сохранения", exact: true })
    .click();
  await expect(page.locator("#editor-name")).toHaveValue("Ростер по коду");
  await expect(
    page.locator('[data-rs="remove-item"][data-kind="characters"]'),
  ).toHaveAttribute("data-slug", "iron-man");
  expect((await saved(page)).rosters).toEqual(seed.rosters);
  expect(errors).toEqual([]);
});
