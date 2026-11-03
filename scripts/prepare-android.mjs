import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Explicit allowlist: no .env, exports, test fixtures, source checkouts or credentials.
const target = path.join(root, "native-web");
await fs.rm(target, { recursive: true, force: true });
await fs.mkdir(target, { recursive: true });
const html = await fs.readFile(path.join(root, "index.html"), "utf8");
const topAssets = [...html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)]
  .map((m) => m[1])
  .filter((s) => !s.includes("/") && !s.includes(":") && !s.startsWith("#"));
for (const name of new Set([
  "index.html",
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  ...topAssets,
]))
  await fs.copyFile(path.join(root, name), path.join(target, name));
for (const name of ["assets", "data"])
  await fs.cp(path.join(root, name), path.join(target, name), {
    recursive: true,
    filter: (s) => !path.basename(s).startsWith("."),
  });
// Only runtime tournament files. Scripts and development reports stay out of APK.
await fs.mkdir(path.join(target, "tournaments"));
for (const name of ["style.css", "data.js"])
  await fs.copyFile(
    path.join(root, "tournaments", name),
    path.join(target, "tournaments", name),
  );
execFileSync(
  process.execPath,
  [path.join(root, "scripts/prepare-ocr-assets.mjs"), "--check"],
  { stdio: "inherit" },
);
console.log(
  "Prepared offline web bundle in native-web (no remote server URL).",
);
