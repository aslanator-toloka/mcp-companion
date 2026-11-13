const express = require("express"),
  path = require("node:path");
const { gameRouter } = require("../game/server.cjs");
const app = express();
app.use(
  "/__mcp_game",
  gameRouter(
    process.env.MCP_GAME_STATE ||
      path.resolve(__dirname, "../.runtime/game.json"),
  ),
);
app.use("/mcp-companion", express.static(path.resolve(__dirname, "..")));
app.listen(Number(process.env.PORT) || 4173, "127.0.0.1", () =>
  console.log(
    "http://127.0.0.1:" + (process.env.PORT || 4173) + "/mcp-companion/",
  ),
);
