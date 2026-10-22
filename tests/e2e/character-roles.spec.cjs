const { test, expect } = require("@playwright/test"),
  express = require("express"),
  http = require("node:http"),
  path = require("node:path"),
  fs = require("node:fs");
const catalog = require("../../data/catalog.json"),
  cards = require("../../data/roster-cards.json"),
  Core = require("../../battle-core.js");
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
  id: "role-webs",
  name: "Role coverage",
  characters: ids,
  tactics: [],
  crises: [],
  groups: [],
  affiliation: "Web Warriors",
};
let origin, server;
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
async function seed(page) {
  await page.addInitScript((roster) => {
    const key = "mcp-companion-catalog-v1";
    if (!localStorage.getItem(key))
      localStorage.setItem(
        key,
        JSON.stringify({ version: 1, owned: [], rosters: [roster] }),
      );
  }, roster);
}
const role = (scope, id) => scope.locator(`[data-role-icon="${id}"]`);
const tooltip = (page) => page.getByRole("tooltip");
test("characters show icons only, hover/focus reveals the role, and Escape closes help without closing the character", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "#screen=catalog&q=Wong");
  const row = page
    .locator("#characters .character-row")
    .filter({ has: page.locator('[data-slug="wong"]') });
  const icons = row.locator('[data-role-context="character"]');
  await expect(icons).toHaveText("");
  await expect(icons.locator("button")).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  const font = await icons.locator(".fa-solid").evaluate((el) => ({
    family: getComputedStyle(el).fontFamily,
    glyph: getComputedStyle(el, "::before").content,
    loaded: document.fonts.check('900 17px "Font Awesome 7 Free"'),
  }));
  expect(font.family).toContain("Font Awesome 7 Free");
  expect(font.glyph).not.toBe("none");
  expect(font.glyph).not.toBe('""');
  expect(font.loaded).toBe(true);
  await expect(icons.locator("svg")).toHaveCount(0);
  const before = page.url();
  await role(icons, "support").hover();
  await expect(tooltip(page)).toContainText("Поддержка");
  await expect(tooltip(page)).toContainText("Передаёт энергию");
  await role(icons, "support").click();
  await expect(page.locator("#character-dialog")).not.toBeVisible();
  await expect(page).toHaveURL(before);
  await page.locator("#search").click();
  await expect(tooltip(page)).toHaveCount(0);
  await row.locator(".row-open").click();
  const detail = page.locator("#character-dialog");
  const badge = role(detail, "support");
  await badge.focus();
  await expect(tooltip(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip(page)).toHaveCount(0);
  await expect(detail).toBeVisible();
  await expect(page).toHaveURL(/card=wong/);
  await badge.hover();
  await expect(tooltip(page)).toBeVisible();
  await page.screenshot({ path: "previews/character-role-detail.png" });
  expect(await page.locator("button button").count()).toBe(0);
  expect(errors).toEqual([]);
});
test("roster icons count distinct providers, squad variants use only their members, and exclusions don't edit the roster", async ({
  page,
}) => {
  await seed(page);
  await page.goto(origin + "#screen=rosters");
  const tile = page.locator(".roster-tile");
  await role(tile, "support").hover();
  await expect(tooltip(page)).toContainText("Поддержка · 1 персонаж");
  await expect(tooltip(page)).toContainText("Wong");
  await tile.locator(".roster-title").click();
  const rosterRoles = page
    .locator('#rosters-screen [data-role-context="roster"]')
    .first();
  await expect(role(rosterRoles, "support")).toHaveCount(1);
  const plan = page.locator(".squad-planner");
  await plan.locator(":scope > summary").click();
  await plan.locator('[data-squad-threat="17"]').click();
  await expect(plan.locator("[data-squad-variant]").first()).toBeVisible();
  await plan.locator('[data-squad-exclude="wong"]').click();
  await expect(
    plan.locator('[data-role-context="squad"] [data-role-icon="support"]'),
  ).toHaveCount(0);
  await expect(role(rosterRoles, "support")).toHaveCount(1);
  expect(await page.evaluate(() => MCPStores.rosters.dirty)).toBe(false);
  await plan.locator('[data-squad-exclude="wong"]').click();
  await expect(
    plan
      .locator('[data-role-context="squad"] [data-role-icon="support"]')
      .first(),
  ).toBeVisible();
  const withSupport = plan
    .locator("[data-squad-variant]")
    .filter({ has: page.locator('[data-role-icon="support"]') })
    .first();
  await role(withSupport, "support").hover();
  await expect(tooltip(page)).toContainText("Wong");
  await page.screenshot({ path: "previews/squad-role-icons.png" });
  await page.reload();
  await expect(
    role(
      page.locator('#rosters-screen [data-role-context="roster"]').first(),
      "support",
    ),
  ).toHaveCount(1);
});
test("touch opens icon help without choosing a character; layout fits a phone and a native picker dialog", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await seed(page);
  await page.goto(origin + "#screen=catalog&q=Wong");
  await page.locator('#characters [data-role-icon="support"]').tap();
  await expect(tooltip(page)).toBeVisible();
  await expect(page.locator("#character-dialog")).not.toBeVisible();
  const box = await tooltip(page).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.locator("#search").tap();
  await expect(tooltip(page)).toHaveCount(0);
  await page.goto(origin + "#screen=rosters&roster=role-webs");
  await page.locator('#rosters-screen [data-rs="pick"]').click();
  const picker = page.locator("#roster-picker-dialog");
  await picker.getByRole("searchbox").fill("Wong");
  const checkbox = picker.locator(
    '[data-pick-kind="characters"][value="wong"]',
  );
  const checked = await checkbox.isChecked();
  await role(picker, "support").tap();
  await expect(tooltip(page)).toBeVisible();
  await expect(checkbox).toBeChecked({ checked });
  await page.screenshot({ path: "previews/role-icons-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
test("actual battle squad has only selected fighters' roles; switching sides changes the summary", async ({
  page,
}) => {
  const detail = (slug) =>
    JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, `../../data/cards/${slug}.json`),
        "utf8",
      ),
    );
  const m = {
    id: "role-battle",
    status: "active",
    name: "Roles battle",
    createdAt: "2026-10-23T12:00:00Z",
    updatedAt: "2026-10-23T12:00:00Z",
    sourceRoster: roster,
    threat: 20,
    round: 1,
    score: { mine: 0, opponent: 0 },
    priority: "unknown",
    mine: {
      name: "Я",
      affiliation: "",
      leader: null,
      fighters: [],
      tactics: [],
    },
    opponent: {
      name: "Противник",
      affiliation: "",
      leader: null,
      fighters: [],
      tactics: [],
    },
    secure: cards.crises.find((c) => c.setup === "D"),
    extract: cards.crises.find((c) => c.setup === "F"),
    references: {},
    undo: [],
    log: [],
  };
  for (const [side, slugs] of [
    ["mine", ["wong", "black-cat"]],
    ["opponent", ["hulk"]],
  ])
    for (const slug of slugs) {
      m.references[slug] = detail(slug);
      m[side].fighters.push(
        Core.fighter(
          catalog.characters.find((c) => c.slug === slug),
          m.references[slug],
          slug + "-fighter",
        ),
      );
    }
  Core.validate({ version: 1, matches: [m] });
  await seed(page);
  await page.addInitScript(
    (m) =>
      localStorage.setItem(
        "mcp-companion-battles-v1",
        JSON.stringify({ version: 1, matches: [m] }),
      ),
    m,
  );
  await page.goto(origin + "#screen=battle");
  await page.locator('[data-bt="open"][data-id="role-battle"]').click();
  const mine = page.locator(
    '[data-role-context="squad"][data-role-owner="mine"]',
  );
  await expect(role(mine, "support")).toBeVisible();
  await expect(role(mine, "brawler")).toHaveCount(0);
  await page
    .locator('#battle-screen [data-bt="team"][data-side="opponent"]')
    .last()
    .click();
  const opponent = page.locator(
    '[data-role-context="squad"][data-role-owner="opponent"]',
  );
  await expect(role(opponent, "support")).toHaveCount(0);
  await expect(role(opponent, "brawler")).toBeVisible();
});
