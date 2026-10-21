const { test, expect } = require("@playwright/test"),
  http = require("node:http"),
  express = require("express"),
  path = require("node:path"),
  fs = require("node:fs");
const Core = require("../../battle-core.js");
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
const catalog = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../data/catalog.json")),
  ),
  lists = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../data/roster-cards.json")),
  );
const load = (slug) =>
  JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../../data/cards/" + slug + ".json"),
    ),
  );
const library = {
  version: 1,
  owned: ["captain-america", "hulk"],
  groups: [],
  rosters: [
    {
      id: "local-r",
      name: "Local roster",
      characters: ["captain-america", "hulk"],
      affiliation: "Avengers",
      tactics: ["fall-back"],
      crises: [],
      groups: [],
    },
  ],
};
function match() {
  const m = {
    id: "local-match",
    status: "active",
    name: "Native React battle",
    createdAt: "2026-10-21T10:00:00Z",
    updatedAt: "2026-10-21T10:00:00Z",
    sourceRoster: library.rosters[0],
    threat: 99,
    round: 1,
    score: { mine: 0, opponent: 0 },
    priority: "unknown",
    mine: {
      name: "Я",
      affiliation: "Avengers",
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
    secure: lists.crises.find((c) => c.setup === "D"),
    extract: lists.crises.find((c) => c.setup === "F"),
    references: {},
    undo: [],
    log: [],
  };
  for (const slug of ["captain-america", "hulk"]) {
    const detail = load(slug);
    m.references[slug] = detail;
    m.mine.fighters.push(
      Core.fighter(
        catalog.characters.find((c) => c.slug === slug),
        detail,
        slug + "-fighter",
      ),
    );
  }
  const card = lists.tactics.find((c) => c.slug === "fall-back");
  m.mine.tactics = [{ slug: card.slug, name: card.name, played: false, card }];
  Core.validate({ version: 1, matches: [m] });
  return m;
}
async function open(page) {
  const m = match();
  await page.addInitScript(
    ({ library, m }) => {
      if (!localStorage.getItem("mcp-companion-catalog-v1"))
        localStorage.setItem(
          "mcp-companion-catalog-v1",
          JSON.stringify(library),
        );
      if (!localStorage.getItem("mcp-companion-battles-v1"))
        localStorage.setItem(
          "mcp-companion-battles-v1",
          JSON.stringify({ version: 1, matches: [m] }),
        );
    },
    { library, m },
  );
  await page.goto(origin + "#screen=battle");
  await page.locator('[data-bt="open"][data-id="local-match"]').click();
  await expect(page.locator(".battle-dashboard")).toBeVisible();
  return m;
}
test("native local battle: stable fighter DOM, conditions, red live stats, portraits, state cycle, power/round, tactics, undo and history", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const initial = await open(page),
    cap = page.locator('[data-fighter="captain-america-fighter"]');
  await page.evaluate(() => {
    window.__other = document.querySelector('[data-fighter="hulk-fighter"]');
    window.__tactic = document.querySelector(".gc-card");
  });
  await cap
    .getByRole("button", { name: "Уменьшить HP Captain America", exact: true })
    .click();
  await expect(
    cap.locator('strong[aria-label="HP Captain America"]'),
  ).toHaveText(String(initial.mine.fighters[0].hp - 1));
  expect(
    await page.evaluate(
      () =>
        __other === document.querySelector('[data-fighter="hulk-fighter"]') &&
        __tactic === document.querySelector(".gc-card"),
    ),
  ).toBe(true);
  await cap.locator('[data-bt="conditions"]').click();
  const dialog = page.locator("#battle-dialog");
  await dialog.locator('[data-condition="Incinerate"]').click();
  await dialog.locator('[data-condition="Slow"]').click();
  await dialog.locator('[data-condition="Root"]').click();
  await dialog.locator('[data-bt="close-dialog"]').click();
  await cap.locator('[data-bt="fighter-card"]').first().click();
  await expect(dialog.locator(".battle-condition-chip")).toHaveCount(3);
  await expect(dialog.locator('[data-stat="speed"]')).toHaveClass(
    /sc-stat-changed/,
  );
  await expect(dialog.locator('[data-stat="physical"]')).toHaveClass(
    /sc-stat-changed/,
  );
  await expect(
    dialog.locator(".battle-fighter-strip .battle-character-portrait"),
  ).toHaveCount(2);
  await dialog
    .locator('.battle-condition-chip[data-card-condition="slow"]')
    .click();
  await expect(page.locator("#sc-condition-dialog")).toBeVisible();
  await expect(page.locator("#sc-condition-dialog")).toContainText("short");
  await page
    .getByRole("button", { name: "Закрыть описание состояния", exact: true })
    .click();
  await dialog
    .locator('[data-bt="fighter-card"][data-id="hulk-fighter"]')
    .click();
  await expect(dialog.locator("h2").first()).toHaveText("Hulk");
  await dialog.locator('[data-bt="close-dialog"]').click();
  await cap.locator('[data-bt="cycle-status"]').click();
  await expect(cap).toHaveAttribute("data-status", "dazed");
  await cap.locator('[data-bt="cycle-status"]').click();
  await expect(cap.locator(".fighter-state-cycle")).toContainText("Injured");
  await page.locator(".battle-undo").click();
  await expect(cap).toHaveAttribute("data-status", "dazed");
  await page.locator(".battle-undo").click();
  await expect(cap).toHaveAttribute("data-status", "ready");
  const flip = page.locator('.battle-tactics-strip [data-bt="flip-tactic"]');
  await flip.click();
  await expect(flip).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".gc-art-face")).toBeVisible();
  await page.locator(".battle-undo").click();
  await expect(flip).toHaveAttribute("aria-pressed", "false");
  await page.locator('[data-bt="power"]').click();
  await expect(dialog.locator(".power-preview-row")).toHaveCount(2);
  await dialog.locator('[data-bt="confirm-power"]').click();
  await expect(page.locator('strong[aria-label="энергию Hulk"]')).toHaveText(
    "3",
  );
  await page.locator('[data-bt="round"]').click();
  await expect(dialog.locator("#round-power")).toBeChecked();
  await dialog.locator('[data-bt="confirm-round"]').click();
  await expect(page.locator(".round-label b")).toHaveText("2");
  await page.locator("#battle-side-switch").click();
  await expect(
    page.locator('.battle-side-tabs [data-side="opponent"]'),
  ).toHaveAttribute("aria-selected", "true");
  await page.locator("#battle-side-switch").click();
  await page.locator('[data-bt="log"]').click();
  await expect(dialog.locator(".battle-log")).toContainText("Начат раунд 2");
  await dialog.locator('[data-bt="close-dialog"]').click();
  await page.reload();
  await page.locator('[data-bt="open"][data-id="local-match"]').click();
  await expect(page.locator(".round-label b")).toHaveText("2");
  await page.locator('[data-bt="finish"]').click();
  await dialog.locator('[data-bt="confirm-finish"]').click();
  await expect(page.locator(".battle-dashboard")).toHaveCount(0);
  await page.locator('[data-bt="open"][data-id="local-match"]').click();
  await expect(page.locator(".battle-undo")).toBeDisabled();
  expect(errors).toEqual([]);
});
test("native SVG map: selection, distances, coordinate validation, pointer drag, pin deletion, keyboard, undo and reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await page.locator('[data-bt="map"]').click();
  const svg = page.locator("#battle-map-svg");
  await expect(svg).toBeVisible();
  const point = svg.locator("[data-map-key]").first(),
    key = await point.getAttribute("data-map-key");
  await point.click();
  await expect(page.locator("#map-origin")).toHaveValue(key);
  await expect(svg.locator(".map-distance-line")).not.toHaveCount(0);
  await page
    .locator('[data-ma="distance-mode"][data-distance-mode="boundaries"]')
    .click();
  await expect(svg.locator(".map-reference-line")).toHaveCount(6);
  await expect(svg.locator(".map-distance-line")).toHaveCount(0);
  await expect(page.locator(".map-details")).toContainText("До стартовых зон");
  const bases = await svg.locator(".map-reference-label").allTextContents();
  await page.locator("#map-mode").selectOption("centers");
  await expect
    .poll(() => svg.locator(".map-reference-label").allTextContents())
    .not.toEqual(bases);
  await page.locator("#map-unit").selectOption("cm");
  await expect(page.locator(".map-details")).toContainText("см");
  await page
    .locator('[data-ma="distance-mode"][data-distance-mode="objects"]')
    .click();
  await page.locator('[data-ma="add-point"]').click();
  const pin = svg.locator('[data-map-key^="pin:"]');
  await expect(pin).toHaveCount(1);
  const id = await pin.getAttribute("data-map-key");
  await page.locator('[data-ma="rename-pin"]').click();
  await page.locator("#map-pin-form input").fill("Marker");
  await page.locator("#map-pin-form button").click();
  await expect(pin).toContainText("Marker");
  await expect(page.locator("#map-origin")).toHaveValue(id);
  await page.locator(".map-coordinate-editor summary").click();
  await page.locator("#map-x").fill("999");
  await page.locator('[data-ma="apply-coords"]').click();
  await expect(page.locator("#toast")).toContainText("внутри поля");
  await page.locator("#map-x").fill("25.4");
  await page.locator("#map-y").fill("25.4");
  await page.locator('[data-ma="apply-coords"]').click();
  await expect(pin).toHaveAttribute("transform", "translate(140 140)");
  const rect = await pin.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width / 2 + 30,
    rect.y + rect.height / 2 + 30,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(pin).not.toHaveAttribute("transform", "translate(140 140)");
  await pin.click();
  await page.keyboard.press("Backspace");
  await expect(pin).toHaveCount(0);
  await page.locator('[data-bt="undo"]').click();
  await expect(pin).toHaveCount(1);
  await expect(svg.locator("[data-map-key]")).toHaveCount(10);
  await page.reload();
  await page.locator('[data-bt="open"][data-id="local-match"]').click();
  await page.locator('[data-bt="map"]').click();
  await expect(pin).toHaveCount(1);
  await page.locator('[data-ma="zoom-in"]').click();
  await expect(page.locator(".map-zoom")).toContainText("150%");
  await page.locator('[data-ma="back"]').click();
  await expect(page.locator(".battle-dashboard")).toBeVisible();
  expect(errors).toEqual([]);
});
test("new local game loads final fighter, starts, and preserves saved roster", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (value) =>
      localStorage.setItem("mcp-companion-catalog-v1", JSON.stringify(value)),
    library,
  );
  await page.goto(origin + "#screen=battle");
  await page.getByRole("button", { name: "Новый бой +", exact: true }).click();
  await page
    .locator('#battle-dialog [data-bt="prepare"][data-roster="local-r"]')
    .click();
  await page
    .locator('[data-bt="pick"][data-side="mine"][data-kind="characters"]')
    .click();
  await page.locator('[data-battle-pick="captain-america"]').check();
  await expect(
    page.locator('[data-battle-pick="captain-america"]'),
  ).toBeChecked();
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await expect(page.locator('[data-bt="start"]')).toBeEnabled();
  await page.locator('[data-bt="start"]').click();
  await expect(page.locator(".battle-dashboard")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("mcp-companion-catalog-v1")).rosters[0]
          .characters,
    ),
  ).toEqual(library.rosters[0].characters);
  expect(errors).toEqual([]);
});
