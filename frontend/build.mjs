import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(root, "..");
const ratingWorker = await build({
  entryPoints: [path.join(root, "src/character-rating-worker.js")],
  bundle: true,
  minify: true,
  write: false,
  target: ["safari16", "chrome110"],
});
const combatWorker = await build({
  entryPoints: [path.join(root, "src/combat/worker.js")],
  bundle: true,
  minify: true,
  write: false,
  target: ["safari16", "chrome110"],
});
await build({
  entryPoints: [path.join(root, "src/main.jsx")],
  outfile: path.join(appRoot, "react-ui.js"),
  bundle: true,
  minify: true,
  format: "iife",
  target: ["safari16", "chrome110"],
  define: {
    "process.env.NODE_ENV": '"production"',
    __COMBAT_WORKER__: JSON.stringify(combatWorker.outputFiles[0].text),
    __CHARACTER_RATING_WORKER__: JSON.stringify(
      ratingWorker.outputFiles[0].text,
    ),
  },
  legalComments: "eof",
});
const licenses = path.join(appRoot, "assets/licenses");
fs.mkdirSync(licenses, { recursive: true });
for (const name of ["react", "react-dom", "mobx", "mobx-react-lite"])
  fs.copyFileSync(
    path.join(root, "../node_modules", name, "LICENSE"),
    path.join(licenses, name + ".txt"),
  );
