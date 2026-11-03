import { Capacitor, registerPlugin } from "@capacitor/core";
const LocalData = registerPlugin("LocalData");
// WebView does not reliably download blob: URLs. Android writes only to a URI
// explicitly selected by the user through the system's Save As dialog.
export async function exportLibrary(value) {
  const text = JSON.stringify(value, null, 2);
  if (
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable("LocalData")
  ) {
    await LocalData.saveExport({ json: text });
    return;
  }
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "mcp-companion-catalog.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
