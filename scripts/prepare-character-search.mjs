// Enrich existing frozen characters for local filtering; never replace card rules.
// Usage: node scripts/prepare-character-search.mjs /path/to/jarvis-api-characters.json
// Public source: https://www.jarvis-protocol.com/api/characters (English locale).
import fs from "node:fs";
const path = "data/catalog.json";
const data = JSON.parse(fs.readFileSync(path));
const source = new Map(
  JSON.parse(fs.readFileSync(process.argv[2])).map((c) => [c.slug, c]),
);
for (const character of data.characters) {
  const current = source.get(character.slug);
  if (!current) throw Error("Missing search metadata: " + character.slug);
  character.affiliations = character.affiliations.map((a) => {
    const metadata = current.affiliations.find((item) => item.slug === a.slug);
    return {
      ...a,
      timelines: metadata?.timelines || [],
      isLeaderWithTeamTactics: !!metadata?.isLeaderWithTeamTactics,
    };
  });
  const detail = JSON.parse(
    fs.readFileSync(`data/cards/${character.slug}.json`),
  );
  const attacks = Object.values(detail)
    .filter(Boolean)
    .flatMap((card) =>
      [card.frontSide, card.backSide]
        .filter(Boolean)
        .flatMap((face) => face.attacks || []),
    );
  character.attacks = [
    ...new Map(
      attacks.map((a) => {
        const match = { type: a.type, range: a.range, strength: a.strength };
        return [JSON.stringify(match), match];
      }),
    ).values(),
  ];
}
data.searchMetadataUpdatedAt = new Date().toISOString();
fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log(
  `Prepared search metadata for ${data.characters.length} characters`,
);
