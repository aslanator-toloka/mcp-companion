import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
execFileSync(process.execPath, [path.join(root, "frontend/build.mjs")], {
  stdio: "inherit",
});
const index = path.join(root, "index.html");
let html = fs.readFileSync(index, "utf8");
html = html.replace(
  /((?:src|href)=")([^"?#]+\.(?:js|css))(?:\?[^"#]*)?"/g,
  (all, prefix, file) => {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) throw Error("Missing entry asset: " + file);
    return (
      prefix +
      file +
      "?v=" +
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(full))
        .digest("hex")
        .slice(0, 12) +
      '"'
    );
  },
);
fs.writeFileSync(index, html);
console.log("Built static client in " + root);
