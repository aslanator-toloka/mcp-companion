"use strict";
// Shared room rules: both the Node server and a browser host use this authority.
(function(root){
function createRoomCore({Core, Geometry, Power, characters, tacticCards, crisisCards, getDetail, randomUUID, randomInt, eq}) {
const fail = (message, status = 400) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
const text = (v, max) => typeof v === "string" && v.length <= max;
function detail(slug) {
  if (!characters.has(slug)) fail("Неизвестный персонаж.");
  return getDetail(slug);
}
function references(slugs) {
  return Object.fromEntries(
    slugs.map((slug) => {
      const d = detail(slug);
      return [
        slug,
        Core.clone({
          statCard: {
            frontSide: d.statCard.frontSide,
            backSide: d.statCard.backSide,
          },
          secondStatCard: d.secondStatCard
            ? {
                frontSide: d.secondStatCard.frontSide,
                backSide: d.secondStatCard.backSide,
              }
            : null,
        }),
      ];
    }),
  );
}
function validateLibrary(value) {
  const c = value?.collection,
    b = value?.battles;
  if (
    c?.version !== 1 ||
    !Array.isArray(c.owned) ||
    !Array.isArray(c.rosters) ||
    !Array.isArray(c.groups) ||
    c.owned.some((s) => !characters.has(s)) ||
    c.rosters.length > 2000 ||
    c.groups.length > 200
  )
    fail("Некорректная коллекция.");
  const groupIds = new Set();
  for (const g of c.groups) {
    if (!g || !text(g.id, 100) || groupIds.has(g.id) || !text(g.name, 100))
      fail("Некорректная группа ростеров.");
    groupIds.add(g.id);
  }
  const ids = new Set();
  for (const r of c.rosters) {
    if (
      !r ||
      !text(r.id, 100) ||
      ids.has(r.id) ||
      !text(r.name, 100) ||
      !text(r.affiliation || "", 100)
    )
      fail("Некорректный ростер.");
    ids.add(r.id);
    for (const k of ["characters", "tactics", "crises", "groups"]) {
      if (
        !Array.isArray(r[k]) ||
        r[k].length > 100 ||
        r[k].some((s) => !text(s, 150))
      )
        fail("Некорректный состав ростера.");
    }
    if (r.groups.some((id) => !groupIds.has(id)))
      fail("В ростере указана неизвестная группа.");
    if (
      r.characters.some((s) => !characters.has(s)) ||
      r.tactics.some((s) => !tacticCards.has(s)) ||
      r.crises.some((s) => !crisisCards.has(s))
    )
      fail("Неизвестные карты ростера.");
  }
  try {
    Core.validate(b);
    for (const m of b.matches) Geometry.validate(m.map);
  } catch {
    fail("Некорректные локальные партии.");
  }
  return value;
}
function rosterFor(store, userId, id) {
  const roster = store
    .library(userId)
    .data.collection.rosters.find((r) => r.id === id);
  if (!roster) fail("Сначала сохраните ростер в своём аккаунте.", 404);
  return Core.clone(roster);
}
const team = (name, roster) => ({
  name,
  affiliation: roster?.affiliation || "",
  leader: null,
  fighters: [],
  tactics: [],
});
function createRoom(user, roster) {
  const id = randomUUID(),
    now = new Date().toISOString();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from(
    { length: 8 },
    () => alphabet[randomInt(alphabet.length)],
  ).join("");
  return {
    id,
    code,
    revision: 1,
    ready: { mine: false, opponent: false },
    members: [{ userId: user.id, name: user.name, side: "mine" }],
    rosters: { mine: roster },
    match: {
      id,
      status: "preparing",
      name: roster.name,
      createdAt: now,
      updatedAt: now,
      sourceRoster: roster,
      threat: 17,
      round: 1,
      score: { mine: 0, opponent: 0 },
      priority: "unknown",
      mine: team(user.name, roster),
      opponent: team("Ждём второго игрока"),
      secure: null,
      extract: null,
      references: {},
      undo: [],
      log: [],
    },
  };
}
function member(room, userId) {
  const m = room?.members.find((m) => m.userId === userId);
  if (!m) fail("Партия недоступна.", 404);
  return m;
}
function packet(room, userId, { live = false, knownReferences } = {}) {
  const m = member(room, userId);
  let match = room.match;
  if (live) {
    // Undo remains authoritative in SQLite. Live clients need availability,
    // not thirty snapshots; card rules are immutable within a running room.
    const { undo, references, ...state } = match;
    const known = new Set(Array.isArray(knownReferences) ? knownReferences : []);
    match = {
      ...state,
      undo: [],
      references: Object.fromEntries(
        Object.entries(references).filter(([slug]) => !known.has(slug)),
      ),
    };
  }
  return {
    ...Core.clone({ ...room, match }),
    ...(live
      ? { undoCount: room.match.undo.length, referencesDelta: Array.isArray(knownReferences) }
      : {}),
    side: m.side,
    members: room.members.map(({ name, side }) => ({ name, side })),
  };
}
function joinRoom(room, user, roster) {
  if (room.members.some((m) => m.userId === user.id)) return false;
  if (room.members.length >= 2 || room.match.status !== "preparing")
    fail("К этой партии уже нельзя присоединиться.", 409);
  room.members.push({ userId: user.id, name: user.name, side: "opponent" });
  room.rosters.opponent = roster;
  room.match.opponent = team(user.name, roster);
  room.ready = { mine: false, opponent: false };
  return true;
}
function safeTeam(input, roster, preparing) {
  if (
    !input ||
    !text(input.name, 100) ||
    !text(input.affiliation, 100) ||
    !Array.isArray(input.fighters) ||
    input.fighters.length > 20 ||
    !Array.isArray(input.tactics) ||
    input.tactics.length > 10
  )
    fail("Некорректный отряд.");
  const result = {
    name: input.name,
    affiliation: input.affiliation,
    leader: input.leader || null,
    fighters: [],
    tactics: [],
  };
  const slugs = new Set();
  for (const f of input.fighters) {
    const info = characters.get(f.slug);
    if (
      !info ||
      info.isGrunt ||
      slugs.has(f.slug) ||
      !text(f.id, 100) ||
      (preparing && !roster.characters.includes(f.slug))
    )
      fail("Выбирайте бойцов своего ростера.");
    slugs.add(f.slug);
    const base = Core.fighter(info, detail(f.slug), f.id);
    if (!preparing) {
      for (const k of [
        "face",
        "form",
        "hp",
        "power",
        "acted",
        "status",
        "conditions",
        "objectives",
      ]) {
        if (f[k] === undefined) fail("Неполные данные бойца.");
        base[k] = Core.clone(f[k]);
      }
      const d = detail(f.slug),
        card = base.form === 1 ? d.secondStatCard : d.statCard;
      const face = base.face === "back" ? card?.backSide : card?.frontSide;
      base.maxHp = Number(face?.stamina);
    }
    if (
      !Array.isArray(base.conditions) ||
      base.conditions.length > 40 ||
      base.conditions.some((c) => !text(c, 80))
    )
      fail("Некорректные состояния.");
    result.fighters.push(base);
  }
  const tactics = new Set();
  for (const t of input.tactics) {
    const c = tacticCards.get(t.slug);
    if (
      !c ||
      tactics.has(t.slug) ||
      (preparing &&
        !roster.tactics.some(
          (slug) => tacticCards.get(slug)?.cardFamily === c.cardFamily,
        ))
    )
      fail("Выбирайте тактики своего ростера.");
    tactics.add(t.slug);
    result.tactics.push({
      slug: c.slug,
      name: c.name,
      played: preparing ? false : !!t.played,
      card: c,
    });
  }
  if (result.leader && !result.fighters.some((f) => f.id === result.leader))
    fail("Лидер отсутствует в отряде.");
  return result;
}
function mission(input, type) {
  if (input === null) return null;
  const c = crisisCards.get(input?.slug);
  if (!c || c.type !== type) fail("Неизвестный кризис.");
  return Core.clone(c);
}
function validateMatch(m) {
  try {
    Core.validate({ version: 1, matches: [m] });
    Geometry.validate(m.map);
  } catch {
    fail("Некорректное состояние партии.");
  }
  if (
    m.threat > 99 ||
    m.round > 100 ||
    m.score.mine > 10000 ||
    m.score.opponent > 10000
  )
    fail("Недопустимое значение счётчика.");
}
function advanceRoom(room, userId, { round, priority, power }) {
  member(room, userId);
  const m = room.match;
  if (m.status !== "active") fail("Переход раунда доступен во время боя.", 409);
  if (round !== m.round)
    fail("Этот раунд уже закончился. Откройте переход заново.", 409);
  if (
    !["mine", "opponent", "unknown"].includes(priority) ||
    typeof power !== "boolean"
  )
    fail("Проверьте параметры нового раунда.");
  const now = new Date().toISOString(),
    next = Core.update(
      m,
      "Начат раунд " + (m.round + 1),
      (n) => {
        Core.nextRound(n);
        n.priority = priority;
        if (power) Power.apply(n);
      },
      now,
    );
  validateMatch(next);
  room.match = next;
}
function powerRoom(room, userId, { round, repeat }) {
  member(room, userId);
  const m = room.match;
  if (m.status !== "active") fail("Power Phase доступна во время боя.", 409);
  if (round !== m.round)
    fail("Раунд изменился. Откройте Power Phase заново.", 409);
  if (typeof repeat !== "boolean")
    fail("Проверьте подтверждение повторного начисления.");
  if (
    (m.powerPhaseRound === m.round || m.basePowerRound === m.round) &&
    !repeat
  )
    fail("В этом раунде энергия уже начислена.", 409);
  const next = Core.update(
    m,
    "Power Phase: фиксированные начисления по картам и состояниям",
    (n) => Power.apply(n),
    new Date().toISOString(),
  );
  validateMatch(next);
  room.match = next;
}
function editRoom(room, userId, input, label) {
  const side = member(room, userId).side,
    old = room.match,
    preparing = old.status === "preparing";
  if (old.status === "finished") fail("Бой завершён.", 409);
  if (!input || !text(label, 180)) fail("Некорректное изменение.");
  if (preparing) {
    const other = side === "mine" ? "opponent" : "mine";
    if (!eq(input[other], old[other]))
      fail("В подготовке можно менять только свой отряд.", 403);
    if (input.status !== "preparing")
      fail("Бой начинается после готовности обоих.", 403);
  }
  const next = Core.clone(old);
  for (const key of ["name", "threat", "priority", "map"])
    if (input[key] !== undefined) next[key] = Core.clone(input[key]);
  if (
    !text(next.name, 100) ||
    !Number.isInteger(next.threat) ||
    next.threat < 1 ||
    next.threat > 99
  )
    fail("Проверьте название и Threat.");
  next.secure = mission(input.secure, "Secure");
  next.extract = mission(input.extract, "Extraction");
  for (const s of ["mine", "opponent"])
    if (!preparing || s === side)
      next[s] = safeTeam(input[s], room.rosters[s], preparing);
  next.references = references([
    ...new Set([
      ...Object.keys(old.references),
      ...Core.allFighters(next).map((f) => f.slug),
    ]),
  ]);
  if (!preparing) {
    if (
      input.round !== old.round ||
      input.powerPhaseRound !== old.powerPhaseRound ||
      input.basePowerRound !== old.basePowerRound
    )
      fail(
        "Обновите страницу: раунд и Power Phase выполняются отдельными командами.",
        409,
      );
    if (!["active", "finished"].includes(input.status))
      fail("Нельзя вернуться к подготовке.");
    next.status = input.status;
    next.score = Core.clone(input.score);
    next.round = input.round;
    for (const k of ["powerPhaseRound", "basePowerRound"])
      if (input[k] !== undefined) next[k] = input[k];
    if (next.status === "finished") next.finishedAt = new Date().toISOString();
  }
  const now = new Date().toISOString();
  next.updatedAt = now;
  if (!preparing) {
    const updated = Core.update(old, label, (m) => Object.assign(m, next), now);
    next.undo = updated.undo;
    next.log = updated.log;
  }
  validateMatch(next);
  if (preparing) {
    const shared = [
      "name",
      "threat",
      "priority",
      "map",
      "secure",
      "extract",
    ].some((k) => !eq(old[k], next[k]));
    if (shared) room.ready = { mine: false, opponent: false };
    else room.ready[side] = false;
  }
  room.match = next;
}
function readyRoom(room, userId, ready) {
  const side = member(room, userId).side;
  if (room.match.status !== "preparing") fail("Подготовка уже закончена.", 409);
  if (typeof ready !== "boolean") fail("Некорректная готовность.");
  if (ready) {
    const m = room.match,
      t = m[side];
    if (!t.fighters.length) fail("Выберите хотя бы одного бойца.");
    const view = Core.clone(m);
    if (side === "opponent")
      [view.mine, view.opponent] = [view.opponent, view.mine];
    const errors = Core.errors(view);
    if (errors.length) fail(errors[0]);
  }
  room.ready[side] = ready;
  if (room.members.length === 2 && room.ready.mine && room.ready.opponent) {
    const now = new Date().toISOString();
    room.match.status = "active";
    room.match.startedAt = now;
    room.match.log = [
      { at: now, round: 1, text: "Оба игрока готовы. Бой начат." },
    ];
    room.match.undo = [];
  }
}
return {
  fail,
  validateLibrary,
  rosterFor,
  createRoom,
  member,
  packet,
  joinRoom,
  editRoom,
  readyRoom,
  advanceRoom,
  powerRoom,
  validateMatch,
};
}
if(typeof module==='object'&&module.exports)module.exports=createRoomCore;
root.MCPRoomCore=createRoomCore;
})(typeof window==='object'?window:globalThis);
