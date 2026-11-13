const { within } = require("./geometry.cjs");
const combat = require("./combat.cjs");
const log = require("./log.cjs");

const cards = {
  gamma: "gamma-wave-sweeps-across-midwest-ca09",
  cosmic: "cosmic-invasion-black-order-descends-on-earth-ca09",
  serum: "infinity-formula-goes-missing-ca09",
  demons: "demons-downtown-has-our-comeuppance-come-due-ca09",
  cores: "alien-ship-crashes-in-downtown-ca09",
  cubes: "struggle-for-the-cube-continues-ca09",
};
const onBoard = (o) => !o.holder;
const held = (state, f) => state.objectives.filter((o) => o.holder === f.id);

function interacts(state, actor) {
  if (actor.grunt || actor.power < 1 || combat.isPower(actor, "Wild Rage"))
    return [];
  return state.objectives.flatMap((o) => {
    if (
      !onBoard(o) ||
      (o.role === "secure" && combat.isPower(actor, "Anklebiter")) ||
      !within(actor, o, combat.interactRange(actor)) ||
      state.interacted?.includes(o.id)
    )
      return [];
    if (combat.canHoldExtract(state, actor, o))
      return [{ value: o.id, label: "Поднять " + o.name }];
    if (
      o.role === "secure" &&
      combat.leadership(state, actor.side, "Freedom Force")
    )
      return [
        { value: "freedom|" + o.id, label: "Freedom Force · " + o.name },
        ...(o.name === "Extremis Console" ? consoleOptions(state, o) : []),
      ];
    if (o.name === "Extremis Console") return consoleOptions(state, o);
    return [];
  });
}

function consoleOptions(state, o) {
  const targets = state.fighters
    .filter((f) => combat.usable(f) && f.damage > 0 && within(f, o, 2))
    .map((f) => ({ value: f.id, label: f.name }));
  return targets.length
    ? [{ value: o.id, label: "Использовать " + o.name, targets }]
    : [];
}

function secureSide(state, objective) {
  const nearby = state.fighters.filter(
    (f) =>
      !f.grunt &&
      combat.usable(f) &&
      !combat.isPower(f, "Anklebiter") &&
      within(f, objective, 1),
  );
  const healthy = nearby.filter(
    (f) => !f.injured || combat.isPower(f, "All Right, Now it‘s Serious..."),
  );
  const eligible = healthy.length ? healthy : nearby;
  if (objective.freedom && !nearby.some((f) => f.side !== objective.freedom))
    return objective.freedom;
  const balance = eligible.reduce(
    (sum, f) => sum + (f.side === "p1" ? 1 : -1),
    0,
  );
  return balance === 0 ? null : balance > 0 ? "p1" : "p2";
}

function points(state) {
  const score = { p1: 0, p2: 0 };
  for (const objective of state.objectives.filter((o) => o.role === "secure")) {
    const side = secureSide(state, objective);
    if (!side) continue;
    const distance = {
      north: objective.y,
      south: 36 - objective.y,
      west: objective.x,
      east: 36 - objective.x,
    }[state.deployment[side]];
    score[side] +=
      state.mission.secure === cards.gamma && distance > 18 ? 2 : 1;
  }
  for (const f of state.fighters.filter(combat.usable)) {
    const tokens = held(state, f);
    score[f.side] += tokens.some(
      (o) => o.name === "Power Core" || o.name === "Senator",
    )
      ? 1
      : tokens.length;
  }
  return score;
}

function powerPhase(state) {
  for (const f of state.fighters.filter(combat.usable)) {
    if (f.conditions?.includes("poison")) f.power = Math.max(0, f.power - 1);
    const near = state.objectives.some(
      (o) => o.role === "secure" && within(f, o, 1),
    );
    if (!near || combat.isPower(f, "Anklebiter")) continue;
    if (state.mission.secure === cards.serum) combat.gain(f, 1);
    if (state.mission.secure === cards.demons)
      combat.condition(f, "incinerate");
  }
}

function cosmicEffects(state) {
  if (state.mission.secure !== cards.cosmic) return [];
  const side = state.priority;
  const enemy = side === "p1" ? "p2" : "p1";
  return [side, enemy].flatMap((p) =>
    state.fighters
      .filter(
        (f) =>
          f.side === p &&
          combat.usable(f) &&
          state.objectives.some(
            (o) => o.name === "Cosmic Vault" && within(f, o, 1),
          ),
      )
      .map((f) => ({ type: "cosmic-check", side: p, target: f.id })),
  );
}
function cleanup(state, random) {
  for (const f of state.fighters.filter(combat.usable)) {
    if (combat.isPower(f, "Overload") && f.power >= 8) {
      combat.damage(state, f, 1);
      log(state, "Overload · " + f.name, { side: f.side, fighter: f.id });
    }
    if (
      state.mission.secure === cards.gamma &&
      !state.objectives.some((o) => o.role === "secure" && within(f, o, 2))
    )
      combat.damage(state, f, 1);
    if (state.mission.extract === cards.cubes) {
      const amount = held(state, f).length;
      combat.gain(
        f,
        combat.damage(state, f, amount, undefined, { gainIfDeferred: f.id }),
      );
    }
    if (
      state.mission.extract === cards.cores &&
      f.power >= 3 &&
      held(state, f).length &&
      combat.usable(f)
    ) {
      const rolled = combat.rawDice(3, random);
      combat.failurePower(state, f, rolled);
      const amount = rolled.filter(
        (die) => die === "wild" || die === "failure",
      ).length;
      log(state, "Power Core · " + f.name, {
        side: f.side,
        fighter: f.id,
        rolls: [{ label: "Бросок", faces: rolled }],
      });
      const origin = { ...f };
      for (const target of state.fighters.filter(
        (t) => t.id === f.id || within(t, origin, 2),
      ))
        combat.damage(state, target, amount);
    }
  }
}

module.exports = {
  interacts,
  held,
  points,
  powerPhase,
  cosmicEffects,
  cleanup,
  secureSide,
};
