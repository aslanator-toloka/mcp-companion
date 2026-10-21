const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const React = require("react"),
  { renderToStaticMarkup: render } = require("react-dom/server");
const catalog = JSON.parse(fs.readFileSync("data/catalog.json")),
  ctx = { window: {} };
for (const file of [
  "card-layout.js",
  "card-art.js",
  "card-skins.js",
  "game-card-data.js",
])
  vm.runInNewContext(fs.readFileSync(file, "utf8"), ctx);
global.__cardFixture = {
  catalog: { byId: new Map(catalog.characters.map((c) => [c.slug, c])) },
  cardViews: {
    metadata: {
      layout: ctx.window.MCP_CARD_LAYOUT,
      art: ctx.window.MCP_CARD_ART,
      skins: ctx.window.MCP_CARD_SKINS,
      game: ctx.window.MCP_GAME_CARD_DATA,
      conditions: require("../card-conditions.js").definitions,
    },
    layers: new Map(),
    views: new Map(),
  },
};
let Cards;
test.before(async () => {
  const esbuild = require("esbuild"),
    target = path.resolve("node_modules/.cache/mcp-native-tests.cjs");
  await esbuild.build({
    entryPoints: ["frontend/src/cards.jsx"],
    outfile: target,
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["react", "react-dom", "mobx", "mobx-react-lite"],
    plugins: [
      {
        name: "pure-view-fixture",
        setup(build) {
          build.onResolve({ filter: /stores\/index.js$/ }, () => ({
            path: "fixture",
            namespace: "fixture",
          }));
          build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents:
              "export const catalog=globalThis.__cardFixture.catalog;export const cardViews=globalThis.__cardFixture.cardViews;export const actions={};",
            loader: "js",
          }));
        },
      },
    ],
  });
  Cards = require(target);
});
const h = (View, props) => render(React.createElement(View, props));
test("all structured character faces render names, statistics and every attack and power as native React elements", () => {
  let count = 0;
  for (const c of catalog.characters) {
    const detail = JSON.parse(
      fs.readFileSync("data/cards/" + c.slug + ".json"),
    );
    for (const [form, card] of [
      [0, detail.statCard],
      [1, detail.secondStatCard],
    ])
      if (card)
        for (const side of ["front", "back"]) {
          const face = card[side + "Side"];
          if (!face) continue;
          const html = h(Cards.StatCard, {
            view: { slug: c.slug, detail, form, side },
          });
          assert(html.includes("data-native-width="), c.slug);
          assert.equal(
            (html.match(/class="sc-ability sc-attack"/g) || []).length,
            (face.attacks || []).length,
            c.slug,
          );
          assert.equal(
            (html.match(/class="sc-ability sc-superpower/g) || []).length,
            (face.superPowers || []).length,
            c.slug,
          );
          for (const [key, value] of [
            ["physical", face.physicalDefense],
            ["energy", face.energyDefense],
            ["mystic", face.mysticDefense],
            ["stamina", face.stamina],
            ["speed", face.speed],
          ])
            assert(
              html.includes(
                `data-stat="${key}" aria-label="${key === "stamina" ? "Stamina" : key === "speed" ? "Speed" : key[0].toUpperCase() + key.slice(1)}: ${value ?? "—"}"`,
              ),
              `${c.slug} ${side} ${key}`,
            );
          count++;
        }
  }
  assert(count >= 480);
  console.log("React character faces checked:", count);
});
test("all independent reskin combinations preserve complete rules and stats on both faces", () => {
  const slug = "spider-man-noir",
    detail = JSON.parse(fs.readFileSync("data/cards/" + slug + ".json")),
    skin = global.__cardFixture.cardViews.metadata.skins[slug];
  skin.character = {
    front: { src: "assets/card-skins/test/front.png" },
    back: { src: "assets/card-skins/test/back.png" },
  };
  for (const side of ["front", "back"]) {
    const view = { slug, detail, form: 0, side },
      plain = h(Cards.StatCard, { view }),
      panel = (html) =>
        html.match(/<div class="sc-rules-panel">([\s\S]*?)<footer/)[1],
      stats = (html) =>
        html.match(/<div class="sc-stats">([\s\S]*?)<\/aside>/)[1];
    for (let mask = 0; mask < 8; mask++) {
      global.__cardFixture.cardViews.layers.set(slug, {
        name: !!(mask & 1),
        background: !!(mask & 2),
        character: !!(mask & 4),
      });
      const html = h(Cards.StatCard, { view });
      assert.equal(panel(html), panel(plain));
      assert.equal(stats(html), stats(plain));
      assert.equal(html.includes("sc-name-styled"), !!(mask & 1));
      assert.equal(html.includes('class="sc-skin-background"'), !!(mask & 2));
      assert.equal(html.includes("sc-art-alternative"), !!(mask & 4));
    }
  }
  global.__cardFixture.cardViews.layers.clear();
});
test("all frozen tactic/crisis faces render complete native card layouts and crisis marker counts", () => {
  const data = JSON.parse(fs.readFileSync("data/roster-cards.json"));
  let count = 0;
  for (const kind of ["tactics", "crises"])
    for (const card of data[kind])
      for (const side of ["front", "back"]) {
        const html = h(Cards.GameCard, { card, kind, side });
        assert(html.includes('class="gc-stage"'));
        assert(html.includes("gc-card gc-"));
        if (kind === "crises" && side === "front") {
          const visual =
            global.__cardFixture.cardViews.metadata.game[kind]?.[card.slug];
          if (visual?.template !== "2019") {
            const expected =
              global.__cardFixture.cardViews.metadata.game.layouts[card.setup];
            if (expected)
              assert.equal(
                (html.match(/data-objective=/g) || []).length,
                expected.length,
                card.slug,
              );
          }
        }
        count++;
      }
  assert(count >= 1100);
  console.log("React game card faces checked:", count);
});
test("rule tokens stay text-safe and condition references are keyboard-accessible buttons", () => {
  const html = h(Cards.Rule, {
    text: "<script>alert(1)</script> |*Bold &!power&| |§shock§Shock|",
  });
  assert(!html.includes("<script>"));
  assert(html.includes("&lt;script&gt;"));
  assert(html.includes("<strong>Bold"));
  assert(html.includes('data-card-condition="shock"'));
  assert(html.includes('aria-haspopup="dialog"'));
});
