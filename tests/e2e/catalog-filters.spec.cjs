const { test, expect } = require("@playwright/test"),
  express = require("express"),
  http = require("node:http"),
  path = require("node:path");
const characters = [...require("../../data/catalog.json").characters].sort(
  (a, b) =>
    a.name.localeCompare(b.name, "en") ||
    String(a.alterEgo || "").localeCompare(String(b.alterEgo || ""), "en"),
);
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
const rows = (p) => p.locator("#characters .row-open");
async function slugs(page) {
  return rows(page).evaluateAll((es) => es.map((e) => e.dataset.slug));
}
async function open(page, title) {
  const group = page.locator(".catalog-filter-group").filter({
    has: page.locator("summary", { hasText: new RegExp("^" + title + "$") }),
  });
  if (!(await group.evaluate((e) => e.open)))
    await group.locator("summary").click();
  return group;
}
async function ready(page) {
  await page.goto(origin + "#screen=catalog");
  await expect(page.locator("#search")).toBeEnabled();
  await page.locator(".catalog-advanced>summary").click();
}
test("statistics and traits compose, preserve DOM and history, reset and restore from URL", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  const traits = await open(page, "Способности и врождённые свойства");
  await traits.getByRole("button", { name: "Flight", exact: true }).click();
  const stats = await open(page, "Характеристики");
  await stats.getByLabel("Physical от", { exact: true }).fill("4");
  const expected = characters
    .filter((c) => c.tags.includes("flight") && c.physicalDefense >= 4)
    .map((c) => c.slug);
  await expect.poll(() => slugs(page)).toEqual(expected);
  await expect(page).toHaveURL(/filters=/);
  const saved = page.url();
  await page.goBack();
  await expect(stats.getByLabel("Physical от", { exact: true })).toHaveValue(
    "",
  );
  await page.goForward();
  await expect.poll(() => slugs(page)).toEqual(expected);
  await page.reload();
  await expect.poll(() => slugs(page)).toEqual(expected);
  await expect(page.locator(".catalog-advanced")).toHaveAttribute("open", "");
  const first = rows(page).first();
  await first.click();
  await expect(page).toHaveURL(/card=/);
  await page.goBack();
  await expect.poll(() => slugs(page)).toEqual(expected);
  await page
    .locator('#catalog-screen .catalog-tools [data-action="reset"]')
    .click();
  await expect(rows(page)).toHaveCount(characters.length);
  await page.goto(saved);
  await expect.poll(() => slugs(page)).toEqual(expected);
  expect(errors).toEqual([]);
});
test("attack blocks match one attack each and allow multiple blocks with all required", async ({
  page,
}) => {
  await ready(page);
  const attacks = await open(page, "Атаки");
  const one = attacks.locator("[data-attack-matcher]").first();
  await one.getByLabel("Дальность", { exact: true }).fill("4");
  await one.getByLabel("Сила", { exact: true }).fill("7");
  await one.getByRole("button", { name: "Energy", exact: true }).click();
  await one.getByRole("button", { name: "Beam", exact: true }).click();
  const expected = characters
    .filter((c) =>
      c.attacks.some(
        (a) =>
          a.type === "energy" &&
          /^B[4-9]/.test(a.range) &&
          Number(a.strength) >= 7,
      ),
    )
    .map((c) => c.slug);
  expect(expected.length).toBeGreaterThan(0);
  await expect.poll(() => slugs(page)).toEqual(expected);
  await attacks.getByRole("button", { name: "Добавить блок атаки" }).click();
  const two = attacks.locator("[data-attack-matcher]").nth(1);
  await two.getByRole("button", { name: "Mystic", exact: true }).click();
  await attacks.getByLabel("Должен совпасть каждый блок атак").check();
  await expect
    .poll(() => slugs(page))
    .toEqual(
      expected.filter((slug) =>
        characters
          .find((c) => c.slug === slug)
          .attacks.some((a) => a.type === "mystic"),
      ),
    );
  await page.reload();
  await expect(page.locator(".catalog-advanced")).toHaveAttribute("open", "");
  const restored = await open(page, "Атаки");
  await expect(restored.locator("[data-attack-matcher]")).toHaveCount(2);
  await expect(
    restored.getByLabel("Должен совпасть каждый блок атак"),
  ).toBeChecked();
});
test("affiliations, timelines, leadership, conditions and tag search work on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const affiliations = await open(page, "Аффилиации");
  await affiliations
    .getByRole("button", { name: "Avengers", exact: true })
    .click();
  await affiliations
    .getByRole("button", { name: "Web Warriors", exact: true })
    .click();
  await affiliations
    .getByLabel("Состоит во всех выбранных аффилиациях")
    .check();
  const expected = characters
    .filter(
      (c) =>
        c.affiliations.some(
          (a) => a.name === "Avengers" && a.timelines.includes("extended"),
        ) &&
        c.affiliations.some(
          (a) => a.name === "Web Warriors" && a.timelines.includes("extended"),
        ),
    )
    .map((c) => c.slug);
  await expect.poll(() => slugs(page)).toEqual(expected);
  const timeline = await open(page, "Другие параметры");
  await timeline.getByRole("button", { name: "2026", exact: true }).click();
  const in2026 = characters.filter(
    (c) =>
      c.affiliations.some(
        (a) => a.name === "Avengers" && a.timelines.includes("2026"),
      ) &&
      c.affiliations.some(
        (a) => a.name === "Web Warriors" && a.timelines.includes("2026"),
      ),
  );
  await expect.poll(() => slugs(page)).toEqual(in2026.map((c) => c.slug));
  await affiliations
    .getByLabel("Только лидеры, включая лидерство через тактики")
    .check();
  await expect
    .poll(() => slugs(page))
    .toEqual(
      in2026
        .filter((c) =>
          c.affiliations.some((a) => a.isLeader || a.isLeaderWithTeamTactics),
        )
        .map((c) => c.slug),
    );
  await page
    .locator('#catalog-screen .catalog-tools [data-action="reset"]')
    .click();
  const conditions = await open(page, "Состояния и иммунитеты");
  const immune = conditions
    .locator("fieldset")
    .filter({ has: page.getByText("Иммунитет к", { exact: true }) });
  await immune.getByRole("button", { name: "Poison", exact: true }).click();
  await expect
    .poll(() => slugs(page))
    .toEqual(
      characters
        .filter((c) => c.tags.includes("immuneToPoison"))
        .map((c) => c.slug),
    );
  await page.locator("#search").fill("#flight !#throwTerrain");
  await expect
    .poll(() => slugs(page))
    .toEqual(
      characters
        .filter(
          (c) =>
            c.tags.includes("immuneToPoison") &&
            c.tags.some((t) => t.toLowerCase().startsWith("flight")) &&
            !c.tags.some((t) => t.toLowerCase().startsWith("throwterrain")),
        )
        .map((c) => c.slug),
    );
  await page.screenshot({ path: "previews/catalog-filters-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("missing collection mode excludes owned models and switches off owned-only mode; sort and release filters persist", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "mcp-companion-catalog-v1",
      JSON.stringify({
        version: 1,
        owned: ["hulk"],
        rosters: [],
        wishlist: [],
      }),
    ),
  );
  await ready(page);
  await page.locator("#only-owned").check();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator("#result")).toHaveText(/^1 запись(?: ·|$)/);
  const other = await open(page, "Другие параметры");
  await other.getByLabel("Только отсутствующие в коллекции").check();
  await expect(page.locator("#only-owned")).not.toBeChecked();
  await expect(rows(page)).toHaveCount(characters.length - 1);
  await other.getByLabel("Скрыть ещё не выпущенных").check();
  const now = new Date().toISOString().slice(0, 10);
  const expected = characters
    .filter((c) => c.slug !== "hulk" && c.releaseDate && c.releaseDate <= now)
    .sort(
      (a, b) =>
        (b.threatLevel ?? -1) - (a.threatLevel ?? -1) ||
        b.name.localeCompare(a.name, "en") ||
        String(b.alterEgo || "").localeCompare(String(a.alterEgo || ""), "en"),
    )
    .map((c) => c.slug);
  await page
    .locator(".catalog-advanced")
    .getByLabel("Сортировка персонажей")
    .selectOption("threat");
  await page
    .locator(".catalog-advanced")
    .getByLabel("По убыванию", { exact: true })
    .check();
  await expect.poll(() => slugs(page)).toEqual(expected);
  await page.reload();
  await expect.poll(() => slugs(page)).toEqual(expected);
});

test("stage filters match only owned models; every filter shows the actual count, and history and detail edits stay in sync", async ({
  page,
}) => {
  const owned = ["wong", "hulk", "silk", "spider-ham", "black-cat"];
  await page.addInitScript((owned) => {
    const key = "mcp-companion-catalog-v1";
    if (!localStorage.getItem(key))
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          owned,
          rosters: [],
          hobbyProgress: {
            wong: "painted",
            hulk: "primed",
            silk: "assembled",
            "doctor-strange": "painted",
          },
        }),
      );
  }, owned);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "#screen=catalog");
  await expect(page.locator("#search")).toBeEnabled();
  await expect(page.locator("#characters [data-model-progress]")).toHaveCount(
    0,
  );
  const stage = page.getByLabel("Этап модели", { exact: true });
  for (const [value, ids] of [
    ["assembled", ["silk"]],
    ["primed", ["hulk"]],
    ["painted", ["wong"]],
    ["unset", ["black-cat", "spider-ham"]],
  ]) {
    await stage.selectOption(value);
    await expect.poll(() => slugs(page)).toEqual(ids);
    await expect(page.locator("#result")).toHaveText(
      new RegExp("^" + ids.length + " "),
    );
  }
  await page.locator("#only-owned").check();
  await expect(page.locator("#result")).toHaveText(/^2 записи · есть у меня/);
  await page.locator("#search").fill("Spider-Ham");
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator("#result")).toHaveText(/^1 запись/);
  await page.locator("#threat").selectOption("4");
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator("#result")).toHaveText(/^0 записей/);
  await page
    .locator('#catalog-screen .catalog-tools [data-action="reset"]')
    .click();
  await expect(rows(page)).toHaveCount(characters.length);
  await expect(stage).toHaveValue("");
  await expect(page.locator("#result")).toHaveText(
    new RegExp("^" + characters.length + " "),
  );
  await stage.selectOption("painted");
  const saved = page.url();
  await stage.selectOption("primed");
  await page.goBack();
  await expect(stage).toHaveValue("painted");
  await expect.poll(() => slugs(page)).toEqual(["wong"]);
  await page.goForward();
  await expect(stage).toHaveValue("primed");
  await page.goto(saved);
  await page.reload();
  await expect(stage).toHaveValue("painted");
  await expect.poll(() => slugs(page)).toEqual(["wong"]);
  await rows(page).first().click();
  await page
    .locator('#character-dialog [data-model-progress="wong"]')
    .selectOption("primed");
  await expect(page.locator("#result")).toHaveText(/^0 записей/);
  await page
    .getByRole("button", { name: "Закрыть карточку", exact: true })
    .click();
  await stage.selectOption("primed");
  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator("#result")).toHaveText(/^2 записи/);
  const advanced = page.locator(".catalog-advanced");
  if (!(await advanced.evaluate((e) => e.open)))
    await advanced.locator(":scope > summary").click();
  const other = await open(page, "Другие параметры");
  await other.getByLabel("Только отсутствующие в коллекции").check();
  await expect(stage).toHaveValue("");
  await expect(rows(page)).toHaveCount(characters.length - owned.length);
  await expect(page.locator("#result")).toHaveText(
    new RegExp("^" + (characters.length - owned.length) + " "),
  );
  await stage.selectOption("primed");
  await expect(
    other.getByLabel("Только отсутствующие в коллекции"),
  ).not.toBeChecked();
  await expect(rows(page)).toHaveCount(2);
  await page.locator("#catalog-screen .catalog-tools").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "previews/catalog-hobby-filter-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
