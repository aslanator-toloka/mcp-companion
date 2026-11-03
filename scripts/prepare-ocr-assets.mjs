import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await fs.readFile(path.join(root, "scripts/ocr-assets.json"), "utf8"),
);
const check = process.argv.includes("--check");
for (const entry of manifest.files) {
  const target = path.join(root, "assets/ocr", entry.path);
  const valid = (data) =>
    crypto.createHash("sha256").update(data).digest("base64") === entry.sha256;
  let data = await fs.readFile(target).catch(() => null);
  if (data && valid(data)) continue;
  if (check)
    throw Error(
      `Missing or changed offline OCR asset: ${entry.path}. Run npm run ocr:assets.`,
    );
  const response = await fetch(entry.url, {
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok)
    throw Error(`OCR asset download failed: ${response.status} ${entry.path}`);
  data = Buffer.from(await response.arrayBuffer());
  if (!valid(data)) throw Error(`OCR asset checksum mismatch: ${entry.path}`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, data);
  console.log(`Verified ${entry.path}`);
}
console.log(
  "Offline OCR assets verified (pinned Tesseract 7.0.0 / English model).",
);
