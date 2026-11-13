const { pool } = require("./catalog.cjs");
const combat = require("./combat.cjs");
const { within } = require("./geometry.cjs");

const name = (id) => pool.tactics[id].name;
const available = (state, side, id) =>
  state.squads[side]?.tactics.includes(id) &&
  !state.playedTactics?.[side]?.includes(id);
const hammerTax = (state, f) =>
  Number(
    state.objectives.some(
      (o) => o.holder === f.id && o.name === "Celestial Hammer",
    ),
  );
const near = (f, target, level) =>
  f.id === target.id || within(f, target, level);
const canSpend = (state, f, power) =>
  !combat.isPower(f, "Diamond Mind") && f.power >= power + hammerTax(state, f);
const choices = (values) => values.map(([value, label]) => ({ value, label }));
const activeCards = {
  "heavy-firepower-ca10": { cost: 2 },
  "i-am-a-baron-after-all": {
    cost: 0,
    character: "baron-helmut-zemo",
    options: choices([
      ["reroll", "Перебросы"],
      ["power", "Получить Power"],
      ["heal", "Восстановить HP"],
    ]),
  },
  "battle-plan": { cost: 3, character: "captain-america-first-avenger" },
  "glory-of-ultron": { cost: 0, character: "ultron-metal-tyrant" },
};

function activationOptions(state, fighter) {
  if (fighter.grunt || combat.isPower(fighter, "Diamond Mind")) return [];
  const side = fighter.side;
  const result = Object.entries(activeCards).flatMap(([id, rule]) =>
    available(state, side, id) &&
    (!rule.character || rule.character === fighter.slug) &&
    canSpend(state, fighter, rule.cost)
      ? [
          {
            value: id,
            label: name(id),
            cost: rule.cost + hammerTax(state, fighter),
            choices: rule.options,
          },
        ]
      : [],
  );
  if (
    fighter.slug === "invincible-iron-man" &&
    available(state, side, "helios-laser-bombardment")
  ) {
    const payments = state.fighters
      .filter(
        (f) => f.side === side && combat.usable(f) && canSpend(state, f, 1),
      )
      .map((f) => ({
        id: f.id,
        label: f.name,
        maximum: f.power - hammerTax(state, f),
      }));
    if (payments.length)
      result.push({
        value: "helios-laser-bombardment",
        label: name("helios-laser-bombardment"),
        cost: 0,
        payments,
      });
  }
  if (
    fighter.slug === "invincible-iron-man" &&
    state.actionsLeft &&
    available(state, side, "repulsor-refraction") &&
    canSpend(state, fighter, 1)
  ) {
    const allies = state.fighters.filter(
      (f) =>
        f.side === side &&
        f.slug === "captain-america-first-avenger" &&
        combat.usable(f) &&
        within(fighter, f, 4) &&
        canSpend(state, f, 1),
    );
    if (allies.length)
      result.push({
        value: "repulsor-refraction",
        label: name("repulsor-refraction"),
        cost: 1 + hammerTax(state, fighter),
        choices: allies.map((f) => ({ value: f.id, label: f.name })),
      });
  }
  if (
    ["crossbones", "sin"].includes(fighter.slug) &&
    available(state, side, "illicit-tech") &&
    canSpend(state, fighter, 1)
  )
    result.push({
      value: "illicit-tech",
      label: name("illicit-tech"),
      cost: 1 + hammerTax(state, fighter),
    });
  return result;
}

function use(state, side, id) {
  (state.playedTactics ||= { p1: [], p2: [] })[side].push(id);
}

function queueRefund(state, side, payers) {
  if (
    !payers.length ||
    !combat.leadership(state, side, "Army of Evil") ||
    state.leadershipUses?.[side]?.includes("army-refund")
  )
    return;
  (state.leadershipUses ||= { p1: [], p2: [] })[side].push("army-refund");
  state.effects.unshift({
    type: "hydra-refund",
    side,
    options: payers.map((f) => ({
      value: f.id,
      label: "Army of Evil · " + f.name,
    })),
  });
}

function activate(state, actor, option, action) {
  if (option.choices && !option.choices.some((c) => c.value === action.choice))
    throw Error("Выберите эффект карты.");
  actor.power -= option.cost;
  use(state, actor.side, option.value);
  const paid = option.cost > hammerTax(state, actor) ? [actor] : [];
  switch (option.value) {
    case "helios-laser-bombardment": {
      const payments = action.payments || {};
      const contributed = option.payments.filter((p) => payments[p.id]);
      if (
        !contributed.length ||
        Object.keys(payments).some(
          (id) => !option.payments.some((p) => p.id === id),
        ) ||
        contributed.some(
          (p) =>
            !Number.isInteger(payments[p.id]) ||
            payments[p.id] < 1 ||
            payments[p.id] > p.maximum,
        )
      )
        throw Error("Укажите допустимый вклад Power.");
      let dice = 0;
      for (const p of contributed) {
        const donor = state.fighters.find((f) => f.id === p.id);
        donor.power -= payments[p.id] + hammerTax(state, donor);
        paid.push(donor);
        dice += payments[p.id];
      }
      (actor.grantedAttacks ||= {})[101] = { dice };
      break;
    }
    case "repulsor-refraction": {
      const cap = state.fighters.find((f) => f.id === action.choice);
      cap.power -= 1 + hammerTax(state, cap);
      paid.push(cap);
      state.actionsLeft--;
      (actor.grantedAttacks ||= {})[102] = { origin: cap.id };
      state.effects.push({
        type: "granted-attack",
        side: actor.side,
        source: actor.id,
        index: 102,
      });
      break;
    }
    case "illicit-tech":
      (actor.grantedAttacks ||= {})[103] = {};
      break;
    case "heavy-firepower-ca10":
      actor.heavyFirepower = true;
      break;
    case "i-am-a-baron-after-all":
      if (action.choice === "reroll") actor.baronRerolls = state.round;
      if (action.choice === "power") combat.gain(actor, state.round);
      if (action.choice === "heal")
        actor.damage = Math.max(0, (actor.damage || 0) - state.round);
      break;
    case "battle-plan":
      state.effects.push(
        ...state.fighters
          .filter(
            (f) =>
              f.side === actor.side && combat.usable(f) && near(actor, f, 3),
          )
          .map((f) => ({
            type: "battle-plan",
            side: actor.side,
            target: f.id,
            source: actor.id,
          })),
      );
      break;
    case "glory-of-ultron": {
      const origins = state.fighters.filter(
        (f) =>
          f.side === actor.side &&
          (f.id === actor.id || f.slug === "ultron-drones-grunts") &&
          combat.usable(f),
      );
      const targets = state.fighters.filter(
        (f) =>
          f.side !== actor.side &&
          combat.usable(f) &&
          origins.some((o) => within(f, o, 2)),
      );
      if (targets.length)
        state.effects.push({
          type: "glory-of-ultron",
          side: targets[0].side,
          source: actor.id,
          remaining: targets.map((f) => f.id),
          declined: [],
          paid: 0,
        });
      break;
    }
  }
  queueRefund(state, actor.side, paid);
}

function phaseEffects(state) {
  const effects = [];
  for (const side of [state.priority, state.priority === "p1" ? "p2" : "p1"]) {
    for (const f of state.fighters.filter(
      (f) => f.side === side && combat.usable(f),
    )) {
      if (combat.isPower(f, "Phasing"))
        effects.push({ type: "phase-shift", side, target: f.id });
      if (combat.isPower(f, "Master of Magnetism")) {
        const count = state.terrain.filter(
          (piece) => piece.construct === side,
        ).length;
        if (count < 2)
          effects.push({
            type: "place-construct",
            side,
            target: f.id,
            mode: "place",
            name: "Metal Construct",
            reference: { x: f.x, y: f.y, radius: f.radius },
            range: 3,
          });
        else combat.gain(f, count);
      }
    }
    for (const id of ["stark-armory", "survival"]) {
      if (
        available(state, side, id) &&
        phaseChoices(state, { side, card: id }).length
      )
        effects.push({ type: "phase-tactic", side, card: id });
    }
  }
  return effects;
}

function phaseChoices(state, effect) {
  if (effect.type === "phase-shift")
    return choices([
      ["density", "Enhanced Density"],
      ["phased", "Phased"],
    ]);
  const own = state.fighters.filter(
    (f) => f.side === effect.side && combat.usable(f),
  );
  if (effect.card === "stark-armory")
    return own
      .filter((f) => f.slug === "invincible-iron-man")
      .flatMap((f) =>
        Array.from(
          { length: Math.min(5, Math.max(0, f.power - hammerTax(state, f))) },
          (_, i) => ({
            value: f.id + "|" + (i + 1),
            label: f.name + " · Stark Armory · " + (i + 1) + " Power",
          }),
        ),
      );
  return own
    .filter(
      (f) =>
        f.injured && canSpend(state, f, pool.characters[f.slug].threatLevel),
    )
    .map((f) => ({ value: f.id, label: f.name + " · Survival" }));
}

function playPhase(state, effect, value) {
  const get = (id) => state.fighters.find((f) => f.id === id);
  if (effect.type === "phase-shift") {
    get(effect.target).phasing = value;
    return "Phasing · " + value;
  }
  const [id, extra] = value.split("|");
  const actor = get(id);
  if (effect.card === "stark-armory") {
    actor.power -= Number(extra) + hammerTax(state, actor);
    actor.starkArmory = Number(extra);
  } else {
    actor.power -=
      pool.characters[actor.slug].threatLevel + hammerTax(state, actor);
    actor.survival = true;
    combat.dropObjectives(state, actor);
  }
  use(state, effect.side, effect.card);
  queueRefund(state, effect.side, [actor]);
  return actor.name + " · " + name(effect.card);
}

function resetTurn(state) {
  for (const f of state.fighters) f.survival = false;
}

module.exports = {
  activationOptions,
  activate,
  phaseEffects,
  phaseChoices,
  playPhase,
  resetTurn,
  available,
  canSpend,
  hammerTax,
  use,
};
