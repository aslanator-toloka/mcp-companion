// Independent verification oracle for small pools. Enumerates ordered physical die faces
// directly; deliberately does not import the production partitions, transitions or formulas.
const faces = [0, 1, 2, 3, 4, 5],
  probabilities = [2 / 8, 2 / 8, 1 / 8, 1 / 8, 1 / 8, 1 / 8];
const count = (roll, face) => roll.dice.filter((d) => d.face === face).length;
function points(face, role, options) {
  if (face === 4) return options.noCriticalSuccess ? 0 : 1;
  if (face === 3) return options.noWildSuccess ? 0 : options.doubleWild ? 2 : 1;
  if (face === (role === "attack" ? 1 : 2)) return 1;
  return (face === 0 && options.blanks) || (face === 5 && options.skulls)
    ? 1
    : 0;
}
function draw(n, emit, base = [], probability = 1) {
  if (!n) {
    emit(base, probability);
    return;
  }
  for (let i = 0; i < faces.length; i++)
    draw(
      n - 1,
      emit,
      [...base, { face: faces[i], used: [] }],
      probability * probabilities[i],
    );
}
function pool(n, options) {
  const result = [];
  draw(n, (initial, probability) => {
    let energy = options.energy || 0;
    const dice = initial.map((d) => ({ ...d }));
    if (options.cloak || options.cloakAll) {
      const skulls = dice.filter((d) => d.face === 5);
      const paid = options.cloakAll
        ? 2 + (options.tax || 0)
        : Math.min(skulls.length, Math.max(0, energy - (options.tax || 0))) +
          (options.tax || 0);
      const n = options.cloakAll
        ? skulls.length
        : Math.min(skulls.length, Math.max(0, energy - (options.tax || 0)));
      if (n && energy >= paid) {
        energy -= paid;
        for (let i = 0; i < n; i++) skulls[i].face = 4;
      }
    }
    const extra = options.noCriticalDice
      ? 0
      : dice.filter((d) => d.face === 4).length * (options.criticalExtra || 1);
    draw(extra, (bonus, p) =>
      result.push({ dice: [...dice, ...bonus], energy, p: probability * p }),
    );
  });
  return result;
}
function withChanges(roll, changes) {
  return {
    ...roll,
    dice: roll.dice.map((d, i) =>
      changes.has(i) ? { ...d, ...changes.get(i) } : d,
    ),
  };
}
function rethrow(roll, indices, key, emit) {
  draw(indices.length, (drawn, p) => {
    const changes = new Map();
    indices.forEach((i, n) =>
      changes.set(i, {
        face: drawn[n].face,
        used: [...roll.dice[i].used, key],
      }),
    );
    emit({ ...withChanges(roll, changes), p: roll.p * p });
  });
}
function own(roll, role, options, enemyCriticals) {
  if (options.banned) return [roll];
  let current = [roll];
  for (const [index, ability] of (options.rerolls || []).entries()) {
    const next = [],
      key = ability.id || "own-" + index;
    for (const state of current) {
      let eligible = state.dice
        .map((d, i) => i)
        .filter(
          (i) =>
            !state.dice[i].used.includes(key) &&
            (state.dice[i].face !== 5 ||
              ability.failures ||
              options.allowFailures),
        );
      if (ability.conditional && count(state, role === "attack" ? 1 : 2)) {
        next.push(state);
        continue;
      }
      if (ability.all) {
        const existing = eligible.reduce(
          (n, i) => n + points(state.dice[i].face, role, options),
          0,
        );
        const expected =
          probabilities.reduce(
            (n, p, f) => n + p * points(f, role, options),
            0,
          ) * eligible.length;
        if (existing >= expected) {
          next.push(state);
          continue;
        }
      } else {
        eligible = eligible
          .filter((i) => !points(state.dice[i].face, role, options))
          .sort((a, b) => state.dice[a].face - state.dice[b].face || a - b)
          .slice(0, ability.enemyCriticals ? enemyCriticals : ability.n || 99);
      }
      const cost = eligible.length
        ? (ability.cost || 0) + (ability.tax || 0)
        : 0;
      if (!eligible.length || state.energy < cost) {
        next.push(state);
        continue;
      }
      rethrow({ ...state, energy: state.energy - cost }, eligible, key, (s) =>
        next.push(s),
      );
    }
    current = next;
  }
  return current.map((state) => {
    let n =
      (options.echo ? enemyCriticals : 0) +
      (options.ronin ? count(state, 3) + count(state, 4) : 0);
    const changes = new Map();
    for (const i of state.dice
      .map((d, i) => i)
      .sort((a, b) => state.dice[a].face - state.dice[b].face || a - b))
      if (
        n &&
        !points(state.dice[i].face, role, options) &&
        (state.dice[i].face !== 5 || options.allowFailures)
      ) {
        changes.set(i, { face: role === "attack" ? 1 : 2 });
        n--;
      }
    state = withChanges(state, changes);
    if (options.hitToWild && state.energy >= (options.hitToWildCost || 0)) {
      const i = state.dice.findIndex((d) => d.face === 1);
      if (i >= 0)
        state = {
          ...withChanges(state, new Map([[i, { face: 3 }]])),
          energy: state.energy - (options.hitToWildCost || 0),
        };
    }
    if (options.cover) {
      const i = state.dice.findIndex(
        (d) =>
          !points(d.face, role, options) &&
          (d.face !== 5 || options.allowFailures),
      );
      if (i >= 0) state = withChanges(state, new Map([[i, { face: 2 }]]));
    }
    return state;
  });
}
function opposingReroll(roll, actor, role, targetOptions, ability) {
  if (!ability) return [{ roll, actor, p: 1 }];
  const indices = roll.dice
    .map((d, i) => i)
    .filter(
      (i) =>
        roll.dice[i].face !== 5 &&
        points(roll.dice[i].face, role, targetOptions) > 0 &&
        !roll.dice[i].used.includes("opponent"),
    )
    .sort(
      (a, b) =>
        points(roll.dice[b].face, role, targetOptions) -
          points(roll.dice[a].face, role, targetOptions) ||
        roll.dice[a].face - roll.dice[b].face ||
        a - b,
    )
    .slice(0, ability.n || 1);
  if (!indices.length || actor.energy < (ability.cost || 0))
    return [{ roll, actor, p: 1 }];
  const result = [];
  rethrow({ ...roll, p: 1 }, indices, "opponent", (r) =>
    result.push({
      roll: { ...r, p: roll.p },
      actor: { ...actor, energy: actor.energy - (ability.cost || 0) },
      p: r.p,
    }),
  );
  return result;
}
module.exports = function exhaustive(config = {}) {
  const a = config.a || {},
    d = config.d || {},
    hist = [];
  const ap = pool(config.attackDice ?? 1, a),
    dp = pool(config.defenseDice ?? 1, d);
  for (const initialA of ap)
    for (const initialD of dp) {
      for (const sa of own(initialA, "attack", a, count(initialD, 4)))
        for (let sd of own(initialD, "defense", d, count(sa, 4))) {
          if (config.pierce) {
            const required = config.pierce.reduce(
              (m, f) => ((m[f] = (m[f] || 0) + 1), m),
              {},
            );
            if (
              Object.entries(required).every(([f, n]) => count(sa, +f) >= n)
            ) {
              const gain = (f) =>
                points(f, "defense", d) -
                points(0, "defense", d) +
                (f === 3 && d.cancelWilds ? 1 : 0);
              const i = sd.dice
                .map((v, i) => i)
                .filter(
                  (i) =>
                    [2, 3, 4].includes(sd.dice[i].face) &&
                    gain(sd.dice[i].face) > 0,
                )
                .sort(
                  (x, y) =>
                    gain(sd.dice[y].face) - gain(sd.dice[x].face) ||
                    sd.dice[x].face - sd.dice[y].face ||
                    x - y,
                )[0];
              if (i !== undefined)
                sd = withChanges(sd, new Map([[i, { face: 0 }]]));
            }
          }
          for (const ad of opposingReroll(
            sd,
            sa,
            "defense",
            d,
            a.opponentReroll,
          ))
            for (const da of opposingReroll(
              ad.actor,
              ad.roll,
              "attack",
              a,
              d.opponentReroll,
            )) {
              let ar = da.roll,
                dr = da.actor;
              if (d.blankWilds) {
                const ids = ar.dice
                  .map((v, i) => i)
                  .filter((i) => ar.dice[i].face === 3)
                  .slice(0, d.blankWildCost ? dr.energy : 99);
                ar = withChanges(ar, new Map(ids.map((i) => [i, { face: 0 }])));
                dr = {
                  ...dr,
                  energy: dr.energy - ids.length * (d.blankWildCost || 0),
                };
              }
              if (d.cancelWilds) {
                const n = count(dr, 3);
                const ids = ar.dice
                  .map((v, i) => i)
                  .filter(
                    (i) =>
                      [1, 3, 4].includes(ar.dice[i].face) &&
                      points(ar.dice[i].face, "attack", a) >
                        points(0, "attack", a),
                  )
                  .sort(
                    (x, y) =>
                      points(ar.dice[y].face, "attack", a) -
                        points(ar.dice[x].face, "attack", a) ||
                      ar.dice[x].face - ar.dice[y].face ||
                      x - y,
                  )
                  .slice(0, n);
                ar = withChanges(ar, new Map(ids.map((i) => [i, { face: 0 }])));
              }
              let av = ar.dice.reduce(
                  (n, v) => n + points(v.face, "attack", a),
                  0,
                ),
                dv = dr.dice.reduce(
                  (n, v) => n + points(v.face, "defense", d),
                  0,
                );
              if (a.enemyFailures) av += count(dr, 5);
              if (d.enemyFailures) dv += count(ar, 5);
              if (
                a.swap &&
                ar.energy >= (a.swapCost || 0) &&
                count(ar, 2) > count(ar, 1)
              )
                av += count(ar, 2) - count(ar, 1);
              let damage = Math.max(0, av - dv);
              if (config.cap !== undefined)
                damage = Math.min(config.cap, damage);
              if (
                d.reduction &&
                damage > (d.minimum || 0) &&
                dr.energy >= (d.reductionCost || 0)
              )
                damage = Math.max(d.minimum || 0, damage - d.reduction);
              const probability = sa.p * sd.p * ad.p * da.p;
              hist[damage] = (hist[damage] || 0) + probability;
            }
        }
    }
  for (let i = 0; i < hist.length; i++) hist[i] ||= 0;
  return {
    distribution: hist,
    mean: hist.reduce((n, p, i) => n + p * i, 0),
    chance: hist.slice(1).reduce((n, p) => n + p, 0),
  };
};
