// Summary of an AI match from decisions.jsonl (programmatic facts only).
// node scripts/ai-match-report.cjs <dir with decisions.jsonl> [game.json]
const fs = require("node:fs");
const path = require("node:path");

const dir = process.argv[2];
const rows = fs
  .readFileSync(path.join(dir, "decisions.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
const game = process.argv[3] && JSON.parse(fs.readFileSync(process.argv[3]));

const sides = ["p1", "p2"];
const enemyOf = (side) => (side === "p1" ? "p2" : "p1");
const sideOf = (id) => String(id).split(":")[0];
const stat = Object.fromEntries(
  sides.map((s) => [
    s,
    {
      commands: 0,
      errors: 0,
      errorTypes: {},
      actions: {},
      damageDealt: 0,
      damageTaken: 0,
      dazedEnemies: [],
      koEnemies: [],
      wastedActivations: [],
      pickups: 0,
      attacks: 0,
      attackDamage: [],
    },
  ]),
);

let lastActivation = {};
for (const r of rows) {
  const s = stat[r.side];
  s.commands += 1;
  if (!r.ok) {
    s.errors += 1;
    const key = r.action?.type + ": " + r.error;
    s.errorTypes[key] = (s.errorTypes[key] || 0) + 1;
    continue;
  }
  const type = r.action?.type;
  s.actions[type] = (s.actions[type] || 0) + 1;
  if (type === "activate") lastActivation[r.side] = r.action.value;
  if (type === "end" && r.actionsLeft === 2 && r.phase === "activation")
    s.wastedActivations.push("R" + r.round + " " + (r.active || "?"));
  let dealt = 0;
  for (const c of r.changes || []) {
    if (c.hp && c.fighter) {
      const loss = Math.max(0, (c.hp[0] ?? 0) - c.hp[1]);
      if (!loss) continue;
      const owner = sideOf(c.fighter);
      stat[owner].damageTaken += loss;
      stat[enemyOf(owner)].damageDealt += loss;
      if (owner !== r.side) dealt += loss;
    }
    if (c.dazed?.[1] === true)
      stat[enemyOf(sideOf(c.fighter))].dazedEnemies.push(
        "R" + r.round + " " + c.fighter,
      );
    if (c.ko?.[1] === true)
      stat[enemyOf(sideOf(c.fighter))].koEnemies.push(
        "R" + r.round + " " + c.fighter,
      );
    if (c.objective && c.holder[1] && !c.holder[0]) s.pickups += 1;
  }
  if (type === "attack") {
    s.attacks += 1;
    s.attackDamage.push(dealt);
  }
}

const scoreByRound = {};
for (const r of rows)
  for (const c of r.changes || [])
    if (c.score) scoreByRound["R" + r.round] = c.score[1];

const out = [];
out.push("# Сводка партии " + path.basename(dir));
if (game)
  out.push(
    "",
    `Итог: ${game.phase}, победитель ${game.winner || "—"}, счёт ${game.score.p1}:${game.score.p2}, раундов ${game.round}`,
    `Отряды: p1 ${JSON.stringify(game.squads?.p1)}; p2 ${JSON.stringify(game.squads?.p2)}`,
  );
out.push("", "Счёт по раундам: " + JSON.stringify(scoreByRound));
for (const side of sides) {
  const s = stat[side];
  out.push(
    "",
    `## ${side}`,
    `- команд: ${s.commands}, ошибок: ${s.errors} (${((100 * s.errors) / Math.max(1, s.commands)).toFixed(0)}%)`,
    `- действия: ${JSON.stringify(s.actions)}`,
    `- атак: ${s.attacks}, урон нанесён/получен: ${s.damageDealt}/${s.damageTaken}`,
    `- Dazed врагов: ${s.dazedEnemies.join(", ") || "—"}; KO врагов: ${s.koEnemies.join(", ") || "—"}`,
    `- подобрано объектов: ${s.pickups}`,
    `- активации, закрытые без единого действия: ${s.wastedActivations.join(", ") || "—"}`,
    `- ошибки по типам:`,
    ...Object.entries(s.errorTypes)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `  - ${v}× ${k}`),
  );
}
console.log(out.join("\n"));
