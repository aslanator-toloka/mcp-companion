const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const express = require("express");
const { create, act, view } = require("../game/engine.cjs");
const { gameRouter } = require("../game/server.cjs");
const { movement } = require("../game/geometry.cjs");
const { trial } = require("./helpers/game.cjs");

test("mission uses opposed choices, and opponent squad stays hidden until both commit", () => {
  const match = create({ p1: "avengers", p2: "cabal" }, 1);
  const throws = [0, 0, 0, 0, 0, 7, 7, 7, 7, 7];
  act(match, "p1", { type: "roll" }, () => throws.shift());
  assert.equal(match.priority, "p1");
  act(match, "p1", { type: "crisis-type", value: "secure" }, () => 0);
  assert.equal(match.decisionSide, "p2");
  assert.equal(new Set(match.offers).size, 2);
  act(match, "p2", { type: "crisis", value: match.offers[0] }, () => 0);
  act(match, "p1", { type: "crisis", value: match.offers[0] });
  act(match, "p2", { type: "threat", value: 17 });
  act(match, "p1", { type: "edge", value: "south" });
  const squad = (side) => ({
    type: "squad",
    characters: match.rosters[side].characters.slice(0, 2),
    tactics: [],
  });
  act(match, "p1", squad("p1"));
  assert.deepEqual(view(match, "p2").squads, {});
  assert.equal(view(match, "p2").ownCommit, undefined);
  assert.equal(view(match, "p2").commits, undefined);
  assert.deepEqual(
    view(match, "p2", true).commits.p1.characters,
    squad("p1").characters,
  );
  act(match, "p2", squad("p2"));
  assert.equal(match.phase, "deployment");
  assert.deepEqual(
    view(match, "p2").squads.p1.characters,
    squad("p1").characters,
  );
  for (const [side, x, y] of [
    ["p1", 7, 34],
    ["p2", 7, 2],
    ["p1", 10, 34],
    ["p2", 10, 2],
  ]) {
    const fighter = view(match, side).actions[side][0].fighters[0];
    act(match, side, { type: "deploy", fighter, x, y });
  }
  act(match, "p1", { type: "leadership", value: "" });
  act(match, "p2", { type: "leadership", value: "" });
  assert.equal(match.phase, "round-priority");
  const second = [0, 0, 0, 0, 0, 7, 7, 7, 7, 7];
  act(match, "p1", { type: "roll" }, () => second.shift());
  const fighter = match.fighters[0];
  act(match, "p1", { type: "activate", value: fighter.id });
  act(match, "p1", { type: "advance", x: 7, y: 31 });
  assert.equal(match.actionsLeft, 1);
  act(match, "p1", { type: "undo" });
  assert.equal(match.actionsLeft, 2);
  assert.equal(match.fighters.find((item) => item.id === fighter.id).y, 34);
  act(match, "p1", { type: "advance", x: 7, y: 31 });
  act(match, "p1", { type: "end" });
  assert.throws(() => act(match, "p1", { type: "undo" }));
});

test("movement checks base fit, board edges and terrain size", () => {
  const terrain = [{ x: 3, y: 3, w: 3, h: 10, size: 4 }];
  const fighter = { id: "p1:a", size: 2, speed: "M", radius: 0.7, x: 2, y: 6 };
  assert.equal(
    movement(fighter, "advance", [fighter], terrain).route({ x: 4, y: 6 }),
    null,
  );
  assert.ok(
    movement(fighter, "climb", [fighter], terrain).route({ x: 4, y: 6 }),
  );
  assert.equal(
    movement(fighter, "climb", [fighter], terrain).route({ x: 3.2, y: 6 }),
    null,
  );
  assert.equal(
    movement(fighter, "advance", [fighter], terrain).route({ x: 0.5, y: 6 }),
    null,
  );
});

test("handoff rejects stale and wrong-controller commands", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-game-"));
  const app = express();
  app.use(gameRouter(join(dir, "state.json")));
  const server = app.listen(0, "127.0.0.1");
  t.after(() => {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });
  await new Promise((resolve) => server.once("listening", resolve));
  const url = "http://127.0.0.1:" + server.address().port;
  const post = (endpoint, body) =>
    fetch(url + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const opened = await (
    await post("/new", { p1: "avengers", p2: "cabal" })
  ).json();
  const command = (source, revision, type) =>
    post("/command", { source, side: "p1", revision, action: { type } });
  const captured = await (await command("cli", opened.revision, "take")).json();
  assert.equal(captured.controllers.p1, "cli");
  assert.equal(
    (await command("browser", captured.revision, "roll")).status,
    409,
  );
  const returned = await (
    await command("browser", captured.revision, "take")
  ).json();
  assert.equal(returned.controllers.p1, "browser");
  assert.equal((await command("cli", captured.revision, "roll")).status, 409);
  assert.equal(
    (await command("browser", returned.revision, "roll")).status,
    200,
  );
});

test("preview activation can be switched, but a resolved interaction must first be undone", () => {
  const s = trial([
    ["p1", "captain-america-first-avenger", 8],
    ["p1", "hawkeye", 11],
    ["p2", "mystique", 18],
  ]);
  const [a, b] = s.fighters;
  s.objectives = [
    {
      id: "hammer",
      name: "Celestial Hammer",
      role: "extract",
      x: 10.5,
      y: 9,
      radius: 0.5,
    },
  ];
  act(s, "p1", { type: "activate", value: a.id });
  act(s, "p1", { type: "activate", value: b.id });
  act(s, "p1", { type: "interact", value: "hammer" });
  assert.equal(s.objectives[0].holder, b.id);
  assert.equal(b.power, 2);
  assert.equal(s.actionsLeft, 2);
  assert.throws(() => act(s, "p1", { type: "activate", value: a.id }));
  act(s, "p1", { type: "undo" });
  assert.equal(s.objectives[0].holder, undefined);
  assert.equal(s.fighters[1].power, 3);
  act(s, "p1", { type: "activate", value: a.id });
});

test("passing cancels an uncommitted fighter choice without spending an activation", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "mystique", 16],
    ["p2", "sabretooth", 21],
  ]);
  const [hawkeye, , sabretooth] = s.fighters;
  s.objectives = [
    {
      id: "hammer",
      name: "Celestial Hammer",
      role: "extract",
      x: 9,
      y: 8,
      radius: 0.5,
    },
  ];
  const canPass = () => view(s, "p1").actions.p1.some((a) => a.type === "pass");
  assert.equal(canPass(), true);
  act(s, "p1", { type: "activate", value: hawkeye.id });
  sabretooth.activated = true;
  assert.equal(canPass(), false);
  sabretooth.activated = false;
  assert.equal(canPass(), true);

  act(s, "p1", { type: "interact", value: "hammer" });
  assert.equal(s.actionsLeft, 2);
  assert.equal(canPass(), false);
  assert.throws(() => act(s, "p1", { type: "pass" }), /недоступно/);
  act(s, "p1", { type: "undo" });
  act(s, "p1", { type: "pass" });
  assert.equal(s.active, null);
  assert.equal(s.actionsLeft, 0);
  assert.equal(s.decisionSide, "p2");
  assert.equal(s.fighters[0].activated, false);
  assert.equal(s.log.at(-1).text, "Пас");
});

test("opponent reaction pauses attack, then damage resolves without undoing the roll", () => {
  const s = trial([
    ["p1", "winter-soldier-operative", 8],
    ["p2", "captain-america-first-avenger", 12],
  ]);
  const [a, b] = s.fighters;
  act(s, "p1", { type: "activate", value: a.id });
  act(s, "p1", { type: "advance", x: 8, y: 9 });
  act(s, "p1", {
    type: "attack",
    index: 0,
    target: b.id,
    damageType: "physical",
  });
  assert.equal(view(s, "p2").awaitingSide, "p2");
  assert.equal(b.damage, undefined);
  assert.throws(() => act(s, "p1", { type: "undo" }));
  const rolls = [2, 2, 2, 7, 7, 7, 7, 7, 7, 7, 7, 7];
  act(
    s,
    "p2",
    { type: "reaction", value: "Perfect Block" },
    () => rolls.shift() ?? 7,
  );
  assert.equal(b.damage, 3);
  assert.equal(view(s, "p1").fighters[1].hp, 4);
  assert.equal(b.power, 4);
  assert.equal(s.log.at(-1).defense.length, 6);
  assert.throws(() => act(s, "p1", { type: "undo" }));
});

test("Calculated Risk rerolls selected dice once per incoming attack", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "the-black-widow", 11.5],
  ]);
  const [hawkeye, widow] = s.fighters;
  widow.power = 6;
  act(s, "p1", { type: "activate", value: hawkeye.id });
  const attack = () => {
    const rolls = [7, 7, 7, 7, 7, 5, 7, 7, 7];
    act(
      s,
      "p1",
      {
        type: "attack",
        index: 0,
        target: widow.id,
        damageType: "physical",
      },
      () => rolls.shift(),
    );
  };
  const reroll = { type: "modify-dice", indices: [0, 1] };
  attack();
  assert.equal(s.effects[0].label, "Calculated Risk");
  assert.equal(s.effects[0].dice[0], "failure");
  act(s, "p2", reroll, () => 4);
  assert.equal(widow.power, 4);
  assert.deepEqual(s.log.at(-1).defense, ["block", "block", "blank", "blank"]);
  assert.throws(() => act(s, "p2", reroll), /недоступно/);
  assert.equal(widow.power, 4);

  attack();
  assert.equal(s.effects[0].label, "Calculated Risk");
  act(s, "p2", reroll, () => 4);
  assert.equal(widow.power, 2);
});

test("attack roll summary includes extra successes and records damage after reduction", () => {
  const s = trial([
    ["p1", "doc-ock-sinister-scientist", 8],
    ["p2", "invincible-iron-man", 10],
  ]);
  const [ock, stark] = s.fighters;
  act(s, "p1", { type: "activate", value: ock.id });
  const rolls = [1, 2, 2, 5, 7, 4, 7, 7, 7];
  act(
    s,
    "p1",
    {
      type: "attack",
      index: 0,
      target: stark.id,
      damageType: "physical",
    },
    () => rolls.shift(),
  );

  const pending = view(s, "p2");
  assert.equal(pending.actions.p2[0].label, "I Am Iron Man");
  assert.deepEqual(pending.attackRoll, {
    attackHits: 4,
    defenseHits: 1,
    incoming: 3,
  });
  act(s, "p2", { type: "modify-dice", amount: 1 });
  const attack = s.log.at(-1);
  assert.equal(attack.attack, "Striking Tentacles");
  assert.deepEqual(attack.rollSummary, pending.attackRoll);
  assert.equal(attack.dealt, 2);
  assert.equal(stark.damage, 2);
  assert.equal(view(s, "p2").attackRoll, undefined);
});

test("a placement superpower pays Power, leaves both actions, and can be undone", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "mystique", 16],
  ]);
  const [a] = s.fighters;
  act(s, "p1", { type: "activate", value: a.id });
  act(s, "p1", { type: "power", value: "Hook Arrow", x: 9, y: 10 });
  assert.equal(a.power, 1);
  assert.equal(a.y, 10);
  assert.equal(s.actionsLeft, 2);
  act(s, "p1", { type: "undo" });
  assert.equal(s.fighters[0].power, 3);
  assert.equal(s.fighters[0].y, 8);
});

test("held extract and secured point score independently during cleanup", () => {
  const s = trial([
    ["p1", "hawkeye", 8],
    ["p2", "mystique", 16],
  ]);
  const [a, b] = s.fighters;
  s.deployment = { p1: "south", p2: "north" };
  s.objectives = [
    {
      id: "console",
      name: "Extremis Console",
      role: "secure",
      x: 8,
      y: 9,
      radius: 0.5,
    },
    {
      id: "hammer",
      name: "Celestial Hammer",
      role: "extract",
      x: 8,
      y: 9,
      radius: 0.5,
      holder: a.id,
    },
  ];
  act(s, "p1", { type: "activate", value: a.id });
  act(s, "p1", { type: "end" });
  act(s, "p2", { type: "activate", value: b.id });
  act(s, "p2", { type: "end" });
  assert.deepEqual(s.score, { p1: 2, p2: 0 });
  assert.equal(s.round, 2);
  assert.equal(s.priority, "p1");
});

test("a beam fixes its target set and pays one action for all attacks", () => {
  const s = trial([
    ["p1", "crossbones-merciless-merc", 8],
    ["p2", "red-skull-master-of-the-world", 12],
    ["p2", "baron-helmut-zemo", 14],
    ["p2", "winter-soldier-operative", 13],
  ]);
  s.fighters[3].y = 12;
  act(s, "p1", { type: "activate", value: s.fighters[0].id });
  const option = view(s, "p1").actions.p1.find((a) => a.type === "attack")
    .attacks[0];
  assert.equal(option.shape, "beam");
  act(s, "p1", { type: "attack", index: 0, angle: 0, damageType: "energy" });
  assert.equal(s.actionsLeft, 1);
  assert.deepEqual(
    s.volley.remaining,
    s.fighters.slice(1, 3).map((f) => f.id),
  );
  act(s, "p1", { type: "volley-target", value: s.fighters[2].id }, () => 7);
  while (s.effects[0]?.type === "modify-dice")
    act(s, s.effects[0].side, { type: "skip-effect" }, () => 7);
  assert.equal(s.volley, null);
  assert.equal(s.actionsLeft, 1);
  assert.equal(s.fighters[0].power, 5);
  assert.deepEqual(
    s.log
      .filter((entry) => entry.attack === option.name)
      .map((entry) => entry.target),
    [s.fighters[2].id, s.fighters[1].id],
  );
});

test("a beam with one target skips ordering and still offers a defender reaction", () => {
  const s = trial([
    ["p1", "crossbones-merciless-merc", 8],
    ["p2", "captain-america-first-avenger", 12],
  ]);
  const [actor, defender] = s.fighters;
  act(s, "p1", { type: "activate", value: actor.id });
  act(
    s,
    "p1",
    { type: "attack", index: 0, angle: 0, damageType: "energy" },
    () => 7,
  );
  assert.equal(s.pendingAttack.target, defender.id);
  assert.equal(view(s, "p2").awaitingSide, "p2");
  assert.ok(
    view(s, "p2").actions.p2.some((action) => action.value === "Perfect Block"),
  );
  assert.equal(s.actionsLeft, 1);
  act(s, "p2", { type: "reaction", value: "skip" }, () => 7);
  assert.equal(s.volley, null);
});

test("area attack lets the player choose each target and spend one sample per attack", () => {
  const s = trial([
    ["p1", "mister-sinister", 8],
    ["p2", "red-skull-master-of-the-world", 11],
    ["p2", "baron-helmut-zemo", 8],
    ["p2", "winter-soldier-operative", 16],
  ]);
  s.fighters[2].y = 11;
  s.fighters[0].power = 10;
  act(s, "p1", { type: "activate", value: s.fighters[0].id });
  act(s, "p1", { type: "attack", index: 1, damageType: "mystic" });
  assert.deepEqual(
    s.volley.remaining,
    s.fighters.slice(1, 3).map((f) => f.id),
  );
  act(
    s,
    "p1",
    { type: "volley-target", value: s.fighters[2].id, sample: true },
    () => 7,
  );
  assert.equal(s.fighters[0].samples, 0);
  while (s.effects[0]?.type === "modify-dice")
    act(s, s.effects[0].side, { type: "skip-effect" }, () => 7);
  assert.equal(s.volley, null);
  assert.equal(s.actionsLeft, 1);
});

test("Charge resolves its move and attack in order for one paid action", () => {
  const s = trial([
    ["p1", "captain-america-first-avenger", 8],
    ["p2", "red-skull-master-of-the-world", 16],
  ]);
  act(s, "p1", { type: "activate", value: s.fighters[0].id });
  act(s, "p1", { type: "power", value: "Charge" });
  assert.equal(s.actionsLeft, 1);
  assert.equal(s.fighters[0].power, 1);
  act(s, "p1", { type: "granted-move", x: 11, y: 8 });
  act(
    s,
    "p1",
    {
      type: "attack",
      index: 0,
      target: s.fighters[1].id,
      damageType: "physical",
    },
    () => 7,
  );
  assert.equal(s.actionsLeft, 1);
  assert.equal(s.effects.length, 0);
});

test("Helios gathers contributions, grants one attack, and preserves ordinary action cost", () => {
  const s = trial([
    ["p1", "invincible-iron-man", 8],
    ["p1", "hawkeye", 11],
    ["p2", "red-skull-master-of-the-world", 16],
  ]);
  s.squads.p1 = { tactics: ["helios-laser-bombardment"] };
  const [stark, hawkeye, defender] = s.fighters;
  act(s, "p1", { type: "activate", value: stark.id });
  act(s, "p1", {
    type: "tactic",
    value: "helios-laser-bombardment",
    payments: { [stark.id]: 1, [hawkeye.id]: 2 },
  });
  assert.deepEqual(s.playedTactics.p1, ["helios-laser-bombardment"]);
  assert.equal(stark.power, 2);
  assert.equal(hawkeye.power, 1);
  assert.equal(s.actionsLeft, 2);
  act(
    s,
    "p1",
    { type: "attack", index: 101, target: defender.id, damageType: "energy" },
    () => 7,
  );
  assert.equal(s.log.at(-1).rolled.length, 5);
  assert.equal(s.actionsLeft, 1);
  assert.equal(stark.grantedAttacks[101], undefined);
});

test("Cabal changes a Failure before critical dice and pays after the attack", () => {
  const s = trial([
    ["p1", "red-skull-master-of-the-world", 8],
    ["p2", "crossbones-merciless-merc", 12],
  ]);
  const [a, b] = s.fighters;
  s.leaders.p1 = a.slug + ":My Cabal is Only for the Strong";
  act(s, "p1", { type: "activate", value: a.id });
  const rolls = [5, 7, 7, 7, 7, 7];
  act(
    s,
    "p1",
    { type: "attack", index: 0, target: b.id, damageType: "energy" },
    () => rolls.shift() ?? 7,
  );
  const mod = view(s, "p1").actions.p1.find((x) => x.type === "modify-dice");
  assert.equal(mod.kind, "cabal");
  act(
    s,
    "p1",
    { type: "modify-dice", indices: mod.eligible.slice(0, 1) },
    () => 7,
  );
  assert.equal(s.log.at(-1).rolled[0], "critical");
  assert.ok(s.log.at(-1).rolled.length > mod.dice.length);
  assert.deepEqual(s.leadershipUses.p1, ["cabal"]);
});

test("all card faces in Game have handlers for listed attacks and active powers", () => {
  const { pool, details } = require("../game/catalog.cjs");
  const combat = require("../game/combat.cjs");
  for (const slug of Object.keys(pool.characters)) {
    for (const form of details[slug].secondStatCard ? [0, 1] : [0]) {
      for (const injured of [false, true]) {
        const { attacks, powers } = combat.status({ slug, form, injured });
        for (const card of [
          ...attacks,
          ...powers.filter((p) => p.type === "active"),
        ])
          assert.equal(card.implemented, true, slug + " " + card.name);
      }
    }
  }
});

test("binary form is placed before activation continues and changes the attack list", () => {
  const s = trial([
    ["p1", "captain-marvel-cosmic-avenger", 8],
    ["p2", "red-skull-master-of-the-world", 12],
  ]);
  const [a] = s.fighters;
  a.power = 6;
  act(s, "p1", { type: "activate", value: a.id });
  assert.equal(view(s, "p1").actions.p1[0].type, "transform");
  act(s, "p1", { type: "transform", x: 9, y: 8 });
  assert.equal(s.fighters[0].form, 1);
  assert.equal(view(s, "p1").fighters[0].attacks[0].name, "Binary Blast");
});
