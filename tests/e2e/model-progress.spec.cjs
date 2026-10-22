const { test, expect } = require("@playwright/test"),
  express = require("express"),
  http = require("node:http"),
  path = require("node:path"),
  fs = require("node:fs");
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
const key = "mcp-companion-catalog-v1";
async function seed(page, data) {
  await page.addInitScript(
    ({ key, data }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(data));
    },
    { key, data },
  );
}
test("owned models edit stages only in detail; reload and JSON export retain the stage and roster", async ({
  page,
}) => {
  await seed(page, {
    version: 1,
    owned: ["wong"],
    rosters: [{ id: "old", name: "Saved", characters: ["wong"] }],
  });
  await page.goto(origin + "#screen=mine");
  await expect(page.locator("#characters [data-model-progress]")).toHaveCount(
    0,
  );
  await page.locator('#characters .row-open[data-slug="wong"]').click();
  const detail = page.locator('#character-dialog [data-model-progress="wong"]');
  await expect(detail).toHaveValue("");
  await detail.selectOption("assembled");
  await detail.selectOption("primed");
  await detail.selectOption("painted");
  await page.reload();
  await expect(detail).toHaveValue("painted");
  await detail.selectOption("primed");
  await page
    .getByRole("button", { name: "Закрыть карточку", exact: true })
    .click();
  await expect(page.locator("#characters [data-model-progress]")).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Данные и экспорт", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON", exact: true }).click();
  const file = await download,
    data = JSON.parse(fs.readFileSync(await file.path(), "utf8"));
  expect(data.hobbyProgress).toEqual({ wong: "primed" });
  expect(data.rosters[0].characters).toEqual(["wong"]);
});
test("each model in a bought box has independent progress, syncs to another tab and retains it after unbuy/rebuy", async ({
  page,
}) => {
  await seed(page, {
    version: 1,
    owned: [],
    purchasedSets: ["CP170"],
    manuallyOwned: [],
    rosters: [],
  });
  await page.goto(origin + "#screen=purchases&tab=purchased&box=CP170");
  const box = page.locator("#box-set-dialog");
  await expect(box.locator("[data-model-progress]")).toHaveCount(0);
  const other = await page.context().newPage();
  await other.goto(origin + "#screen=mine");
  await expect(other.locator("#search")).toBeEnabled();
  for (const [slug, stage] of [
    ["silk", "primed"],
    ["spider-man-noir", "painted"],
    ["spider-ham", "assembled"],
  ]) {
    await other.locator(`#characters .row-open[data-slug="${slug}"]`).click();
    await other
      .locator(`#character-dialog [data-model-progress="${slug}"]`)
      .selectOption(stage);
    await other
      .getByRole("button", { name: "Закрыть карточку", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate((slug) => MCPStores.library.hobby.get(slug), slug),
      )
      .toBe(stage);
  }
  await expect(other.locator("#characters [data-model-progress]")).toHaveCount(
    0,
  );
  await box.locator('[data-purchased-code="CP170"]').click();
  await expect(other.locator("#characters .row-open")).toHaveCount(0);
  await box.locator('[data-purchased-code="CP170"]').click();
  await expect(other.locator("#characters .row-open")).toHaveCount(3);
  await other.locator('#characters .row-open[data-slug="silk"]').click();
  await expect(
    other.locator('#character-dialog [data-model-progress="silk"]'),
  ).toHaveValue("primed");
  await expect(box.locator("[data-model-progress]")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "previews/model-progress-box-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await other.close();
});
test("failed writes roll the selector back and never lose the previous hobby progress", async ({
  page,
}) => {
  await seed(page, {
    version: 1,
    owned: ["wong"],
    hobbyProgress: { wong: "assembled" },
    rosters: [],
  });
  await page.goto(origin + "#screen=mine");
  await page.locator('#characters .row-open[data-slug="wong"]').click();
  const select = page.locator('#character-dialog [data-model-progress="wong"]');
  await expect(select).toHaveValue("assembled");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "mcp-companion-catalog-v1") throw new Error("quota");
      return original.call(this, k, v);
    };
  });
  await select.selectOption("painted");
  await expect(select).toHaveValue("assembled");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("mcp-companion-catalog-v1"))
          .hobbyProgress.wong,
    ),
  ).toBe("assembled");
  expect(await page.evaluate(() => MCPStores.library.hobby.get("wong"))).toBe(
    "assembled",
  );
});
