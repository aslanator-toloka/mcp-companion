import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(os.homedir(), "Library/Android/sdk");
if (!fs.existsSync(path.join(sdk, "platforms/android-36/android.jar")))
  throw Error(
    "Install Android SDK platform 36, then set ANDROID_HOME to the SDK directory.",
  );
const tasks = process.argv.includes("--apk")
  ? [":app:assembleDebug"]
  : [":app:testDebugUnitTest", ":app:compileDebugJavaWithJavac"];
const env = {
  ...process.env,
  ANDROID_HOME: sdk,
  GRADLE_USER_HOME:
    process.env.GRADLE_USER_HOME || path.join(root, ".android-cache/gradle"),
};
// Avoid an unrelated machine-wide JDK 25 default; Capacitor 8 targets Java 21.
if (process.env.MCP_ANDROID_JAVA_HOME)
  env.JAVA_HOME = process.env.MCP_ANDROID_JAVA_HOME;
else if (process.platform === "darwin") {
  try {
    env.JAVA_HOME = execFileSync("/usr/libexec/java_home", ["-v", "21"], {
      encoding: "utf8",
    }).trim();
  } catch {}
}
console.log(`Android Java: ${env.JAVA_HOME || "system default"}`);
const command = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
execFileSync(command, tasks, {
  cwd: path.join(root, "android"),
  env,
  stdio: "inherit",
});
if (process.argv.includes("--apk")) {
  const output = path.join(root, "output/apk");
  fs.mkdirSync(output, { recursive: true });
  const target = path.join(output, "mcp-companion-debug.apk");
  fs.copyFileSync(path.join(root, "android/app/build/outputs/apk/debug/app-debug.apk"), target);
  const digest = crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
  fs.writeFileSync(target + ".sha256", `${digest}  mcp-companion-debug.apk\n`);
  console.log(`APK ready: ${target}\nSHA-256: ${digest}`);
}
