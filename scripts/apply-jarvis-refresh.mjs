// Apply a complete public-API capture to the canonical Pages data.
// Usage: node scripts/apply-jarvis-refresh.mjs /path/to/capture
// Capture contains characters/tactics/crises/boxes/artworks.json, cards/, boxes/, layouts/.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
const input = process.argv[2];
if (!input) throw Error("Supply the public Jarvis capture directory");
const read = (name) => JSON.parse(fs.readFileSync(path.join(input, name)));
const write = (name, value) =>
  fs.writeFileSync(name, JSON.stringify(value, null, 2) + "\n");
const previous = JSON.parse(fs.readFileSync("data/catalog.json"));
const oldCharacters = new Map(previous.characters.map((c) => [c.slug, c]));
const capturedCharacters = read("characters.json");
const mainSculpts = new Map(
  capturedCharacters.map((c) => [c.slug, c.mainCharacterSlug || c.slug]),
);
const rawCharacters = capturedCharacters.filter((c) => !c.isAlternateSculpt);
const latest = new Map(rawCharacters.map((c) => [c.slug, c]));
for (const slug of oldCharacters.keys())
  if (!latest.has(slug)) throw Error("Missing existing character: " + slug);
const now = new Date().toISOString(),
  details = new Map(),
  changes = [];
const fields = [
  "slug",
  "name",
  "alterEgo",
  "threatLevel",
  "stamina",
  "speed",
  "size",
  "baseSize",
  "physicalDefense",
  "energyDefense",
  "mysticDefense",
  "isGrunt",
  "secondFormSlug",
  "secondFormBaseSize",
  "boxSets",
  "tags",
  "version",
  "releaseDate",
  "actAs",
];
const characters = rawCharacters.map((raw) => {
  const detail = read("cards/" + raw.slug + ".json");
  if (!detail.statCard?.frontSide) throw Error("Incomplete card: " + raw.slug);
  const card = {
    statCard: detail.statCard,
    secondStatCard: detail.secondStatCard || null,
  };
  const oldPath = "data/cards/" + raw.slug + ".json";
  if (
    !fs.existsSync(oldPath) ||
    JSON.stringify(JSON.parse(fs.readFileSync(oldPath))) !==
      JSON.stringify(card)
  )
    changes.push(raw.slug);
  details.set(raw.slug, card);
  const c = Object.fromEntries(fields.map((k) => [k, raw[k] ?? null]));
  c.affiliations = raw.affiliations.map((a) =>
    Object.fromEntries(
      ["name", "slug", "isLeader", "timelines", "isLeaderWithTeamTactics"].map(
        (k) => [k, a[k] ?? (k === "timelines" ? [] : false)],
      ),
    ),
  );
  c.sourceUrl = "https://www.jarvis-protocol.com/characters/" + c.slug;
  c.portrait = fs.existsSync("assets/avatars/" + c.slug + ".png")
    ? "assets/avatars/" + c.slug + ".png"
    : oldCharacters.get(c.slug)?.portrait || null;
  c.cardAvailable = true;
  const attacks = Object.values(card)
    .filter(Boolean)
    .flatMap((form) =>
      [form.frontSide, form.backSide]
        .filter(Boolean)
        .flatMap((face) => face.attacks || []),
    );
  c.attacks = [
    ...new Map(
      attacks.map((a) => {
        const row = { type: a.type, range: a.range, strength: a.strength };
        return [JSON.stringify(row), row];
      }),
    ).values(),
  ];
  return c;
});
const oldRoster = JSON.parse(fs.readFileSync("data/roster-cards.json"));
const cardFields = [
  "slug",
  "name",
  "type",
  "cardFamily",
  "updatedBy",
  "replacedBy",
  "replaces",
  "variantOf",
  "isInfinityGem",
  "affiliation",
  "body",
  "secondaryBody",
  "intermediaryBody",
  "paragraphs",
  "threatLevel",
  "setup",
  "setupDescription",
  "scoringDescription",
  "standardTimelineStatus",
  "extendedTimelineStatus",
  "setSymbol",
  "latestSetSymbol",
  "requirementsItems",
  "challengerStatus",
  "challengerRotatesInOn",
  "challengerRotatesOutOn",
];
const roster = { source: previous.source, fetchedAt: now };
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync("game-card-data.js", "utf8"), ctx);
const game = ctx.window.MCP_GAME_CARD_DATA;
const visuals = [
  "artist",
  "repeatType",
  "doubleSided",
  "template",
  "squished",
  "biggerIcons",
  "attacks",
  "superPowers",
  "subTypes",
  "event",
];
const artworks = read("artworks.json");
for (const kind of ["tactics", "crises"]) {
  const raw = read(kind + ".json"),
    ids = new Set(raw.map((c) => c.slug));
  for (const old of oldRoster[kind])
    if (!ids.has(old.slug)) throw Error("Missing existing card: " + old.slug);
  roster[kind] = raw.map((c) =>
    Object.fromEntries(cardFields.map((k) => [k, c[k] ?? null])),
  );
  game[kind] = {};
  for (const c of raw) {
    const visual = Object.fromEntries(
      visuals.filter((k) => k in c).map((k) => [k, c[k]]),
    );
    if (kind === "tactics") {
      const choices = artworks[c.cardFamily] || [],
        selected =
          choices.find((a) => a.name === c.cardFamily) ||
          choices.find((a) => a.main);
      visual.artUrl = selected
        ? "https://d15s9aja3f2wkq.cloudfront.net/card_backs/" +
          selected.name +
          ".png"
        : null;
      if (selected) visual.artist = selected.artist || c.artist;
    }
    game[kind][c.slug] = visual;
  }
}
roster.challengerSource = {
  url: "https://www.jarvis-protocol.com/api/crisis_cards",
  fetchedAt: now,
};
const oldBoxes = JSON.parse(fs.readFileSync("data/box-sets.json")),
  byCode = new Map(oldBoxes.sets.map((b) => [b.code, b]));
const sets = read("boxes.json")
  .map((row) => {
    const detail = read("boxes/" + row.code + ".json"),
      old = byCode.get(row.code);
    if (detail.code !== row.code) throw Error("Invalid box " + row.code);
    return {
      code: row.code,
      name: row.name,
      type: row.type,
      releaseDate: row.releaseDate ?? null,
      characters: (detail.content || [])
        .filter((c) => c.itemType === "Character")
        .map((c) => ({
          slug: mainSculpts.get(c.itemSlug) || c.itemSlug,
          ...(mainSculpts.get(c.itemSlug) &&
          mainSculpts.get(c.itemSlug) !== c.itemSlug
            ? { sourceSlug: c.itemSlug }
            : {}),
          name: c.name,
          amount: c.amount ?? 1,
        })),
      image: old?.image || null,
      sourceUrl: "https://www.jarvis-protocol.com/box-sets/" + row.code,
      imageError: old?.imageError || null,
    };
  })
  .sort(
    (a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()) ||
      a.code.localeCompare(b.code),
  );
// Preserve the existing source-specific art placement; require a fresh capture for changed faces.
for (const [filename, global] of [
  ["card-layout.js", "MCP_CARD_LAYOUT"],
  ["card-art.js", "MCP_CARD_ART"],
]) {
  const c = { window: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), c);
  const output = c.window[global];
  for (const slug of changes) {
    const capture = read("layouts/" + slug + ".json");
    output[slug] =
      global === "MCP_CARD_LAYOUT"
        ? capture
        : capture.map((form) =>
            Object.fromEntries(
              Object.entries(form)
                .filter(([, face]) => face.art.url)
                .map(([side, face]) => [side, face.art.url]),
            ),
          );
  }
  fs.writeFileSync(
    filename,
    "/* Presentation metadata captured from Jarvis; rules are local structured JSON. */\nwindow." +
      global +
      "=" +
      JSON.stringify(output) +
      ";\n",
  );
}
for (const [slug, card] of details) {
  const target = "data/cards/" + slug + ".json";
  if (
    !fs.existsSync(target) ||
    JSON.stringify(JSON.parse(fs.readFileSync(target))) !== JSON.stringify(card)
  )
    fs.writeFileSync(target, JSON.stringify(card) + "\n");
}
write("data/catalog.json", {
  source: previous.source,
  fetchedAt: now,
  searchMetadataUpdatedAt: now,
  characters,
});
write("data/roster-cards.json", roster);
write("data/box-sets.json", { source: oldBoxes.source, fetchedAt: now, sets });
fs.writeFileSync(
  "game-card-data.js",
  "/* Presentation metadata from the same public snapshot as local card rules. */\nwindow.MCP_GAME_CARD_DATA=" +
    JSON.stringify(game) +
    ";\n",
);
write("data/refresh-audit.json", {
  source: previous.source,
  fetchedAt: now,
  characters: characters.length,
  addedCharacters: characters
    .filter((c) => !oldCharacters.has(c.slug))
    .map((c) => ({ slug: c.slug, name: c.name })),
  updatedCharacterCards: changes.filter((s) => oldCharacters.has(s)),
  tactics: roster.tactics.length,
  addedTactics: roster.tactics
    .filter((c) => !oldRoster.tactics.some((old) => old.slug === c.slug))
    .map((c) => ({ slug: c.slug, name: c.name })),
  crises: roster.crises.length,
  boxSets: sets.length,
});
console.log(
  JSON.stringify(
    {
      characters: characters.length,
      changedCharacterCards: changes,
      tactics: roster.tactics.length,
      crises: roster.crises.length,
      boxes: sets.length,
    },
    null,
    2,
  ),
);
