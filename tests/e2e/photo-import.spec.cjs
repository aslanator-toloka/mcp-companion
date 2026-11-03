const { test, expect } = require("@playwright/test");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  express = require("express");
const Core = require("../../battle-core.js");
const { scan: axeScan, summarize } = require("../helpers/accessibility.cjs");
const root = path.resolve(__dirname, "../..");
const catalogue = JSON.parse(
  fs.readFileSync(path.join(root, "data/catalog.json")),
).characters;
const cardLists = JSON.parse(
  fs.readFileSync(path.join(root, "data/roster-cards.json")),
);
const image = (name) => path.join(root, "tests/fixtures/photo-import", name);
const library = {
  version: 1,
  owned: [],
  groups: [],
  rosters: [
    {
      id: "photo-roster",
      name: "Photo roster",
      affiliation: "Web Warriors",
      characters: ["ultimate-spider-man", "hulk"],
      tactics: ["fall-back"],
      crises: [],
      groups: [],
    },
  ],
};
const secure = cardLists.crises.find(
  (c) => c.slug === "power-overload-factory-goes-up-in-flames",
);
const extract = cardLists.crises.find(
  (c) => c.slug === "scientific-samples-found-in-discovered-universe",
);
let server, origin;
test.beforeAll(async () => {
  if (process.env.MCP_PHOTO_TEST_ORIGIN) {
    origin = process.env.MCP_PHOTO_TEST_ORIGIN;
    return;
  }
  const app = express();
  app.use("/mcp-companion", express.static(root));
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
async function seed(page, match = null) {
  await page.addInitScript(
    ({ library, match }) => {
      localStorage.setItem("mcp-companion-catalog-v1", JSON.stringify(library));
      if (match)
        localStorage.setItem(
          "mcp-companion-battles-v1",
          JSON.stringify({ version: 1, matches: [match] }),
        );
    },
    { library, match },
  );
}
// Native contract fake: exercises the real Capacitor JS proxy and plugin methods,
// but not an Android camera or ML Kit. Real WASM OCR tests below are separate.
async function native(page, texts = ["ULTIMATE SPIDER-MAN"]) {
  await page.addInitScript(
    ({ texts }) => {
      window.__nativeCalls = [];
      window.__nextTexts = [...texts];
      window.androidBridge = { postMessage() {} };
      let seq = 0;
      window.Capacitor = {
        PluginHeaders: [
          {
            name: "CardScanner",
            methods: ["choosePhotos", "recognizePhoto", "releasePhotos"].map(
              (name) => ({ name, rtype: "promise" }),
            ),
          },
        ],
        convertFileSrc: () =>
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
        nativePromise: async (plugin, method, args) => {
          window.__nativeCalls.push({ plugin, method, args });
          if (method === "choosePhotos") {
            if (window.__chooseError) {
              const e = Object.assign(Error(window.__chooseError.message), {
                code: window.__chooseError.code,
              });
              window.__chooseError = null;
              throw e;
            }
            const id = `00000000-0000-0000-0000-${String(++seq).padStart(12, "0")}`;
            return {
              photos: [
                {
                  id,
                  path: `file:///data/cache/${id}.jpg`,
                  name: "Camera photo",
                },
              ],
            };
          }
          if (method === "recognizePhoto") {
            if (window.__deferOCR)
              return new Promise((resolve) => (window.__resolveOCR = resolve));
            if (window.__ocrError) {
              window.__ocrError = false;
              throw Error("Размытое фото");
            }
            return {
              text: window.__nextTexts.shift() || texts[0],
              width: 1800,
              height: 1200,
            };
          }
          return {};
        },
      };
    },
    { texts },
  );
}
async function openRoster(page) {
  await page.goto(origin + "#screen=rosters");
  await page
    .locator('[data-rs="edit"][data-id="photo-roster"]')
    .first()
    .click();
  await expect(page.locator("#editor-name")).toHaveValue("Photo roster");
}
async function openScanner(
  page,
  kind = "characters",
  target = "roster",
  side = "opponent",
) {
  if (target === "roster" && kind !== "characters")
    await page.locator('[data-rs="tab"][data-tab="' + kind + '"]').click();
  // Most scenarios exercise the review and acquisition controls independently.
  // Direct camera entry is covered separately below.
  await page.evaluate(({ kind, target, side }) => {
    if (target === "roster") MCPStores.photoImport.openRoster(kind);
    else MCPStores.photoImport.openBattle(side, kind);
  }, { kind, target, side });
  await expect(page.locator("#photo-import-dialog")).toBeVisible();
}
async function paste(page, text) {
  const d = page.locator("#photo-import-dialog");
  await d.locator(".photo-text-import summary").click();
  await d.locator("#photo-recognized-text").fill(text);
  await d
    .getByRole("button", { name: "Найти названия в тексте", exact: true })
    .click();
}
function fixtureMatch(status = "active") {
  const m = {
    id: "photo-match",
    status,
    name: "Photo battle",
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    sourceRoster: library.rosters[0],
    threat: 99,
    round: 1,
    score: { mine: 0, opponent: 0 },
    priority: "unknown",
    mine: {
      name: "Я",
      affiliation: "",
      leader: null,
      fighters: [],
      tactics: [],
    },
    opponent: {
      name: "Противник",
      affiliation: "",
      leader: null,
      fighters: [],
      tactics: [],
    },
    secure: null,
    extract: null,
    references: {},
    undo: [],
    log: [],
  };
  const slug = "hulk",
    detail = JSON.parse(
      fs.readFileSync(path.join(root, "data/cards", slug + ".json")),
    );
  m.references[slug] = detail;
  const fighter = Core.fighter(
    catalogue.find((c) => c.slug === slug),
    detail,
    "old-hulk",
  );
  fighter.power = 7;
  fighter.hp = Math.max(1, fighter.hp - 2);
  m.opponent.fighters = [fighter];
  const tactic = cardLists.tactics.find((c) => c.slug === "fall-back");
  m.opponent.tactics = [
    { slug: tactic.slug, name: tactic.name, played: true, card: tactic },
  ];
  Core.validate({ version: 1, matches: [m] });
  return m;
}
async function openBattle(page) {
  await page.goto(origin + "#screen=battle");
  await page.locator('[data-bt="open"][data-id="photo-match"]').click();
  await page.locator('[data-bt="team"][data-side="opponent"]').first().click();
}

test("native camera contract: confirmation, additive roster, saved persistence and cache release", async ({
  page,
}) => {
  await seed(page);
  await native(page, ["ULTIMATE SPIDER-MAN\nBLACK CAT"]);
  await openRoster(page);
  await openScanner(page);
  await page
    .getByRole("button", { name: "Сфотографировать", exact: true })
    .click();
  await expect(page.locator('[data-photo-card="black-cat"]')).toBeVisible();
  expect(await page.evaluate(() => MCPStores.rosters.draft.characters)).toEqual(
    ["ultimate-spider-man", "hulk"],
  );
  await expect(
    page.locator('[data-photo-card="ultimate-spider-man"]'),
  ).toContainText("Уже есть");
  await page
    .getByRole("button", { name: "Добавить в ростер", exact: true })
    .click();
  await expect(page.locator("#photo-import-dialog")).not.toBeVisible();
  expect(await page.evaluate(() => MCPStores.rosters.draft.characters)).toEqual(
    ["ultimate-spider-man", "hulk", "black-cat"],
  );
  const calls = await page.evaluate(() => __nativeCalls);
  expect(
    calls.some(
      (c) => c.method === "choosePhotos" && c.args.source === "camera",
    ),
  ).toBe(true);
  expect(calls.some((c) => c.method === "releasePhotos")).toBe(true);
  await page.locator('[data-rs="save"]').click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("mcp-companion-catalog-v1"),
        ).rosters.find((r) => r.id === "photo-roster").characters,
    ),
  ).toContain("black-cat");
});
for (const [kind, text, slug] of [
  ["tactics", "CLONE SAGA", "clone-saga"],
  ["crises", "POWER OVERLOAD! FACTORY GOES UP IN FLAMES", secure.slug],
])
  test(`native ${kind} scanner resolves cards and updates only its roster section`, async ({
    page,
  }) => {
    await seed(page);
    await native(page, [text]);
    await openRoster(page);
    await openScanner(page, kind);
    await page
      .getByRole("button", { name: "Выбрать фото", exact: true })
      .click();
    await expect(page.locator(`[data-photo-card="${slug}"]`)).toBeVisible();
    await page
      .getByRole("button", { name: "Добавить в ростер", exact: true })
      .click();
    expect(
      await page.evaluate((kind) => MCPStores.rosters.draft[kind], kind),
    ).toContain(slug);
    expect(
      await page.evaluate(() => MCPStores.rosters.draft.characters.length),
    ).toBe(2);
  });

test("uncertain names are preselected; keyboard catalogue search adds missing characters", async ({
  page,
}) => {
  await seed(page);
  await native(page, ["SPIDER-MAN N0IR"]);
  await openRoster(page);
  await openScanner(page);
  await page
    .getByRole("button", { name: "Сфотографировать", exact: true })
    .click();
  const row = page.locator('[data-photo-card="spider-man-noir"]');
  await expect(row).toContainText("Проверьте название");
  await expect(
    page.getByRole("button", { name: "Добавить в ростер", exact: true }),
  ).toBeEnabled();
  await expect(row.getByRole("checkbox")).toBeChecked();
  const q = page.locator("#photo-card-search");
  await q.fill("wong");
  await q.press("ArrowDown");
  await q.press("Enter");
  await expect(page.locator('[data-photo-card="wong"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Добавить в ростер", exact: true })
    .click();
  expect(await page.evaluate(() => MCPStores.rosters.draft.characters)).toEqual(
    ["ultimate-spider-man", "hulk", "spider-man-noir", "wong"],
  );
});

test("multiple native photos deduplicate, preserve explicit unchecks and remove evidence", async ({
  page,
}) => {
  await seed(page);
  await native(page, ["BLACK CAT", "BLACK CAT\nWONG"]);
  await openRoster(page);
  await openScanner(page);
  await page.getByRole("button", { name: "Выбрать фото", exact: true }).click();
  const cat = page.locator('[data-photo-card="black-cat"]');
  await expect(cat).toBeVisible();
  await cat.getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "Выбрать фото", exact: true }).click();
  await expect(page.locator(".photo-source")).toHaveCount(2);
  await expect(cat.getByRole("checkbox")).not.toBeChecked();
  await expect(page.locator('[data-photo-card="wong"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Убрать фото 2", exact: true })
    .click();
  await expect(page.locator('[data-photo-card="wong"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "Закрыть распознавание", exact: true })
    .click();
  expect(
    await page.evaluate(() => MCPStores.rosters.draft.characters.length),
  ).toBe(2);
});

test("camera cancellation and errors keep the draft unchanged and allow gallery retry", async ({
  page,
}) => {
  await seed(page);
  await native(page, ["BLACK CAT"]);
  await openRoster(page);
  await openScanner(page);
  await page.evaluate(
    () =>
      (window.__chooseError = { code: "SCAN_CANCELLED", message: "Cancelled" }),
  );
  await page
    .getByRole("button", { name: "Сфотографировать", exact: true })
    .click();
  await expect(page.locator(".photo-progress")).toHaveCount(0);
  await expect(page.locator(".photo-error")).toHaveCount(0);
  await page.evaluate(
    () =>
      (window.__chooseError = {
        code: "PHOTO_PICK_FAILED",
        message: "Камера недоступна",
      }),
  );
  await page
    .getByRole("button", { name: "Сфотографировать", exact: true })
    .click();
  await expect(page.locator(".photo-error")).toContainText("Камера недоступна");
  await page.getByRole("button", { name: "Выбрать фото", exact: true }).click();
  await expect(page.locator('[data-photo-card="black-cat"]')).toBeVisible();
});

test("late native OCR after cancel cannot mutate another roster section", async ({
  page,
}) => {
  await seed(page);
  await native(page);
  await openRoster(page);
  await openScanner(page);
  await page.evaluate(() => (window.__deferOCR = true));
  await page
    .getByRole("button", { name: "Сфотографировать", exact: true })
    .click();
  await expect(page.locator(".photo-progress")).toBeVisible();
  await page
    .getByRole("button", { name: "Отменить распознавание", exact: true })
    .click();
  await openScanner(page, "tactics");
  await page.evaluate(() => {
    window.__deferOCR = false;
    window.__resolveOCR({ text: "BLACK CAT" });
  });
  await expect(page.locator(".photo-result")).toHaveCount(0);
  expect(
    await page.evaluate(() => MCPStores.rosters.draft.characters.length),
  ).toBe(2);
});

test("unreadable native image remains retryable and rotation is passed to the plugin", async ({
  page,
}) => {
  await seed(page);
  await native(page, ["BLACK CAT"]);
  await openRoster(page);
  await openScanner(page);
  await page.evaluate(() => (window.__ocrError = true));
  await page
    .getByRole("button", { name: "Сфотографировать", exact: true })
    .click();
  await expect(page.locator(".photo-source")).toContainText("Не прочитано");
  await page
    .getByRole("button", {
      name: "Повернуть фото 1 вправо и распознать снова",
      exact: true,
    })
    .click();
  await expect(page.locator('[data-photo-card="black-cat"]')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        __nativeCalls.filter((c) => c.method === "recognizePhoto").at(-1).args
          .rotation,
    ),
  ).toBe(90);
});

for (const [kind, file, expected] of [
  [
    "characters",
    "characters.jpg",
    ["ultimate-spider-man", "amazing-spider-man"],
  ],
  ["tactics", "tactic.jpg", ["clone-saga"]],
  ["crises", "crisis.jpg", [secure.slug]],
])
  test(`real offline WASM OCR reads ${kind} from a card image without sending it to any server`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await seed(page);
    const errors = [],
      external = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (
        !["127.0.0.1", "localhost"].includes(u.hostname) &&
        !["data:", "blob:"].includes(u.protocol)
      ) {
        external.push(u.origin);
        return route.abort();
      }
      return route.continue();
    });
    await openRoster(page);
    await openScanner(page, kind);
    await page
      .locator('input[aria-label="Фотографии карт"]')
      .setInputFiles(image(file));
    await expect(page.locator(".photo-progress")).toHaveCount(0, {
      timeout: 100000,
    });
    await expect(page.locator(".photo-source-error")).toHaveCount(0);
    for (const slug of expected) {
      const row = page.locator(`[data-photo-card="${slug}"]`);
      await expect(row).toBeVisible();
      if (!(await row.getByRole("checkbox").isChecked()))
        await row.getByRole("checkbox").check();
    }
    await page
      .getByRole("button", { name: "Добавить в ростер", exact: true })
      .click();
    const slugs = await page.evaluate(
      (kind) => MCPStores.rosters.draft[kind],
      kind,
    );
    for (const slug of expected) expect(slugs).toContain(slug);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

test("bad uploads are explained without discarding an earlier successful result", async ({
  page,
}) => {
  await seed(page);
  await native(page, ["BLACK CAT"]);
  await openRoster(page);
  await openScanner(page);
  await page
    .getByRole("button", { name: "Сфотографировать", exact: true })
    .click();
  await expect(page.locator('[data-photo-card="black-cat"]')).toBeVisible();
  // Use the browser upload handler in this native-contract context to exercise validation.
  await page.locator('input[aria-label="Фотографии карт"]').setInputFiles({
    name: "not-a-photo.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(page.locator(".photo-error")).toContainText(
    "Выберите фотографию",
  );
  await expect(page.locator('[data-photo-card="black-cat"]')).toBeVisible();
});

test("keyboard focus, Escape return, named controls and accessibility in scanner", async ({
  page,
}) => {
  await seed(page);
  await native(page, ["BLACK CAT"]);
  await openRoster(page);
  const opener = page.locator('[data-photo-kind="characters"]');
  await opener.focus();
  await opener.press("Enter");
  await expect(
    page.getByRole("button", { name: "Сфотографировать", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Сфотографировать", exact: true })
    .click();
  await expect(page.locator('[data-photo-card="black-cat"]')).toBeVisible();
  expect(summarize(await axeScan(page))).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.locator("#photo-import-dialog")).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test("Pixel-sized layout preserves complete controls, scrolling and a visible confirmation action", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  try {
    await seed(page);
    await native(page, [secure.name]);
    await openRoster(page);
    await openScanner(page, "crises");
    await page
      .getByRole("button", { name: "Сфотографировать", exact: true })
      .click();
    await expect(
      page.locator(`[data-photo-card="${secure.slug}"]`),
    ).toBeVisible();
    expect(
      await page.evaluate(() => {
        const d = document.querySelector("#photo-import-dialog");
        return d.scrollWidth <= d.clientWidth + 1;
      }),
    ).toBe(true);
    const apply = page.getByRole("button", {
      name: "Добавить в ростер",
      exact: true,
    });
    await expect(apply).toBeInViewport();
    const box = await apply.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: path.join(root, "previews/photo-import/pixel-scanner.png"),
    });
    await apply.click();
    expect(await page.evaluate(() => MCPStores.rosters.draft.crises)).toContain(
      secure.slug,
    );
  } finally {
    await context.close();
  }
});

test("active opponent character import preserves HP/power and one undo removes the whole batch", async ({
  page,
}) => {
  const match = fixtureMatch();
  await seed(page, match);
  await native(page, ["HULK\nWONG\nBLACK CAT"]);
  await openBattle(page);
  await openScanner(page, "characters", "battle", "opponent");
  await page
    .getByRole("button", { name: "Сфотографировать", exact: true })
    .click();
  await expect(page.locator('[data-photo-card="black-cat"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Добавить в бой", exact: true })
    .click();
  const fighters = await page.evaluate(
    () => MCPStores.battle.current.opponent.fighters,
  );
  expect(fighters).toHaveLength(3);
  expect(fighters.find((f) => f.slug === "hulk").power).toBe(7);
  expect(fighters.find((f) => f.slug === "hulk").hp).toBe(
    match.opponent.fighters[0].hp,
  );
  await page.locator('[data-bt="undo"]').click();
  expect(
    await page.evaluate(
      () => MCPStores.battle.current.opponent.fighters.length,
    ),
  ).toBe(1);
});

test("battle tactics stay unplayed on import and existing played cards are untouched", async ({
  page,
}) => {
  await seed(page, fixtureMatch());
  await native(page, ["FALL BACK\nCLONE SAGA"]);
  await openBattle(page);
  await openScanner(page, "tactics", "battle", "opponent");
  await page.getByRole("button", { name: "Выбрать фото", exact: true }).click();
  await expect(page.locator('[data-photo-card="clone-saga"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Добавить в бой", exact: true })
    .click();
  const tactics = await page.evaluate(
    () => MCPStores.battle.current.opponent.tactics,
  );
  expect(tactics.find((t) => t.slug === "fall-back").played).toBe(true);
  expect(tactics.find((t) => t.slug === "clone-saga").played).toBe(false);
});

test("battle crisis scan filters type, warns before replacement and keeps the other mission", async ({
  page,
}) => {
  const match = fixtureMatch();
  match.secure = cardLists.crises.find(
    (c) => c.slug === "infinity-formula-goes-missing-ca09",
  );
  match.extract = extract;
  const otherExtract = cardLists.crises.find(
    (c) => c.slug === "spider-infected-invade-manhattan-ca09",
  );
  await seed(page, match);
  await native(page, [secure.name + "\n" + otherExtract.name]);
  await openBattle(page);
  await page.locator('[data-bt="missions"]').first().click();
  await page
    .locator('.mission-choice[data-kind="secure"] [data-photo-kind="crises"]')
    .click();
  await page
    .getByRole("button", { name: "Сфотографировать", exact: true })
    .click();
  await expect(
    page.locator(`[data-photo-card="${secure.slug}"]`),
  ).toBeVisible();
  await expect(page.locator("#photo-import-dialog")).toContainText(
    "Будут заменены миссии",
  );
  await expect(
    page.locator(`[data-photo-card="${otherExtract.slug}"]`),
  ).toContainText("Другой тип кризиса");
  await page
    .getByRole("button", { name: "Добавить в бой", exact: true })
    .click();
  expect(await page.evaluate(() => MCPStores.battle.current.secure.slug)).toBe(
    secure.slug,
  );
  expect(await page.evaluate(() => MCPStores.battle.current.extract.slug)).toBe(
    extract.slug,
  );
});

test("own-side photo scan cannot import a character outside the saved source roster", async ({
  page,
}) => {
  await seed(page, fixtureMatch());
  await native(page, ["ULTIMATE SPIDER-MAN\nBLACK CAT"]);
  await openBattle(page);
  await page.locator('[data-bt="team"][data-side="mine"]').first().click();
  await openScanner(page, "characters", "battle", "mine");
  await page
    .getByRole("button", { name: "Сфотографировать", exact: true })
    .click();
  await expect(page.locator('[data-photo-card="black-cat"]')).toContainText(
    "Нет в ростере этой стороны",
  );
  await expect(
    page.locator('[data-photo-card="black-cat"] input'),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Добавить в бой", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      MCPStores.battle.current.mine.fighters.map((f) => f.slug),
    ),
  ).toEqual(["ultimate-spider-man"]);
});

test("cancelling a real running WASM worker releases it and a new scan still works", async ({
  page,
}) => {
  test.setTimeout(120000);
  await seed(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openRoster(page);
  await openScanner(page, "characters");
  await page
    .locator('input[aria-label="Фотографии карт"]')
    .setInputFiles(image("characters.jpg"));
  await page.waitForFunction(
    () => !!MCPStores.photoImport.recognizer.worker,
    null,
    { timeout: 45000 },
  );
  await page
    .getByRole("button", { name: "Отменить распознавание", exact: true })
    .click();
  await expect(page.locator("#photo-import-dialog")).not.toBeVisible();
  await openScanner(page, "tactics");
  await page
    .locator('input[aria-label="Фотографии карт"]')
    .setInputFiles(image("tactic.jpg"));
  await expect(page.locator(".photo-progress")).toHaveCount(0, {
    timeout: 90000,
  });
  await expect(page.locator('[data-photo-card="clone-saga"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Закрыть распознавание", exact: true })
    .click();
  expect(
    await page.evaluate(() => MCPStores.photoImport.recognizer.pending.size),
  ).toBe(0);
  expect(await page.evaluate(() => MCPStores.rosters.draft.characters)).toEqual(
    library.rosters[0].characters,
  );
  expect(errors).toEqual([]);
});

for (const target of ["roster", "battle"]) {
  test(`${target} photo entry opens the native camera immediately`, async ({ page }) => {
    await seed(page, target === "battle" ? fixtureMatch() : null);
    await native(page, ["BLACK CAT"]);
    if (target === "battle") await openBattle(page);
    else await openRoster(page);
    await page.locator(`[data-photo-target="${target}"][data-photo-kind="characters"]${target === "battle" ? '[data-photo-side="opponent"]' : ''}`).first().click();
    await expect(page.locator('[data-photo-card="black-cat"]')).toBeVisible();
    expect(await page.evaluate(() => __nativeCalls.filter(c => c.method === "choosePhotos").map(c => c.args.source))).toEqual(["camera"]);
  });
}
test("empty roster name is highlighted, focused and explained until corrected", async ({ page }) => {
  await seed(page);
  await openRoster(page);
  const name = page.locator("#editor-name");
  await name.fill("   ");
  await page.locator('[data-rs="save"]').click();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
  await expect(page.locator("#editor-name-error")).toHaveText("Введите название ростера.");
  await page.locator("#editor-affiliation").selectOption({ index: 1 });
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await name.fill("Исправленный ростер");
  await expect(name).not.toHaveAttribute("aria-invalid", "true");
  await page.locator('[data-rs="save"]').click();
  await expect(page.locator('[data-rs="edit"]').filter({ hasText: "Исправленный ростер" }).first()).toBeVisible();
});
