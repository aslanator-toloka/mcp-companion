const { test, expect } = require("@playwright/test");
const express = require("express"), http = require("node:http"), path = require("node:path");
let server, origin;
test.beforeAll(async () => {
  const app = express();
  app.use("/mcp-companion", express.static(path.resolve(__dirname, "../..")));
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}/mcp-companion/`;
});
test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

test("theme switches persist across reload without changing collection data", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "#screen=catalog&q=Wong");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(16, 23, 34)");
  await page.getByRole("checkbox", { name: "Есть у меня", exact: true }).last().check();
  const saved = await page.evaluate(() => localStorage.getItem("mcp-companion-catalog-v1"));
  const toggle = page.getByRole("button", { name: "Включить светлую тему", exact: true });
  await toggle.click();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(244, 246, 250)");
  await page.reload();
  await expect(page.getByRole("button", { name: "Включить тёмную тему", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Включить тёмную тему", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("mcp-companion-catalog-v1"))).toBe(saved);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

for (const theme of ["dark", "light"])
  test(`saved ${theme} theme applies before the React bundle loads`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem("mcp-companion-theme-v1", value), theme);
    await page.route("**/react-ui.js*", route => route.abort());
    await page.goto(origin);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("body")).toHaveCSS("background-color", theme === "dark" ? "rgb(16, 23, 34)" : "rgb(244, 246, 250)");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", theme === "dark" ? "#101722" : "#2563eb");
  });
