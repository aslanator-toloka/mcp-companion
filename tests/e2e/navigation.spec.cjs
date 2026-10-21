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
const seed = {
  version: 1,
  owned: ["hulk"],
  groups: [],
  rosters: [
    {
      id: "history-roster",
      name: "History roster",
      affiliation: "Avengers",
      characters: ["hulk"],
      tactics: ["fall-back"],
      crises: [],
      groups: [],
    },
  ],
};
test("screens and nested cards/boxes have URLs, Back/Forward restore views and reload restores a deep link", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "#screen=catalog");
  await expect(page.locator("#search")).toBeEnabled();
  await page.locator('nav [data-action="rosters"]').click();
  await expect(page).toHaveURL(/screen=rosters/);
  await page.goBack();
  await expect(page.locator("#catalog-screen")).toBeVisible();
  await page.goForward();
  await expect(page.locator("#rosters-screen")).toBeVisible();
  await page.goBack();
  const length = await page.evaluate(() => history.length);
  await page.locator("#search").fill("Spider-Man Noir");
  await expect(page).toHaveURL(/q=Spider-Man/);
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.locator('#characters [data-action="character"]').click();
  await expect(page).toHaveURL(/card=spider-man-noir/);
  await expect(page.locator(".sc-card")).toBeVisible();
  await page.locator('[data-cv="side"][data-side="back"]').click();
  await expect(page).toHaveURL(/face=back/);
  await page.goBack();
  await expect(page.locator(".sc-healthy")).toBeVisible();
  await page.goForward();
  await expect(page.locator(".sc-injured")).toBeVisible();
  await page.locator('#character-dialog [data-box-code="CP170"]').click();
  await expect(page).toHaveURL(/box=CP170/);
  await page.goBack();
  await expect(page.locator("#box-set-dialog")).not.toBeVisible();
  await expect(page.locator("#character-dialog")).toBeVisible();
  await page.goForward();
  await expect(page.locator("#box-set-dialog")).toBeVisible();
  const url = page.url(),
    top = await page
      .locator("#character-dialog")
      .evaluate((el) => el.scrollTop);
  await page.reload();
  await expect(page.locator("#box-set-dialog")).toBeVisible();
  await expect(page.locator(".sc-injured")).toBeVisible();
  expect(page.url()).toBe(url);
  await expect
    .poll(() =>
      page.locator("#character-dialog").evaluate((el) => el.scrollTop),
    )
    .toBe(top);
  expect(errors).toEqual([]);
});
test("browser Back from a dirty roster can be cancelled, discarded or saved without corrupting the history stack", async ({
  page,
}) => {
  await page.addInitScript((value) => {
    if (!localStorage.getItem("mcp-companion-catalog-v1"))
      localStorage.setItem("mcp-companion-catalog-v1", JSON.stringify(value));
  }, seed);
  await page.goto(origin + "#screen=rosters");
  await page.locator(".roster-title").click();
  await expect(page).toHaveURL(/roster=history-roster/);
  await page.locator("#editor-name").fill("Unsaved");
  await page.goBack();
  await expect(page.locator("#roster-action-dialog")).toContainText(
    "несохранённые",
  );
  await expect(page).toHaveURL(/roster=history-roster/);
  await page
    .getByRole("button", { name: "Продолжить редактирование", exact: true })
    .click();
  await expect(page.locator("#editor-name")).toHaveValue("Unsaved");
  await page.goBack();
  await page.locator('[data-rs="discard-leave"]').click();
  await expect(page.locator(".roster-title")).toBeVisible();
  await expect(page).not.toHaveURL(/roster=history-roster/);
  await page.goForward();
  await expect(page.locator("#editor-name")).toHaveValue("History roster");
  await page.locator("#editor-name").fill("Saved through Back");
  await page.goBack();
  await page.locator('[data-rs="save-leave"]').click();
  await expect(page.locator(".roster-title")).toHaveText("Saved through Back");
  await page.goForward();
  await expect(page.locator("#editor-name")).toHaveValue("Saved through Back");
});
test("tournament selections and purchase tabs survive Back/Forward, filters appear in links", async ({
  page,
}) => {
  await page.goto(origin + "#character=ultimate-spider-man");
  await expect(page.locator("#at-character-overview")).toContainText(
    "Ultimate Spider-Man",
  );
  await page.locator('#at-character-list [data-character="hulk"]').click();
  await expect(page).toHaveURL(/character=hulk/);
  await page.goBack();
  await expect(page.locator("#at-character-overview")).toContainText(
    "Ultimate Spider-Man",
  );
  await page.goForward();
  await expect(page.locator("#at-character-overview h2")).toHaveText("Hulk");
  await page.locator("#at-affiliation-picker").click();
  await expect(page).toHaveURL(/dialog=affiliation/);
  await page
    .locator('#at-affiliation-options input[value="Web Warriors"]')
    .check();
  await expect(page).toHaveURL(/affiliation=Web\+Warriors/);
  await page.goBack();
  await expect(
    page.locator('#at-affiliation-options input[value="Web Warriors"]'),
  ).not.toBeChecked();
  await page.goForward();
  await expect(
    page.locator('#at-affiliation-options input[value="Web Warriors"]'),
  ).toBeChecked();
  await page.locator("#at-affiliation-done").click();
  await page.locator('nav [data-action="purchases"]').click();
  await page.locator('.purchase-tabs [data-purchase-tab="all"]').click();
  await expect(page).toHaveURL(/tab=all/);
  await page.goBack();
  await expect(page.locator('[data-purchase-tab="wishlist"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.goForward();
  await expect(
    page.locator('.purchase-tabs [data-purchase-tab="all"]'),
  ).toHaveAttribute("aria-pressed", "true");
});

test("roster pickers, battle views and fighter cards navigate without undoing game actions", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((value) => {
    if (!localStorage.getItem("mcp-companion-catalog-v1"))
      localStorage.setItem("mcp-companion-catalog-v1", JSON.stringify(value));
  }, seed);
  await page.goto(origin + "#screen=rosters");
  await page.locator(".roster-title").click();
  await page
    .getByRole("button", { name: "Добавить карты Hulk", exact: true })
    .click();
  await expect(page).toHaveURL(/pick=tactics/);
  await page.goBack();
  await expect(page.locator("#roster-picker-dialog")).not.toBeVisible();
  await expect(page.locator("#editor-name")).toHaveValue("History roster");
  await page.goForward();
  await expect(page.locator("#roster-picker-dialog")).toBeVisible();
  await page
    .locator('#roster-picker-dialog [data-rs="close-picker"]')
    .last()
    .click();
  await page.locator('[data-rs="tab"][data-tab="crises"]').click();
  await expect(page).toHaveURL(/tab=crises/);
  await page.goBack();
  await expect(
    page.locator('[data-rs="tab"][data-tab="characters"]'),
  ).toHaveAttribute("aria-selected", "true");
  await page.locator('nav [data-action="battle"]').click();
  await page.getByRole("button", { name: "Новый бой +", exact: true }).click();
  await expect(page).toHaveURL(/panel=choose-roster/);
  await page.locator('#battle-dialog [data-bt="prepare"]').click();
  await expect(page).toHaveURL(/match=/);
  await page
    .locator('[data-bt="pick"][data-side="mine"][data-kind="characters"]')
    .click();
  await page.locator('[data-battle-pick="hulk"]').check();
  await expect(page.locator('[data-battle-pick="hulk"]')).toBeChecked();
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await page.locator('[data-bt="start"]').click();
  await expect(page.locator(".battle-dashboard")).toBeVisible();
  const matchURL = page.url(),
    count = await page.evaluate(() => history.length);
  await page
    .getByRole("button", { name: "Уменьшить HP Hulk", exact: true })
    .click();
  await expect(page.locator('strong[aria-label="HP Hulk"]')).toHaveText("19");
  expect(page.url()).toBe(matchURL);
  expect(await page.evaluate(() => history.length)).toBe(count);
  await page.locator(".fighter-portrait").click();
  await expect(page).toHaveURL(/panel=fighter/);
  await page.goBack();
  await expect(page.locator("#battle-dialog")).not.toBeVisible();
  await page.goForward();
  await expect(page.locator("#battle-dialog h2").first()).toHaveText("Hulk");
  await page.locator('#battle-dialog [data-bt="close-dialog"]').click();
  await page.locator('[data-bt="map"]').click();
  await expect(page).toHaveURL(/view=map/);
  await page.goBack();
  await expect(page.locator(".battle-dashboard")).toBeVisible();
  await expect(page.locator('strong[aria-label="HP Hulk"]')).toHaveText("19");
  await page.goForward();
  await expect(page.locator("#battle-map-svg")).toBeVisible();
  await page.reload();
  await expect(page.locator("#battle-map-svg")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".battle-dashboard")).toBeVisible();
  expect(errors).toEqual([]);
});

test("back restores catalog scroll and a pending card load cannot reopen a closed view", async ({
  page,
}) => {
  await page.goto(origin + "#screen=catalog");
  await expect(page.locator("#search")).toBeEnabled();
  await page.locator("#owned-yondu").scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  expect(y).toBeGreaterThan(1000);
  await page.locator('nav [data-action="purchases"]').click();
  await page.goBack();
  await expect(page.locator("#catalog-screen")).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y - 10);
  let release;
  await page.route("**/data/cards/yondu.json", async (route) => {
    await new Promise((r) => (release = r));
    await route.continue();
  });
  await page
    .locator('#characters [data-slug="yondu"][data-action="character"]')
    .click();
  await expect(page).toHaveURL(/card=yondu/);
  await expect.poll(() => !!release).toBe(true);
  await page.goBack();
  await expect(page.locator("#character-dialog")).not.toBeVisible();
  release();
  await expect(page).not.toHaveURL(/card=yondu/);
  await page.goForward();
  await expect(page.locator("#character-dialog .sc-card")).toBeVisible();
});

test("new roster links restore a session draft after reload; typed hashes also respect the leave prompt", async ({
  page,
}) => {
  await page.goto(origin + "#screen=rosters");
  await page
    .getByRole("button", { name: "Новый ростер +", exact: true })
    .click();
  await page.locator("#editor-name").fill("Session draft");
  await expect(page).toHaveURL(/roster=new/);
  page.once("dialog", (d) => d.accept());
  await page.reload();
  await expect(page.locator("#editor-name")).toHaveValue("Session draft");
  await page.evaluate(() => (location.hash = "screen=purchases"));
  await expect(page.locator("#roster-action-dialog")).toContainText(
    "несохранённые",
  );
  await expect(page).toHaveURL(/roster=new/);
  await page
    .getByRole("button", { name: "Продолжить редактирование", exact: true })
    .click();
  await expect(page.locator("#editor-name")).toHaveValue("Session draft");
});

test("closing a card still works after the browser has pruned old history entries", async ({
  page,
}) => {
  await page.goto(origin + "#screen=catalog");
  await expect(page.locator("#search")).toBeEnabled();
  await page
    .locator(
      '#characters [data-action="character"][data-slug="spider-man-noir"]',
    )
    .click();
  await expect(page.locator(".sc-card")).toBeVisible();
  await page.evaluate(async () => {
    for (let i = 0; i < 65; i++) {
      MCPStores.catalog.selectFace("side", i % 2 ? "front" : "back");
      await new Promise(requestAnimationFrame);
    }
  });
  await page
    .getByRole("button", { name: "Закрыть карточку", exact: true })
    .click();
  await expect(page).not.toHaveURL(/card=/);
  await page.locator('nav [data-action="purchases"]').click();
  await expect(page).toHaveURL(/screen=purchases/);
});
