const { test, expect } = require("@playwright/test"),
  express = require("express"),
  http = require("node:http"),
  path = require("node:path"),
  fs = require("node:fs");
const fixture = require("../helpers/remaining-ux.cjs"),
  { scan, summarize } = require("../helpers/accessibility.cjs");
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
async function seed(page) {
  await page.addInitScript((data) => {
    const { battles, ...library } = data;
    if (!localStorage.getItem("mcp-companion-catalog-v1"))
      localStorage.setItem("mcp-companion-catalog-v1", JSON.stringify(library));
    if (!localStorage.getItem("mcp-companion-battles-v1"))
      localStorage.setItem("mcp-companion-battles-v1", JSON.stringify(battles));
  }, fixture());
}
async function open(page, hash, ready) {
  await page.goto(origin + "#" + hash);
  await expect(page.locator('nav [data-action="all"]')).toBeEnabled();
  if (ready) await page.locator(ready).first().waitFor({ state: "visible" });
}
async function accessible(page, name) {
  const result = await scan(page);
  expect(summarize(result), name).toEqual([]);
  return result;
}
const scenes = [
  ["catalog", "screen=catalog&q=Spider", "#characters .character-row"],
  ["rosters", "screen=rosters", ".roster-tile"],
  ["editor", "screen=rosters&roster=audit-r0", "#editor-name"],
  [
    "calculator",
    "screen=calculator&calculator=wong&opponent=hulk",
    ".combat-direction",
  ],
  ["purchases", "screen=purchases&tab=all&q=CP143", "[data-box-set]"],
  ["battle", "screen=battle&match=audit-match&view=play", ".battle-dashboard"],
  ["map", "screen=battle&match=audit-match&view=map", "#battle-map-svg"],
  ["tournaments", "screen=tournaments&character=wong", "#at-character-list"],
];
for (const [name, hash, ready] of scenes)
  test(`WCAG automatic checks: ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await seed(page);
    await open(page, hash, ready);
    if (name === "editor") {
      // Audit with the sticky actions in normal flow rather than covering a
      // partially visible row at this viewport's arbitrary scroll position.
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
    }
    await accessible(page, name);
  });

test("dialog names, contrast and scrollable journal remain accessible in interactive states", async ({
  page,
}) => {
  test.setTimeout(120000);
  await seed(page);
  await page.setViewportSize({ width: 820, height: 1180 });
  await open(page, "screen=rosters", ".roster-tile");
  await page.getByRole("button", { name: "Группы", exact: true }).click();
  await accessible(page, "groups");
  await page.keyboard.press("Escape");
  await page.locator('nav [data-action="data"]').click();
  await accessible(page, "data");
  await page.keyboard.press("Escape");
  await open(page, "screen=catalog&card=ant-man", "#character-dialog .sc-card");
  await accessible(page, "character");
  await page.locator(".character-tactic-open").first().click();
  await expect(
    page.getByRole("dialog", { name: "Pym Particles", exact: true }),
  ).toBeVisible();
  await accessible(page, "tactic");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await open(
    page,
    "screen=battle&match=audit-match&view=play",
    ".battle-dashboard",
  );
  await page
    .getByRole("button", { name: "Состояния +", exact: true })
    .first()
    .click();
  for (const item of await page.locator(".condition-grid button").all())
    if (!(await item.getAttribute("class"))?.includes("selected"))
      await item.click();
  await accessible(page, "conditions");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Журнал", exact: true }).click();
  await accessible(page, "log");
  await page.locator(".battle-log-list").focus();
  await page.keyboard.press("End");
  await expect
    .poll(() => page.locator(".battle-log-list").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await open(page, "screen=battle", ".network-home");
  await page
    .getByRole("button", { name: "Создать совместный бой", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Создать совместный бой", exact: true }),
  ).toBeVisible();
  await accessible(page, "peer");
  await page.keyboard.press("Escape");
  await open(page, "screen=tournaments&character=wong", "#at-character-list");
  await page.locator("#at-player-picker").click();
  await accessible(page, "players");
  await page.keyboard.press("Escape");
  await page.locator("#at-affiliation-picker").click();
  await accessible(page, "affiliations");
});

test("tabs support arrows, Home and End while keeping one Tab stop and labelled panels", async ({
  page,
}) => {
  await seed(page);
  await open(page, "screen=rosters&roster=audit-r0", "#editor-name");
  const tabs = page.getByRole("tablist", {
    name: "Состав ростера",
    exact: true,
  });
  await tabs.getByRole("tab", { name: /Персонажи/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: /Тактики/ })).toBeFocused();
  await expect(tabs.getByRole("tab", { name: /Тактики/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel", { name: /Тактики/ })).toBeVisible();
  expect(await tabs.locator('[tabindex="0"]').count()).toBe(1);
  await page.keyboard.press("End");
  await expect(tabs.getByRole("tab", { name: /Кризисы/ })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(tabs.getByRole("tab", { name: /Персонажи/ })).toBeFocused();
  await open(
    page,
    "screen=battle&match=audit-match&view=play",
    ".battle-dashboard",
  );
  const sides = page.getByRole("tablist", { name: "Сторона боя", exact: true });
  await sides.getByRole("tab", { name: /Мои/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(sides.getByRole("tab", { name: /Противник/ })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: /Противник/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Карта и расстояния", exact: true })
    .click();
  const modes = page.getByRole("tablist", {
    name: "Режим расстояний",
    exact: true,
  });
  await modes.getByRole("tab", { name: "До объектов", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    modes.getByRole("tab", { name: "До краёв и стартовых зон", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("tabpanel", {
      name: "До краёв и стартовых зон",
      exact: true,
    }),
  ).toBeVisible();
});

test("keyboard skips chrome, stays inside nested dialogs and returns to its opener", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 820, height: 1180 });
  await open(page, "screen=catalog&q=Wong", "#characters .character-row");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Перейти к содержимому", exact: true }),
  ).toBeFocused();
  const url = page.url();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page).toHaveURL(url);
  const row = page.locator("#characters .row-open").first();
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Закрыть карточку", exact: true }),
  ).toBeFocused();
  const box = page.locator("#character-dialog [data-box-code]").first();
  await box.focus();
  await page.keyboard.press("Enter");
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => document.activeElement.closest("dialog")?.id),
    ).toBe("box-set-dialog");
  }
  await page.keyboard.press("Escape");
  await expect(box).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(row).toBeFocused();
  const data = page.locator('nav [data-action="data"]');
  await data.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Закрыть данные", exact: true }),
  ).toBeFocused();
  await page.locator("#import-file").setInputFiles({
    name: "acceptance.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture())),
  });
  await expect(
    page.getByRole("button", { name: "Закрыть восстановление", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(data).toBeFocused();
});

test("focused editor actions stay visible above sticky chrome and footer", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 1194, height: 834 });
  await open(page, "screen=rosters&roster=audit-r0", "#editor-name");
  await page.locator("#editor-name").focus();
  for (let i = 0; i < 42; i++) {
    await page.keyboard.press("Tab");
    const state = await page.evaluate(() => {
      const el = document.activeElement,
        r = el.getBoundingClientRect(),
        x = Math.max(1, Math.min(innerWidth - 1, r.x + r.width / 2)),
        y = Math.max(1, Math.min(innerHeight - 1, r.y + r.height / 2));
      return {
        tag: el.tagName,
        label: el.getAttribute("aria-label") || el.textContent?.slice(0, 70),
        visible:
          r.bottom > 0 &&
          r.top < innerHeight &&
          r.right > 0 &&
          r.left < innerWidth,
        uncovered: (() => {
          const top = document.elementFromPoint(x, y);
          return !!top && (el === top || el.contains(top));
        })(),
      };
    });
    expect(state.visible, JSON.stringify(state)).toBe(true);
    expect(state.uncovered, JSON.stringify(state)).toBe(true);
  }
});

for (const [name, hash, ready] of scenes)
  test(`200 percent layout equivalent: ${name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 410, height: 590 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await seed(page);
    try {
      await open(page, hash, ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(411);
      const meta = await page
        .locator('meta[name="viewport"]')
        .getAttribute("content");
      expect(meta).not.toMatch(
        /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\D|$)/,
      );
      if (name === "editor") {
        await page
          .getByRole("button", { name: "Сохранить ростер", exact: true })
          .focus();
        const r = await page
          .getByRole("button", { name: "Сохранить ростер", exact: true })
          .boundingBox();
        expect(r.y + r.height).toBeLessThanOrEqual(590);
      }
      await page.screenshot({ path: `previews/acceptance/zoom-${name}.png` });
    } finally {
      await context.close();
    }
  });

test("group editor stays usable when available tablet height shrinks", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 820, height: 1180 });
  await open(page, "screen=rosters", ".roster-tile");
  await page.getByRole("button", { name: "Группы", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Новая группа", exact: true })
    .click();
  const input = page.getByRole("textbox", {
    name: "Название группы",
    exact: true,
  });
  await input.fill("Клавиатура");
  await page.setViewportSize({ width: 820, height: 600 });
  await input.focus();
  const r = await input.boundingBox();
  expect(r.y).toBeGreaterThan(0);
  expect(r.y + r.height).toBeLessThan(600);
  await input.press("Enter");
  await expect(page.locator(".group-manager")).toBeVisible();
});

test("first-time roster and local battle can be completed through visible labels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await open(page, "screen=rosters");
  await page
    .getByRole("button", { name: "Новый ростер +", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Название ростера", exact: true })
    .fill("Первый ростер");
  await page.getByRole("button", { name: "+ Добавить", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Поиск для добавления", exact: true })
    .fill("Wong");
  await page.getByRole("checkbox", { name: /Портрет Wong/ }).check();
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await page
    .getByRole("button", { name: "Сохранить ростер", exact: true })
    .click();
  await page.getByRole("button", { name: "Бой →", exact: true }).click();
  await page
    .getByRole("button", { name: "Выбрать из моего ростера +", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Wong/ }).check();
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await page.getByRole("button", { name: "Начать бой →", exact: true }).click();
  await expect(page.locator(".battle-dashboard")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Wong", exact: true }),
  ).toBeVisible();
});

test("ordinary control boundaries and keyboard focus have sufficient contrast", async ({
  page,
}) => {
  await open(page, "screen=catalog&q=Wong", "#search");
  const colors = await page.locator("#search").evaluate((el) => {
    const s = getComputedStyle(el);
    return { border: s.borderTopColor, background: s.backgroundColor };
  });
  function luminance(color) {
    const rgb = color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((n) => {
        n /= 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }
  function ratio(a, b) {
    const l1 = luminance(a),
      l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  expect(ratio(colors.border, colors.background)).toBeGreaterThanOrEqual(3);
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement);
    return {
      outline: s.outlineColor,
      width: parseFloat(s.outlineWidth),
      style: s.outlineStyle,
      canvas: getComputedStyle(document.body).backgroundColor,
    };
  });
  expect(focus.style).not.toBe("none");
  expect(focus.width).toBeGreaterThanOrEqual(2);
  expect(ratio(focus.outline, focus.canvas)).toBeGreaterThanOrEqual(3);
});

test("Chromium permits 200 percent pinch magnification without a restrictive viewport", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Native emulation command is Chromium-only; reflow scenarios run on both engines.",
  );
  await page.setViewportSize({ width: 820, height: 1180 });
  await open(page, "screen=catalog&q=Wong", "#search");
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  await expect.poll(() => page.evaluate(() => visualViewport.scale)).toBe(2);
  expect(await page.evaluate(() => visualViewport.width)).toBeLessThanOrEqual(
    411,
  );
  await page.screenshot({ path: "previews/acceptance/pinch-200.png" });
  await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  await session.detach();
});

test("keyboard entry into a new editor announces its heading without resetting to the site navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await open(page, "screen=rosters");
  const create = page.getByRole("button", {
    name: "Новый ростер +",
    exact: true,
  });
  await create.focus();
  await create.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Новый ростер", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Код ростера", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Ростер по коду", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "← К ростерам", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("textbox", { name: "Название ростера", exact: true }),
  ).toBeFocused();
});
