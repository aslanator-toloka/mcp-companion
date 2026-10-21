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
test("character detail displays personal native tactics without duplicate printings; enlarged cards support history", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "#screen=catalog&card=wong");
  const section = page.locator('[data-character-tactics="wong"]');
  await expect(section.locator(".character-tactic-preview")).toHaveCount(1);
  await expect(section).toContainText("Pentagram of Farallah");
  await expect(section.locator(".gc-tactic")).toBeVisible();
  await section
    .getByRole("button", {
      name: "Открыть тактику Pentagram of Farallah",
      exact: true,
    })
    .click();
  await expect(page.locator("#game-card-dialog")).toBeVisible();
  await expect(page).toHaveURL(/game=tactics/);
  await page.goBack();
  await expect(page.locator("#game-card-dialog")).not.toBeVisible();
  await expect(page.locator("#character-dialog")).toBeVisible();
  await page.goto(origin + "#screen=catalog&card=hulk");
  const hulk = page.locator('[data-character-tactics="hulk"]');
  await expect(hulk.locator(".character-tactic-preview")).toHaveCount(3);
  await expect(hulk).toContainText("Gamma Launch");
  await expect(hulk).not.toContainText("Fall Back");
  await page.setViewportSize({ width: 390, height: 844 });
  await hulk.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "previews/character-tactics-mobile.png" });
  await page.goto(origin + "#screen=catalog&card=angel");
  await expect(page.locator('[data-character-tactics="angel"]')).toContainText(
    "Ultimate Sacrifice",
  );
  expect(errors).toEqual([]);
});
