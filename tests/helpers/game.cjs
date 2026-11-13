const { create } = require("../../game/engine.cjs");
const { pool } = require("../../game/catalog.cjs");

function trial(slugs) {
  const s = create({ p1: "avengers", p2: "cabal" }, 1);
  s.fighters = slugs.map(([side, slug, x]) => {
    const card = pool.characters[slug];
    return {
      id: side + ":" + slug,
      side,
      slug,
      name: card.name,
      size: card.size,
      speed: card.speed,
      radius: card.baseSize / 50.8,
      x,
      y: 8,
      power: 3,
      activated: false,
    };
  });
  Object.assign(s, {
    phase: "activation",
    round: 1,
    decisionSide: "p1",
    priority: "p1",
    terrain: [],
  });
  return s;
}

module.exports = { trial };
