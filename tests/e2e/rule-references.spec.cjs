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
test("character token help is local, keyboard accessible and survives Back, Forward and reload", async ({
  page,
}) => {
  await page.goto(origin + "#screen=catalog&card=doctor-voodoo");
  const ref = page
    .locator('#character-dialog [data-rule-reference="token:brother_daniel"]')
    .first();
  await expect(ref).toBeVisible();
  await ref.focus();
  await page.keyboard.press("Enter");
  const dialog = page.locator("#sc-reference-dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/reference=token%3Abrother_daniel/);
  const image = dialog.locator(".sc-reference-token");
  await expect(image).toHaveAttribute(
    "src",
    "assets/rule-tokens/brother_daniel.png",
  );
  await expect
    .poll(() => image.evaluate((img) => img.naturalWidth))
    .toBeGreaterThan(0);
  await page.screenshot({ path: "previews/rule-token-help.png" });
  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await page.goForward();
  await expect(dialog).toBeVisible();
  await page.reload();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#character-dialog")).toBeVisible();
});
test("tactic references open help without closing or flipping the tactic", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "#screen=rosters&game=tactics:sinister-traps");
  const card = page.locator("#game-card-dialog");
  await expect(card).toBeVisible();
  await card
    .locator('[data-rule-reference="token:sinister_traps"]')
    .first()
    .click();
  await expect(page.locator("#sc-reference-dialog")).toBeVisible();
  await expect(page.locator("#sc-reference-title")).toHaveText(
    "Sinister Traps",
  );
  await page
    .locator("#sc-reference-dialog")
    .getByRole("button", { name: "Закрыть пояснение" })
    .click();
  await expect(page.locator("#sc-reference-dialog")).not.toBeVisible();
  await expect(card).toBeVisible();
  await expect(card.locator(".gc-tactic")).toHaveClass(/gc-rules-face/);
  expect(errors).toEqual([]);
});
test("grunt links render their native card, handle a failed fetch and retry", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/data/cards/shield-agents-grunts.json", async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, body: "unavailable" });
    } else await route.continue();
  });
  await page.goto(origin + "#screen=catalog&card=nick-fury");
  await page
    .locator(
      '#character-dialog [data-rule-reference="character:shield-agents-grunts"]',
    )
    .first()
    .click();
  const dialog = page.locator("#sc-reference-dialog");
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Повторить" }).click();
  await expect(dialog.locator(".sc-card")).toBeVisible();
  await expect(dialog).toContainText("S.H.I.E.L.D.");
  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#character-dialog")).toBeVisible();
});
test("crisis map links and inline annotations show the referenced content", async ({
  page,
}) => {
  const cards = require("../../data/roster-cards.json").crises;
  const mapCard = cards.find(
    (c) => !c.replacedBy && JSON.stringify(c).includes("|$C-"),
  );
  const noteCard = cards.find((c) => JSON.stringify(c).includes("|="));
  await page.goto(origin + "#screen=rosters&game=crises:" + mapCard.slug);
  await page
    .locator('#game-card-dialog [data-rule-reference="map:C"]')
    .first()
    .click();
  await expect(
    page.locator('#sc-reference-dialog svg[data-setup="C"]'),
  ).toBeVisible();
  await expect(
    page.locator("#sc-reference-dialog [data-objective]"),
  ).toHaveCount(3);
  await page.goto(origin + "#screen=rosters&game=crises:" + noteCard.slug);
  await page
    .locator('#game-card-dialog [data-rule-reference^="note:"]')
    .click();
  await expect(page.locator("#sc-reference-dialog")).toContainText(
    "Upcoming addition",
  );
  await expect(page.locator("#sc-reference-dialog")).toContainText(
    "Interact (Prisoner)",
  );
});
