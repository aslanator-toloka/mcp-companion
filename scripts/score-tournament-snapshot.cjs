// Use the exact same scoring implementation as the current React app.
const fs = require("node:fs"),
  core = require("../tournaments/core.js");
process.stdout.write(
  JSON.stringify(core.scoreData(JSON.parse(fs.readFileSync(0, "utf8")))),
);
