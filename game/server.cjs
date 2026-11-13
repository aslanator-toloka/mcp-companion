const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const { pool, details } = require("./catalog.cjs");
const engine = require("./engine.cjs");
const geometry = require("./geometry.cjs");
const combat = require("./combat.cjs");
const { deployable, movement, within, gridStep } = geometry;

function gameRouter(file) {
  const api = express.Router();
  let state = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : null;

  function save(next) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(next), { mode: 0o600 });
    fs.renameSync(temp, file);
    state = next;
  }

  if (state?.volley?.remaining.length === 1) {
    const next = structuredClone(state);
    if (engine.continueSingleTarget(next)) {
      next.revision += 1;
      save(next);
    }
  }

  api.use((req, res, next) => {
    const host = req.get("host");
    const origin = req.get("origin");
    if (
      !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host || "") ||
      (origin && origin !== "http://" + host)
    ) {
      return res
        .status(403)
        .json({ error: "Game доступна через локальный сервер." });
    }
    res.set("Cache-Control", "no-store");
    next();
  });
  api.use(express.json({ limit: "32kb" }));
  api.get("/catalog", (_req, res) => res.json(pool));
  api.get("/character/:slug", (req, res) => {
    const slug = req.params.slug;
    if (!Object.hasOwn(details, slug))
      return res.status(404).json({ error: "Персонаж не входит в Game." });
    res.json({
      character: pool.characters[slug],
      statCard: details[slug].statCard,
    });
  });
  api.get("/state", (req, res) => {
    const side = req.query.side === "p2" ? "p2" : "p1";
    res.json(engine.view(state, side, req.query.full === "1"));
  });

  api.get("/reach", (req, res) => {
    const side = req.query.side === "p2" ? "p2" : "p1";
    const type = req.query.type;
    const actions = state && engine.view(state, side).actions[side];
    const allowed = actions?.find((option) => option.type === type);
    const fighter =
      (type === "place-construct" ? allowed?.reference : allowed?.model) ||
      state?.fighters.find(
        (f) =>
          f.id ===
          (type === "deploy"
            ? req.query.fighter
            : allowed?.mover || state.active),
      );
    const power =
      type === "power" &&
      allowed?.powers.find(
        (p) =>
          p.value === req.query.value && ["place", "advance"].includes(p.mode),
      );
    const drop =
      type === "drop-objective" &&
      allowed &&
      state.objectives.find((o) => o.id === allowed.objective);
    const positioned =
      ["displace", "transform", "spawn-drones", "place-construct"].includes(
        type,
      ) && ["place", "advance"].includes(allowed?.mode);
    if (
      !allowed ||
      (!drop && !fighter) ||
      (!["advance", "climb", "deploy", "bonus-move", "granted-move"].includes(
        type,
      ) &&
        !power &&
        !drop &&
        !positioned) ||
      (type === "deploy" && !allowed.fighters.includes(fighter.id))
    )
      return res.status(400).json({ error: "Движение сейчас недоступно." });
    let move = null;
    let check;
    if (type === "deploy") {
      check = (point) =>
        deployable(
          point,
          state.deployment[side],
          fighter,
          state.fighters,
          state.terrain,
        );
    } else if (drop) {
      check = (point) =>
        within(allowed.origin, { ...point, radius: drop.radius }, 2);
    } else if (power) {
      check = (point) =>
        combat.powerDestination(fighter, power, point, state, geometry);
    } else if (type === "place-construct") {
      check = (point) =>
        geometry.metalConstruct(
          point,
          allowed.reference,
          state.fighters,
          state.terrain,
        );
    } else if (positioned && allowed.mode === "place") {
      check = (point) =>
        within(
          allowed.reference,
          { ...point, radius: fighter.radius },
          allowed.range,
        ) && geometry.fits(point, fighter, state.fighters, state.terrain);
    } else {
      const mode =
        type === "climb" ||
        (type === "granted-move" && req.query.value === "climb")
          ? "climb"
          : "advance";
      move = movement(
        combat.movementModel({
          ...fighter,
          ...(allowed.speed && { speed: allowed.speed }),
          ...(allowed.climbsOnAdvance && { climbsOnAdvance: true }),
        }),
        mode,
        state.fighters,
        state.terrain,
      );
      check = allowed.direction
        ? (point) =>
            geometry.allowedAngle(
              fighter,
              allowed.reference,
              allowed.direction,
              (Math.atan2(point.y - fighter.y, point.x - fighter.x) * 180) /
                Math.PI,
            ) && move.route(point)
        : move.route;
    }
    const points = [];
    for (let y = 0; y <= 36; y += gridStep) {
      if (move && Math.abs(y - fighter.y) > move.maximum) continue;
      for (let x = 0; x <= 36; x += gridStep) {
        if (
          (!move || Math.abs(x - fighter.x) <= move.maximum) &&
          check({ x, y })
        )
          points.push([x, y]);
      }
    }
    res.json({ revision: state.revision, step: gridStep, points });
  });

  api.post("/new", (req, res) => {
    try {
      if (state && state.phase !== "finished" && req.body.replace !== state.id)
        return res.status(409).json({ error: "Уже есть активная партия." });
      save(engine.create(req.body, (state?.revision || 0) + 1));
      res.json(engine.view(state, "p1"));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  api.post("/finish", (req, res) => {
    if (!state || req.body?.id !== state.id)
      return res.status(409).json({ error: "Активная партия изменилась." });
    if (state.phase !== "finished") {
      const next = structuredClone(state);
      engine.finish(next);
      next.revision += 1;
      save(next);
    }
    res.json(engine.view(state, "p1"));
  });

  api.post("/command", (req, res) => {
    const { side, source, revision, action } = req.body || {};
    if (!engine.sides.includes(side) || !["cli", "browser"].includes(source))
      return res
        .status(400)
        .json({ error: "Укажите сторону и источник команды." });
    if (!state || revision !== state.revision)
      return res
        .status(409)
        .json({ error: "Партия изменилась. Обновите состояние." });
    const next = structuredClone(state);
    try {
      if (action?.type === "take") {
        if (state.phase === "finished")
          return res.status(409).json({ error: "Матч завершён." });
        next.controllers[side] = source;
      } else {
        if (state.controllers[side] !== source)
          return res
            .status(409)
            .json({ error: "Сторона сейчас под другим управлением." });
        engine.act(next, side, action);
      }
      next.revision += 1;
      save(next);
      res.json(engine.view(state, side));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  return api;
}

module.exports = { gameRouter };
