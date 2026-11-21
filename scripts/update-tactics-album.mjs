// Maintains data/tactics-album.json — the owner's physical tactics binder, kept in the repo
// so its contents are reviewable. Numbers are append-only: new cards always go to the end.
// Usage: node scripts/update-tactics-album.mjs [--set CODE]... [--card SLUG]... [--from-export file.json]
import fs from "node:fs";
import {
  collectTactics,
  numberAlbum,
} from "../frontend/src/tactics-album.js";
const FILE = "data/tactics-album.json",
  read = (f) => JSON.parse(fs.readFileSync(f)),
  boxes = new Map(read("data/box-sets.json").sets.map((s) => [s.code, s])),
  cards = new Map(read("data/roster-cards.json").tactics.map((c) => [c.slug, c])),
  characters = read("data/catalog.json").characters;
const album = fs.existsSync(FILE)
  ? read(FILE)
  : { sets: [], loose: [], order: [] };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const [flag, value] = [args[i], args[i + 1]];
  if (flag === "--set") {
    if (!boxes.has(value)) throw Error("Unknown box " + value);
    album.sets = [...new Set([...album.sets, value])];
  } else if (flag === "--card") {
    if (!cards.has(value)) throw Error("Unknown tactics card " + value);
    album.loose = [...new Set([...album.loose, value])];
  } else if (flag === "--from-export") {
    album.sets = [...new Set([...album.sets, ...read(value).purchasedSets])];
  } else throw Error("Unknown flag " + flag);
}
const collect = (includeManual, loose) =>
  collectTactics(
    album.sets,
    (code) => {
      const set = boxes.get(code);
      return includeManual || !set?.manualTactics ? set : null;
    },
    (slug) => cards.get(slug),
    characters,
    loose,
  );
// A first layout leaves hand-entered box contents and loose cards for the end.
const base = album.order.length ? album.order : numberAlbum(collect(false, [])).order;
const next = numberAlbum(collect(true, album.loose), base);
album.order = next.order;
fs.writeFileSync(FILE, JSON.stringify(album, null, 2) + "\n");
console.log(
  `Tactics album: ${next.slots.length} cards, ${album.order.length} pockets used` +
    (next.added.length ? `; appended ${next.added.join(", ")}` : ""),
);
