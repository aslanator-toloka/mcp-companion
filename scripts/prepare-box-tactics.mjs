// Add box Team Tactics contents from a Jarvis capture, without refreshing rules.
// Usage: node scripts/prepare-box-tactics.mjs /path/to/jarvis-capture
// The capture directory needs boxes/<CODE>.json (GET /api/box_sets/<CODE>).
import fs from "node:fs";
import path from "node:path";
import { boxTactics } from "./box-tactics.mjs";
const capture = process.argv[2];
if (!capture) throw Error("Supply the Jarvis capture directory");
const file = "data/box-sets.json",
  data = JSON.parse(fs.readFileSync(file));
for (const set of data.sets) {
  const detail = JSON.parse(
    fs.readFileSync(path.join(capture, "boxes", set.code + ".json")),
  );
  if (detail.code !== set.code) throw Error("Invalid box " + set.code);
  const tactics = boxTactics(detail);
  // Keep hand-entered contents for boxes Jarvis has not filled in yet.
  if (tactics.length || !set.manualTactics) {
    set.tactics = tactics;
    delete set.manualTactics;
  }
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(
  "Box tactics prepared:",
  data.sets.length,
  "sets,",
  data.sets.reduce((n, s) => n + s.tactics.length, 0),
  "printings",
);
