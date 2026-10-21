import React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "./shell.jsx";
import { initialize } from "./bootstrap.js";
const root = createRoot(document.getElementById("app-root"));
root.render(<AppShell />);
window.MCPApp = Object.freeze({
  diagnostics: () => ({
    engine: "react",
    version: React.version,
    state: "mobx",
    roots: 1,
  }),
});
initialize();
