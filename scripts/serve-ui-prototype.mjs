// Local, throwaway UI preview. Production entry points and browser storage stay untouched.
import express from "express";
import { context } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundle = await context({
  entryPoints: [path.join(root, "frontend/src/ui-prototype.jsx")],
  bundle: true, write: false, outdir: "/prototype", loader: { ".css": "css" },
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{
    name: "isolated-native-card-state",
    setup(build) {
      build.onResolve({ filter: /^\.\/stores\/index\.js$/ }, args => {
        if (args.importer === path.join(root, "frontend/src/cards.jsx"))
          return { path: path.join(root, "frontend/src/ui-prototype-card-state.js") };
      });
    },
  }],
});
let files = await bundle.rebuild();
const app = express();
app.get("/mcp-companion/", async (req, res, next) => {
  if (req.query.prototype !== "ui") return next();
  files = await bundle.rebuild();
  res.set("Cache-Control", "no-store").type("html").send(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MCP Companion · Прототип интерфейса</title><link rel="icon" href="icon.svg"><link rel="stylesheet" href="__ui-prototype.css"><link rel="stylesheet" href="card-viewer.css"></head>
<body><div id="app-root"></div><script src="card-art.js"></script><script src="card-layout.js"></script><script src="card-conditions.js"></script><script src="__ui-prototype.js"></script></body></html>`);
});
for (const ext of ["js", "css"]) app.get(`/mcp-companion/__ui-prototype.${ext}`, (req, res) => {
  res.set("Cache-Control", "no-store").type(ext).send(files.outputFiles.find(f => f.path.endsWith(`.${ext}`)).text);
});
app.use("/mcp-companion", express.static(root));
const port = Number(process.env.PROTOTYPE_PORT) || 4186;
const server = app.listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}/mcp-companion/?prototype=ui&variant=A`));
async function stop() { server.close(); await bundle.dispose(); process.exit(); }
process.on("SIGINT", stop); process.on("SIGTERM", stop);
