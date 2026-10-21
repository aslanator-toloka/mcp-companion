const express = require("express"),
  path = require("node:path");
const app = express();
app.use("/mcp-companion", express.static(path.resolve(__dirname, "..")));
app.listen(Number(process.env.PORT) || 4173, "127.0.0.1", () =>
  console.log(
    "http://127.0.0.1:" + (process.env.PORT || 4173) + "/mcp-companion/",
  ),
);
