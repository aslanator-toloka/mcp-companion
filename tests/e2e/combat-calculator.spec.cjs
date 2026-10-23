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
const modal = (page) =>
  page.getByRole("dialog", { name: "Калькулятор атак", exact: true });
async function open(page, slug = "malekith-the-accursed") {
  await page.goto(origin + "#screen=catalog&card=" + slug);
  await page
    .locator("#character-dialog")
    .getByRole("button", { name: "Калькулятор", exact: true })
    .click();
  await expect(modal(page)).toBeVisible();
}
async function complete(page) {
  await expect(modal(page).locator(".combat-direction")).toHaveCount(2, {
    timeout: 30000,
  });
}
test("each attack is compared both ways, paid Cloak changes the result, URL and nested Back/Forward/reload work", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await expect(page).toHaveURL(/calculator=malekith-the-accursed/);
  await modal(page)
    .getByLabel("Противник", { exact: true })
    .selectOption("wong");
  await complete(page);
  const forward = modal(page).locator(
    '[data-attacker="malekith-the-accursed"]',
  );
  await expect(forward.locator(".combat-attack")).toHaveCount(3);
  const values = await forward
    .locator(".combat-attack")
    .first()
    .locator(".combat-outcome strong")
    .allTextContents();
  const numbers = values.map((v) =>
    Number(v.replace(/[^\d,]/g, "").replace(",", ".")),
  );
  expect(numbers[1]).toBeGreaterThan(numbers[0]);
  await forward.locator(".combat-attack").first().locator("summary").click();
  await expect(forward).toContainText("Cloak of Shadows");
  const url = page.url();
  await page.reload();
  await complete(page);
  await expect(page).toHaveURL(url);
  await expect(
    modal(page).getByLabel("Противник", { exact: true }),
  ).toHaveValue("wong");
  await modal(page)
    .getByRole("button", { name: "Закрыть калькулятор" })
    .click();
  await expect(modal(page)).not.toBeVisible();
  await expect(page.locator("#character-dialog")).toBeVisible();
  await page.goBack();
  await complete(page);
  await expect(page).toHaveURL(url);
  await page.goForward();
  await expect(modal(page)).not.toBeVisible();
  expect(errors).toEqual([]);
});
test("search, independent sides and forms, damage state and range survive navigation without changing the catalog card", async ({
  page,
}) => {
  await open(page, "hulk");
  await modal(page).getByRole("searchbox").fill("Hood");
  await modal(page)
    .getByLabel("Противник", { exact: true })
    .selectOption("hood");
  await complete(page);
  await modal(page).getByLabel("Форма Hood").selectOption("1");
  await complete(page);
  await expect(modal(page).getByLabel("Форма Hood")).toHaveValue("1");
  await modal(page).getByLabel("Урон на Hulk").fill("8");
  await complete(page);
  const mean = await modal(page)
    .locator('[data-attacker="hulk"] .combat-outcome strong')
    .first()
    .textContent();
  await modal(page).getByLabel("Дистанция", { exact: true }).selectOption("4");
  await complete(page);
  await expect(
    modal(page).locator(".combat-unavailable").first(),
  ).toContainText("Вне дальности");
  await page.goBack();
  await complete(page);
  await expect(
    modal(page).getByLabel("Дистанция", { exact: true }),
  ).toHaveValue("2");
  await expect(
    modal(page)
      .locator('[data-attacker="hulk"] .combat-outcome strong')
      .first(),
  ).toHaveText(mean);
  await page.reload();
  await complete(page);
  await expect(modal(page).getByLabel("Урон на Hulk")).toHaveValue("8");
  await expect(modal(page).getByLabel("Форма Hood")).toHaveValue("1");
  await page.keyboard.press("Escape");
  await expect(modal(page)).not.toBeVisible();
  await expect(page.locator("#character-dialog h2").first()).toHaveText("Hulk");
});
test("failed opponent load can retry; rapidly choosing a new opponent cancels old calculation and mobile fits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let fail = true;
  await page.route("**/data/cards/wong.json", (route) =>
    fail ? route.fulfill({ status: 503, body: "offline" }) : route.continue(),
  );
  await open(page);
  await modal(page)
    .getByLabel("Противник", { exact: true })
    .selectOption("wong");
  await expect(modal(page).getByRole("alert")).toBeVisible();
  fail = false;
  await modal(page).getByRole("button", { name: "Повторить расчёт" }).click();
  await complete(page);
  await modal(page)
    .getByLabel("Противник", { exact: true })
    .selectOption("amazing-spider-man");
  await modal(page)
    .getByLabel("Противник", { exact: true })
    .selectOption("black-cat");
  await complete(page);
  await expect(modal(page).locator(".combat-direction").last()).toHaveAttribute(
    "data-attacker",
    "black-cat",
  );
  await expect(modal(page)).not.toContainText("Amazing Spider-Man →");
  expect(
    await modal(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({
    path: "previews/combat-calculator-mobile.png",
    fullPage: false,
  });
});
test("unknown calculator URLs are ignored and unsupported mechanics are clearly labeled", async ({
  page,
}) => {
  await page.goto(
    origin + "#screen=catalog&calculator=does-not-exist&opponent=bad",
  );
  await expect(page.locator("#search")).toBeEnabled();
  await expect(modal(page)).not.toBeVisible();
  await open(page, "wong");
  await modal(page)
    .getByLabel("Противник", { exact: true })
    .selectOption("adam-warlock");
  await complete(page);
  const row = modal(page).locator(".combat-attack").first();
  await expect(row.locator("summary")).toContainText("Частичный расчёт");
  await row.locator("summary").click();
  await expect(row).toContainText("Chronokinesis");
  await page.screenshot({
    path: "previews/combat-calculator.png",
    fullPage: false,
  });
});
