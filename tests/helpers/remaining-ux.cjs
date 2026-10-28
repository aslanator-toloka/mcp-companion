const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "../..");
const Core = require("../../battle-core.js");
module.exports = function fixture() {
  const catalog = JSON.parse(
    fs.readFileSync(path.join(root, "data/catalog.json")),
  ).characters;
  const cards = JSON.parse(
    fs.readFileSync(path.join(root, "data/roster-cards.json")),
  );
  const ids = [
    "amazing-spider-man",
    "ultimate-spider-man",
    "ghost-spider",
    "spider-ham",
    "black-cat",
    "venom",
    "wong",
    "moon-knight",
    "daredevil",
    "silk",
  ];
  const groups = Array.from({ length: 24 }, (_, i) => ({
    id: "audit-g" + i,
    name:
      i === 23
        ? "Длинное название группы для подготовки к турниру и тренировочных составов"
        : "Группа " + String(i + 1).padStart(2, "0"),
  }));
  const rosters = Array.from({ length: 40 }, (_, i) => ({
    id: "audit-r" + i,
    name:
      (i % 2 ? "Тренировочный состав" : "Турнирный состав") +
      " " +
      String(i + 1).padStart(2, "0"),
    affiliation: i % 2 ? "Web Warriors" : "Defenders",
    characters: ids,
    tactics: cards.tactics
      .filter((c) => c.standardTimelineStatus === "legal")
      .slice(0, 5)
      .map((c) => c.slug),
    crises: [],
    groups: [groups[i % 24].id],
    updatedAt: new Date(Date.UTC(2026, 9, 1 + (i % 26))).toISOString(),
  }));
  const info = (slug) => catalog.find((c) => c.slug === slug);
  const owned = catalog
    .filter((c) => !c.isGrunt)
    .slice(0, 210)
    .map((c) => c.slug);
  const hobbyProgress = Object.fromEntries(
    owned
      .filter((_, i) => i % 4 !== 3)
      .map((s, i) => [s, ["assembled", "primed", "painted"][i % 3]]),
  );
  let match = {
    id: "audit-match",
    status: "active",
    name: "Проверка длинной партии",
    createdAt: "2026-10-27T10:00:00Z",
    updatedAt: "2026-10-27T12:00:00Z",
    sourceRoster: rosters[0],
    threat: 25,
    round: 4,
    score: { mine: 12, opponent: 11 },
    priority: "mine",
    references: {},
    undo: [],
    log: [],
    secure: cards.crises.find((c) => c.setup === "D"),
    extract: cards.crises.find((c) => c.setup === "F"),
    map: {
      edge: "south",
      positions: {},
      objectives: {},
      pins: Array.from({ length: 16 }, (_, i) => ({
        id: "audit-pin" + i,
        name: "Точка " + (i + 1),
        x: 3 + (i % 4) * 8,
        y: 3 + Math.floor(i / 4) * 8,
      })),
    },
  };
  for (const [index, side] of ["mine", "opponent"].entries()) {
    match[side] = {
      name: side === "mine" ? "Я" : "Противник",
      affiliation: "Web Warriors",
      leader: null,
      fighters: [],
      tactics: [],
    };
    for (const slug of ids.slice(index * 5, index * 5 + 5)) {
      const detail = JSON.parse(
        fs.readFileSync(path.join(root, "data/cards", slug + ".json")),
      );
      match.references[slug] = detail;
      const fighter = Core.fighter(info(slug), detail, "audit-" + slug);
      fighter.power = 3;
      if (slug === "amazing-spider-man") fighter.conditions = ["Shock", "Slow"];
      match[side].fighters.push(fighter);
    }
    match[side].tactics = rosters[0].tactics.map((slug) => {
      const card = cards.tactics.find((c) => c.slug === slug);
      return { slug, name: card.name, played: false, card };
    });
  }
  for (let i = 0; i < 30; i++)
    match = Core.update(
      match,
      "Энергия · действие " + i,
      (m) => (m.mine.fighters[0].power = i % 10),
      "2026-10-27T12:00:00Z",
    );
  match.log = Array.from({ length: 200 }, (_, i) => ({
    at: new Date(Date.UTC(2026, 9, 27, 10, 0, i)).toISOString(),
    round: 1 + Math.floor(i / 50),
    text:
      "Событие " +
      (i + 1) +
      " · Amazing Spider-Man получил энергию, отмечены состояния и цели",
  }));
  Core.validate({ version: 1, matches: [match] });
  return {
    version: 1,
    owned,
    groups,
    rosters,
    hobbyProgress,
    wishlist: ["CP170"],
    purchasedSets: [],
    battles: { version: 1, matches: [match] },
  };
};
if (require.main === module)
  fs.writeFileSync(
    path.join(root, "previews/complete-audit/fixture.json"),
    JSON.stringify(module.exports()),
  );
