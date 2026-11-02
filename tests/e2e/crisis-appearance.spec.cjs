const { test, expect } = require("@playwright/test");
const express = require("express");
const http = require("node:http");
const path = require("node:path");
let server, origin;
test.beforeAll(async () => {
  const app = express();
  app.use("/mcp-companion", express.static(path.resolve(__dirname, "../..")));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}/mcp-companion/`;
});
test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

// Jarvis's native crisis faces use unfiltered paper, a black Threat ring,
// type-colored lettering/borders and a number contained by the center disc.
for (const [slug, type, threat, paper, accent] of [
  [
    "alien-ship-crashes-in-downtown-ca09",
    "Extraction",
    17,
    "extract",
    "rgb(183, 55, 53)",
  ],
  [
    "assault-ships-make-sweeping-search",
    "Secure",
    16,
    "secure",
    "rgb(41, 102, 173)",
  ],
]) {
  test(`${type} crisis preserves its paper and readable Threat badge`, async ({
    page,
  }) => {
    await page.goto(origin + "#screen=rosters&game=crises:" + slug);
    const card = page.locator(".gc-crisis");
    await expect(card).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const background = card.locator(".gc-crisis-paper");
    await expect(background).toHaveAttribute(
      "src",
      `assets/game-cards/crisis-${paper}-paper.png`,
    );
    expect(
      await background.evaluate(async (img) => {
        await img.decode();
        return img.naturalWidth;
      }),
    ).toBeGreaterThan(0);
    await card.screenshot({
      path: `previews/crisis-${type.toLowerCase()}.png`,
    });
    await expect.soft(background).toHaveCSS("filter", "none");
    await expect.soft(background).toHaveCSS("opacity", "1");
    await expect
      .soft(card.locator(".gc-setup-scoring"))
      .toHaveCSS("border-top-color", accent);
    await expect
      .soft(card.locator(".gc-threat-ring"))
      .toHaveCSS("fill", "rgb(0, 0, 0)");
    const number = card.locator(".gc-threat-number");
    await expect(number).toHaveText(String(threat));
    // Use SVG glyph bounds: CSS font metrics alone miss cropped/shifted digits.
    const bounds = await number.evaluate((el) => {
      const n = el.getBBox();
      const disc = el.ownerSVGElement.querySelector(".gc-threat-center");
      if (!disc) return false;
      const cx = disc.cx.baseVal.value,
        cy = disc.cy.baseVal.value;
      const radius = disc.r.baseVal.value - 2;
      return [n.x, n.x + n.width].every((x) =>
        [n.y, n.y + n.height].every(
          (y) => Math.hypot(x - cx, y - cy) <= radius,
        ),
      );
    });
    expect.soft(bounds).toBe(true);
    const letters = card.locator(".gc-threat-ring-text");
    await expect.soft(letters.first()).toHaveCSS("fill", accent);
    expect
      .soft(
        await letters.evaluateAll((els) =>
          els.every((el) => {
            const b = el.getBBox();
            return b.width > 0 && b.height > 0;
          }),
        ),
      )
      .toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(number).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
