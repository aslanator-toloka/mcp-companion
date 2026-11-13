const port = Number(process.env.PORT || 4173);
const base = "http://127.0.0.1:" + port + "/__mcp_game/";
const [verb, side, ...args] = process.argv.slice(2);
const isSide = (value) => ["p1", "p2"].includes(value);

async function request(route, body) {
  const response = await fetch(
    base + route,
    body && {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const result = await response.json();
  if (!response.ok) throw Error(result.error);
  return result;
}

async function main() {
  if (verb === "catalog") return request("catalog");
  if (verb === "character" && side)
    return request("character/" + encodeURIComponent(side));
  if (verb === "snapshot") return request("state?full=1");
  if (verb === "finish") {
    const state = await request("state");
    if (!state) throw Error("Нет активной партии.");
    return request("finish", { id: state.id });
  }
  if (verb === "new") return request("new", { p1: side, p2: args[0] });
  if (!isSide(side) || !["state", "take", "act", "reach"].includes(verb)) {
    throw Error(
      "Команды: catalog | character <slug> | snapshot | finish | new avengers cabal | state p1|p2 | take p1|p2 | reach p1|p2 <position action> [fighter, power, or move mode] | act p1|p2 '<JSON>' [revision]",
    );
  }
  if (verb === "reach")
    return request(
      "reach?" +
        new URLSearchParams({
          side,
          type: args[0],
          fighter: args[1] || "",
          value: args[1] || "",
        }),
    );
  const state = await request("state?side=" + side);
  if (verb === "state") return state;
  if (!state) throw Error("Создайте партию.");
  const action = verb === "take" ? { type: "take" } : JSON.parse(args[0]);
  return request("command", {
    side,
    source: "cli",
    revision: args[1] === undefined ? state.revision : Number(args[1]),
    action,
  });
}

main()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(
      error.cause?.code === "ECONNREFUSED"
        ? "Запустите локальный сервер: npm run serve"
        : error.message,
    );
    process.exitCode = 1;
  });
