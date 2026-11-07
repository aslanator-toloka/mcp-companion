// Add exchange identifiers from the same frozen Jarvis capture, without refreshing rules.
// Usage: node scripts/prepare-roster-codes.mjs /path/to/jarvis-capture
import fs from "node:fs";
import path from "node:path";
const capture = process.argv[2];
if (!capture) throw Error("Supply the Jarvis capture directory");
for (const [file, fields] of [
  ["data/catalog.json", ["characters"]],
  ["data/roster-cards.json", ["tactics", "crises"]],
]) {
  const data = JSON.parse(fs.readFileSync(file));
  for (const field of fields) {
    const source = new Map(
      JSON.parse(fs.readFileSync(path.join(capture, field + ".json"))).map(
        (row) => [row.slug, row],
      ),
    );
    for (const row of data[field]) {
      if (!source.has(row.slug))
        throw Error("Missing exchange metadata: " + row.slug);
      const code = source.get(row.slug).exportCode ?? null;
      if (code !== null && !/^\d{8}$/.test(code))
        throw Error("Invalid exchange identifier: " + row.slug);
      row.exportCode = code;
    }
    console.log("Exchange identifiers prepared:", field, data[field].length);
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}
