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
const workspace = (page) =>
  page.getByRole("region", { name: "Калькулятор атак", exact: true });
const first = (page) =>
  workspace(page).getByLabel("Первый персонаж", { exact: true });
const second = (page) =>
  workspace(page).getByLabel("Второй персонаж", { exact: true });
async function open(page, slug = "malekith-the-accursed") {
  await page.goto(origin + "#screen=catalog&card=" + slug);
  await page
    .locator("#character-dialog")
    .getByRole("button", { name: "Калькулятор", exact: true })
    .click();
  await expect(workspace(page)).toBeVisible();
  await expect(page).toHaveURL(/screen=calculator/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function complete(page) {
  await expect(workspace(page).locator(".combat-direction")).toHaveCount(2, {
    timeout: 30000,
  });
}
test("sidebar opens a real page with two independent selectors and no character/dialog underneath", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "#screen=catalog");
  await page.locator('nav [data-action="calculator"]').click();
  await expect(workspace(page)).toBeVisible();
  await expect(page).toHaveURL(/screen=calculator/);
  await expect(page.locator('nav [data-action="calculator"]')).toHaveClass(
    /selected/,
  );
  await expect(first(page)).toHaveValue("");
  await expect(second(page)).toHaveValue("");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#catalog-screen")).not.toBeVisible();
  await second(page).selectOption("wong");
  await first(page).selectOption("malekith-the-accursed");
  await complete(page);
  const forward = workspace(page).locator('[data-combat-slot="first"]');
  await expect(forward.locator(".combat-attack")).toHaveCount(3);
  const numbers = (
    await forward
      .locator(".combat-attack")
      .first()
      .locator(".combat-outcome strong")
      .allTextContents()
  ).map((v) => Number(v.replace(/[^\d,]/g, "").replace(",", ".")));
  expect(numbers[1]).toBeGreaterThan(numbers[0]);
  await forward.locator(".combat-attack").first().locator("summary").click();
  await expect(forward).toContainText("Cloak of Shadows");
  const url = page.url();
  await page.reload();
  await complete(page);
  await expect(page).toHaveURL(url);
  await expect(first(page)).toHaveValue("malekith-the-accursed");
  await expect(second(page)).toHaveValue("wong");
  await page.locator('nav [data-action="all"]').click();
  await expect(workspace(page)).not.toBeVisible();
  await page.goBack();
  await complete(page);
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("character shortcut preselects the first character, both picks and contexts navigate, Back returns to the original detail", async ({
  page,
}) => {
  await open(page, "hulk");
  await expect(first(page)).toHaveValue("hulk");
  await expect(second(page)).toHaveValue("");
  await workspace(page)
    .getByLabel("Найти второго персонажа", { exact: true })
    .fill("Hood");
  await second(page).selectOption("hood");
  await complete(page);
  await workspace(page).getByLabel("Форма Hood").selectOption("1");
  await complete(page);
  await workspace(page).getByLabel("Урон на Hulk").fill("8");
  await complete(page);
  await first(page).selectOption("wong");
  await complete(page);
  await expect(workspace(page).getByLabel("Урон на Wong")).toHaveValue("0");
  await expect(workspace(page).getByLabel("Форма Hood")).toHaveValue("1");
  await page.goBack();
  await complete(page);
  await expect(first(page)).toHaveValue("hulk");
  await expect(workspace(page).getByLabel("Урон на Hulk")).toHaveValue("8");
  const mean = await workspace(page)
    .locator('[data-combat-slot="first"] .combat-outcome strong')
    .first()
    .textContent();
  await workspace(page)
    .getByLabel("Дистанция", { exact: true })
    .selectOption("4");
  await complete(page);
  await expect(
    workspace(page).locator(".combat-unavailable").first(),
  ).toContainText("Вне дальности");
  await page.goBack();
  await complete(page);
  await expect(
    workspace(page).getByLabel("Дистанция", { exact: true }),
  ).toHaveValue("2");
  await expect(
    workspace(page)
      .locator('[data-combat-slot="first"] .combat-outcome strong')
      .first(),
  ).toHaveText(mean);
  await page.reload();
  await complete(page);
  await expect(workspace(page).getByLabel("Урон на Hulk")).toHaveValue("8");
  await expect(workspace(page).getByLabel("Форма Hood")).toHaveValue("1");
  await page.keyboard.press("Escape");
  await expect(workspace(page)).toBeVisible();
  await page.evaluate(() => history.go(-4));
  await expect(page).toHaveURL(/screen=catalog.*card=hulk/);
  await expect(page.locator("#character-dialog")).toBeVisible();
  await page.goForward();
  await expect(workspace(page)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("failed loads retry; both searches and rapid choices cancel stale work; mobile is an ordinary page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let fail = true;
  await page.route("**/data/cards/wong.json", (route) =>
    fail ? route.fulfill({ status: 503, body: "offline" }) : route.continue(),
  );
  await open(page);
  await second(page).selectOption("wong");
  await expect(workspace(page).getByRole("alert")).toBeVisible();
  fail = false;
  await workspace(page)
    .getByRole("button", { name: "Повторить расчёт" })
    .click();
  await complete(page);
  await workspace(page)
    .getByLabel("Найти первого персонажа", { exact: true })
    .fill("Spider-Man");
  await first(page).selectOption("amazing-spider-man");
  await workspace(page)
    .getByLabel("Найти первого персонажа", { exact: true })
    .fill("Black Cat");
  await first(page).selectOption("black-cat");
  await complete(page);
  await expect(
    workspace(page).locator('[data-combat-slot="first"]'),
  ).toHaveAttribute("data-attacker", "black-cat");
  await expect(second(page)).toHaveValue("wong");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await workspace(page)
    .getByRole("heading", { name: "Калькулятор атак", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "previews/calculator-page-mobile.png" });
});
test("legacy URLs become a standalone page; invalid selections are sanitized, partial support stays visible", async ({
  page,
}) => {
  await page.goto(
    origin + "#screen=catalog&card=wong&calculator=wong&opponent=adam-warlock",
  );
  await complete(page);
  await expect(page).toHaveURL(/screen=calculator/);
  await expect(page).not.toHaveURL(/card=/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = workspace(page).locator(".combat-attack").first();
  await expect(row.locator("summary")).toContainText("Частичный расчёт");
  await row.locator("summary").click();
  await expect(row).toContainText("Chronokinesis");
  await page.goto(
    origin + "#screen=calculator&calculator=does-not-exist&opponent=bad",
  );
  await expect(first(page)).toHaveValue("");
  await expect(second(page)).toHaveValue("");
  await expect(page).not.toHaveURL(/does-not-exist|opponent=/);
  await first(page).selectOption("wong");
  await second(page).selectOption("hulk");
  await complete(page);
  await first(page).selectOption("");
  await expect(first(page)).toHaveValue("");
  await expect(second(page)).toHaveValue("hulk");
  await page.goBack();
  await complete(page);
  await expect(first(page)).toHaveValue("wong");
});
test("same character can occupy both slots with independent damage; leaving during computation keeps the page closed", async ({
  page,
}) => {
  await page.goto(origin + "#screen=calculator");
  await first(page).selectOption("hulk");
  await second(page).selectOption("hulk");
  await complete(page);
  const left = workspace(page).getByRole("group", {
    name: "Первый персонаж: выбор и настройки",
    exact: true,
  });
  const right = workspace(page).getByRole("group", {
    name: "Второй персонаж: выбор и настройки",
    exact: true,
  });
  await left.getByLabel("Урон на Hulk").fill("8");
  await complete(page);
  await expect(right.getByLabel("Урон на Hulk")).toHaveValue("0");
  const a = Number(
    (
      await workspace(page)
        .locator('[data-combat-slot="first"] .combat-outcome strong')
        .first()
        .textContent()
    )
      .replace(/[^\d,]/g, "")
      .replace(",", "."),
  );
  const b = Number(
    (
      await workspace(page)
        .locator('[data-combat-slot="second"] .combat-outcome strong')
        .first()
        .textContent()
    )
      .replace(/[^\d,]/g, "")
      .replace(",", "."),
  );
  expect(a).toBeGreaterThan(b);
  await left.getByLabel("Урон на Hulk").fill("4");
  await page.locator('nav [data-action="all"]').click();
  await expect(workspace(page)).not.toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator('nav [data-action="calculator"]').click();
  await complete(page);
  await expect(first(page)).toHaveValue("hulk");
  await expect(second(page)).toHaveValue("hulk");
  await expect(
    workspace(page)
      .getByRole("group", {
        name: "Первый персонаж: выбор и настройки",
        exact: true,
      })
      .getByLabel("Урон на Hulk"),
  ).toHaveValue("4");
  await workspace(page)
    .getByRole("heading", { name: "Калькулятор атак", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "previews/calculator-page.png" });
});
test("calculator shortcut honors unsaved roster guard before leaving the character detail", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "mcp-companion-catalog-v1",
      JSON.stringify({
        version: 1,
        owned: [],
        groups: [],
        rosters: [
          {
            id: "calculator-roster",
            name: "Original roster",
            characters: ["hulk"],
            affiliation: "Avengers",
            tactics: [],
            crises: [],
            groups: [],
          },
        ],
      }),
    ),
  );
  await page.goto(origin + "#screen=rosters&roster=calculator-roster");
  await page.locator("#editor-name").fill("Unsaved roster");
  await page.locator('.selected-character[data-slug="hulk"]').click();
  const detail = page.locator("#character-dialog");
  await detail
    .getByRole("button", { name: "Калькулятор", exact: true })
    .click();
  await expect(page.locator("#roster-action-dialog")).toContainText(
    "несохранённые",
  );
  await expect(workspace(page)).not.toBeVisible();
  await page
    .getByRole("button", { name: "Продолжить редактирование", exact: true })
    .click();
  await expect(detail).toBeVisible();
  await expect(page.locator("#editor-name")).toHaveValue("Unsaved roster");
  await detail
    .getByRole("button", { name: "Калькулятор", exact: true })
    .click();
  await page.locator('[data-rs="discard-leave"]').click();
  await expect(workspace(page)).toBeVisible();
  await expect(first(page)).toHaveValue("hulk");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("mcp-companion-catalog-v1")).rosters[0]
          .name,
    ),
  ).toBe("Original roster");
});

test("calculator shows closed-form means and no sampling count, approximation mark or confidence interval", async ({
  page,
}) => {
  await page.goto(origin + "#screen=calculator&calculator=wong&opponent=wong");
  await complete(page);
  const c = require("../../data/cards/wong.json").statCard.frontSide,
    n = Number(c.attacks[0].strength),
    m = Number(c.physicalDefense);
  const convolve = (a, b) => {
    const out = Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++)
      for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
    return out;
  };
  const raise = (p, n) => {
    let out = [1];
    while (n--) out = convolve(out, p);
    return out;
  };
  const ap = raise([1 / 2, 7 / 16, 1 / 16], n),
    dp = raise([5 / 8, 21 / 64, 3 / 64], m);
  let mean = 0;
  for (let i = 0; i < ap.length; i++)
    for (let j = 0; j < dp.length; j++)
      mean += ap[i] * dp[j] * Math.max(0, i - j);
  const printed = mean.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const values = workspace(page).locator(".combat-outcome strong");
  for (let i = 0; i < (await values.count()); i++)
    await expect(values.nth(i)).toHaveText(printed);
  await expect(workspace(page)).not.toContainText(
    /60\s*000|95%|Погрешность|±|≈/,
  );
  await workspace(page).locator(".combat-method summary").click();
  await expect(workspace(page).locator(".combat-method")).toContainText(
    "Вероятности всех исходов",
  );
  await workspace(page)
    .locator('[data-combat-slot="first"]')
    .screenshot({ path: "previews/exact-calculator-result.png" });
  await page.reload();
  await complete(page);
  await expect(
    workspace(page).locator(".combat-outcome strong").first(),
  ).toHaveText(printed);
});
