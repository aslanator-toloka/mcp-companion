import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = fs.existsSync(path.join(root, "../app/index.html"))
  ? path.join(root, "../app")
  : path.join(root, "..");
await build({
  entryPoints: [path.join(root, "src/main.jsx")],
  outfile: path.join(appRoot, "react-ui.js"),
  bundle: true,
  minify: true,
  format: "iife",
  target: ["safari16", "chrome110"],
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "eof",
});
const licenses = path.join(appRoot, "assets/licenses");
fs.mkdirSync(licenses, { recursive: true });
for (const name of ["react", "react-dom"])
  fs.copyFileSync(
    path.join(root, "node_modules", name, "LICENSE"),
    path.join(licenses, name + ".txt"),
  );
