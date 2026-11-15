// Compact Game client for AI players. Every decision is appended to
// .runtime/ai-matches/<matchId>/decisions.jsonl with the player's reason,
// the engine log entries it produced and a programmatic state diff.
const fs = require("node:fs");
const path = require("node:path");
const { pool, details } = require("../game/catalog.cjs");
const { secureSide, points } = require("../game/mission.cjs");

const port = Number(process.env.PORT || 4173);
const base = "http://127.0.0.1:" + port + "/__mcp_game/";
const logRoot = path.resolve(
  process.env.AI_MATCH_DIR || path.join(__dirname, "../.runtime/ai-matches"),
);
const [verb, side, ...args] = process.argv.slice(2);
const strip = (text) =>
  String(text || "")
    .replace(/\|!range_small\|/g, "Short")
    .replace(/\|!range_medium\|/g, "Medium")
    .replace(/\|!range_large\|/g, "Long")
    .replace(/&!([a-z_]+)&/g, "$1")
    .replace(/\\/g, " ")
    .replace(/\|[!*<]?(?:[a-z_]+>)?([^|]*)\|/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

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

const matchDir = (id) => {
  const dir = path.join(logRoot, id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const record = (id, entry) =>
  fs.appendFileSync(
    path.join(matchDir(id), "decisions.jsonl"),
    JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n",
  );

function fighterLine(f) {
  const bits = [
    f.id,
    f.name + (f.form ? " (form " + f.form + ")" : ""),
    f.x == null ? "off-board" : "@" + f.x + "," + f.y,
    "hp " + f.hp + "/" + f.maxHp,
    "def P" +
      f.defenses?.physical +
      "/E" +
      f.defenses?.energy +
      "/M" +
      f.defenses?.mystic,
    "pow " + (f.power || 0),
  ];
  if (f.activated) bits.push("activated");
  if (f.dazed) bits.push("DAZED");
  if (f.ko) bits.push("KO");
  if (f.conditions?.length) bits.push("cond " + f.conditions.join("+"));
  if (f.grunt) bits.push("grunt");
  return bits.join(" | ");
}

// Programmatic diff of two states: what actually changed after a command.
function diff(before, after) {
  const changes = [];
  const pick = (f) => ({
    x: f.x,
    y: f.y,
    hp: f.hp,
    power: f.power || 0,
    conditions: (f.conditions || []).join("+"),
    dazed: !!f.dazed,
    ko: !!f.ko,
    activated: !!f.activated,
    form: f.form || 0,
  });
  const old = new Map(before.fighters.map((f) => [f.id, pick(f)]));
  for (const f of after.fighters) {
    const a = old.get(f.id) || {};
    const b = pick(f);
    const delta = Object.fromEntries(
      Object.keys(b)
        .filter((k) => a[k] !== b[k])
        .map((k) => [k, [a[k] ?? null, b[k]]]),
    );
    if (Object.keys(delta).length) changes.push({ fighter: f.id, ...delta });
  }
  const holders = new Map(before.objectives.map((o) => [o.id, o]));
  for (const o of after.objectives) {
    const a = holders.get(o.id) || {};
    if (a.holder !== o.holder || a.x !== o.x || a.y !== o.y)
      changes.push({
        objective: o.id,
        holder: [a.holder ?? null, o.holder ?? null],
        at: [
          [a.x, a.y],
          [o.x, o.y],
        ],
      });
  }
  if (JSON.stringify(before.score) !== JSON.stringify(after.score))
    changes.push({ score: [before.score, after.score] });
  for (const k of ["phase", "round", "active", "actionsLeft", "winner"])
    if (before[k] !== after[k]) changes.push({ [k]: [before[k], after[k]] });
  return changes;
}

// Score forecast using the same function the engine uses in Cleanup.
function forecast(view, me) {
  const enemy = me === "p1" ? "p2" : "p1";
  const gain = points(view);
  const now = { you: view.score[me], enemy: view.score[enemy] };
  const after = { you: now.you + gain[me], enemy: now.enemy + gain[enemy] };
  const finalRound = view.round >= 6;
  const ends = (a, b) => (Math.max(a, b) >= 16 || finalRound) && a !== b;
  const out = {
    round: view.round + (finalRound ? " (final round: the leader wins after it)" : " of 6"),
    now,
    thisCleanupIfNothingChanges: { you: "+" + gain[me], enemy: "+" + gain[enemy] },
    after,
    toWin: { you: Math.max(0, 16 - now.you), enemy: Math.max(0, 16 - now.enemy) },
  };
  if (ends(after.you, after.enemy)) {
    if (after.enemy > after.you) {
      const deny = after.enemy - 15;
      const catchUp = after.enemy - after.you;
      out.alert = finalRound
        ? `DEFEAT after this final round if nothing changes (${after.you}:${after.enemy}). Gap ${catchUp} VP: each objective taken from the enemy closes it by 2, each new one of your own by 1.`
        : `DEFEAT in this Cleanup if nothing changes (${after.you}:${after.enemy}). Deny the enemy at least ${deny} VP (Daze a holder, outnumber him on his Secure objective) so he stays below 16.` +
          (catchUp <= 2 ? ` Or tie/overtake him: you need +${catchUp} VP in your favour.` : ` Scoring your own VP is not enough: the gap is ${catchUp} VP.`);
    } else
      out.alert = `VICTORY in this Cleanup if you hold this position (${after.you}:${after.enemy}). Protect your holders and Secure objectives; do not risk them.`;
  } else if (!finalRound && after.enemy >= 12)
    out.alert = `The enemy will be ${16 - after.enemy} VP from victory after this Cleanup. Every objective he holds is critical now.`;
  return out;
}

function compact(view, me) {
  const enemy = me === "p1" ? "p2" : "p1";
  const out = {
    revision: view.revision,
    phase: view.phase,
    round: view.round,
    score: view.score,
    you: me,
    awaitingSide: view.awaitingSide,
    priority: view.priority,
    mission: Object.fromEntries(
      Object.entries(view.mission || {}).map(([k, v]) => [
        k,
        pool.crises[v]?.name,
      ]),
    ),
    threat: view.threat,
    deploymentEdge: view.deployment?.[me],
  };
  if (view.active) {
    const a = view.fighters.find((f) => f.id === view.active);
    out.activeFighter = a ? a.id + " " + a.name : view.active;
    out.actionsLeft = view.actionsLeft;
    if (a && a.side === me && a.x != null) {
      const tool = { S: 3.25, M: 5, L: 7.25 }[a.speed] || 5;
      const step = tool + 2 * a.radius;
      out.objectiveDistance = view.objectives
        .filter((o) => o.x != null && !o.holder)
        .map((o) => {
          const d = Math.hypot(o.x - a.x, o.y - a.y);
          const need = 1 + a.radius + (o.radius || 0.5);
          const advances = d <= need ? 0 : Math.ceil((d - need) / step);
          return `${o.id} @${o.x},${o.y}: ${d.toFixed(1)}" centre-to-centre, ≈${advances} Advance to Range 1 (straight line, ignores terrain)`;
        });
    }
  }
  if (view.fighters.length) {
    out.yourFighters = view.fighters
      .filter((f) => f.side === me)
      .map(fighterLine);
    out.enemyFighters = view.fighters
      .filter((f) => f.side === enemy)
      .map(fighterLine);
  }
  if (view.objectives.length)
    out.objectives = view.objectives.map(
      (o) =>
        o.id +
        " " +
        o.name +
        " (" +
        o.role +
        ")" +
        (o.x != null ? " @" + o.x + "," + o.y : "") +
        (o.holder ? " held by " + o.holder : "") +
        (o.owner ? " owner " + o.owner : ""),
    );
  // Threat zone: the enemy reaches with one Advance plus its longest attack.
  const live = view.fighters.filter((f) => f.x != null && !f.ko && !f.dazed);
  const reachOf = (e) => {
    const ranges = (pool.characters[e.slug]?.attacks || []).map(
      (a) => Number(String(a.range).replace(/\D/g, "")) || 0,
    );
    const r = [0, 1, 3, 6, 8, 10][Math.max(0, ...ranges)] || 0;
    return ({ S: 3.25, M: 5, L: 7.25 }[e.speed] || 5) + 3 * e.radius + r;
  };
  const threats = live
    .filter((f) => f.side === me)
    .map((f) => {
      const by = live.filter(
        (e) =>
          e.side === enemy &&
          !e.grunt &&
          Math.hypot(e.x - f.x, e.y - f.y) <= reachOf(e) + f.radius,
      );
      return by.length
        ? `${f.id}: ${by.map((e) => e.name + (e.activated ? " (already activated this round)" : " (still to activate this round!)")).join(", ")}`
        : null;
    })
    .filter(Boolean);
  if (threats.length) out.underThreat = threats;
  if (view.objectives.length && view.fighters.length) {
    const control = { you: [], enemy: [], contested: [] };
    for (const o of view.objectives) {
      if (o.role === "secure") {
        const owner = secureSide(view, o);
        (owner === me ? control.you : owner ? control.enemy : control.contested).push(o.id);
      } else if (o.holder) {
        (o.holder.startsWith(me + ":") ? control.you : control.enemy).push(
          o.id + " (" + o.holder + ")",
        );
      } else control.contested.push(o.id + " (on the ground)");
    }
    out.scoringNow = control;
  }
  if (view.phase === "activation" && view.objectives.length)
    out.scoreForecast = forecast(view, me);
  if (view.attackRoll) out.attackRoll = view.attackRoll;
  if (view.effects?.length)
    out.pendingEffect = JSON.stringify(view.effects[0]).slice(0, 600);
  out.recentLog = view.log
    .slice(-10)
    .map((e) => "R" + e.round + " " + e.text);
  out.actions = view.actions[me];
  if (view.phase === "finished") {
    out.winner = view.winner;
    out.finishReason = view.finishReason;
  }
  return out;
}

function card(slug) {
  const entry = details[slug];
  if (!entry) throw Error("No card " + slug);
  const c = pool.characters[slug];
  const sc = entry.statCard || {};
  const sides = [
    sc.frontSide,
    sc.sidesHaveDifferences !== false && sc.backSide,
  ].filter(Boolean);
  return {
    slug,
    name: c.name,
    threat: c.threatLevel,
    stamina: c.stamina,
    speed: c.speed,
    size: c.size,
    defense: {
      physical: c.physicalDefense,
      energy: c.energyDefense,
      mystic: c.mysticDefense,
    },
    affiliations: c.affiliations.map(
      (a) => a.name + (a.isLeader ? " (leader)" : ""),
    ),
    sides: sides.map((s) => ({
      side: s.type,
      attacks: (s.attacks || []).map(
        (a) =>
          `${a.name} [${a.type}, range ${a.range}, str ${a.strength}, cost ${a.powerCost}] ` +
          (a.steps || []).map(strip).join(" "),
      ),
      superPowers: (s.superPowers || []).map(
        (p) =>
          `${p.name} [${p.type}${p.powerCost && p.powerCost !== "0" ? ", cost " + p.powerCost : ""}] ${strip(p.body)}`,
      ),
    })),
  };
}

function brief(view, me) {
  const r = view.rosters[me];
  return {
    you: me,
    roster: r.name,
    characters: r.characters.map((slug) => {
      const c = pool.characters[slug];
      return `${slug} | ${c.name} | threat ${c.threatLevel} | stamina ${c.stamina} | speed ${c.speed} | size ${c.size} | def P${c.physicalDefense}/E${c.energyDefense}/M${c.mysticDefense} | ${c.affiliations.map((a) => a.name + (a.isLeader ? "*" : "")).join(", ")}${c.peerless ? " | PEERLESS" : ""}`;
    }),
    tactics: r.tactics.map((id) => {
      const t = pool.tactics[id];
      return `${id} | ${t.name} | ${t.type}${t.affiliation ? " | only " + t.affiliation.name : ""} | ${strip(t.body).slice(0, 700)}`;
    }),
    crises: r.crises.map((id) => {
      const c = pool.crises[id];
      return `${id} | ${c.name} | ${c.type} | threat ${c.threatLevel} | ${strip(c.scoringDescription).slice(0, 200)}`;
    }),
    enemyRoster: view.rosters[me === "p1" ? "p2" : "p1"].characters,
  };
}

const conditionWords = [
  "bleed",
  "poison",
  "incinerate",
  "stagger",
  "stun",
  "slow",
  "hex",
  "root",
  "shock",
  "judgment",
  "push",
  "throw",
];
// Scouting profile: role from stats and which conditions it inflicts.
function profile(slug, live) {
  const c = pool.characters[slug];
  const side = details[slug]?.statCard?.frontSide || {};
  const attacks = (side.attacks || []).map((a) => {
    const text = (a.steps || []).map(strip).join(" ").toLowerCase();
    return {
      name: a.name,
      type: a.type,
      range: a.range,
      strength: Number(a.strength) || 0,
      cost: Number(a.powerCost) || 0,
      inflicts: conditionWords.filter((w) => text.includes(w)),
    };
  });
  const maxStr = Math.max(0, ...attacks.map((a) => a.strength));
  const maxRange = Math.max(
    0,
    ...attacks.map((a) => Number(String(a.range).replace(/\D/g, "")) || 0),
  );
  const defense = [c.physicalDefense, c.energyDefense, c.mysticDefense];
  const roles = [];
  if (maxStr >= 7) roles.push("hard hitter (up to " + maxStr + " dice)");
  if (maxRange >= 4) roles.push("long range (Range " + maxRange + ")");
  if (maxRange <= 2) roles.push("melee");
  if (c.stamina >= 8 || Math.min(...defense) >= 4) roles.push("tank");
  if (c.stamina <= 5 || Math.max(...defense) <= 2) roles.push("fragile");
  if (c.speed === "L") roles.push("fast (L)");
  if (c.speed === "S") roles.push("slow (S)");
  const weakest = ["physical", "energy", "mystic"][
    defense.indexOf(Math.min(...defense))
  ];
  return {
    id: live?.id || slug,
    name: c.name,
    threat: c.threatLevel,
    hp: live ? live.hp + "/" + live.maxHp : c.stamina,
    speed: c.speed,
    size: c.size,
    defense: "P" + defense[0] + "/E" + defense[1] + "/M" + defense[2],
    weakestDefense: weakest,
    roles,
    attacks: attacks.map(
      (a) =>
        `${a.name} [${a.type}, R${a.range}, ${a.strength} dice, ${a.cost} Power]` +
        (a.inflicts.length ? " → " + a.inflicts.join(", ") : ""),
    ),
    superPowers: (side.superPowers || []).map(
      (p) => p.name + " [" + p.type + "]",
    ),
    ...(live && {
      power: live.power || 0,
      activated: !!live.activated,
      dazed: !!live.dazed,
      conditions: live.conditions || [],
    }),
  };
}

async function main() {
  if (!["p1", "p2"].includes(side))
    throw Error(
      "Commands: brief|wait|state|scout p1|p2 | card p1|p2 <slug> | mission p1|p2 | reach p1|p2 <type> [arg] | act p1|p2 '<JSON>' '<why>'",
    );
  if (verb === "card") return card(args[0]);
  const view = await request("state?side=" + side);
  if (!view) throw Error("No active match.");
  if (verb === "brief") return brief(view, side);
  if (verb === "state") return compact(view, side);
  if (verb === "scout") {
    const enemy = side === "p1" ? "p2" : "p1";
    const live = view.fighters.filter((f) => f.side === enemy && !f.ko);
    return live.length
      ? live.map((f) => profile(f.slug, f))
      : view.rosters[enemy].characters.map((slug) => profile(slug));
  }
  if (verb === "mission")
    return Object.values(view.mission || {}).map((id) => {
      const c = pool.crises[id];
      return {
        name: c.name,
        type: c.type,
        setup: strip(c.setupDescription),
        rules: (c.paragraphs || []).map(strip),
        scoring: strip(c.scoringDescription),
      };
    });
  if (verb === "wait") {
    const timeout = Date.now() + Number(args[0] || 600) * 1000;
    for (;;) {
      const v = await request("state?side=" + side);
      if (v.phase === "finished" || v.actions[side]?.length)
        return compact(v, side);
      if (Date.now() > timeout)
        return { waiting: true, phase: v.phase, awaitingSide: v.awaitingSide };
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (verb === "reach") {
    const result = await request(
      "reach?" +
        new URLSearchParams({
          side,
          type: args[0],
          fighter: /,/.test(args[1] || "") ? "" : args[1] || "",
          value: /,/.test(args[1] || "") ? "" : args[1] || "",
        }),
    );
    const pts = result.points;
    const toward = args.find((a) => /^-?[\d.]+,-?[\d.]+$/.test(a));
    if (toward) {
      const [tx, ty] = toward.split(",").map(Number);
      const d = ([x, y]) => Math.hypot(x - tx, y - ty);
      return {
        total: pts.length,
        closestTo: [tx, ty],
        best: [...pts]
          .sort((a, b) => d(a) - d(b))
          .slice(0, 6)
          .map((p) => [...p, +d(p).toFixed(2)]),
      };
    }
    const stride = Math.max(1, Math.ceil(pts.length / 60));
    return {
      total: pts.length,
      sample: pts.filter((_, i) => i % stride === 0),
    };
  }
  if (verb === "act") {
    const action = JSON.parse(args[0]);
    const why = args[1] || "";
    const entry = {
      side,
      revision: view.revision,
      phase: view.phase,
      round: view.round,
      score: view.score,
      active: view.active,
      actionsLeft: view.actionsLeft,
      action,
      why,
    };
    try {
      const next = await request("command", {
        side,
        source: "cli",
        revision: view.revision,
        action,
      });
      const added = next.log.slice(view.log.length);
      const after = await request("state?side=" + side + "&full=1");
      record(view.id, {
        ...entry,
        ok: true,
        engineLog: added,
        changes: diff(view, after),
      });
      return { ok: true, events: added.map((e) => e.text), state: compact(next, side) };
    } catch (error) {
      record(view.id, { ...entry, ok: false, error: error.message });
      const positional = ["x", "y"].some((k) => k in action);
      return {
        ok: false,
        error: error.message,
        ...(positional && {
          hint:
            "Invalid point (terrain, another base or out of range). Call reach " +
            side +
            " " +
            action.type +
            (action.value ? ' "' + action.value + '"' : action.fighter ? " " + action.fighter : "") +
            " <target x,y> and use a point from best.",
        }),
      };
    }
  }
  throw Error("Unknown command " + verb);
}

main()
  .then((result) => console.log(JSON.stringify(result, null, 1)))
  .catch((error) => {
    console.error(
      error.cause?.code === "ECONNREFUSED"
        ? "Game server is not running on port " + port
        : error.message,
    );
    process.exitCode = 1;
  });
