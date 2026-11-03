const { chromium } = require("@playwright/test");
const axePath = require.resolve("axe-core/axe.min.js");
const fs = require("node:fs"),
  path = require("node:path");
const fixture = require("../tests/helpers/remaining-ux.cjs");
const base =
  process.env.MCP_AUDIT_ORIGIN || "http://127.0.0.1:4173/mcp-companion/";
fs.mkdirSync("previews/acceptance", { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
  });
  await context.addInitScript((data) => {
    const { battles, ...library } = data;
    if (!localStorage.getItem("mcp-companion-catalog-v1"))
      localStorage.setItem("mcp-companion-catalog-v1", JSON.stringify(library));
    if (!localStorage.getItem("mcp-companion-battles-v1"))
      localStorage.setItem("mcp-companion-battles-v1", JSON.stringify(battles));
  }, fixture());
  const page = await context.newPage(),
    reports = [];
  const scenarios = [
    ["catalog", "screen=catalog&q=Spider", "#characters .character-row"],
    ["roster-list", "screen=rosters", ".roster-tile"],
    ["roster-editor", "screen=rosters&roster=audit-r0", "#editor-name"],
    [
      "calculator",
      "screen=calculator&calculator=wong&opponent=hulk",
      ".combat-direction",
    ],
    ["purchases", "screen=purchases&tab=all&q=CP143", "[data-box-set]"],
    [
      "battle",
      "screen=battle&match=audit-match&view=play",
      ".battle-dashboard",
    ],
    ["map", "screen=battle&match=audit-match&view=map", "#battle-map-svg"],
    ["tournaments", "screen=tournaments&character=wong", "#at-character-list"],
  ];
  async function audit(name) {
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({ path: axePath });
    const tags = [
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22aa",
      "best-practice",
    ];
    const result = await page.evaluate(
      (tags) => axe.run(document, { runOnly: { type: "tag", values: tags } }),
      tags,
    );
    const report = {
      name,
      tags,
      url: page.url(),
      violations: result.violations,
      incomplete: result.incomplete,
      passes: result.passes.map((x) => x.id),
    };
    fs.writeFileSync(
      path.join("previews/acceptance", name + ".json"),
      JSON.stringify(report, null, 2),
    );
    reports.push({
      name,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        count: v.nodes.length,
        examples: v.nodes
          .slice(0, 3)
          .map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    });
    console.log(JSON.stringify(reports.at(-1)));
  }
  try {
    for (const [name, hash, selector] of scenarios) {
      await page.goto(base + "#" + hash);
      await page
        .locator('nav [data-action="all"]')
        .waitFor({ state: "visible" });
      await page.waitForFunction(
        () =>
          !!document.querySelector('nav [data-action="all"]:not(:disabled)'),
      );
      if (selector)
        await page
          .locator(selector)
          .first()
          .waitFor({ state: "visible", timeout: 15000 });
      await audit(name);
    }
    for (const [name, hash, ready] of [
      [
        "empty-catalog",
        "screen=catalog&q=no-such-character-900",
        "#characters .empty",
      ],
      ["empty-rosters", "screen=rosters&q=no-such-roster-900", ".roster-empty"],
      [
        "empty-purchases",
        "screen=purchases&tab=all&q=no-such-box-900",
        ".purchase-empty",
      ],
      [
        "squad-planner",
        "screen=rosters&roster=audit-r0&squads=1",
        ".squad-results",
      ],
    ]) {
      await page.goto(base + "#" + hash);
      await page.locator(ready).waitFor({ state: "visible" });
      await audit(name);
    }
    await page.goto(base + "#screen=rosters");
    await page.getByRole("button", { name: "Группы", exact: true }).click();
    await audit("groups-dialog");
    await page.keyboard.press("Escape");
    await page.locator('nav [data-action="data"]').click();
    await audit("data-dialog");
    await page.goto(base + "#screen=catalog&card=wong");
    await page
      .locator("#character-dialog .sc-card")
      .waitFor({ state: "visible" });
    await audit("character-dialog");
    await page.goto(base + "#screen=catalog&card=ant-man");
    await page.locator(".character-tactic-open").first().click();
    await audit("tactic-dialog");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.goto(base + "#screen=battle&match=audit-match&view=play");
    await page
      .getByRole("button", { name: "Состояния +", exact: true })
      .first()
      .click();
    for (const item of await page.locator(".condition-grid button").all())
      if (!(await item.getAttribute("class"))?.includes("selected"))
        await item.click();
    await audit("conditions-dialog");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Журнал", exact: true }).click();
    await audit("log-dialog");
    await page.keyboard.press("Escape");
    await page.locator('[data-bt="activate"]').first().click();
    await audit("battle-acted");
    await page.goto(base + "#screen=battle");
    await page
      .getByRole("button", { name: "Создать совместный бой", exact: true })
      .click();
    await audit("peer-dialog");
    await page.keyboard.press("Escape");
    await page.goto(base + "#screen=tournaments&character=wong");
    await page.locator("#at-player-picker").click();
    await audit("player-dialog");
    await page.keyboard.press("Escape");
    await page.locator("#at-affiliation-picker").click();
    await audit("affiliation-dialog");
  } finally {
    fs.writeFileSync(
      "previews/acceptance/summary.json",
      JSON.stringify(reports, null, 2),
    );
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
