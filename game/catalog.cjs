const { characters: allCharacters } = require("../data/catalog.json");
const {
  tactics: allTactics,
  crises: allCrises,
} = require("../data/roster-cards.json");
const { layouts } = require("../data/map-layouts.json");
const { missionPoints } = require("../map-geometry.js");

const core = allCharacters.filter(
  (card) => card.boxSets.includes("CP143") && !card.isGrunt,
);
const common = [
  "winter-soldier-operative",
  "spectacular-spider-man",
  "doc-ock-sinister-scientist",
];
const crisisIds = [
  "infinity-formula-goes-missing-ca09",
  "riots-spark-over-extremis-30-ca09",
  "gamma-wave-sweeps-across-midwest-ca09",
  "demons-downtown-has-our-comeuppance-come-due-ca09",
  "cosmic-invasion-black-order-descends-on-earth-ca09",
  "fear-grips-world-as-worthy-terrorize-cities-ca09",
  "alien-ship-crashes-in-downtown-ca09",
  "struggle-for-the-cube-continues-ca09",
  "the-montesi-formula-found-ca09",
  "mutant-extremists-target-us-senators-ca09",
];
const genericTactics = [
  "battle-plan",
  "battle-bound",
  "going-all-out",
  "reposition",
  "survival",
];
const presets = [
  {
    id: "avengers",
    name: "Avengers · Earth’s Mightiest",
    characters: [
      ...core
        .filter((card) => card.affiliations.some((a) => a.name === "Avengers"))
        .map((card) => card.slug)
        .filter((slug) => !common.includes(slug)),
      ...common,
      "hulk",
      "vision",
      "hawkeye",
    ],
    tactics: [
      ...genericTactics,
      "stark-armory",
      "repulsor-refraction",
      "helios-laser-bombardment",
      "till-the-end-of-the-line-ca10",
      "go-get-em-tiger",
    ],
    crises: crisisIds,
  },
  {
    id: "cabal",
    name: "Cabal · Earth’s Mightiest",
    characters: [
      ...core
        .filter((card) => card.affiliations.some((a) => a.name === "Cabal"))
        .map((card) => card.slug)
        .filter((slug) => !common.includes(slug)),
      ...common,
      "mystique",
      "sabretooth",
      "mister-sinister",
    ],
    tactics: [
      ...genericTactics,
      "glory-of-ultron",
      "i-am-a-baron-after-all",
      "illicit-tech",
      "well-laid-plans-ca10",
      "heavy-firepower-ca10",
    ],
    crises: crisisIds,
  },
];

const selected = (cards, field, extra = []) => {
  const ids = new Set([
    ...presets.flatMap((roster) => roster[field]),
    ...extra,
  ]);
  const result = Object.fromEntries(
    cards.filter((card) => ids.has(card.slug)).map((card) => [card.slug, card]),
  );
  for (const id of ids) {
    if (!result[id]) throw Error("Missing Game card " + id);
  }
  return result;
};
const characters = selected(allCharacters, "characters", [
  "ultron-drones-grunts",
  "scarlet-witch",
  "quicksilver",
  "magneto",
  "toad",
  "rogue",
  "pyro",
  "the-blob",
  "juggernaut",
  "avalanche",
  "gambit",
  "sabretooth-apex-predator",
  "colossus",
  "exodus",
  "emma-frost",
  "shadow-king",
  "lady-mastermind",
  "beast",
  "wolverine",
  "cyclops",
  "storm",
  "jean-grey",
  "nightcrawler",
  "iceman",
  "angel",
  "professor-x",
  "psylocke",
  "shadowcat",
  "havok",
  "jubilee",
  "domino",
  "bishop",
  "x-23",
  "honey-badger",
  "magik",
  "cable",
  "logan-the-wolverine",
  "archangel",
  "mirage",
  "sunspot",
  "deadpool",
  "warlock",
  "maverick",
  "weapon-x",
  "omega-red",
  "cassandra-nova",
  "multiple-man",
  "multiple-man-duplicates-grunts",
  "phoenix",
  "red-guardian",
  "ursa-major",
  "darkstar",
  "black-widow",
  "crimson-dynamo",
  "black-panther",
  "okoye",
  "shuri",
  "mbaku",
  "killmonger",
  "king-tchalla",
  "black-panther-chosen-of-bast",
  "killmonger-usurper",
  "corvus-glaive",
  "proxima-midnight",
  "black-dwarf",
  "ebony-maw",
  "supergiant",
  "black-swan",
  "nebula",
  "cosmic-ghost-rider",
  "thanos-the-mad-titan",
  "wong",
  "clea",
  "doctor-strange",
  "ancient-one",
  "baron-mordo",
  "doctor-strange-sorcerer-supreme",
  "doctor-voodoo",
  "luke-cage",
  "she-hulk",
  "spectrum",
  "blue-marvel",
]);
const tactics = selected(allTactics, "tactics");
const crises = selected(allCrises, "crises");
const details = Object.fromEntries(
  Object.keys(characters).map((slug) => [
    slug,
    require("../data/cards/" + slug + ".json"),
  ]),
);

const presentationText = require("node:fs").readFileSync(
  require("node:path").join(__dirname, "../game-card-data.js"),
  "utf8",
);
const presentation = JSON.parse(
  presentationText
    .split("window.MCP_GAME_CARD_DATA=")[1]
    .trim()
    .replace(/;$/, ""),
);
const grantedAttacks = {
  100: presentation.crises["the-montesi-formula-found-ca09"].attacks[0],
  101: presentation.tactics["helios-laser-bombardment"].attacks[0],
  102: presentation.tactics["repulsor-refraction"].attacks[0],
  103: presentation.tactics["illicit-tech"].attacks[0],
};

const pool = {
  presets,
  characters: Object.fromEntries(
    Object.entries(characters).map(([slug, card]) => [
      slug,
      {
        ...card,
        peerless: (details[slug].statCard.frontSide.superPowers || []).some(
          (power) => /(?:^|,\s*)Peerless(?:,|$)/.test(power.name),
        ),
        leaderships: (details[slug].statCard.frontSide.superPowers || [])
          .filter((power) => power.type === "leadership")
          .map((power) => ({
            name: power.name.split(" (Affiliation:")[0],
            affiliation:
              power.name.match(/\(Affiliation: (.+)\)/)?.[1] ||
              card.affiliations[0]?.name,
          })),
      },
    ]),
  ),
  tactics,
  crises,
};

function objectives(mission, priorityEdge) {
  return ["secure", "extract"].flatMap((kind) =>
    missionPoints(crises[mission[kind]], kind, layouts).map((point) => {
      const { x, y } = point;
      const oriented = {
        south: { x, y },
        west: { x: 36 - y, y: x },
        north: { x: 36 - x, y: 36 - y },
        east: { x: y, y: 36 - x },
      }[priorityEdge];
      return { ...point, ...oriented };
    }),
  );
}

module.exports = { pool, details, objectives, grantedAttacks };
