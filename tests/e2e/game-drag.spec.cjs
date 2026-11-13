const { test, expect } = require("@playwright/test");
const express = require("express");
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { gameRouter } = require("../../game/server.cjs");
const { create } = require("../../game/engine.cjs");

if (process.env.MCP_GAME_CHROME)
  test.use({ launchOptions: { executablePath: process.env.MCP_GAME_CHROME } });

test("drag keeps the grabbed point under the cursor at the movement limit", async ({ page }) => {
  const dir = mkdtempSync(path.join(tmpdir(), "mcp-game-drag-"));
  const save = path.join(dir, "game.json");
  const match = create({ p1: "avengers", p2: "cabal" }, 1);
  const fighter = {
    id: "p1:captain-america-first-avenger", side: "p1", slug: "captain-america-first-avenger",
    name: "Captain America, First Avenger", size: 2, speed: "M", radius: 35 / 50.8,
    x: 8, y: 8, power: 1,
  };
  Object.assign(match, {
    phase: "activation", round: 1, priority: "p1", decisionSide: "p1", active: fighter.id,
    actionsLeft: 2, fighters: [fighter], terrain: [],
  });
  writeFileSync(save, JSON.stringify(match));
  const app = express();
  app.use("/__mcp_game", gameRouter(save));
  app.use("/mcp-companion", express.static(path.resolve(__dirname, "../..")));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const origin = "http://127.0.0.1:" + server.address().port;
    await page.goto(origin + "/mcp-companion/#screen=game");
    const board = page.locator(".game-board");
    await board.locator("image").waitFor();
    await board.scrollIntoViewIfNeeded();
    const at = (x, y) => board.evaluate((svg, [x, y]) => {
      const point = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
      return { x: point.x, y: point.y };
    }, [x, y]);
    const grab = await at(8.55, 8);
    const drop = await at(14.6, 8);
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(drop.x, drop.y, { steps: 6 });
    const response = page.waitForResponse((r) => r.url().endsWith("/__mcp_game/command"), { timeout: 1500 })
      .catch(() => null);
    await page.mouse.up();
    await response;
    const state = await (await page.request.get(origin + "/__mcp_game/state")).json();
    expect(state.fighters[0].x, "the base centre moves 6 inches while the grabbed edge stays under the cursor").toBe(14);
    expect(state.actionsLeft).toBe(1);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
