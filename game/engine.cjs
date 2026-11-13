const { randomInt, randomUUID } = require("node:crypto");
const { pool, objectives } = require("./catalog.cjs");
const geometry = require("./geometry.cjs");
const combat = require("./combat.cjs");
const mission = require("./mission.cjs");
const tactics = require("./tactics.cjs");
const log = require("./log.cjs");

const sides = ["p1", "p2"];
const other = (side) => (side === "p1" ? "p2" : "p1");
const kinds = ["secure", "extract"];
const faces = [
  "critical",
  "wild",
  "hit",
  "hit",
  "block",
  "failure",
  "blank",
  "blank",
];
const pick = (values, random) => values[random(values.length)];
const fail = (message) => {
  throw Error(message);
};
const expect = (ok, message) => {
  if (!ok) fail(message);
};
const unique = (items) =>
  Array.isArray(items) && new Set(items).size === items.length;
const options = (values) => values.map((value) => ({ value, label: value }));
const hexFieldConditions = ["hex", "judgment", "poison"];

function roster(input) {
  const preset = pool.presets.find((r) => r.id === input);
  if (preset) return preset;
  expect(input && typeof input === "object", "Выберите ростер.");
  for (const [field, catalog] of Object.entries({
    characters: pool.characters,
    tactics: pool.tactics,
    crises: pool.crises,
  })) {
    expect(
      unique(input[field]) &&
        input[field].length === 10 &&
        input[field].every(
          (id) => Object.hasOwn(catalog, id) && !catalog[id].isGrunt,
        ),
      "Ростер должен включать 10 поддерживаемых карт в каждой категории.",
    );
  }
  expect(
    input.crises.filter((id) => pool.crises[id].type === "Secure").length === 5,
    "Нужно пять Secure и пять Extraction.",
  );
  expect(
    new Set(
      input.characters.map(
        (id) => pool.characters[id].name + pool.characters[id].alterEgo,
      ),
    ).size === 10,
    "В ростере есть повтор персонажа.",
  );
  expect(
    new Set(input.tactics.map((id) => pool.tactics[id].name)).size === 10,
    "В ростере есть повтор тактики.",
  );
  return {
    name: String(input.name || "Ростер").slice(0, 100),
    characters: input.characters,
    tactics: input.tactics,
    crises: input.crises,
  };
}

function create(input, revision) {
  return {
    id: randomUUID(),
    revision,
    controllers: { p1: "browser", p2: "browser" },
    rosters: { p1: roster(input.p1), p2: roster(input.p2) },
    phase: "priority",
    priority: null,
    decisionSide: null,
    roll: null,
    crisisKind: null,
    offers: [],
    mission: {},
    threat: null,
    deployment: {},
    commits: {},
    squads: {},
    leaders: {},
    fighters: [],
    objectives: [],
    terrain: structuredClone(geometry.battlefield),
    round: 0,
    active: null,
    actionsLeft: 0,
    log: [],
    undo: [],
    score: { p1: 0, p2: 0 },
    playedTactics: { p1: [], p2: [] },
    effects: [],
    drops: [],
    usedPowers: [],
    interacted: [],
    activationLocked: false,
  };
}

function finish(state) {
  if (state.phase === "finished") return;
  Object.assign(state, {
    phase: "finished",
    decisionSide: null,
    active: null,
    actionsLeft: 0,
    undo: [],
    finishReason: "stopped",
    effects: [],
    drops: [],
    pendingAttack: null,
    volley: null,
  });
  log(state, "Матч завершён без результата");
}

function priorityRoll(state, random) {
  for (;;) {
    const dice = Object.fromEntries(
      sides.map((side) => [
        side,
        Array.from({ length: 5 }, () => pick(faces, random)),
      ]),
    );
    const rank = (side) => {
      const counts = ["critical", "wild", "hit"].map(
        (face) => dice[side].filter((d) => d === face).length,
      );
      return (
        counts.reduce((total, n) => total + n, 0) * 216 +
        counts[0] * 36 +
        counts[1] * 6 +
        counts[2]
      );
    };
    const delta = rank("p1") - rank("p2");
    state.roll = { dice, winner: delta ? (delta > 0 ? "p1" : "p2") : null };
    log(
      state,
      delta ? "Priority · " + state.roll.winner : "Ничья · бросаем снова",
      state.roll,
    );
    if (delta) return state.roll.winner;
  }
}

function draw(state, side, kind, random) {
  const deck = state.rosters[side].crises.filter(
    (id) =>
      pool.crises[id].type.toLowerCase() ===
      (kind === "extract" ? "extraction" : kind),
  );
  const first = random(deck.length);
  return [deck.splice(first, 1)[0], pick(deck, random)];
}

function affiliations(ids) {
  const counts = new Map();
  for (const id of ids) {
    for (const affiliation of pool.characters[id].affiliations)
      counts.set(affiliation.name, (counts.get(affiliation.name) || 0) + 1);
  }
  return [...counts]
    .filter(([, count]) => count * 2 > ids.length)
    .map(([name]) => name);
}

function leadersFor(state, side) {
  const squad = state.squads[side];
  return squad.characters.flatMap((slug) =>
    pool.characters[slug].leaderships
      .filter((l) => l.affiliation === squad.affiliation)
      .map((l) => ({ value: slug + ":" + l.name, label: l.name })),
  );
}

function ready(state, side) {
  return state.fighters.filter(
    (f) => f.side === side && !f.grunt && !f.activated && combat.usable(f),
  );
}

const actorOf = (state) => state.fighters.find((f) => f.id === state.active);
const selectable = (state, side) =>
  ready(state, side)
    .filter((f) => f.id !== state.active)
    .map((f) => ({ type: "activate", value: f.id, label: f.name }));

function makeFighter(side, slug) {
  const card = pool.characters[slug];
  return {
    id: side + ":" + slug,
    side,
    slug,
    name: card.name,
    size: card.size,
    speed: card.speed,
    radius: card.baseSize / 50.8,
    power: 0,
    grunt: !!card.isGrunt,
    activated: false,
    x: null,
    y: null,
  };
}
function beginActivation(state, active, locked = false) {
  Object.assign(state, {
    active: active.id,
    actionsLeft: 2,
    undo: [],
    activationLocked: locked,
    moves: 0,
    usedPowers: [],
    duelTargets: [],
    fieldLeaderMoves: [],
    interacted: [],
  });
  log(state, "Активирован " + active.name, {
    side: active.side,
    fighter: active.id,
  });
  if (active.slug === "emma-frost") {
    active.formStartedDiamond = active.form === 1;
    if (active.formStartedDiamond)
      state.effects.push({
        ...transformEvent(active, 0, false),
        losePower: true,
      });
  }
  if (
    active.slug === "captain-marvel-cosmic-avenger" &&
    !active.form &&
    active.power >= 6
  ) {
    state.activationLocked = true;
    state.effects.push(transformEvent(active, 1, true));
  }
}
function transformEvent(active, form, required) {
  return {
    type: "transform",
    side: active.side,
    mover: active.id,
    mode: "place",
    form,
    range: 1,
    required,
    model: combat.transformModel(active, form),
    name: active.name,
    reference: { x: active.x, y: active.y, radius: active.radius },
  };
}

function movementProtection(state, effect) {
  if (effect?.type !== "displace" || effect.polarityReviewed) return null;
  const mover = state.fighters.find((f) => f.id === effect.mover);
  const source = state.fighters.find((f) => f.id === effect.source);
  if (!mover || !source || !combat.usable(mover)) return null;
  const options = [];
  const tax = (fighter) =>
    Number(fighter.conditions?.includes("root") || false);
  const cost = 2 + tax(mover);
  if (
    ["advance", "push", "throw"].includes(effect.mode) &&
    combat.isPower(mover, "Polarity Shielding") &&
    mover.power >= cost &&
    combat.reactiveAllowed(source, mover, state)
  ) {
    options.push({
      value: "pay",
      label: "Polarity Shielding · " + cost + " Power",
      protector: mover.id,
      cost,
      power: "Polarity Shielding",
    });
  }
  if (
    source.side !== mover.side &&
    ["mystic", "superpower"].includes(effect.cause) &&
    ["advance", "place", "push"].includes(effect.mode)
  ) {
    for (const ally of state.fighters.filter(
      (f) =>
        f.side === mover.side &&
        combat.usable(f) &&
        combat.isPower(f, "Shield Mind") &&
        geometry.within(f, mover, 4) &&
        combat.reactiveAllowed(source, f, state),
    )) {
      const cost = 2 + tax(ally);
      if (ally.power >= cost)
        options.push({
          value: "shield:" + ally.id,
          label: "Shield Mind · " + ally.name + " · " + cost + " Power",
          protector: ally.id,
          cost,
          power: "Shield Mind",
        });
    }
  }
  if (!options.length) return null;
  return {
    options,
    side: effect.required || effect.polarityStarted ? mover.side : effect.side,
    type: options.some((option) => option.value === "pay")
      ? "polarity-shielding"
      : "shield-mind",
  };
}

function pendingDecision(state) {
  return (
    state.pendingAttack?.side ||
    movementProtection(state, state.effects?.[0])?.side ||
    state.effects?.[0]?.side ||
    state.drops?.[0]?.side ||
    state.volley?.side
  );
}
function recordPlacement(state, id) {
  if (
    !state.fighters.some(
      (fighter) => fighter.id === id && fighter.slug === "nightcrawler",
    )
  )
    return;
  const placements = (state.placements ||= {});
  placements[id] = (placements[id] || 0) + 1;
}

function coldSnapEvent(state, actor) {
  return state.fighters.some(
    (f) =>
      f.side !== actor.side &&
      combat.usable(f) &&
      combat.isPower(f, "Cold Snap"),
  )
    ? [{ type: "cold-snap-check", side: actor.side, target: actor.id }]
    : [];
}

function moveReactionOptions(state, actor) {
  const cost = 2 + Number(actor.conditions?.includes("root") || false);
  if (actor.power < cost || !combat.reactiveAllowed(actor, actor, state))
    return [];
  return ["Ice Slide", "Air Lift", "Hostile Takeover"].flatMap((power) => {
    if (
      !combat.isPower(actor, power) ||
      state.reactionUses?.includes(actor.id + ":" + power)
    )
      return [];
    const hostile = power === "Hostile Takeover";
    return state.fighters
      .filter(
        (f) =>
          f.id !== actor.id &&
          combat.usable(f) &&
          geometry.within(actor, f, 2) &&
          (hostile
            ? f.side !== actor.side
            : f.side === actor.side && f.size <= 2),
      )
      .map((f) => ({
        value: power + "|" + f.id,
        label: power + " · " + f.name + " · " + cost + " Power",
        power,
        target: f.id,
        cost,
        hostile,
      }));
  });
}

function finishMoveAction(state, actor, move) {
  if (!move.granted) state.actionsLeft -= 1;
  Object.assign(actor, move.point);
  state.moves = (state.moves || 0) + 1;
  if (!actor.momentumUsed && combat.isPower(actor, "Unstoppable Momentum")) {
    actor.momentumUsed = actor.momentumReady = true;
    combat.gain(actor, 2);
    log(state, "Unstoppable Momentum · +2 Power", {
      side: actor.side,
      fighter: actor.id,
    });
  }
  log(
    state,
    actor.name + (move.mode === "advance" ? " · Advance" : " · Climb"),
    { side: actor.side, fighter: actor.id, point: move.point },
  );
  state.effects.unshift(
    ...move.followups.flatMap((option) => {
      const target = state.fighters.find((f) => f.id === option.target);
      const effect = combat.moveEvent(
        {
          mode: option.hostile ? "push" : "place",
          range: 2,
          speed: "S",
          direction: option.hostile ? "toward" : undefined,
          required: true,
          reference: option.hostile ? actor : target,
        },
        actor,
        target,
        "superpower",
      );
      return effect ? [{ ...effect, name: option.power }] : [];
    }),
    ...coldSnapEvent(state, actor),
  );
}

function terrainReactionOptions(state, target, label) {
  if (!combat.usable(target)) return [];
  return state.terrain
    .filter(
      (p) =>
        p.size <= 3 &&
        geometry.distanceToTerrain(target, p) <= geometry.range[2],
    )
    .map((p) => ({ value: p.id, label: label + " · " + p.name }));
}
function xmenGoldTargets(state, actor) {
  if (
    actor.grunt ||
    actor.power < 1 ||
    mission.held(state, actor).length ||
    state.goldUsedRound?.[actor.side] === state.round ||
    !combat.leadership(state, actor.side, "X-Men Gold")
  )
    return [];
  return state.fighters.filter(
    (f) =>
      f.id !== actor.id &&
      f.side === actor.side &&
      combat.usable(f) &&
      geometry.within(actor, f, 2),
  );
}

function mindLock(defender) {
  return ["Mental Lock", "Telepathic Lock"].find((name) =>
    combat.isPower(defender, name),
  );
}

function targetingReactions(state, pending) {
  const attacker = state.fighters.find((f) => f.id === pending.actor);
  const defender = state.fighters.find((f) => f.id === pending.target);
  const reactions = combat
    .targetReactions(state, attacker, defender, pending)
    .map((option) => ({
      ...option,
      key:
        defender.id +
        ":" +
        (["density", "phased"].includes(option.value)
          ? "rapid-phase"
          : option.value),
    }));
  const lock = mindLock(defender);
  if (pending.damageType !== "mystic" && lock)
    reactions.push({
      value: "mental-lock",
      key: defender.id + ":mental-lock",
      label: lock + " · предложить защиту Mystic",
    });
  const logan =
    !pending.redirected &&
    combat.isPower(defender, "Wolverine!") &&
    combat.reactiveAllowed(attacker, defender, state) &&
    defender.power >= combat.rootTax(defender) &&
    state.fighters.find(
      (f) =>
        f.side === defender.side &&
        f.id !== defender.id &&
        combat.usable(f) &&
        pool.characters[f.slug]?.alterEgo === "James Logan Howlett" &&
        geometry.within(defender, f, 2),
    );
  if (logan)
    reactions.push({
      value: "wolverine-swap:" + logan.id,
      key: defender.id + ":wolverine-swap",
      label: "Wolverine! · " + logan.name + " становится целью",
      cost: combat.rootTax(defender),
    });
  for (const ally of state.fighters.filter(
    (f) =>
      f.side === defender.side &&
      combat.usable(f) &&
      combat.reactiveAllowed(attacker, f, state),
  )) {
    const cost = 2 + Number(ally.conditions?.includes("root") || false);
    if (ally.power < cost) continue;
    if (
      ally.id !== defender.id &&
      !pending.redirected &&
      combat.isPower(ally, "Too Dangerous to Ignore") &&
      geometry.within(attacker, ally, 2)
    )
      reactions.push({
        value: "too-dangerous:" + ally.id,
        key: "too-dangerous:" + ally.id,
        label:
          "Too Dangerous to Ignore · " + ally.name + " · " + cost + " Power",
        cost,
        reactor: ally.id,
      });
    if (
      ally.id !== defender.id &&
      !pending.redirected &&
      combat.isPower(ally, "Big Brother") &&
      geometry.within(attacker, ally, 4)
    )
      reactions.push({
        value: "big-brother:" + ally.id,
        key: "big-brother:" + ally.id,
        label: "Big Brother · " + ally.name + " · " + cost + " Power",
        cost,
        reactor: ally.id,
      });
    if (
      combat.isPower(ally, "Can‘t Touch This") &&
      ["physical", "energy"].includes(pending.damageType) &&
      (ally.id === defender.id || geometry.within(ally, defender, 2))
    )
      reactions.push({
        value: "cant-touch:" + ally.id,
        key: "cant-touch:" + ally.id,
        label: "Can‘t Touch This · " + ally.name + " · " + cost + " Power",
        cost,
        reactor: ally.id,
      });
    if (
      combat.isPower(ally, "Telekinetic Shield") &&
      geometry.within(ally, defender, 3) &&
      !state.reactionUses?.includes("telekinetic-shield:" + ally.id)
    )
      reactions.push({
        value: "telekinetic-shield:" + ally.id,
        key: "telekinetic-shield:" + ally.id,
        label: "Telekinetic Shield · " + ally.name + " · " + cost + " Power",
        cost,
        reactor: ally.id,
      });
  }
  return reactions.filter((option) => !pending.reacted?.includes(option.key));
}

function continueTargeting(state, pending, random) {
  if (targetingReactions(state, pending).length) state.pendingAttack = pending;
  else finishAttack(state, pending, false, random);
}

function currentEffect(state, side) {
  if (state.pendingAttack) {
    if (state.pendingAttack.mentalDecision)
      return [
        {
          type: "reaction",
          value: "mental-lock-pay",
          label:
            "Заплатить 2 Power · " +
            mindLock(
              state.fighters.find((f) => f.id === state.pendingAttack.target),
            ),
        },
        {
          type: "reaction",
          value: "mental-lock-accept",
          label: "Разрешить защиту Mystic",
        },
      ];
    return [
      ...targetingReactions(state, state.pendingAttack).map((option) => ({
        ...option,
        type: "reaction",
      })),
      { type: "reaction", value: "skip", label: "Пропустить реакцию" },
    ];
  }
  const effect = state.effects?.[0];
  if (effect) {
    const actor = actorOf(state);
    const skip = { type: "skip-effect", label: "Пропустить эффект" };
    if (effect.type === "place-construct") return [effect];
    if (effect.type === "move-reaction")
      return [
        {
          type: effect.type,
          options: [
            ...moveReactionOptions(state, actor),
            { value: "skip", label: "Выполнить Move" },
          ],
        },
      ];
    if (effect.type === "xmen-blue") {
      const source = state.fighters.find((f) => f.id === effect.source);
      const targets = combat.xmenBlueTargets(state, source);
      return [
        ...(targets.length
          ? [
              {
                type: "xmen-blue",
                options: targets.map((f) => ({
                  value: f.id,
                  label: "X-Men Blue · " + f.name + " · +1 Power",
                })),
              },
            ]
          : []),
        skip,
      ];
    }
    if (effect.type === "diamond-dodge")
      return [
        { type: "diamond-dodge", label: "Diamond Form · уклонение" },
        skip,
      ];
    if (effect.type === "acrobatic-dodge")
      return [
        {
          type: effect.type,
          label:
            (effect.label || "Unglaublich Acrobatics") +
            " · " +
            effect.cost +
            " Power",
        },
        skip,
      ];
    if (effect.type === "puff-smoke")
      return [
        {
          type: effect.type,
          label:
            "Puff of Smoke" +
            (effect.cost ? " · " + effect.cost + " Power" : ""),
        },
        skip,
      ];
    if (effect.type === "nice-punch") {
      const target = state.fighters.find((f) => f.id === effect.target);
      return [
        ...(combat.usable(target) && target.power >= effect.cost
          ? [
              {
                type: "nice-punch",
                label:
                  "Nice Punch... · " +
                  effect.amount +
                  " урона · " +
                  effect.cost +
                  " Power",
              },
            ]
          : []),
        skip,
      ];
    }
    if (effect.type === "juggernaut-contact")
      return [
        {
          type: "juggernaut-contact",
          options: effect.targets.map((id) => ({
            value: id,
            label: state.fighters.find((f) => f.id === id).name + " · 1 урон",
          })),
        },
      ];
    if (effect.type === "magnetic-crush")
      return [
        {
          type: "magnetic-crush",
          options: [
            ...effect.destroyed.map((piece) => ({
              value: piece.id,
              label: piece.name + " · Size " + piece.size,
            })),
            { value: "", label: "Без основного террейна" },
          ],
        },
      ];
    if (effect.type === "xavier-school") {
      const source = state.fighters.find((f) => f.id === effect.source);
      const recipients = combat.xavierTargets(state, source);
      return [
        ...(recipients.length
          ? [
              {
                type: "xavier-school",
                options: recipients.map((f) => ({
                  value: f.id,
                  label: "Xavier's School · " + f.name + " · +1 Power",
                })),
              },
            ]
          : []),
        skip,
      ];
    }
    if (effect.type === "from-the-ruins") {
      const recipients = state.fighters.filter(
        (f) =>
          f.side === side &&
          combat.usable(f) &&
          !f.grunt &&
          !state.leadershipUses?.[side]?.includes("ruins:" + f.id),
      );
      return [
        ...(recipients.length
          ? [
              {
                type: "from-the-ruins",
                options: recipients.map((f) => ({
                  value: f.id,
                  label: f.name + " · +1 Power",
                })),
              },
            ]
          : []),
        skip,
      ];
    }
    if (effect.type === "grunt-deploy")
      return [{ type: "deploy", fighters: [effect.fighter] }];
    if (effect.type === "transform" || effect.type === "spawn-drones")
      return [effect, ...(!effect.required ? [skip] : [])];
    if (effect.type === "frenzy")
      return [
        { type: "frenzy", label: "Frenzy · " + effect.cost + " Power" },
        skip,
      ];
    if (effect.type === "untamed")
      return [{ type: "untamed", label: "Untamed Force · 2 Power" }, skip];
    if (effect.type === "slippery")
      return [
        { type: "slippery", label: "Slippery · " + effect.cost + " Power" },
        skip,
      ];
    if (effect.type === "fire-manipulation") {
      const targets = state.fighters.filter(
        (f) => effect.targets.includes(f.id) && combat.usable(f),
      );
      return [
        ...(targets.length
          ? [
              {
                type: "fire-manipulation",
                options: targets.map((f) => ({
                  value: f.id,
                  label: "Fire Manipulation · " + f.name,
                })),
              },
            ]
          : []),
        skip,
      ];
    }
    if (effect.type === "curse") {
      const witch = state.fighters.find((f) => f.id === effect.source);
      const enemy = state.fighters.find((f) => f.id === effect.target);
      return combat.usable(witch) &&
        combat.usable(enemy) &&
        witch.power >= effect.cost
        ? [
            {
              type: "curse",
              label: "Curse · " + enemy.name + " · " + effect.cost + " Power",
            },
            skip,
          ]
        : [skip];
    }
    if (["sinister-shake", "tiger-shake"].includes(effect.type))
      return [{ type: effect.type, options: effect.options }, skip];
    if (["kill-box", "falling-debris"].includes(effect.type)) {
      const source = state.fighters.find((f) => f.id === effect.source);
      const target = state.fighters.find((f) => f.id === effect.target);
      const label =
        effect.type === "kill-box" ? "Kill Box" : "Beware Falling Debris";
      const choices =
        combat.usable(source) &&
        source.power >= 3 + Number(source.conditions?.includes("root") || false)
          ? terrainReactionOptions(state, target, label)
          : [];
      return [
        ...(choices.length ? [{ type: effect.type, options: choices }] : []),
        skip,
      ];
    }
    if (effect.type === "enhanced-agility")
      return [
        {
          type: "enhanced-agility",
          label: "Enhanced Agility · " + effect.cost + " Power",
        },
        skip,
      ];
    if (effect.type === "nightmare-visions") {
      const source = state.fighters.find((f) => f.id === effect.source);
      const target = state.fighters.find((f) => f.id === effect.target);
      return [
        ...(combat.usable(source) &&
        combat.usable(target) &&
        source.power >= effect.cost
          ? [
              {
                type: "nightmare-visions",
                label: "Nightmare Visions · " + effect.cost + " Power",
              },
            ]
          : []),
        skip,
      ];
    }
    if (effect.type === "go-get-em")
      return [
        {
          type: "go-get-em",
          label: "Go Get ’em Tiger · " + effect.cost + " Power",
        },
        skip,
      ];
    if (effect.type === "hydra-refund")
      return [{ type: "hydra-refund", options: effect.options }];
    if (effect.type === "hydra-tactic")
      return [{ type: "hydra-tactic", options: effect.options }];
    if (effect.type === "modify-dice")
      return [
        { ...effect, resume: undefined },
        ...(!effect.required ? [skip] : []),
      ];
    if (effect.type === "bonus-attack") {
      const attacks = combat.attacks(state, actor, effect);
      return [...(attacks.length ? [{ type: "attack", attacks }] : []), skip];
    }
    if (effect.type === "borrowed-attack") {
      const attacks = combat.attacks(state, actor, { kind: "borrowed" });
      return [...(attacks.length ? [{ type: "attack", attacks }] : []), skip];
    }
    if (effect.type === "flurry-attack") {
      const attacks = combat.attacks(state, actor, {
        kind: "flurry",
        target: effect.target,
      });
      return [...(attacks.length ? [{ type: "attack", attacks }] : []), skip];
    }
    if (effect.type === "mind-over-matter")
      return [{ type: effect.type, options: effect.options }, skip];
    if (effect.type === "strike-order")
      return [
        {
          type: "strike-order",
          options: effect.moves.map((move, index) => ({
            value: String(index),
            label: move.name + " первым",
          })),
        },
      ];
    if (["phase-tactic", "phase-shift"].includes(effect.type)) {
      const choices = tactics.phaseChoices(state, effect);
      return [
        ...(choices.length ? [{ type: "phase-choice", options: choices }] : []),
        ...(effect.type === "phase-tactic" ? [skip] : []),
      ];
    }
    if (effect.type === "web-collision")
      return [{ type: "web-collision", options: effect.options }, skip];
    if (effect.type === "battle-plan") {
      const f = state.fighters.find((f) => f.id === effect.target);
      return [
        {
          type: "battle-plan",
          options: [
            ...((f.damage || 0) > 0
              ? [{ value: "heal", label: "Восстановить 1 HP · " + f.name }]
              : []),
            ...(f.conditions || []).map((c) => ({
              value: c,
              label: "Снять " + c + " · " + f.name,
            })),
            { value: "place", label: "Place · " + f.name },
          ],
        },
        skip,
      ];
    }
    if (effect.type === "glory-of-ultron") {
      const f = state.fighters.find((f) => f.id === effect.remaining[0]);
      return [
        {
          type: "glory-choice",
          options: [
            ...(f.power > 0
              ? [{ value: "pay", label: f.name + " платит 1 Power" }]
              : []),
            { value: "decline", label: f.name + " не платит" },
          ],
        },
      ];
    }
    if (effect.type === "granted-attack") {
      const attacks = combat.usable(actor)
        ? combat
            .attacks(state, actor)
            .filter((a) => effect.index == null || a.index === effect.index)
        : [];
      return attacks.length ? [{ type: "attack", attacks }] : [skip];
    }
    if (effect.type === "granted-move") {
      return combat.usable(actor) &&
        !(
          state.moves &&
          mission.held(state, actor).some((o) => o.name === "Senator")
        )
        ? [
            { type: "granted-move", climbsOnAdvance: effect.climbsOnAdvance },
            skip,
          ]
        : [skip];
    }
    if (effect.type === "throw-terrain") return [{ ...effect, mode: "throw" }];
    if (effect.type === "purge") {
      const target = state.fighters.find((f) => f.id === effect.actor);
      return [{ type: "purge", options: options(target.conditions) }, skip];
    }
    if (effect.type === "displace") {
      const shielding = movementProtection(state, effect);
      if (shielding)
        return effect.required || effect.polarityStarted
          ? [
              {
                type: shielding.type,
                options: [
                  ...shielding.options,
                  { value: "skip", label: "Пропустить реакцию" },
                ],
              },
            ]
          : [
              {
                type: "start-displacement",
                label: "Переместить " + effect.name,
              },
              skip,
            ];
      return [
        { ...effect, resume: undefined },
        ...(!effect.required ? [skip] : []),
      ];
    }
    if (effect.type === "bonus-move")
      return [{ type: "bonus-move", speed: "S" }, skip];
    return [
      {
        type: "choose-condition",
        options: effect.options.map((value) => ({ value, label: value })),
      },
    ];
  }
  if (!state.drops?.length && state.volley) {
    const volley = state.volley;
    return [
      {
        type: "volley-target",
        sampleBoost: volley.sampleBoost && (actorOf(state).samples ?? 1) > 0,
        options: volley.remaining.map((id) => ({
          value: id,
          label: state.fighters.find((f) => f.id === id).name,
        })),
      },
    ];
  }
  return [
    {
      type: "drop-objective",
      objective: state.drops[0].id,
      origin: state.drops[0].origin,
    },
  ];
}

function checkpoint(state) {
  state.undo.push({
    fighters: structuredClone(state.fighters),
    objectives: structuredClone(state.objectives),
    terrain: structuredClone(state.terrain),
    playedTactics: structuredClone(state.playedTactics || { p1: [], p2: [] }),
    actionsLeft: state.actionsLeft,
    usedPowers: [...(state.usedPowers || [])],
    interacted: [...(state.interacted || [])],
    leadershipUses: structuredClone(state.leadershipUses || { p1: [], p2: [] }),
    goldUsedRound: { ...state.goldUsedRound },
    fieldLeaderMoves: [...(state.fieldLeaderMoves || [])],
    placements: { ...state.placements },
    activationLocked: !!state.activationLocked,
    moves: state.moves || 0,
    logLength: state.log.length,
  });
  state.activationLocked = true;
}

function announceAttack(state, actor, target, option, attack, random) {
  const pending = {
    actor: actor.id,
    target: target.id,
    index: option.index,
    damageType: attack.damageType,
    extra: attack.extra,
    sample: attack.sample,
    payment: attack.payment,
    angle: attack.angle,
    diceBonus: attack.diceBonus,
    doubleWild: attack.doubleWild,
    throwAfter: attack.throwAfter,
    coldSnapAction: attack.coldSnapAction,
    side: target.side,
    ...(attack.volley && { volley: true }),
  };
  log(state, actor.name + " объявляет " + option.name + " по " + target.name, {
    side: actor.side,
    fighter: actor.id,
    target: target.id,
  });
  continueTargeting(state, pending, random);
}

function finishAttack(state, pending, block, random) {
  state.pendingAttack = null;
  if (pending.payment) {
    combat.pay(
      state,
      state.fighters.find((f) => f.id === pending.actor),
      pending.payment.cost,
      pending.payment.payer,
    );
    delete pending.payment;
  }
  const spot = (id) => {
    const f = state.fighters.find((item) => item.id === id);
    return f?.x == null ? null : { x: f.x, y: f.y };
  };
  const from = spot(pending.actor),
    to = spot(pending.target);
  const result = combat.resolve(state, pending, block, random);
  state.effects = [
    ...result.events,
    ...(!result.suspended && !pending.volley && pending.coldSnapAction
      ? coldSnapEvent(state, result.actor)
      : []),
    ...(state.effects || []),
  ];
  if (result.suspended) return;
  const { actor, target, attack, rolled, defense, rollSummary, dealt } = result;
  log(
    state,
    actor.name +
      " → " +
      target.name +
      " · " +
      attack.name +
      " · " +
      dealt +
      " урона",
    {
      side: actor.side,
      fighter: actor.id,
      target: target.id,
      attack: attack.name,
      beam: String(attack.range).startsWith("B"),
      from,
      to,
      rolled,
      defense,
      rollSummary,
      dealt,
    },
  );
  if (
    actor.slug === "spectacular-spider-man" &&
    dealt &&
    !target.grunt &&
    (target.dazed || target.ko) &&
    combat.usable(actor) &&
    combat.reactiveAllowed(target, actor, state) &&
    tactics.available(state, actor.side, "go-get-em-tiger") &&
    tactics.canSpend(state, actor, 2)
  )
    state.effects.push({
      type: "go-get-em",
      side: actor.side,
      source: actor.id,
      cost: 2 + tactics.hammerTax(state, actor),
    });
  finishVolleyTarget(state, pending, actor);
  const living = sides.filter((p) =>
    state.fighters.some((f) => f.side === p && !f.ko),
  );
  if (living.length === 1) {
    declareWinner(state, living[0]);
    return;
  }
  if (!combat.usable(actor) && !pendingDecision(state))
    endActivation(state, actor.side, random, false);
}

function finishVolleyTarget(state, pending, actor) {
  if (pending.volley && state.volley) {
    (state.volley.targets ||= []).push(pending.target);
    state.volley.remaining = state.volley.remaining.filter((id) =>
      combat.usable(state.fighters.find((f) => f.id === id)),
    );
    if (!combat.usable(actor) || !state.volley.remaining.length) {
      if (combat.usable(actor)) {
        combat.finishVolley(actor, pending.index);
        if (
          combat.attackCard(actor, pending.index).name === "Shatter" &&
          actor.form === 1
        )
          state.effects.push(transformEvent(actor, 0, false));
        if (combat.attackCard(actor, pending.index).name === "Hurricane")
          state.effects.push({
            type: "hurricane-flight",
            side: actor.side,
            source: actor.id,
            targets: [...new Set(state.volley.targets)],
          });
        const placeAfter = combat.attackCard(actor, pending.index).name;
        if (["Flyby", "Tornado Claw"].includes(placeAfter)) {
          const last = state.fighters.find((f) => f.id === pending.target);
          if (last?.x != null)
            state.effects.push({
              type: "displace",
              mode: "place",
              side: actor.side,
              mover: actor.id,
              source: actor.id,
              name: placeAfter,
              required: true,
              range: 1,
              reference: { x: last.x, y: last.y, radius: last.radius },
            });
        }
        if (pending.coldSnapAction)
          state.effects.push(...coldSnapEvent(state, actor));
        state.effects.push(...(state.volley.tail || []));
      }
      state.volley = null;
    }
  }
}

function finishRound(state, side, random) {
  for (const fighter of state.fighters) delete fighter.projection;
  const gained = mission.points(state);
  state.score ||= { p1: 0, p2: 0 };
  for (const p of sides) state.score[p] += gained[p];
  log(state, "Очки за миссию: P1 +" + gained.p1 + " · P2 +" + gained.p2);
  const max = Math.max(state.score.p1, state.score.p2);
  if ((max >= 16 || state.round >= 6) && state.score.p1 !== state.score.p2) {
    declareWinner(state, state.score.p1 > state.score.p2 ? "p1" : "p2");
    return;
  }
  mission.cleanup(state, random);
  if (state.drops?.length || state.effects?.length)
    state.nextRoundPriority = other(side);
  else nextRound(state, other(side));
}

function declareWinner(state, side) {
  state.phase = "finished";
  state.finishReason = "victory";
  state.winner = side;
  state.decisionSide = null;
  state.active = null;
  state.actionsLeft = 0;
  state.effects = [];
  state.drops = [];
  state.volley = null;
  state.undo = [];
  log(state, "Победа " + side.toUpperCase());
}

function nextRound(state, priority) {
  const living = sides.filter((p) =>
    state.fighters.some((f) => f.side === p && !f.ko),
  );
  if (living.length === 1) {
    declareWinner(state, living[0]);
    return;
  }
  for (const f of state.fighters.filter((f) => f.dazed)) {
    f.dazed = false;
    if (f.slug === "hulk") {
      f.ko = true;
      f.x = f.y = null;
      log(state, f.name + " · KO в Cleanup", { side: f.side, fighter: f.id });
      continue;
    }
    f.injured = true;
    f.damage = 0;
    f.conditions = [];
    const card = combat.face(f);
    f.speed = card.speed || f.speed;
    f.size = Number(card.size) || f.size;
  }
  const surviving = living.filter((p) =>
    state.fighters.some((f) => f.side === p && !f.ko),
  );
  if (surviving.length === 1) {
    declareWinner(state, surviving[0]);
    return;
  }
  state.nextRoundPriority = null;
  state.priority = priority;
  beginRound(state);
}

function endActivation(state, side, random, applyBleed = true) {
  const actor = actorOf(state);
  if (actor) {
    if (applyBleed && actor.conditions?.includes("bleed")) {
      combat.damage(state, actor, 1);
      if (state.effects?.length) {
        state.endAfterDamage = side;
        return;
      }
    }
    if (combat.usable(actor) && actor.formStartedDiamond && actor.form === 1) {
      actor.formStartedDiamond = false;
      state.effects.unshift({
        ...transformEvent(actor, 0, true),
        endAfterTransform: true,
      });
      return;
    }
    const healing = combat.isPower(actor, "Healing Factor [2]")
      ? 2
      : combat.isPower(actor, "Healing Factor [1]")
        ? 1
        : 0;
    if (healing && combat.usable(actor))
      actor.damage = Math.max(0, (actor.damage || 0) - healing);
    actor.activated = true;
    actor.trickShot = false;
    actor.noMercy = false;
    actor.baronRerolls = 0;
    actor.heavyFirepower = false;
    actor.stokeFlames = 0;
    actor.apexDice = 0;
    delete actor.borrowedAttacks;
    actor.momentumReady = false;
    actor.momentumUsed = false;
    actor.juggernautHit = [];
    actor.grantedAttacks = {};
    actor.montesiUsed = false;
    log(state, actor.name + " завершает активацию", {
      side,
      fighter: actor.id,
    });
  }
  if (state.queuedParent && !state.drops?.length) {
    const parent = state.fighters.find((f) => f.id === state.queuedParent);
    state.queuedParent = null;
    if (combat.usable(parent)) {
      beginActivation(state, parent, true);
      return;
    }
  }
  tactics.resetTurn(state);
  state.leadershipUses = { p1: [], p2: [] };
  state.reactionUses = [];
  state.placements = {};
  state.active = null;
  state.actionsLeft = 0;
  state.undo = [];
  if (state.drops?.length) {
    state.endAfterDrops = side;
    return;
  }
  if (ready(state, other(side)).length) state.decisionSide = other(side);
  else if (ready(state, side).length) state.decisionSide = side;
  else finishRound(state, side, random);
}

function resumeAfterDamage(state, random) {
  const living = sides.filter((side) =>
    state.fighters.some((f) => f.side === side && !f.ko),
  );
  if (living.length === 1) {
    declareWinner(state, living[0]);
    return;
  }
  if (pendingDecision(state)) return;
  if (state.endAfterDamage) {
    const side = state.endAfterDamage;
    delete state.endAfterDamage;
    endActivation(state, side, random, false);
  } else if (state.nextRoundPriority) nextRound(state, state.nextRoundPriority);
  else if (actorOf(state) && !combat.usable(actorOf(state)))
    endActivation(state, state.decisionSide, random, false);
}

function commandOptions(state, side) {
  if (state.phase === "finished") return [];
  if (pendingDecision(state))
    return pendingDecision(state) === side ? currentEffect(state, side) : [];
  if (state.phase === "priority" || state.phase === "round-priority")
    return side === "p1" ? [{ type: "roll" }] : [];
  if (["squad", "leadership"].includes(state.phase)) {
    if (state.commits[side]) return [];
    return state.phase === "squad"
      ? [{ type: "squad", threat: state.threat }]
      : [
          {
            type: "leadership",
            options: [
              ...leadersFor(state, side),
              { value: "", label: "Без Leadership" },
            ],
          },
        ];
  }
  if (state.decisionSide !== side) return [];
  if (state.phase === "crisis-type")
    return [{ type: "crisis-type", options: options(kinds) }];
  if (["first-crisis", "second-crisis"].includes(state.phase))
    return [
      {
        type: "crisis",
        options: state.offers.map((value) => ({
          value,
          label: pool.crises[value].name,
        })),
      },
    ];
  if (state.phase === "threat")
    return [
      {
        type: "threat",
        options: [
          ...new Set(
            kinds.map((kind) => pool.crises[state.mission[kind]].threatLevel),
          ),
        ].map((value) => ({ value, label: String(value) })),
      },
    ];
  if (state.phase === "edge")
    return [{ type: "edge", options: options(geometry.edges) }];
  if (state.phase === "deployment")
    return [
      {
        type: "deploy",
        fighters: state.fighters
          .filter((f) => f.side === side && f.x == null)
          .map((f) => f.id),
      },
    ];
  if (state.phase !== "activation") return [];
  const pass =
    (!state.active || (!state.activationLocked && state.actionsLeft === 2)) &&
    ready(state, side).length < ready(state, other(side)).length
      ? [{ type: "pass" }]
      : [];
  if (state.active) {
    const actor = actorOf(state);
    const available = state.actionsLeft > 0;
    const stagger =
      actor.conditions?.includes("stagger") && state.actionsLeft === 2;
    const hexField =
      actor.conditions?.some((name) => hexFieldConditions.includes(name)) &&
      state.fighters.some(
        (f) =>
          f.side !== side &&
          combat.usable(f) &&
          combat.isPower(f, "Hex Field") &&
          geometry.within(actor, f, 3),
      );
    const shake = (stagger ? ["stagger"] : actor.conditions || []).filter(
      (name) => !hexField || !hexFieldConditions.includes(name),
    );
    const attacks = available && !stagger ? combat.attacks(state, actor) : [];
    const canMove =
      available &&
      !stagger &&
      !(
        state.moves &&
        mission.held(state, actor).some((o) => o.name === "Senator")
      );
    const powers = combat
      .powers(state, actor)
      .filter(
        (power) => !stagger || power.value === "Nothing Stops the Juggernaut!",
      );
    const interacts = stagger ? [] : mission.interacts(state, actor);
    const playable = tactics.activationOptions(state, actor);
    const goldTargets = xmenGoldTargets(state, actor);
    return [
      ...(!state.activationLocked ? selectable(state, side) : []),
      ...(canMove ? [{ type: "advance" }, { type: "climb" }] : []),
      ...(attacks.length ? [{ type: "attack", attacks }] : []),
      ...(powers.length ? [{ type: "power", powers }] : []),
      ...(interacts.length ? [{ type: "interact", interacts }] : []),
      ...(playable.length ? [{ type: "tactic", cards: playable }] : []),
      ...(goldTargets.length
        ? [
            {
              type: "xmen-gold",
              options: goldTargets.map((f) => ({
                value: f.id,
                label: "X-Men Gold · " + f.name + " · 1 Power",
              })),
            },
          ]
        : []),
      ...(available && shake.length
        ? [
            {
              type: "shake",
              options: shake.map((value) => ({ value, label: value })),
            },
          ]
        : []),
      ...(state.undo.length ? [{ type: "undo" }] : []),
      ...pass,
      ...(!stagger ? [{ type: "end" }] : []),
    ];
  }
  return [...selectable(state, side), ...pass];
}

function view(state, side, full = false) {
  if (!state) return null;
  const { undo, commits, ...visible } = state;
  return {
    ...visible,
    fighters: state.fighters.map((f) => ({ ...f, ...combat.status(f) })),
    attackRoll: combat.attackRollSummary(state, state.effects?.[0]?.resume),
    awaitingSide:
      pendingDecision(state) ||
      state.decisionSide ||
      (["priority", "round-priority"].includes(state.phase)
        ? "p1"
        : ["squad", "leadership"].includes(state.phase)
          ? sides.find((p) => !commits[p] && commits[other(p)])
          : null),
    perspective: side,
    ...(full ? { undo, commits } : {}),
    committed: Object.fromEntries(sides.map((p) => [p, !!commits[p]])),
    ...(commits[side] ? { ownCommit: commits[side] } : {}),
    actions: Object.fromEntries(
      (full ? sides : [side]).map((p) => [p, commandOptions(state, p)]),
    ),
  };
}

function beginRound(state) {
  state.phase = "activation";
  state.round += 1;
  state.decisionSide = state.priority;
  state.fighters.forEach((fighter) => {
    fighter.activated = false;
    fighter.realityTargets = [];
    fighter.starkArmory = 0;
    if (combat.usable(fighter)) {
      combat.gain(fighter, 1);
      if (combat.isPower(fighter, "Psionic of the Highest Order"))
        combat.gain(fighter, 1);
      if (combat.isPower(fighter, "Omega Level Multi-Versal Entity"))
        combat.gain(fighter, 1);
      if (combat.isPower(fighter, "Inner Rage")) combat.gain(fighter, 2);
      if (
        combat.isPower(fighter, "Techno-Organic Virus Suppression") ||
        combat.isPower(fighter, "Psionic Nexus")
      )
        combat.gain(fighter, 1);
      if (combat.isPower(fighter, "Latent Psychic Potential"))
        combat.gain(fighter, 2);
    }
  });
  mission.powerPhase(state);
  state.effects = [
    ...tactics.phaseEffects(state),
    ...mission.cosmicEffects(state),
  ];
  log(state, "Раунд " + state.round);
}

function continueSingleTarget(state, random = randomInt) {
  if (state.phase !== "activation" || state.volley?.remaining.length !== 1)
    return false;
  const side = state.volley.side;
  const [decision] = commandOptions(state, side);
  if (decision?.type !== "volley-target" || decision.sampleBoost) return false;

  act(
    state,
    side,
    { type: "volley-target", value: decision.options[0].value },
    random,
  );
  return true;
}

function act(state, side, action, random = randomInt) {
  state.effects ||= [];
  const terrainBefore = [...state.terrain];
  const previousPositions = state.fighters.map((f) => [f.id, f.x, f.y]);
  const movementEffect = state.effects?.[0]?.mode;
  let powerMovement;
  let resolvedMoveMode;
  const binary = state.fighters
    .filter((f) => f.slug === "captain-marvel-cosmic-avenger" && f.form === 1)
    .map((f) => [f.id, f.power]);
  const type = action?.type;
  const allowed = commandOptions(state, side).filter(
    (option) => option.type === type,
  );
  expect(allowed.length, "Это действие сейчас недоступно.");
  if (allowed[0].options)
    expect(
      allowed[0].options.some(({ value }) => value === action.value),
      "Недопустимый вариант.",
    );
  const { value } = action;
  switch (type) {
    case "roll":
      state.priority = priorityRoll(state, random);
      if (state.phase === "round-priority") beginRound(state);
      else {
        state.phase = "crisis-type";
        state.decisionSide = state.priority;
      }
      break;
    case "crisis-type":
      state.crisisKind = value;
      state.offers = draw(state, side, value, random);
      state.phase = "first-crisis";
      state.decisionSide = other(side);
      break;
    case "crisis":
      if (state.phase === "first-crisis") {
        state.mission[state.crisisKind] = value;
        state.crisisKind = kinds.find((kind) => kind !== state.crisisKind);
        state.offers = draw(state, side, state.crisisKind, random);
        state.phase = "second-crisis";
        state.decisionSide = other(side);
      } else {
        state.mission[state.crisisKind] = value;
        state.offers = [];
        state.phase = "threat";
        state.decisionSide = other(state.priority);
      }
      log(state, pool.crises[value].name);
      break;
    case "threat":
      state.threat = value;
      state.phase = "edge";
      state.decisionSide = state.priority;
      break;
    case "edge":
      state.deployment = {
        [side]: value,
        [other(side)]: geometry.oppositeEdge[value],
      };
      state.objectives = objectives(state.mission, value);
      state.phase = "squad";
      state.decisionSide = null;
      break;
    case "squad": {
      const { characters, tactics, affiliation } = action;
      const selected = state.rosters[side];
      expect(
        unique(characters) &&
          characters.length &&
          characters.every((id) => selected.characters.includes(id)),
        "Выберите персонажей из ростера.",
      );
      const cards = characters.map((id) => pool.characters[id]);
      expect(
        cards.filter((card) => card.peerless).length <= 1,
        "В отряде может быть только один персонаж с Peerless.",
      );
      expect(
        cards.reduce((sum, card) => sum + card.threatLevel, 0) <= state.threat,
        "Превышен лимит Threat.",
      );
      expect(
        new Set(cards.map((card) => card.alterEgo || card.slug)).size ===
          cards.length,
        "В отряде повторяется Alter Ego.",
      );
      expect(
        !affiliation || affiliations(characters).includes(affiliation),
        "Больше половины отряда должны состоять в этой аффилиации.",
      );
      expect(
        unique(tactics) &&
          tactics.length <= 5 &&
          tactics.every(
            (id) =>
              selected.tactics.includes(id) &&
              (!pool.tactics[id].affiliation ||
                pool.tactics[id].affiliation === affiliation),
          ),
        "Выберите до пяти допустимых тактик.",
      );
      state.commits[side] = {
        characters,
        tactics,
        affiliation: affiliation || "",
      };
      if (sides.every((p) => state.commits[p])) {
        state.squads = state.commits;
        state.commits = {};
        state.fighters = sides.flatMap((p) =>
          state.squads[p].characters.map((slug) => makeFighter(p, slug)),
        );
        state.phase = "deployment";
        state.decisionSide = state.priority;
        log(state, "Отряды и тактики раскрыты");
      }
      break;
    }
    case "deploy": {
      const fighter = state.fighters.find(
        (f) => f.id === action.fighter && f.side === side && f.x == null,
      );
      const point = { x: action.x, y: action.y };
      expect(
        fighter &&
          geometry.deployable(
            point,
            state.deployment[side],
            fighter,
            state.fighters,
            state.terrain,
          ),
        "База должна помещаться на поле, в зоне расстановки, без пересечения с другими базами.",
      );
      Object.assign(fighter, point);
      if (state.effects?.[0]?.type === "grunt-deploy") state.effects.shift();
      if (
        fighter.slug === "ultron-metal-tyrant" &&
        !state.fighters.some((f) => f.side === side && f.grunt)
      ) {
        const drone = makeFighter(side, "ultron-drones-grunts");
        state.fighters.push(drone);
        state.effects.push({ type: "grunt-deploy", side, fighter: drone.id });
        log(state, "Расставлен " + fighter.name, { side, point });
        break;
      }
      log(state, "Расставлен " + fighter.name, { side, point });
      const undeployed = (p) =>
        state.fighters.some((f) => f.side === p && f.x == null);
      if (undeployed(other(side))) state.decisionSide = other(side);
      else if (!undeployed(side)) {
        state.decisionSide = null;
        state.phase = "leadership";
      }
      break;
    }
    case "leadership":
      state.commits[side] = { value };
      if (sides.every((p) => state.commits[p])) {
        state.leaders = Object.fromEntries(
          sides.map((p) => [p, state.commits[p].value]),
        );
        state.commits = {};
        for (const p of sides) {
          if (!combat.leadership(state, p, "Army of Evil")) continue;
          const unused = state.rosters[p].tactics.filter(
            (id) =>
              !state.squads[p].tactics.includes(id) &&
              (!pool.tactics[id].affiliation ||
                pool.tactics[id].affiliation === "Hydra"),
          );
          if (unused.length)
            state.effects.push({
              type: "hydra-tactic",
              side: p,
              options: unused.map((id) => ({
                value: id,
                label: pool.tactics[id].name,
              })),
            });
        }
        state.phase = "round-priority";
        log(state, "Leadership раскрыты");
      }
      break;
    case "activate":
      expect(
        allowed.some((option) => option.value === value),
        "Нельзя активировать персонажа.",
      );
      const model = state.fighters.find((f) => f.id === value);
      const drone =
        model.slug === "ultron-metal-tyrant" &&
        state.fighters.find(
          (f) => f.grunt && f.side === side && !f.activated && combat.usable(f),
        );
      state.queuedParent = drone ? model.id : null;
      beginActivation(state, drone || model);
      break;
    case "advance":
    case "climb":
    case "granted-move": {
      const actor = actorOf(state);
      const point = { x: action.x, y: action.y };
      const granted = type === "granted-move";
      const mode = granted
        ? action.mode === "climb"
          ? "climb"
          : "advance"
        : type;
      const model = combat.movementModel(actor);
      expect(
        geometry
          .movement(
            granted && allowed[0].climbsOnAdvance
              ? { ...model, climbsOnAdvance: true }
              : model,
            mode,
            state.fighters,
            state.terrain,
          )
          .route(point),
        "Сюда нельзя переместить базу выбранным действием.",
      );
      if (granted) {
        state.effects.shift();
        state.undo = [];
      } else checkpoint(state);
      const move = {
        type: "move-reaction",
        side,
        point,
        mode,
        granted,
        followups: [],
      };
      if (moveReactionOptions(state, actor).length) state.effects.unshift(move);
      else {
        resolvedMoveMode = mode;
        finishMoveAction(state, actor, move);
      }
      break;
    }
    case "move-reaction": {
      const move = state.effects[0];
      const actor = actorOf(state);
      if (value !== "skip") {
        const selected = allowed[0].options.find(
          (option) => option.value === value,
        );
        combat.spend(state, actor, selected.cost);
        (state.reactionUses ||= []).push(actor.id + ":" + selected.power);
        move.followups.push(selected);
        log(state, selected.power, {
          side,
          fighter: actor.id,
          power: selected.power,
          target: selected.target,
        });
      }
      if (value === "skip" || !moveReactionOptions(state, actor).length) {
        state.effects.shift();
        resolvedMoveMode = move.mode;
        finishMoveAction(state, actor, move);
      }
      break;
    }
    case "attack": {
      const actor = actorOf(state);
      const option = allowed[0].attacks.find(
        (a) => a.index === action.index && a.types.includes(action.damageType),
      );
      expect(option, "Выберите доступную атаку и тип урона.");
      const effect = state.effects?.[0];
      const extra = ["bonus-attack", "borrowed-attack"].includes(effect?.type);
      const granted = ["granted-attack", "flurry-attack"].includes(
        effect?.type,
      );
      const boost = action.boost || 0;
      expect(
        Number.isInteger(boost) &&
          boost >= 0 &&
          boost <= (option.boostMax || 0),
        "Укажите допустимую доплату Power.",
      );
      const diceBonus = (!extra ? actor.stokeFlames || 0 : 0) + boost;
      if (option.shape !== "single") {
        const remaining = combat.beginVolley(
          state,
          actor,
          option,
          action.angle,
          action.damageType,
        );
        if (option.index === 100) actor.montesiUsed = true;
        expect(
          remaining.length,
          "Шаблон должен накрыть хотя бы одну допустимую цель.",
        );
        if (!extra) {
          combat.pay(state, actor, option.cost + boost, action.payer);
          actor.stokeFlames = 0;
        }
        if (granted || extra) state.effects.shift();
        else state.actionsLeft -= 1;
        state.undo = [];
        state.activationLocked = true;
        state.volley = {
          side,
          index: option.index,
          damageType: action.damageType,
          remaining,
          targetCount: remaining.length,
          angle: action.angle,
          diceBonus,
          doubleWild: effect?.doubleWild,
          coldSnapAction: !extra,
          sampleBoost: option.sampleBoost,
          tail: (state.effects || []).splice(0),
        };
        log(
          state,
          actor.name +
            " направляет " +
            option.name +
            " · целей: " +
            remaining.length,
          { side, fighter: actor.id },
        );
        break;
      }
      expect(
        option.targets.some(
          (t) =>
            t.value === action.target &&
            (!t.types || t.types.includes(action.damageType)),
        ),
        "Выберите допустимую цель.",
      );
      const target = state.fighters.find((f) => f.id === action.target);
      if (extra || granted) state.effects.shift();
      let payment;
      if (!extra) {
        if (
          combat
            .targetReactions(state, actor, target)
            .some((r) => r.value === "cant-catch-me")
        ) {
          payment = {
            cost: option.cost + boost,
            payer: combat.payerFor(state, actor, option.cost, action.payer).id,
          };
        } else combat.pay(state, actor, option.cost + boost, action.payer);
        if (!granted) state.actionsLeft -= 1;
        actor.stokeFlames = 0;
      }
      state.undo = [];
      state.activationLocked = true;
      announceAttack(
        state,
        actor,
        target,
        option,
        {
          damageType: action.damageType,
          extra,
          reroll: effect?.reroll,
          payment,
          diceBonus,
          doubleWild: effect?.doubleWild,
          throwAfter: granted && effect?.throwAfter,
          coldSnapAction: !extra,
        },
        random,
      );
      break;
    }
    case "volley-target": {
      const actor = actorOf(state);
      const volley = state.volley;
      volley.remaining = volley.remaining.filter((id) => id !== value);
      const target = state.fighters.find((f) => f.id === value);
      expect(
        !action.sample || allowed[0].sampleBoost,
        "Нет доступного Genetic Sample.",
      );
      if (action.sample) actor.samples = (actor.samples ?? 1) - 1;
      const name = combat.attackCard(actor, volley.index).name;
      announceAttack(
        state,
        actor,
        target,
        { index: volley.index, name },
        {
          damageType: volley.damageType,
          volley: true,
          angle: volley.angle,
          diceBonus: volley.diceBonus,
          doubleWild: volley.doubleWild,
          coldSnapAction: volley.coldSnapAction,
          sample: !!action.sample,
        },
        random,
      );
      break;
    }
    case "reaction": {
      expect(
        allowed.some((o) => o.value === value),
        "Эта реакция недоступна.",
      );
      const pending = state.pendingAttack;
      const chosenReaction = allowed.find((option) => option.value === value);
      if (chosenReaction.key) (pending.reacted ||= []).push(chosenReaction.key);
      if (value === "quick-draw") {
        const cyclops = state.fighters.find((f) => f.id === pending.target);
        combat.spend(state, cyclops, chosenReaction.cost);
        pending.quickDraw = cyclops.damage || 0;
        log(state, "Quick Draw", {
          side,
          fighter: cyclops.id,
          power: "Quick Draw",
        });
        continueTargeting(state, pending, random);
        break;
      }
      if (value === "mental-lock") {
        const attacker = state.fighters.find((f) => f.id === pending.actor);
        if (attacker.power >= 2) {
          pending.mentalDecision = true;
          pending.side = attacker.side;
        } else {
          pending.defenseType = "mystic";
          continueTargeting(state, pending, random);
        }
        break;
      }
      if (value === "mental-lock-pay" || value === "mental-lock-accept") {
        const attacker = state.fighters.find((f) => f.id === pending.actor);
        if (value === "mental-lock-pay") attacker.power -= 2;
        else pending.defenseType = "mystic";
        delete pending.mentalDecision;
        pending.side = other(attacker.side);
        continueTargeting(state, pending, random);
        break;
      }
      if (value === "diamond-form") {
        const emma = state.fighters.find((f) => f.id === pending.target);
        combat.spend(state, emma, chosenReaction.cost);
        state.pendingAttack = null;
        state.effects.unshift({
          ...transformEvent(emma, 1, true),
          attackAfterTransform: pending,
        });
        break;
      }
      if (chosenReaction.reactor) {
        const ally = state.fighters.find(
          (f) => f.id === chosenReaction.reactor,
        );
        const attacker = state.fighters.find((f) => f.id === pending.actor);
        combat.spend(state, ally, chosenReaction.cost);
        const bigBrother = value.startsWith("big-brother:");
        const cantTouch = value.startsWith("cant-touch:");
        const dangerous = value.startsWith("too-dangerous:");
        if (dangerous) {
          Object.assign(pending, {
            target: ally.id,
            redirected: true,
            defenseBonus: 0,
            block: false,
          });
          delete pending.quickDraw;
        } else if (cantTouch) {
          pending.defenseBonus = (pending.defenseBonus || 0) + 2;
          pending.cantTouch = pending.target;
        } else if (!bigBrother) {
          (state.reactionUses ||= []).push(chosenReaction.key);
          pending.defenseBonus = (pending.defenseBonus || 0) + 2;
        } else if (geometry.within(attacker, ally, 2)) {
          pending.target = ally.id;
          pending.redirected = true;
          pending.defenseBonus = 0;
          pending.block = false;
          delete pending.quickDraw;
        } else (pending.bigBrotherMoves ||= []).push(ally.id);
        log(
          state,
          bigBrother
            ? "Big Brother · " + ally.name
            : dangerous
              ? "Too Dangerous to Ignore · " + ally.name
              : cantTouch
                ? "Can‘t Touch This · " + ally.name
                : "Telekinetic Shield · " + ally.name,
          { side, fighter: ally.id, target: pending.target },
        );
        continueTargeting(state, pending, random);
        break;
      }
      if (value?.startsWith("wolverine-swap:")) {
        const jubilee = state.fighters.find((f) => f.id === pending.target);
        combat.spend(state, jubilee, chosenReaction.cost);
        Object.assign(pending, {
          target: value.split(":").slice(1).join(":"),
          redirected: true,
          defenseBonus: 0,
          block: false,
        });
        delete pending.quickDraw;
        log(state, "Wolverine! · " + jubilee.name, {
          side,
          fighter: jubilee.id,
          target: pending.target,
        });
        continueTargeting(state, pending, random);
        break;
      }
      if (value === "cant-catch-me") {
        const reactor = state.fighters.find((f) => f.id === pending.target);
        combat.spend(
          state,
          reactor,
          allowed.find((a) => a.value === value).cost,
        );
        (state.reactionUses ||= []).push(reactor.id + ":evasion");
        state.pendingAttack = null;
        state.effects.unshift({
          type: "displace",
          mode: "advance",
          speed: "S",
          side,
          mover: reactor.id,
          source: reactor.id,
          name: "Can’t Catch Me",
          afterEvasion: pending,
        });
        log(state, "Can’t Catch Me", {
          side,
          fighter: reactor.id,
          power: "Can’t Catch Me",
        });
        break;
      }
      if (value?.startsWith("fast-draw:")) {
        const reactor = state.fighters.find((f) => f.id === pending.target);
        const initial = state.fighters.find((f) => f.id === pending.actor);
        const chosen = allowed.find((o) => o.value === value);
        combat.spend(
          state,
          reactor,
          1 + Number(reactor.conditions?.includes("root") || false),
        );
        state.pendingAttack = null;
        state.effects.unshift({
          type: "resume-attack",
          attack: pending,
          side: initial.side,
        });
        announceAttack(
          state,
          reactor,
          initial,
          { index: chosen.index, name: "Fast Draw · Arrow Shot" },
          { damageType: value.split(":")[1] },
          random,
        );
        break;
      }
      if (value !== "skip") {
        const target = state.fighters.find((f) => f.id === pending.target);
        combat.spend(
          state,
          target,
          2 + Number(target.conditions?.includes("root") || false),
        );
        const block = [
          "Perfect Block",
          "bozhe-moi",
          "acrobatic-defense",
        ].includes(value);
        if (block) pending.block = true;
        else target.phasing = value;
        const name =
          value === "bozhe-moi"
            ? "Bozhe Moi"
            : value === "acrobatic-defense"
              ? "Unglaublich Acrobatics"
              : block
                ? value
                : "Rapid Phase";
        log(state, target.name + " использует " + name, {
          side,
          fighter: target.id,
          power: name,
        });
      }
      if (value === "skip") finishAttack(state, pending, false, random);
      else continueTargeting(state, pending, random);
      break;
    }
    case "hydra-refund": {
      state.effects.shift();
      const payer = state.fighters.find((f) => f.id === value);
      combat.gain(payer, 1);
      log(state, "Army of Evil · " + payer.name + " получает 1 Power", {
        side,
        fighter: payer.id,
      });
      break;
    }
    case "hydra-tactic":
      state.effects.shift();
      state.squads[side].tactics.push(value);
      log(state, "Army of Evil · " + pool.tactics[value].name, { side });
      break;
    case "sinister-shake": {
      const effect = state.effects.shift();
      const target = state.fighters.find((f) => f.id === effect.target);
      target.conditions = target.conditions.filter((c) => c !== value);
      (state.leadershipUses ||= { p1: [], p2: [] })[side].push(
        "sinister-shake",
      );
      break;
    }
    case "frenzy": {
      const effect = state.effects.shift();
      const source = state.fighters.find((f) => f.id === effect.source);
      combat.spend(state, source, effect.cost);
      (state.reactionUses ||= []).push(source.id + ":frenzy");
      state.effects.unshift(
        {
          type: "displace",
          mode: "advance",
          speed: "S",
          side,
          mover: source.id,
          source: source.id,
          name: "Frenzy",
          required: true,
        },
        {
          type: "granted-attack",
          side,
          source: source.id,
          index:
            combat
              .attacks(state, source)
              .find((a) => a.name === "Adamantium Slash")?.index ?? 0,
        },
      );
      log(state, "Frenzy", { side, fighter: source.id, power: "Frenzy" });
      break;
    }
    case "untamed": {
      const effect = state.effects.shift();
      const source = state.fighters.find((f) => f.id === effect.source);
      const target = state.fighters.find((f) => f.id === effect.target);
      combat.spend(
        state,
        source,
        2 + Number(source.conditions?.includes("root") || false),
      );
      (state.reactionUses ||= []).push(source.id + ":untamed");
      announceAttack(
        state,
        source,
        target,
        { index: effect.index, name: "Untamed Force · Claw Slash" },
        { damageType: "physical" },
        random,
      );
      break;
    }
    case "curse": {
      const effect = state.effects.shift();
      const witch = state.fighters.find((f) => f.id === effect.source);
      const enemy = state.fighters.find((f) => f.id === effect.target);
      combat.spend(state, witch, effect.cost);
      combat.condition(enemy, "judgment");
      state.undo = [];
      log(state, "Curse · " + enemy.name + " получает Judgment", {
        side,
        fighter: witch.id,
        target: enemy.id,
        power: "Curse",
      });
      break;
    }
    case "slippery": {
      const effect = state.effects.shift();
      const toad = state.fighters.find((f) => f.id === effect.mover);
      combat.spend(state, toad, effect.cost);
      state.effects.unshift({
        type: "displace",
        mode: "advance",
        speed: "M",
        side,
        mover: toad.id,
        source: toad.id,
        name: "Slippery",
      });
      log(state, "Slippery", { side, fighter: toad.id, power: "Slippery" });
      break;
    }
    case "kill-box":
    case "falling-debris": {
      const effect = state.effects.shift();
      const source = state.fighters.find((f) => f.id === effect.source);
      const target = state.fighters.find((f) => f.id === effect.target);
      combat.spend(
        state,
        source,
        3 + Number(source.conditions?.includes("root") || false),
      );
      if (type === "kill-box")
        (state.reactionUses ||= []).push(source.id + ":kill-box");
      state.terrain = state.terrain.filter((p) => p.id !== value);
      combat.collide(state, target, source, random);
      state.undo = [];
      const power = type === "kill-box" ? "Kill Box" : "Beware Falling Debris";
      log(state, power + " · " + target.name, {
        side,
        power,
        fighter: source.id,
        target: target.id,
      });
      break;
    }
    case "enhanced-agility": {
      const effect = state.effects.shift();
      const gambit = state.fighters.find((f) => f.id === effect.mover);
      const attacker = state.fighters.find((f) => f.id === effect.target);
      combat.spend(state, gambit, effect.cost);
      state.effects.unshift({
        type: "displace",
        mode: "advance",
        speed: "S",
        side,
        mover: gambit.id,
        source: gambit.id,
        name: "Enhanced Agility",
      });
      combat.damage(state, attacker, 1, gambit);
      log(state, "Enhanced Agility", {
        side,
        fighter: gambit.id,
        power: "Enhanced Agility",
      });
      resumeAfterDamage(state, random);
      break;
    }
    case "nightmare-visions": {
      const effect = state.effects.shift();
      const source = state.fighters.find((f) => f.id === effect.source);
      const target = state.fighters.find((f) => f.id === effect.target);
      combat.spend(state, source, effect.cost);
      (state.reactionUses ||= []).push(source.id + ":nightmare-visions");
      state.undo = [];
      combat.nightmareVisions(state, source, target, random);
      resumeAfterDamage(state, random);
      break;
    }
    case "go-get-em": {
      const effect = state.effects.shift();
      const source = state.fighters.find((f) => f.id === effect.source);
      source.power -= effect.cost;
      tactics.use(state, side, "go-get-em-tiger");
      if (mission.held(state, source).length) {
        source.damage = Math.max(0, (source.damage || 0) - 3);
        if (source.conditions?.length)
          state.effects.unshift({
            type: "tiger-shake",
            side,
            target: source.id,
            options: source.conditions.map((value) => ({
              value,
              label: "Снять " + value,
            })),
          });
      }
      if (
        !state.objectives.some(
          (o) => o.role === "secure" && geometry.within(source, o, 1),
        )
      )
        state.effects.push({ type: "bonus-move", side });
      log(state, "Go Get ’em Tiger", { side, fighter: source.id });
      break;
    }
    case "tiger-shake": {
      const effect = state.effects.shift();
      const target = state.fighters.find((f) => f.id === effect.target);
      target.conditions = target.conditions.filter((c) => c !== value);
      break;
    }
    case "transform":
    case "spawn-drones": {
      const effect = state.effects.shift();
      const point = { x: action.x, y: action.y };
      expect(
        geometry.within(
          effect.reference,
          { ...point, radius: effect.model.radius },
          effect.range,
        ) && geometry.fits(point, effect.model, state.fighters, state.terrain),
        "Точка вне области размещения.",
      );
      if (type === "transform") {
        const f = state.fighters.find((item) => item.id === effect.mover);
        Object.assign(f, {
          form: effect.form,
          radius: effect.model.radius,
          size: effect.model.size,
          speed: effect.model.speed,
          ...point,
        });
        const conditions = [...(f.conditions || [])];
        f.conditions = [];
        for (const name of conditions) combat.condition(f, name);
        if (effect.losePower) {
          f.power = 0;
          state.activationLocked = true;
        }
      } else {
        state.fighters = state.fighters.filter((f) => f.id !== effect.model.id);
        state.fighters.push({
          ...effect.model,
          ...point,
          conditions: ["stagger"],
        });
      }
      state.undo = [];
      log(
        state,
        effect.name +
          (type === "transform"
            ? effect.form
              ? effect.model.slug === "emma-frost"
                ? " · Diamond"
                : " · Binary"
              : " · Normal"
            : " · размещение"),
        { side, point },
      );
      if (effect.attackAfterTransform)
        continueTargeting(state, effect.attackAfterTransform, random);
      if (effect.dodgeAfterTransform) {
        const target = state.fighters.find((f) => f.id === effect.mover);
        const source = state.fighters.find(
          (f) => f.id === effect.dodgeAfterTransform.source,
        );
        combat.collide(state, target, source, random, false);
      }
      if (effect.endAfterTransform) endActivation(state, side, random, false);
      break;
    }
    case "diamond-dodge": {
      const effect = state.effects.shift();
      const emma = state.fighters.find((f) => f.id === effect.target);
      combat.spend(state, emma, effect.cost);
      state.effects.unshift({
        ...transformEvent(emma, 1, true),
        dodgeAfterTransform: effect,
      });
      break;
    }
    case "acrobatic-dodge": {
      const effect = state.effects.shift();
      combat.resolveAcrobaticDodge(state, effect, true, random);
      break;
    }
    case "puff-smoke": {
      const effect = state.effects.shift();
      const mover = state.fighters.find((f) => f.id === effect.source);
      combat.spend(state, mover, effect.cost);
      state.effects.unshift({
        type: "displace",
        mode: "place",
        side,
        mover: mover.id,
        source: mover.id,
        name: "Puff of Smoke",
        reference: effect.reference,
        range: 2,
        required: true,
      });
      break;
    }
    case "modify-dice": {
      const effect = state.effects.shift();
      if (effect.collision) {
        combat.resolveDodge(state, effect, action, random);
        break;
      }
      const before =
        effect.dice && Array.isArray(action.indices)
          ? action.indices.map((index) => effect.dice[index])
          : [];
      const pending = combat.applyModifier(state, effect, action, random);
      const after = pending.rolls?.[effect.role] || pending.initial;
      log(state, effect.label, {
        side,
        fighter: effect.payer,
        power: effect.label,
        ...(before?.length &&
          after && {
            rolls: [
              { label: "До", faces: before },
              {
                label: "После",
                faces: action.indices.map((index) => after[index]),
              },
            ],
          }),
      });
      finishAttack(state, pending, false, random);
      break;
    }
    case "magnetic-crush": {
      const { destroyed, resume } = state.effects.shift();
      const primary = destroyed.find((piece) => piece.id === value);
      resume.crushDice = destroyed.length + (primary ? primary.size - 1 : 0);
      log(state, "Magnetic Crush · +" + resume.crushDice + " куб.", { side });
      finishAttack(state, resume, false, random);
      break;
    }
    case "mind-over-matter": {
      const { resume } = state.effects.shift();
      const target = state.fighters.find((f) => f.id === resume.target);
      const attacker = state.fighters.find((f) => f.id === resume.actor);
      const removed = value.split("|");
      target.conditions = target.conditions.filter(
        (condition) => !removed.includes(condition),
      );
      const previous = [...state.effects];
      combat.damage(state, target, 2, attacker, {
        attackType: resume.damageType,
      });
      log(state, "Mind Over Matter · " + removed.join(" + "), {
        side,
        fighter: attacker.id,
        target: target.id,
      });
      const reactions = state.effects.filter(
        (effect) => !previous.includes(effect),
      );
      if (reactions.length)
        state.effects = [
          ...reactions,
          { type: "resume-attack", side, attack: resume, resolvedTarget: true },
          ...previous,
        ];
      else finishAttack(state, resume, false, random);
      break;
    }
    case "nice-punch": {
      const effect = state.effects.shift();
      state.undo = [];
      log(state, "Nice Punch...", {
        side,
        fighter: effect.target,
        power: "Nice Punch...",
      });
      combat.resolveNicePunch(state, effect, true);
      resumeAfterDamage(state, random);
      break;
    }
    case "xmen-blue": {
      state.effects.shift();
      const ally = state.fighters.find((f) => f.id === value);
      combat.gain(ally, 1);
      (state.leadershipUses ||= { p1: [], p2: [] })[side].push(
        "blue:" + ally.id,
      );
      log(state, "X-Men Blue · " + ally.name + " получает 1 Power", {
        side,
        fighter: ally.id,
      });
      break;
    }
    case "xmen-gold": {
      const actor = actorOf(state);
      const ally = state.fighters.find((f) => f.id === value);
      checkpoint(state);
      actor.power--;
      (state.goldUsedRound ||= {})[side] = state.round;
      state.effects.unshift({
        type: "displace",
        mode: "place",
        side,
        mover: actor.id,
        source: actor.id,
        name: "X-Men Gold",
        range: 1,
        reference: { x: ally.x, y: ally.y, radius: ally.radius },
        required: true,
      });
      log(state, "X-Men Gold · " + actor.name, { side, fighter: actor.id });
      break;
    }
    case "juggernaut-contact": {
      const effect = state.effects.shift();
      const source = state.fighters.find((f) => f.id === effect.source);
      const target = state.fighters.find((f) => f.id === value);
      combat.damage(state, target, 1, source, { juggernautContact: true });
      break;
    }
    case "xavier-school": {
      state.effects.shift();
      const ally = state.fighters.find((f) => f.id === value);
      combat.gain(ally, 1);
      log(state, "Xavier's School · " + ally.name + " получает 1 Power", {
        side,
        fighter: ally.id,
      });
      break;
    }
    case "from-the-ruins": {
      const effect = state.effects[0];
      const target = state.fighters.find((f) => f.id === value);
      combat.gain(target, 1);
      (state.leadershipUses ||= { p1: [], p2: [] })[side].push(
        "ruins:" + target.id,
      );
      effect.remaining--;
      if (
        !effect.remaining ||
        !state.fighters.some(
          (f) =>
            f.side === side &&
            combat.usable(f) &&
            !f.grunt &&
            !state.leadershipUses[side].includes("ruins:" + f.id),
        )
      )
        state.effects.shift();
      log(state, "From the Ruins · " + target.name + " получает 1 Power", {
        side,
        fighter: target.id,
      });
      break;
    }
    case "place-construct": {
      const effect = state.effects[0];
      const rect = geometry.metalConstruct(
        action,
        effect.reference,
        state.fighters,
        state.terrain,
      );
      expect(rect, "Точка вне области размещения Metal Construct.");
      state.effects.shift();
      state.terrain.push({
        ...rect,
        id: "construct:" + randomUUID(),
        name: "Metal Construct",
        size: 2,
        construct: side,
      });
      const magneto = state.fighters.find((f) => f.id === effect.target);
      combat.gain(
        magneto,
        state.terrain.filter((piece) => piece.construct === side).length,
      );
      log(state, "Master of Magnetism · Metal Construct", {
        side,
        fighter: magneto.id,
        point: { x: action.x, y: action.y },
      });
      break;
    }
    case "start-displacement":
      state.effects[0].polarityStarted = true;
      break;
    case "polarity-shielding":
    case "shield-mind": {
      const effect = state.effects[0];
      state.undo = [];
      if (value === "skip") effect.polarityReviewed = true;
      else {
        const option = movementProtection(state, effect).options.find(
          (item) => item.value === value,
        );
        const protector = state.fighters.find((f) => f.id === option.protector);
        state.effects.shift();
        combat.spend(state, protector, option.cost);
        log(state, option.power, {
          side,
          fighter: protector.id,
          power: option.power,
          target: effect.mover,
        });
        if (effect.resume) finishAttack(state, effect.resume, false, random);
      }
      break;
    }
    case "web-collision": {
      const effect = state.effects.shift();
      state.terrain = state.terrain.filter((p) => p.id !== value);
      const target = state.fighters.find((f) => f.id === effect.target);
      const source = state.fighters.find((f) => f.id === effect.source);
      combat.collide(state, target, source, random);
      log(state, "Catch! · " + target.name, { side, fighter: target.id });
      break;
    }
    case "tactic": {
      const actor = actorOf(state);
      const option = allowed[0].cards.find((c) => c.value === value);
      expect(option, "Эта тактика недоступна.");
      checkpoint(state);
      tactics.activate(state, actor, option, action);
      if (state.effects?.some((e) => e.side !== side)) state.undo = [];
      log(state, actor.name + " · " + option.label, {
        side,
        fighter: actor.id,
      });
      break;
    }
    case "phase-choice": {
      const effect = state.effects.shift();
      log(state, tactics.playPhase(state, effect, value), { side });
      break;
    }
    case "battle-plan": {
      const effect = state.effects.shift();
      const f = state.fighters.find((f) => f.id === effect.target);
      if (value === "heal") f.damage--;
      else if (value === "place")
        state.effects.unshift({
          type: "displace",
          side,
          mode: "place",
          range: 1,
          mover: f.id,
          source: effect.source,
          name: f.name,
          reference: { x: f.x, y: f.y, radius: f.radius },
          required: true,
        });
      else f.conditions = f.conditions.filter((c) => c !== value);
      log(state, "Battle Plan · " + f.name + " · " + value, {
        side,
        fighter: f.id,
      });
      break;
    }
    case "glory-choice": {
      const effect = state.effects[0];
      const target = state.fighters.find(
        (f) => f.id === effect.remaining.shift(),
      );
      if (value === "pay") {
        target.power--;
        effect.paid++;
      } else effect.declined.push(target.id);
      if (!effect.remaining.length) {
        state.effects.shift();
        const source = state.fighters.find((f) => f.id === effect.source);
        combat.gain(source, effect.paid);
        for (const id of effect.declined)
          combat.damage(
            state,
            state.fighters.find((f) => f.id === id),
            1,
            source,
          );
      }
      log(state, "Glory of Ultron · " + target.name + " · " + value, {
        side,
        fighter: target.id,
      });
      break;
    }
    case "throw-terrain": {
      const effect = state.effects.shift();
      combat.throwTerrain(state, effect, action.angle, random);
      state.undo = [];
      log(state, "Бросок террейна · " + effect.name, { side });
      break;
    }
    case "purge": {
      const effect = state.effects[0];
      const target = state.fighters.find((f) => f.id === effect.actor);
      target.samples--;
      target.conditions = target.conditions.filter((c) => c !== value);
      if (!target.samples || !target.conditions.length) state.effects.shift();
      break;
    }
    case "displace": {
      const effect = state.effects.shift();
      const nextEffect = state.effects[0];
      const point = combat.displacement(
        state,
        effect,
        action,
        random,
        geometry,
      );
      if (effect.mode === "place") recordPlacement(state, effect.mover);
      state.undo = [];
      const moved = state.fighters.find((f) => f.id === effect.mover);
      if (
        effect.resume?.cantTouch === effect.mover &&
        ["push", "throw"].includes(effect.mode) &&
        combat.usable(moved)
      )
        state.effects.unshift({
          type: "displace",
          mode: "place",
          range: 1,
          side: moved.side,
          mover: moved.id,
          source: moved.id,
          name: "Can‘t Touch This",
          reference: { x: moved.x, y: moved.y, radius: moved.radius },
        });
      log(state, effect.name + " · " + effect.mode, {
        side,
        fighter: effect.mover,
        point,
      });
      if (effect.resume) {
        const queued = state.effects[0];
        if (
          queued !== nextEffect &&
          (queued?.collision || queued?.type === "nice-punch")
        ) {
          const index = nextEffect
            ? state.effects.indexOf(nextEffect)
            : state.effects.length;
          state.effects.splice(index, 0, {
            type: "resume-attack",
            side,
            attack: effect.resume,
          });
        } else finishAttack(state, effect.resume, false, random);
      }
      if (effect.afterEvasion)
        state.effects.unshift({
          type: "resume-attack",
          side: effect.side,
          attack: effect.afterEvasion,
          evasion: true,
        });
      break;
    }
    case "skip-effect": {
      const effect = state.effects.shift();
      if (effect.type === "acrobatic-dodge")
        combat.resolveAcrobaticDodge(state, effect, false, random);
      if (effect.type === "diamond-dodge") {
        const target = state.fighters.find((f) => f.id === effect.target);
        const source = state.fighters.find((f) => f.id === effect.source);
        combat.collide(state, target, source, random, false);
      }
      if (effect.type === "nice-punch") {
        state.undo = [];
        combat.resolveNicePunch(state, effect, false);
        resumeAfterDamage(state, random);
        break;
      }
      if (effect.collision) combat.resolveDodge(state, effect, null, random);
      if (effect.afterEvasion)
        finishAttack(state, effect.afterEvasion, false, random);
      if (
        ["kill-box", "falling-debris", "curse", "nightmare-visions"].includes(
          effect.type,
        )
      )
        state.undo = [];
      if (effect.resume)
        finishAttack(
          state,
          effect.type === "modify-dice"
            ? combat.applyModifier(state, effect, null, random)
            : effect.resume,
          false,
          random,
        );
      break;
    }
    case "strike-order": {
      const { moves } = state.effects.shift();
      const first = Number(value);
      state.effects.unshift(moves[first], moves[1 - first]);
      break;
    }
    case "choose-condition": {
      const effect = state.effects.shift();
      const target = state.fighters.find((f) => f.id === effect.target);
      combat.condition(target, value);
      log(state, target.name + " получает " + value, {
        side,
        fighter: target.id,
      });
      break;
    }
    case "fire-manipulation": {
      state.effects.shift();
      const target = state.fighters.find((f) => f.id === value);
      combat.condition(target, "incinerate");
      log(state, "Fire Manipulation · " + target.name, {
        side,
        target: target.id,
      });
      break;
    }
    case "bonus-move": {
      const actor = actorOf(state);
      const point = { x: action.x, y: action.y };
      expect(
        combat.powerDestination(
          actor,
          { mode: "advance", speed: "S" },
          point,
          state,
          geometry,
        ),
        "Точка вне короткого Advance.",
      );
      state.effects.shift();
      Object.assign(actor, point);
      log(state, actor.name + " · бонусный Advance", {
        side,
        fighter: actor.id,
        point,
      });
      break;
    }
    case "power": {
      const actor = actorOf(state);
      const selected = allowed[0].powers.find((p) => p.value === value);
      expect(selected, "Эта способность недоступна.");
      powerMovement = selected.mode;
      const point = { x: action.x, y: action.y };
      const positioned =
        selected.mode === "place" || selected.mode === "advance";
      expect(
        !positioned ||
          combat.powerDestination(actor, selected, point, state, geometry),
        "Недопустимая точка для способности.",
      );
      expect(
        !selected.targets ||
          selected.targets.some((t) => t.value === action.target),
        "Эта цель недоступна.",
      );
      let cost = selected.cost;
      if (selected.variableCost) {
        const minimum =
          selected.targets?.find((target) => target.value === action.target)
            ?.minPower ?? 1;
        const amount = action.amount ?? minimum;
        expect(
          Number.isInteger(amount) &&
            amount >= minimum &&
            amount <= selected.maxPower,
          "Укажите допустимое количество Power.",
        );
        cost = amount + selected.tax;
      }
      checkpoint(state);
      (state.usedPowers ||= []).push(value);
      const from = { x: actor.x, y: actor.y };
      combat.usePower(state, actor, { ...selected, cost }, action, random);
      if (selected.mode === "place" && selected.effect !== "projection")
        recordPlacement(state, actor.id);
      if (state.drops?.length) state.undo = [];
      log(state, actor.name + " использует " + value, {
        side,
        fighter: actor.id,
        power: value,
        from,
        target: action.target,
        ...(positioned && { point }),
      });
      break;
    }
    case "interact": {
      const actor = actorOf(state);
      const selected = allowed[0].interacts.find((o) => o.value === value);
      expect(
        selected &&
          (!selected.targets ||
            selected.targets.some((t) => t.value === action.target)),
        "Недопустимый Interact.",
      );
      checkpoint(state);
      const freedom = value.startsWith("freedom|");
      const objective = state.objectives.find(
        (o) => o.id === (freedom ? value.split("|")[1] : value),
      );
      actor.power -= 1;
      (state.interacted ||= []).push(objective.id);
      if (freedom) {
        for (const o of state.objectives.filter((o) => o.freedom === side))
          delete o.freedom;
        objective.freedom = side;
        log(state, actor.name + " · Freedom Force · " + objective.name, {
          side,
          fighter: actor.id,
        });
      } else if (selected.targets) {
        const target = state.fighters.find((f) => f.id === action.target);
        target.damage -= 1;
        log(
          state,
          actor.name + " · " + objective.name + " лечит " + target.name,
          { side, fighter: actor.id },
        );
      } else {
        objective.holder = actor.id;
        if (
          combat.leadership(state, side, "Freedom Force") &&
          !state.leadershipUses?.[side]?.includes("freedom")
        ) {
          combat.gain(actor, 1);
          (state.leadershipUses ||= { p1: [], p2: [] })[side].push("freedom");
        }
        log(state, actor.name + " подбирает " + objective.name, {
          side,
          fighter: actor.id,
        });
      }
      break;
    }
    case "drop-objective": {
      const { origin, id } = state.drops[0];
      const objective = state.objectives.find((o) => o.id === id);
      const point = { x: action.x, y: action.y, radius: objective.radius };
      expect(
        Number.isFinite(point.x) &&
          Number.isFinite(point.y) &&
          point.x >= 0 &&
          point.x <= 36 &&
          point.y >= 0 &&
          point.y <= 36 &&
          geometry.within(origin, point, 2),
        "Положите жетон в пределах Range 2.",
      );
      Object.assign(objective, { x: point.x, y: point.y });
      state.drops.shift();
      log(state, "Размещён жетон " + objective.name, { side, point });
      if (!state.drops.length && state.afterDrops) {
        state.effects.push(state.afterDrops);
        delete state.afterDrops;
      }
      if (!pendingDecision(state)) {
        if (state.endAfterDamage) resumeAfterDamage(state, random);
        else if (state.nextRoundPriority)
          nextRound(state, state.nextRoundPriority);
        else if (state.endAfterDrops) {
          const last = state.endAfterDrops;
          state.endAfterDrops = null;
          endActivation(state, last, random, false);
        } else if (actorOf(state) && !combat.usable(actorOf(state)))
          endActivation(state, state.decisionSide, random, false);
      }
      break;
    }
    case "shake": {
      checkpoint(state);
      const actor = actorOf(state);
      actor.conditions = actor.conditions.filter((c) => c !== value);
      state.actionsLeft -= 1;
      log(state, actor.name + " снимает " + value, { side, fighter: actor.id });
      break;
    }
    case "undo": {
      const { logLength, ...restored } = state.undo.pop();
      if (restored.fighters) Object.assign(state, restored);
      else {
        Object.assign(actorOf(state), { x: restored.x, y: restored.y });
        state.actionsLeft = restored.actionsLeft;
        state.activationLocked = state.actionsLeft !== 2;
      }
      state.log.length = logLength;
      break;
    }
    case "end":
      endActivation(state, side, random);
      break;
    case "pass":
      tactics.resetTurn(state);
      Object.assign(state, {
        active: null,
        activationLocked: false,
        actionsLeft: 0,
        queuedParent: null,
        undo: [],
        moves: 0,
        usedPowers: [],
        duelTargets: [],
        interacted: [],
        leadershipUses: { p1: [], p2: [] },
        reactionUses: [],
        placements: {},
        decisionSide: other(side),
      });
      log(state, "Пас", { side });
      break;
  }
  if (state.phase === "finished") return;
  for (const objective of state.objectives.filter((o) => o.freedom))
    if (
      state.fighters.some(
        (f) =>
          f.side !== objective.freedom &&
          !f.grunt &&
          combat.usable(f) &&
          geometry.within(f, objective, 1),
      )
    )
      delete objective.freedom;
  const advanced =
    resolvedMoveMode === "advance" ||
    type === "bonus-move" ||
    (type === "power" && powerMovement === "advance") ||
    (type === "displace" && movementEffect === "advance");
  const placed =
    type === "transform" ||
    powerMovement === "place" ||
    (type === "displace" && movementEffect === "place");
  if ((advanced || placed) && state.phase === "activation") {
    for (const [id, x, y] of previousPositions) {
      const target = state.fighters.find((f) => f.id === id);
      if (!combat.usable(target) || (x === target.x && y === target.y))
        continue;
      for (const source of state.fighters.filter(
        (f) =>
          f.side !== target.side &&
          combat.usable(f) &&
          combat.reactiveAllowed(target, f, state) &&
          f.power >= 3 + Number(f.conditions?.includes("root") || false),
      )) {
        const killBox =
          combat.isPower(source, "Kill Box") &&
          !state.reactionUses?.includes(source.id + ":kill-box") &&
          geometry.within(target, source, 4);
        const debris =
          advanced &&
          combat.isPower(source, "Beware Falling Debris") &&
          geometry.within(target, source, 3);
        const label = killBox ? "Kill Box" : "Beware Falling Debris";
        if (
          (killBox || debris) &&
          terrainReactionOptions(state, target, label).length
        )
          state.effects.unshift({
            type: killBox ? "kill-box" : "falling-debris",
            side: source.side,
            source: source.id,
            target: id,
          });
        const nightmareCost =
          4 + Number(source.conditions?.includes("root") || false);
        if (
          advanced &&
          source.power >= nightmareCost &&
          combat.isPower(source, "Nightmare Visions") &&
          !state.reactionUses?.includes(source.id + ":nightmare-visions") &&
          geometry.within(target, combat.rangeOrigin(source), 3)
        )
          state.effects.unshift({
            type: "nightmare-visions",
            side: source.side,
            source: source.id,
            target: id,
            cost: nightmareCost,
          });
      }
    }
  }
  if (
    state.phase === "activation" &&
    !pendingDecision(state) &&
    actorOf(state) &&
    !combat.usable(actorOf(state))
  )
    resumeAfterDamage(state, random);
  while (
    !state.pendingAttack &&
    [
      "resume-attack",
      "cosmic-check",
      "failure-power",
      "quick-draw-damage",
      "hurricane-flight",
      "cold-snap-check",
    ].includes(state.effects[0]?.type) &&
    state.phase !== "finished"
  ) {
    const effect = state.effects.shift();
    if (effect.type === "failure-power") {
      combat.grantFailurePower(state, effect.observers);
      continue;
    }
    if (effect.type === "cold-snap-check") {
      const target = state.fighters.find((f) => f.id === effect.target);
      if (combat.usable(target)) {
        for (const iceman of state.fighters.filter(
          (f) =>
            f.side !== target.side &&
            combat.usable(f) &&
            combat.isPower(f, "Cold Snap") &&
            geometry.within(f, target, 2),
        )) {
          if (target.conditions?.includes("slow"))
            combat.damage(state, target, 1, iceman);
          else combat.condition(target, "slow");
          log(state, "Cold Snap · " + target.name, {
            side: iceman.side,
            fighter: iceman.id,
            target: target.id,
            power: "Cold Snap",
          });
        }
        resumeAfterDamage(state, random);
      }
      continue;
    }
    if (
      effect.type === "quick-draw-damage" ||
      effect.type === "hurricane-flight"
    ) {
      const source = state.fighters.find((f) => f.id === effect.source);
      if (combat.usable(source)) {
        if (effect.type === "quick-draw-damage") {
          combat.damage(
            state,
            state.fighters.find((f) => f.id === effect.target),
            2,
            source,
          );
          log(state, "Quick Draw · 2 урона", {
            side: source.side,
            fighter: source.id,
            target: effect.target,
          });
        } else {
          for (const target of state.fighters.filter(
            (f) =>
              effect.targets.includes(f.id) &&
              combat.usable(f) &&
              combat.isPower(f, "Flight"),
          ))
            combat.damage(state, target, 1, source, { attackType: "physical" });
        }
        resumeAfterDamage(state, random);
      }
      continue;
    }
    if (effect.type === "cosmic-check") {
      const target = state.fighters.find((f) => f.id === effect.target);
      if (!combat.usable(target)) continue;
      const die = pick(faces, random);
      combat.failurePower(state, target, [die]);
      log(state, "Cosmic Vault · " + target.name + " · " + die, {
        side: target.side,
        fighter: target.id,
        rolls: [{ label: "Бросок", faces: [die] }],
      });
      if (die === "wild" || die === "critical") {
        combat.gain(target, 2);
        if (target.phasing !== "density")
          state.effects.unshift({
            type: "displace",
            mode: "push",
            speed: "S",
            side: other(target.side),
            mover: target.id,
            source: target.id,
            name: target.name,
            required: true,
          });
      }
    } else {
      const { attack } = effect;
      const attacker = state.fighters.find((f) => f.id === attack.actor);
      const target = state.fighters.find((f) => f.id === attack.target);
      if (effect.evasion && combat.usable(attacker)) {
        if (
          combat.usable(target) &&
          combat.attackReaches(state, attacker, target, attack)
        ) {
          finishAttack(state, attack, false, random);
        } else {
          if (
            combat.usable(target) &&
            state.active === attacker.id &&
            (!attack.volley || state.volley?.targetCount === 1)
          )
            state.actionsLeft++;
          finishVolleyTarget(state, attack, attacker);
          if (!attack.volley && attack.coldSnapAction)
            state.effects.unshift(...coldSnapEvent(state, attacker));
          log(state, "Can’t Catch Me · атака завершена", {
            side: target.side,
            fighter: target.id,
          });
          const living = sides.filter((p) =>
            state.fighters.some((f) => f.side === p && !f.ko),
          );
          if (living.length === 1) declareWinner(state, living[0]);
        }
      } else if (
        combat.usable(attacker) &&
        (combat.usable(target) || effect.resolvedTarget)
      )
        finishAttack(state, attack, false, random);
      else if (!combat.usable(attacker) && state.active === attacker.id) {
        state.volley = null;
        endActivation(state, attacker.side, random, false);
      }
    }
  }
  if (state.phase === "finished") return;
  for (const [id, previous] of binary) {
    const f = state.fighters.find((item) => item.id === id);
    if (
      combat.usable(f) &&
      f.form === 1 &&
      f.power < previous &&
      f.power <= 3 &&
      !state.effects.some((e) => e.type === "transform" && e.mover === f.id)
    )
      state.effects.push(transformEvent(f, 0, false));
  }
  const destroyed = terrainBefore.filter(
    (piece) => !state.terrain.some((live) => live.id === piece.id),
  );
  if (state.phase === "activation" && destroyed.length) {
    for (const leaderSide of [
      state.decisionSide || side,
      other(state.decisionSide || side),
    ]) {
      if (
        !combat.leadership(state, leaderSide, "From the Ruins") ||
        !state.fighters.some(
          (f) =>
            f.side === leaderSide &&
            combat.usable(f) &&
            !f.grunt &&
            !state.leadershipUses?.[leaderSide]?.includes("ruins:" + f.id),
        )
      )
        continue;
      state.effects.push(
        ...destroyed.map((piece) => ({
          type: "from-the-ruins",
          side: leaderSide,
          remaining: piece.size,
        })),
      );
      if (leaderSide !== side) state.undo = [];
    }
    const ultron = state.fighters.find(
      (f) =>
        f.side === side && f.slug === "ultron-metal-tyrant" && combat.usable(f),
    );
    if (
      ultron &&
      !state.fighters.some((f) => f.grunt && f.side === side && !f.ko) &&
      !state.effects.some((e) => e.type === "spawn-drones" && e.side === side)
    ) {
      const model = makeFighter(side, "ultron-drones-grunts");
      state.effects.push({
        type: "spawn-drones",
        mode: "place",
        side,
        model,
        name: model.name,
        range: 3,
        reference: { x: ultron.x, y: ultron.y, radius: ultron.radius },
      });
    }
  }
  continueSingleTarget(state, random);
}

module.exports = {
  create,
  act,
  finish,
  view,
  sides,
  affiliations,
  continueSingleTarget,
};
