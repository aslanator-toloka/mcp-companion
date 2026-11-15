const { pool } = require("./catalog.cjs");
const combat = require("./combat.cjs");
const {
  within,
  distanceToTerrain,
  range: rangeInches,
} = require("./geometry.cjs");

const name = (id) => pool.tactics[id].name;
const holdStillAttack = require("./catalog.cjs").grantedAttacks[104];
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
const member = (f, affiliation) =>
  pool.characters[f.slug]?.affiliations.some((a) => a.name === affiliation);
const xmen = (f) => member(f, "Uncanny X-Men");
const brotherhood = (f) => member(f, "Brotherhood of Mutants");
const threat = (f) => pool.characters[f.slug]?.threatLevel || 0;
const living = (state, side) =>
  state.fighters.filter((f) => f.side === side && combat.usable(f));
const enemies = (state, side) =>
  state.fighters.filter((f) => f.side !== side && combat.usable(f));
const holding = (state, f) => state.objectives.some((o) => o.holder === f.id);
// Rogue's partners for Pardon Me, Sugah, matched by the name on the card.
const sugahPartners = [
  ["wolverine", (f) => /Wolverine/.test(f.name)],
  ["cyclops", (f) => f.slug === "cyclops"],
  ["storm", (f) => f.slug === "storm"],
  ["deadpool", (f) => /Deadpool/.test(f.name)],
  ["magneto", (f) => f.slug === "magneto"],
];
const activeCards = {
  "heavy-firepower-ca10": { cost: 2 },
  "i-am-a-baron-after-all": {
    cost: 0,
    character: "baron-helmut-zemo",
    options: choices([
      ["reroll", "Rerolls"],
      ["power", "Gain Power"],
      ["heal", "Restore HP"],
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
  result.push(...tournamentOptions(state, fighter));
  return result;
}

// Team Tactic Cards of the X-Men and Brotherhood tournament rosters.
function tournamentOptions(state, fighter) {
  const side = fighter.side;
  const own = living(state, side);
  const ready = (id, cost = 0) =>
    available(state, side, id) && canSpend(state, fighter, cost);
  const card = (id, cost, extra = {}) => ({
    value: id,
    label: name(id),
    cost: cost + hammerTax(state, fighter),
    ...extra,
  });
  const result = [];
  if (ready("children-of-the-atom") && xmen(fighter) && fighter.conditions?.length)
    result.push(card("children-of-the-atom", 0));
  if (ready("magnetic-refraction", 2) && fighter.slug === "magneto")
    result.push(card("magnetic-refraction", 2));
  if (ready("do-you-know-who-i-am", 3) && fighter.slug === "juggernaut") {
    const targets = [
      ...enemies(state, side)
        .filter((f) => f.size <= 4 && within(fighter, f, 2))
        .map((f) => [f.id, f.name]),
      ...state.terrain
        .filter(
          (piece) =>
            piece.size <= 4 &&
            distanceToTerrain(fighter, piece) <= rangeInches[2] + 1e-8,
        )
        .map((piece) => [piece.id, piece.name]),
    ];
    if (targets.length)
      result.push(card("do-you-know-who-i-am", 3, { choices: choices(targets) }));
  }
  if (ready("journey-through-limbo", 3) && fighter.slug === "magik") {
    const targets = state.fighters.filter(
      (f) => f.id !== fighter.id && combat.usable(f) && within(fighter, f, 2),
    );
    if (targets.length)
      result.push(
        card("journey-through-limbo", 3, {
          choices: choices(targets.map((f) => [f.id, f.name])),
        }),
      );
  }
  if (ready("hold-still", 3) && fighter.slug === "shadowcat" && state.actionsLeft) {
    const targets = enemies(state, side).filter((f) => within(fighter, f, 3));
    if (targets.length)
      result.push(
        card("hold-still", 3, {
          choices: choices(targets.map((f) => [f.id, f.name])),
        }),
      );
  }
  if (ready("pyrotechnics", 1) && fighter.slug === "pyro") {
    const targets = enemies(state, side).filter(
      (f) => f.conditions?.includes("incinerate") && within(fighter, f, 3),
    );
    if (targets.length)
      result.push(
        card("pyrotechnics", 0, {
          targets: targets.map((f) => ({ value: f.id, label: f.name })),
          perTarget: 1,
        }),
      );
  }
  if (ready("headmistress", 1) && fighter.slug === "emma-frost") {
    const movers = own.filter((f) => xmen(f) && !holding(state, f));
    if (movers.length)
      result.push(
        card("headmistress", 0, {
          targets: movers.map((f) => ({ value: f.id, label: f.name })),
          perTarget: 1,
        }),
      );
  }
  if (
    ready("to-me-my-x-men", 1) &&
    pool.characters[fighter.slug].leaderships.some(
      (l) => l.affiliation === "Uncanny X-Men",
    )
  ) {
    const movers = own.filter((f) => f.id !== fighter.id && xmen(f));
    if (movers.length)
      result.push(
        card("to-me-my-x-men", 0, {
          targets: movers.map((f) => ({ value: f.id, label: f.name })),
          perTarget: 1,
        }),
      );
  }
  if (ready("pardon-me-sugah") && fighter.slug === "rogue") {
    const options = [];
    for (const [key, test] of sugahPartners) {
      const partner = own.find((f) => test(f) && within(fighter, f, 2));
      if (!partner) continue;
      if (key === "deadpool")
        for (const enemy of enemies(state, side).filter((f) =>
          within(fighter, f, 2),
        ))
          options.push([
            key + "|" + enemy.id,
            partner.name + " · " + enemy.name + " loses 2 Power",
          ]);
      else options.push([key, partner.name]);
    }
    if (options.length)
      result.push(card("pardon-me-sugah", 0, { choices: choices(options) }));
  }
  if (available(state, side, "patch-up-cp143")) {
    const options = [];
    for (const target of own.filter((f) => f.damage > 0))
      for (const payer of own.filter(
        (f) =>
          f.id !== target.id &&
          within(f, target, 2) &&
          canSpend(state, f, 1),
      ))
        options.push([target.id + "|" + payer.id, target.name + " ← " + payer.name]);
    if (options.length)
      result.push(
        card("patch-up-cp143", 0, {
          choices: choices(options),
          amount: { min: 1, max: 5 },
        }),
      );
  }
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
    throw Error("Choose the card effect.");
  if (option.targets) {
    const ids = action.targets;
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      new Set(ids).size !== ids.length ||
      !ids.every((id) => option.targets.some((t) => t.value === id)) ||
      !canSpend(state, actor, ids.length * option.perTarget + option.cost)
    )
      throw Error("Choose legal targets for the card.");
    actor.power -= ids.length * option.perTarget;
  }
  if (option.amount) {
    const payer = state.fighters.find(
      (f) => f.id === String(action.choice).split("|")[1],
    );
    if (
      !Number.isInteger(action.amount) ||
      action.amount < option.amount.min ||
      action.amount > option.amount.max ||
      !canSpend(state, payer, action.amount)
    )
      throw Error("Specify a legal amount of Power.");
  }
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
        throw Error("Specify a legal Power contribution.");
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
      if (action.choice === "heal") combat.heal(state, actor, state.round);
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
    case "children-of-the-atom": {
      const removed = actor.conditions.length;
      actor.conditions = [];
      combat.gain(actor, removed);
      break;
    }
    case "magnetic-refraction":
      (state.refraction ||= []).push({
        side: actor.side,
        round: state.round,
        source: actor.id,
      });
      break;
    case "do-you-know-who-i-am": {
      const piece = state.terrain.find((p) => p.id === action.choice);
      const target = state.fighters.find((f) => f.id === action.choice);
      state.effects.push(
        piece
          ? {
              type: "throw-terrain",
              side: actor.side,
              piece: piece.id,
              source: actor.id,
              name: piece.name,
              speed: "L",
            }
          : {
              type: "displace",
              side: actor.side,
              mover: target.id,
              name: target.name,
              source: actor.id,
              mode: "throw",
              cause: "tactic",
              speed: "L",
              required: true,
            },
      );
      break;
    }
    case "journey-through-limbo": {
      const target = state.fighters.find((f) => f.id === action.choice);
      state.effects.push({
        type: "displace",
        side: actor.side,
        mover: target.id,
        name: target.name,
        source: actor.id,
        mode: "place",
        cause: "tactic",
        range: 3,
        required: true,
        reference: { x: target.x, y: target.y, radius: target.radius },
      });
      combat.condition(target, "incinerate");
      break;
    }
    case "hold-still": {
      const target = state.fighters.find((f) => f.id === action.choice);
      state.actionsLeft--;
      (actor.extraAttacks ||= {})[104] = {
        ...holdStillAttack,
        target: target.id,
      };
      state.effects.push(
        {
          type: "displace",
          side: actor.side,
          mover: actor.id,
          name: actor.name,
          source: actor.id,
          mode: "place",
          range: 1,
          required: true,
          reference: { x: target.x, y: target.y, radius: target.radius },
        },
        {
          type: "granted-attack",
          side: actor.side,
          source: actor.id,
          index: 104,
        },
      );
      break;
    }
    case "pyrotechnics":
      for (const id of action.targets) {
        const target = state.fighters.find((f) => f.id === id);
        const token = state.objectives.find((o) => o.holder === target.id);
        if (token) combat.dropObjectives(state, target, token.id);
        state.effects.push({
          type: "displace",
          side: actor.side,
          mover: target.id,
          name: target.name,
          source: actor.id,
          mode: "push",
          cause: "tactic",
          speed: "S",
          direction: "away",
          required: true,
          reference: { x: actor.x, y: actor.y, radius: actor.radius },
        });
      }
      break;
    case "headmistress":
    case "to-me-my-x-men":
      for (const id of action.targets) {
        const ally = state.fighters.find((f) => f.id === id);
        state.effects.push({
          type: "displace",
          side: actor.side,
          mover: ally.id,
          name: ally.name + " · " + option.label,
          source: actor.id,
          mode: "advance",
          speed: option.value === "headmistress" ? "M" : "S",
          ...(option.value === "to-me-my-x-men" && {
            direction: "toward",
            reference: { x: actor.x, y: actor.y, radius: actor.radius },
          }),
        });
      }
      break;
    case "pardon-me-sugah": {
      const [key, enemyId] = action.choice.split("|");
      const partner = living(state, actor.side).find(
        (f) =>
          sugahPartners.find(([k]) => k === key)[1](f) && within(actor, f, 2),
      );
      if (key === "wolverine") actor.sugahHealing = 2;
      if (key === "cyclops") {
        const optic = combat
          .face(partner)
          .attacks.find((a) => a.name === "Optic Blast");
        (actor.extraAttacks ||= {})[105] = { ...optic };
      }
      if (key === "storm") actor.sugahDice = 2;
      if (key === "deadpool") {
        const enemy = state.fighters.find((f) => f.id === enemyId);
        enemy.power = Math.max(0, enemy.power - 2);
      }
      if (key === "magneto") actor.sugahCover = state.round;
      combat.damage(state, partner, 1, actor, { noPower: true });
      break;
    }
    case "patch-up-cp143": {
      const [targetId, payerId] = action.choice.split("|");
      const target = state.fighters.find((f) => f.id === targetId);
      const payer = state.fighters.find((f) => f.id === payerId);
      payer.power -= action.amount + hammerTax(state, payer);
      paid.push(payer);
      combat.heal(state, target, action.amount);
      break;
    }
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
    for (const id of [
      "stark-armory",
      "survival",
      "first-class",
      "asteroid-m",
      "genetic-superiority",
    ]) {
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
  if (effect.card === "first-class")
    return own
      .filter(xmen)
      .slice(0, 1)
      .map((f) => ({ value: f.id, label: f.name + " · First Class" }));
  if (effect.card === "asteroid-m") {
    const members = own.filter(
      (f) => brotherhood(f) && !f.grunt && canSpend(state, f, 2),
    );
    return members.flatMap((chosen) =>
      members
        .filter((other) => other.id !== chosen.id)
        .map((other) => ({
          value: chosen.id + "|" + other.id,
          label: chosen.name + " → next to " + other.name,
        })),
    );
  }
  if (effect.card === "genetic-superiority")
    return own.some((f) => pool.characters[f.slug].alterEgo === "Max Eisenhardt") &&
      own.some((f) => f.slug === "exodus")
      ? [{ value: "play", label: "Genetic Superiority · set near the battlefield" }]
      : [];
  if (effect.card === "the-pawns-go-first") {
    const pawn = state.fighters.find((f) => f.id === effect.pawn);
    if (!pawn || !combat.usable(pawn) || !canSpend(state, pawn, 1)) return [];
    return own
      .filter(
        (f) => brotherhood(f) && threat(f) >= 5 && within(pawn, f, 3),
      )
      .flatMap((big) =>
        [
          ["advance", "Advance Short toward " + big.name],
          ["heal", big.name + " removes 1 damage and 1 condition"],
          ["power", big.name + " gains 1 Power"],
        ].map(([kind, label]) => ({
          value: pawn.id + "|" + big.id + "|" + kind,
          label: pawn.name + " · " + label,
        })),
      );
  }
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
  if (effect.card === "genetic-superiority") {
    (state.genetic ||= {})[effect.side] = true;
    use(state, effect.side, effect.card);
    return name(effect.card);
  }
  const [id, extra, kind] = value.split("|");
  const actor = get(id);
  if (effect.card === "first-class") {
    (state.firstClass ||= {})[effect.side] = state.round;
    state.firstClassUsed = [];
    use(state, effect.side, effect.card);
    return actor.name + " · " + name(effect.card);
  }
  if (effect.card === "asteroid-m") {
    const other = get(extra);
    for (const f of [actor, other]) f.power -= 2 + hammerTax(state, f);
    combat.dropObjectives(state, actor);
    state.effects.push({
      type: "displace",
      side: effect.side,
      mover: actor.id,
      name: actor.name + " · Asteroid M",
      source: other.id,
      mode: "place",
      range: 1,
      required: true,
      reference: { x: other.x, y: other.y, radius: other.radius },
    });
    use(state, effect.side, effect.card);
    queueRefund(state, effect.side, [actor, other]);
    return actor.name + " · " + name(effect.card);
  }
  if (effect.card === "the-pawns-go-first") {
    const big = get(extra);
    actor.power -= 1 + hammerTax(state, actor);
    if (!state.playedTactics[effect.side].includes(effect.card))
      use(state, effect.side, effect.card);
    if (kind === "advance")
      state.effects.unshift({
        type: "displace",
        side: effect.side,
        mover: actor.id,
        name: actor.name + " · The Pawns Go First",
        source: actor.id,
        mode: "advance",
        speed: "S",
        direction: "toward",
        reference: { x: big.x, y: big.y, radius: big.radius },
      });
    if (kind === "heal") {
      combat.heal(state, big, 1);
      if (big.conditions?.length) big.conditions.shift();
    }
    if (kind === "power") combat.gain(big, 1);
    const rest = effect.remaining.filter((p) => p !== actor.id);
    if (rest.length)
      state.effects.push({ ...effect, pawn: rest[0], remaining: rest });
    return actor.name + " · " + name(effect.card) + " · " + kind;
  }
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

// Cleanup Phase: The Pawns Go First and the Brotherhood refund of Magnetic Refraction.
function cleanupEffects(state) {
  const effects = [];
  for (const side of [state.priority, state.priority === "p1" ? "p2" : "p1"]) {
    if (
      state.squads[side]?.affiliation === "Brotherhood of Mutants" &&
      state.playedTactics?.[side]?.includes("magnetic-refraction")
    )
      state.playedTactics[side] = state.playedTactics[side].filter(
        (id) => id !== "magnetic-refraction",
      );
    if (!available(state, side, "the-pawns-go-first")) continue;
    const pawns = living(state, side).filter(
      (f) => brotherhood(f) && !f.grunt && threat(f) <= 3,
    );
    for (const [index, pawn] of pawns.entries()) {
      const effect = {
        type: "phase-tactic",
        side,
        card: "the-pawns-go-first",
        pawn: pawn.id,
        remaining: pawns.slice(index).map((f) => f.id),
      };
      if (phaseChoices(state, effect).length) {
        effects.push(effect);
        break;
      }
    }
  }
  return effects;
}

// Genetic Superiority: once per turn an allied Threat 4- character suffers enemy damage.
function geneticSuperiority(state, target, source) {
  if (
    !state.genetic?.[target.side] ||
    state.geneticTurn?.includes(target.side) ||
    !source ||
    source.side === target.side ||
    threat(target) > 4
  )
    return;
  const recipient = living(state, target.side)
    .filter((f) => brotherhood(f) && threat(f) >= 5 && within(target, f, 5))
    .sort((a, b) => a.power - b.power)[0];
  if (!recipient) return;
  (state.geneticTurn ||= []).push(target.side);
  combat.gain(recipient, 1);
  return recipient;
}

function resetTurn(state) {
  state.geneticTurn = [];
  for (const f of state.fighters) f.survival = false;
}

module.exports = {
  activationOptions,
  activate,
  phaseEffects,
  phaseChoices,
  playPhase,
  resetTurn,
  cleanupEffects,
  geneticSuperiority,
  available,
  canSpend,
  hammerTax,
  use,
};
