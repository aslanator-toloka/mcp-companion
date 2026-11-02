const { test, expect } = require("@playwright/test");
const express = require("express"),
  http = require("node:http"),
  path = require("node:path");
let server, origin;
test.beforeAll(async () => {
  const app = express();
  app.use("/mcp-companion", express.static(path.resolve(__dirname, "../..")));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${server.address().port}/mcp-companion/`;
});
test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
});
for (const [name, width, height] of [
  ["tablet", 1628, 1108],
  ["phone", 390, 844],
  ["landscape", 844, 390],
]) {
  test(`condition help is opaque and readable over a character card on ${name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto(origin + "#screen=catalog&card=clea");
    const link = page
      .locator('#character-dialog [data-card-condition="judgment"]')
      .first();
    await link.click();
    const dialog = page.getByRole("dialog", { name: "Judgment", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#sc-condition-body")).toContainText(
      "Damage from enemy attacks",
    );
    await dialog.locator(".sc-condition-token").evaluate((img) => img.decode());
    await page.screenshot({ path: `previews/condition-${name}.png` });
    const appearance = await dialog.evaluate((el) => {
      const panel = getComputedStyle(el),
        body = getComputedStyle(el.querySelector("p"));
      const rgb = (color) => color.match(/[\d.]+/g).map(Number);
      const bg = rgb(panel.backgroundColor),
        fg = rgb(body.color);
      const luminance = (rgb) =>
        rgb
          .slice(0, 3)
          .map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      const a = luminance(bg),
        b = luminance(fg),
        rect = el.getBoundingClientRect();
      return {
        opaque: (bg[3] ?? 1) === 1,
        contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        contained:
          rect.left >= 0 &&
          rect.top >= 0 &&
          rect.right <= innerWidth &&
          rect.bottom <= innerHeight,
        fontSize: parseFloat(body.fontSize),
      };
    });
    expect.soft(appearance.opaque).toBe(true);
    expect.soft(appearance.contrast).toBeGreaterThanOrEqual(4.5);
    expect.soft(appearance.fontSize).toBeGreaterThanOrEqual(16);
    expect(appearance.contained).toBe(true);
    await expect(dialog.locator(".sc-icon")).toHaveCSS("filter", "none");
    await dialog
      .getByRole("button", { name: "Закрыть описание состояния" })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("#character-dialog")).toBeVisible();
    await expect(link).toBeFocused();
  });
}
