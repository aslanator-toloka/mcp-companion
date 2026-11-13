const boardSize = 36;
const gridStep = 0.25;
const edges = ["south", "north", "west", "east"];
const oppositeEdge = {
  south: "north",
  north: "south",
  west: "east",
  east: "west",
};
const range = [0, 1, 3, 6, 8, 10];
const projectionRadius = 0.5;
function projectionAt(point, reference) {
  const token = { x: point.x, y: point.y, radius: projectionRadius };
  return Number.isFinite(token.x) &&
    Number.isFinite(token.y) &&
    token.x >= projectionRadius &&
    token.y >= projectionRadius &&
    token.x <= boardSize - projectionRadius &&
    token.y <= boardSize - projectionRadius &&
    within(reference, token, 3)
    ? token
    : null;
}
const toolLengths = { S: 3.25, M: 5, L: 7.25 };
const epsilon = 1e-8;
const toolHalfWidth = 0.4;
const halfTurn = Math.PI / 2;
const bendOffsets = Array.from({ length: 19 }, (_, index) => {
  const step = Math.ceil(index / 2);
  return ((step * Math.PI) / 36) * (index % 2 ? 1 : -1);
});

const battlefield = [
  { id: "car-1", name: "Автомобиль", size: 2, x: 7, y: 9.5, w: 3, h: 1.5 },
  { id: "car-2", name: "Автомобиль", size: 2, x: 26, y: 25, w: 3, h: 1.5 },
  { id: "truck-1", name: "Грузовик", size: 3, x: 24, y: 10, w: 4.5, h: 2 },
  { id: "truck-2", name: "Грузовик", size: 3, x: 7.5, y: 24, w: 4.5, h: 2 },
  { id: "building-1", name: "Здание", size: 4, x: 11, y: 11.5, w: 4, h: 3.5 },
  { id: "building-2", name: "Здание", size: 4, x: 21, y: 21, w: 4, h: 3.5 },
  { id: "wall-1", name: "Стена", size: 2, x: 3, y: 21, w: 2.5, h: 1 },
  { id: "wall-2", name: "Стена", size: 2, x: 30.5, y: 14, w: 2.5, h: 1 },
  { id: "bench-1", name: "Скамейка", size: 1, x: 16, y: 15, w: 1.5, h: 1 },
  { id: "bench-2", name: "Скамейка", size: 1, x: 18.5, y: 20, w: 1.5, h: 1 },
  { id: "tower", name: "Башня", size: 5, x: 15.75, y: 2, w: 4.5, h: 3.5 },
  { id: "kiosk", name: "Киоск", size: 3, x: 16.5, y: 30.5, w: 3, h: 3 },
];

function snap(point) {
  return Object.fromEntries(
    ["x", "y"].map((axis) => [
      axis,
      Math.round(point[axis] / gridStep) * gridStep,
    ]),
  );
}

function circleOverlaps(point, radius, rect) {
  const dx = Math.max(rect.x - point.x, 0, point.x - rect.x - rect.w);
  const dy = Math.max(rect.y - point.y, 0, point.y - rect.y - rect.h);
  return dx * dx + dy * dy < radius * radius - epsilon;
}

function entirelyOn(point, radius, rect) {
  return (
    point.x - radius >= rect.x - epsilon &&
    point.x + radius <= rect.x + rect.w + epsilon &&
    point.y - radius >= rect.y - epsilon &&
    point.y + radius <= rect.y + rect.h + epsilon
  );
}

function fits(point, fighter, fighters, terrain) {
  const { radius } = fighter;
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= radius &&
    point.y >= radius &&
    point.x <= boardSize - radius &&
    point.y <= boardSize - radius &&
    fighters.every(
      (other) =>
        other.id === fighter.id ||
        other.x == null ||
        Math.hypot(point.x - other.x, point.y - other.y) >=
          radius + other.radius - epsilon,
    ) &&
    terrain.every(
      (rect) =>
        !circleOverlaps(point, radius, rect) || entirelyOn(point, radius, rect),
    )
  );
}

function deployable(point, edge, fighter, fighters, terrain) {
  const fromEdge = {
    north: point.y,
    south: boardSize - point.y,
    east: boardSize - point.x,
    west: point.x,
  };
  return (
    fromEdge[edge] - fighter.radius <= range[3] &&
    fits(point, fighter, fighters, terrain)
  );
}

function hitsRect(from, to, rect, margin) {
  let enter = 0;
  let exit = 1;
  for (const [axis, size] of [
    ["x", "w"],
    ["y", "h"],
  ]) {
    const delta = to[axis] - from[axis];
    const low = rect[axis] - margin;
    const high = rect[axis] + rect[size] + margin;
    if (Math.abs(delta) < epsilon) {
      if (from[axis] <= low || from[axis] >= high) return false;
      continue;
    }
    const a = (low - from[axis]) / delta;
    const b = (high - from[axis]) / delta;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (enter >= exit) return false;
  }
  return true;
}

function movement(fighter, mode, fighters, terrain) {
  const radius = fighter.radius;
  const size = mode === "climb" || fighter.climbsOnAdvance ? 5 : fighter.size;
  const speed =
    mode === "climb" || fighter.conditions?.includes("slow")
      ? "S"
      : fighter.speed;
  const lengths = Object.entries(toolLengths).filter(
    ([, length]) => length <= toolLengths[speed],
  );
  const maximum = toolLengths[speed] + 2 * radius;
  const obstacles = terrain.filter(
    (rect) => rect.size > size && !circleOverlaps(fighter, radius, rect),
  );
  const clear = (a, b) =>
    obstacles.every((rect) => !hitsRect(a, b, rect, toolHalfWidth));
  return {
    maximum,
    route(point) {
      const dx = point.x - fighter.x;
      const dy = point.y - fighter.y;
      const distance = Math.hypot(dx, dy);
      if (
        distance < epsilon ||
        distance > maximum + epsilon ||
        !fits(point, fighter, fighters, terrain)
      )
        return null;
      if (clear(fighter, point)) return [fighter, point];
      const direction = Math.atan2(dy, dx);
      for (const [, length] of lengths) {
        const arm = length / 2 + radius;
        for (const offset of bendOffsets) {
          const angle = direction + offset;
          const elbow = {
            x: fighter.x + arm * Math.cos(angle),
            y: fighter.y + arm * Math.sin(angle),
          };
          const remainder = Math.hypot(point.x - elbow.x, point.y - elbow.y);
          const turn = Math.atan2(point.y - elbow.y, point.x - elbow.x) - angle;
          if (
            remainder > arm ||
            Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) > halfTurn
          )
            continue;
          if (clear(fighter, elbow) && clear(elbow, point))
            return [fighter, elbow, point];
        }
      }
      return null;
    },
  };
}

function rangeAfterMove(fighter, radius, fighters, terrain) {
  const advance = movement(fighter, "advance", fighters, terrain);
  const climb = movement(fighter, "climb", fighters, terrain);
  const limit = Math.max(advance.maximum, climb.maximum);
  const last = boardSize / gridStep;
  const stride = last + 2;
  const rows = new Int32Array((last + 1) * stride);

  function addRange({ x, y }) {
    const first = Math.max(0, Math.ceil((y - radius) / gridStep));
    const end = Math.min(last, Math.floor((y + radius) / gridStep));
    for (let row = first; row <= end; row++) {
      const dy = row * gridStep - y;
      const dx = Math.sqrt(Math.max(0, radius * radius - dy * dy));
      const left = Math.max(0, Math.ceil((x - dx) / gridStep));
      const right = Math.min(last, Math.floor((x + dx) / gridStep));
      if (left > right) continue;
      rows[row * stride + left]++;
      rows[row * stride + right + 1]--;
    }
  }

  addRange(fighter);
  for (
    let y = Math.ceil(Math.max(0, fighter.y - limit) / gridStep) * gridStep;
    y <= Math.min(boardSize, fighter.y + limit);
    y += gridStep
  ) {
    for (
      let x = Math.ceil(Math.max(0, fighter.x - limit) / gridStep) * gridStep;
      x <= Math.min(boardSize, fighter.x + limit);
      x += gridStep
    ) {
      const point = { x, y };
      if (advance.route(point) || climb.route(point)) addRange(point);
    }
  }

  let path = "";
  for (let row = 0; row <= last; row++) {
    let coverage = 0;
    let start = 0;
    for (let col = 0; col <= last + 1; col++) {
      const previous = coverage;
      coverage += rows[row * stride + col];
      if (!previous && coverage) start = col;
      if (previous && !coverage)
        path += `M${(start - 0.5) * gridStep} ${row * gridStep}H${(col - 0.5) * gridStep}`;
    }
  }
  return path;
}

module.exports = {
  battlefield,
  deployable,
  edges,
  gridStep,
  movement,
  projectionAt,
  rangeAfterMove,
  oppositeEdge,
  snap,
};

function distance(a, b) {
  return Math.max(
    0,
    Math.hypot(a.x - b.x, a.y - b.y) - (a.radius || 0) - (b.radius || 0),
  );
}

function within(a, b, level) {
  return a.x != null && b.x != null && distance(a, b) <= range[level] + epsilon;
}

function distanceToTerrain(point, rect) {
  const dx = Math.max(rect.x - point.x, 0, point.x - rect.x - rect.w);
  const dy = Math.max(rect.y - point.y, 0, point.y - rect.y - rect.h);
  return Math.max(0, Math.hypot(dx, dy) - point.radius);
}

const constructWidth = 35 / 25.4;
function metalConstruct(point, reference, fighters, terrain) {
  const w = constructWidth;
  const rect = { x: point.x - w / 2, y: point.y - w / 2, w, h: w };
  return Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + w <= boardSize &&
    rect.y + w <= boardSize &&
    distanceToTerrain(reference, rect) <= range[3] + epsilon &&
    !fighters.some((f) => f.x != null && circleOverlaps(f, f.radius, rect)) &&
    !terrain.some(
      (t) =>
        rect.x < t.x + t.w &&
        rect.x + w > t.x &&
        rect.y < t.y + t.h &&
        rect.y + w > t.y,
    )
    ? rect
    : null;
}

function lineOfSight(from, target, terrain) {
  const ground = terrain.find((rect) => entirelyOn(from, from.radius, rect));
  const targetGround = terrain.find((rect) =>
    entirelyOn(target, target.radius, rect),
  );
  const targetSize = target.size + (targetGround?.size || 0);
  const blockers = terrain.filter(
    (rect) => rect !== ground && rect.size > targetSize,
  );
  const cover = within(from, target, 2)
    ? []
    : terrain.filter(
        (rect) =>
          rect.size >= target.size &&
          distanceToTerrain(target, rect) <= range[1],
      );
  const sampleBase = (f) => [
    f,
    ...Array.from({ length: 16 }, (_, index) => {
      const angle = (index * Math.PI) / 8;
      return {
        x: f.x + f.radius * Math.cos(angle),
        y: f.y + f.radius * Math.sin(angle),
      };
    }),
  ];
  const start = sampleBase(from),
    end = sampleBase(target);
  return {
    visible: start.some((a) =>
      end.some((b) => blockers.every((rect) => !hitsRect(a, b, rect, 0))),
    ),
    cover: cover.some((rect) =>
      start.some((a) => end.some((b) => hitsRect(a, b, rect, 0))),
    ),
  };
}

function beamHits(actor, target, level, angle) {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians),
    sin = Math.sin(radians);
  const dx = target.x - actor.x,
    dy = target.y - actor.y;
  const forward = dx * cos + dy * sin - actor.radius;
  const across = dy * cos - dx * sin;
  return (
    Math.hypot(
      Math.max(0, -forward, forward - range[level]),
      Math.max(0, Math.abs(across) - 0.5),
    ) <=
    target.radius + epsilon
  );
}

function beamReaches(origin, target, level, angle, damageType) {
  return (
    beamHits(origin, target, level, angle) ||
    (damageType === "mystic" &&
      target.projection &&
      beamHits(origin, target.projection, level, angle))
  );
}
Object.assign(module.exports, {
  fits,
  within,
  lineOfSight,
  beamHits,
  beamReaches,
});

function toolEnd(
  origin,
  mover,
  terrain,
  fighters,
  speed,
  angle,
  ignored,
  breakSize = 0,
) {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians),
    sin = Math.sin(radians);
  const start = new Set(
    terrain.filter((item) => circleOverlaps(origin, mover.radius, item)),
  );
  let point = { x: origin.x, y: origin.y };
  let remaining = terrain;
  const destroyed = [];
  const stop = (contact) => ({
    point,
    ...contact,
    ...(destroyed.length ? { destroyed } : {}),
  });
  const length = toolLengths[speed];
  const increments = Math.ceil(length / 0.02);
  for (let i = 1; i <= increments; i++) {
    const d = (length * i) / increments;
    const next = { x: origin.x + cos * d, y: origin.y + sin * d };
    if (
      next.x < mover.radius ||
      next.y < mover.radius ||
      next.x > boardSize - mover.radius ||
      next.y > boardSize - mover.radius
    )
      return stop();
    const touches = (f) =>
      f.x != null &&
      f.id !== mover.id &&
      f.id !== ignored &&
      Math.hypot(next.x - f.x, next.y - f.y) < f.radius + mover.radius;
    const target = fighters.find(touches);
    if (target)
      return stop({
        fighter: target.id,
        ...(breakSize
          ? { contacts: fighters.filter(touches).map((f) => f.id) }
          : {}),
      });
    const contacts = (item) =>
      !start.has(item) && circleOverlaps(next, mover.radius, item);
    let piece = remaining.find(contacts);
    while (piece && piece.size <= breakSize) {
      destroyed.push(piece.id);
      remaining = remaining.filter((item) => item !== piece);
      piece = remaining.find(contacts);
    }
    if (piece) return stop({ terrain: piece.id });
    if (fits(next, mover, fighters, remaining)) point = next;
  }
  return stop();
}

function allowedAngle(mover, reference, kind, angle) {
  if (!Number.isFinite(angle)) return false;
  if (
    !reference ||
    !kind ||
    (mover.x === reference.x && mover.y === reference.y)
  )
    return true;
  const bearing =
    Math.atan2(mover.y - reference.y, mover.x - reference.x) +
    (kind === "toward" ? Math.PI : 0);
  const delta = (angle * Math.PI) / 180 - bearing;
  return Math.cos(delta) >= Math.SQRT1_2 - epsilon;
}

function terrainThrowPath(actor, pieceId, terrain, fighters, speed, angle) {
  const bearing = (angle * Math.PI) / 180;
  const origin = {
    x: actor.x + Math.cos(bearing) * actor.radius,
    y: actor.y + Math.sin(bearing) * actor.radius,
  };
  return toolEnd(
    origin,
    { id: actor.id, radius: 0.4 },
    terrain.filter((piece) => piece.id !== pieceId),
    fighters,
    speed,
    angle,
  );
}
Object.assign(module.exports, {
  toolEnd,
  terrainThrowPath,
  allowedAngle,
  distanceToTerrain,
  metalConstruct,
  constructWidth,
  range,
});
