const { test, expect } = require("@playwright/test"),
  express = require("express"),
  http = require("node:http"),
  path = require("node:path");
const ids = [
  "amazing-spider-man",
  "ultimate-spider-man",
  "ghost-spider",
  "spider-ham",
  "black-cat",
  "venom",
  "wong",
  "moon-knight",
  "daredevil",
  "silk",
];
const roster = {
  id: "squad-web",
  name: "Web planning",
  affiliation: "Web Warriors",
  characters: ids,
  tactics: [],
  crises: [],
  groups: [],
};
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
async function seed(page, records = [roster]) {
  await page.addInitScript(
    (records) =>
      localStorage.setItem(
        "mcp-companion-catalog-v1",
        JSON.stringify({ version: 1, owned: [], groups: [], rosters: records }),
      ),
    records,
  );
}
const planner = (p) => p.locator(".squad-planner");
async function lock(page, slug) {
  await planner(page).locator(`[data-squad-required="${slug}"]`).check();
}
test("minimum five and locked Spider-Men produce the exact squads; groups, links, history and reload retain the selection", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await page.goto(origin + "#screen=rosters&roster=squad-web");
  await planner(page).locator("summary").click();
  await expect(
    planner(page).getByLabel("Минимум персонажей", { exact: true }),
  ).toHaveValue("5");
  await lock(page, "amazing-spider-man");
  await lock(page, "ultimate-spider-man");
  await planner(page).locator('[data-squad-threat="17"]').click();
  await expect(planner(page).locator("[data-squad-variant]")).toHaveCount(9);
  const squads = await planner(page)
    .locator("[data-squad-variant]")
    .evaluateAll((es) => es.map((e) => e.dataset.squadVariant.split("|")));
  expect(
    squads.every(
      (s) =>
        s.length >= 5 &&
        s.includes("amazing-spider-man") &&
        s.includes("ultimate-spider-man"),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => MCPStores.rosters.dirty)).toBe(false);
  await planner(page)
    .getByLabel("Минимум персонажей", { exact: true })
    .fill("6");
  await planner(page).locator('[data-squad-threat="19"]').click();
  await expect(planner(page).locator("[data-squad-variant]")).toHaveCount(3);
  await expect(page).toHaveURL(/squad-min=6/);
  await expect(page).toHaveURL(/squad-required=amazing-spider-man/);
  await page.reload();
  await expect(
    planner(page).getByLabel("Минимум персонажей", { exact: true }),
  ).toHaveValue("6");
  await expect(planner(page).locator("[data-squad-variant]")).toHaveCount(3);
  await planner(page)
    .locator('[data-squad-required="ultimate-spider-man"]')
    .uncheck();
  await expect(page).not.toHaveURL(/squad-required=ultimate-spider-man/);
  await page.goBack();
  await expect(
    planner(page).locator('[data-squad-required="ultimate-spider-man"]'),
  ).toBeChecked();
  await planner(page)
    .locator("[data-squad-variant]")
    .first()
    .locator('[data-squad-member="amazing-spider-man"]')
    .click();
  await expect(page.locator("#character-dialog")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#character-dialog")).not.toBeVisible();
  await expect(planner(page).locator("[data-squad-variant]")).toHaveCount(3);
  expect(
    await page.evaluate(
      () =>
        MCPStores.library.snapshot.rosters.find((r) => r.id === "squad-web")
          .characters,
    ),
  ).toEqual(ids);
  expect(errors).toEqual([]);
});
test("changing the draft recomputes combinations and removes stale locks without editing the saved roster; mobile fits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.goto(
    origin +
      "#screen=rosters&roster=squad-web&squads=1&squad-required=amazing-spider-man&squad-required=ultimate-spider-man",
  );
  await expect(planner(page).locator("[data-squad-variant]")).toHaveCount(9);
  await page
    .locator(".selected-row")
    .filter({
      has: page.locator('.selected-character[data-slug="amazing-spider-man"]'),
    })
    .locator('[data-rs="remove-item"]')
    .click();
  await expect(
    planner(page).locator('[data-squad-required="amazing-spider-man"]'),
  ).toHaveCount(0);
  await expect(page).not.toHaveURL(/squad-required=amazing-spider-man/);
  expect(
    await planner(page)
      .locator('[data-squad-member="amazing-spider-man"]')
      .count(),
  ).toBe(0);
  expect(
    await page.evaluate(() =>
      MCPStores.library.snapshot.rosters
        .find((r) => r.id === "squad-web")
        .characters.includes("amazing-spider-man"),
    ),
  ).toBe(true);
  await planner(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "previews/squad-planner-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("conflicting alter egos, empty rosters and invalid threat ranges have clear states", async ({
  page,
}) => {
  await seed(page, [
    { ...roster, characters: ["amazing-spider-man", "spider-man", "wong"] },
  ]);
  await page.goto(origin + "#screen=rosters&roster=squad-web&squads=1");
  await lock(page, "amazing-spider-man");
  await lock(page, "spider-man");
  await expect(planner(page).getByRole("alert")).toContainText("Peter Parker");
  await expect(planner(page).locator("[data-squad-variant]")).toHaveCount(0);
  await planner(page)
    .getByRole("button", { name: "Снять все закрепления" })
    .click();
  await planner(page).getByLabel("Threat: от", { exact: true }).fill("25");
  await expect(planner(page).getByRole("alert")).toContainText(
    "Начало диапазона",
  );
  await planner(page).getByLabel("Threat: до", { exact: true }).fill("30");
  await expect(planner(page).getByRole("alert")).toHaveCount(0);
  await expect(planner(page).locator(".squad-empty")).toContainText(
    "В ростере 3",
  );
  await page.goto(origin + "#screen=rosters");
  await page
    .getByRole("button", { name: "Новый ростер +", exact: true })
    .click();
  await planner(page).locator("summary").click();
  await expect(planner(page).locator(".squad-required")).toContainText(
    "Добавь персонажей",
  );
});
test("paging keeps the list and scroll; opening a character restores the same list position", async ({
  page,
}) => {
  await seed(page);
  await page.goto(origin + "#screen=rosters&roster=squad-web&squads=1");
  const list = page.locator("#roster-squad-variants");
  await expect(list.locator("[data-squad-variant]")).toHaveCount(30);
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const before = await list.evaluate((el) => el.scrollTop);
  await planner(page)
    .getByRole("button", { name: "Показать ещё 30", exact: true })
    .click();
  await expect(list.locator("[data-squad-variant]")).toHaveCount(60);
  expect(
    Math.abs((await list.evaluate((el) => el.scrollTop)) - before),
  ).toBeLessThan(3);
  await list.locator("[data-squad-member]").nth(145).click();
  const saved = await list.evaluate((el) => el.scrollTop);
  await expect(page.locator("#character-dialog")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#character-dialog")).not.toBeVisible();
  await expect(list.locator("[data-squad-variant]")).toHaveCount(60);
  await expect
    .poll(async () =>
      Math.abs((await list.evaluate((el) => el.scrollTop)) - saved),
    )
    .toBeLessThan(3);
  await planner(page).locator('[data-squad-threat="18"]').click();
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(0);
  await planner(page).locator(".squad-settings").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "previews/squad-planner-desktop.png" });
});
test("excluded models stay in the roster but leave every variant; exclusion and pin switch cleanly and persist in history", async ({
  page,
}) => {
  await seed(page);
  await page.goto(
    origin +
      "#screen=rosters&roster=squad-web&squads=1&squad-required=amazing-spider-man&squad-required=ultimate-spider-man",
  );
  const root = planner(page),
    exclude = root.locator('[data-squad-exclude="ghost-spider"]');
  await expect(root.locator("[data-squad-variant]")).toHaveCount(9);
  await exclude.click();
  await expect(root.locator("[data-squad-variant]")).toHaveCount(5);
  await expect(root.locator('[data-squad-member="ghost-spider"]')).toHaveCount(
    0,
  );
  await expect(exclude).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/squad-excluded=ghost-spider/);
  expect(
    await page.evaluate(() =>
      MCPStores.rosters.draft.characters.includes("ghost-spider"),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => MCPStores.rosters.dirty)).toBe(false);
  await page.reload();
  await expect(exclude).toHaveAttribute("aria-pressed", "true");
  await expect(root.locator("[data-squad-variant]")).toHaveCount(5);
  await exclude.click();
  await expect(root.locator("[data-squad-variant]")).toHaveCount(9);
  await page.goBack();
  await expect(exclude).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect(exclude).toHaveAttribute("aria-pressed", "false");
  await root.locator('[data-squad-exclude="amazing-spider-man"]').click();
  await expect(
    root.locator('[data-squad-required="amazing-spider-man"]'),
  ).not.toBeChecked();
  await expect(
    root.locator('[data-squad-member="amazing-spider-man"]'),
  ).toHaveCount(0);
  await lock(page, "amazing-spider-man");
  await expect(
    root.locator('[data-squad-exclude="amazing-spider-man"]'),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(root.locator("[data-squad-variant]")).toHaveCount(9);
  await exclude.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await root
    .locator('[data-squad-exclude="ghost-spider"]')
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "previews/squad-exclusions-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await root
    .getByRole("button", { name: "Снять все исключения", exact: true })
    .click();
  await expect(root.locator("[data-squad-variant]")).toHaveCount(9);
});
