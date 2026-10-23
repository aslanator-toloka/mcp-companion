const test = require("node:test"),
  assert = require("node:assert/strict");
test("changing either calculator slot resets only that character's context and keeps the other slot and distance", async () => {
  const { CardStore } = await import("../frontend/src/stores/cards.js");
  const cards = new CardStore({ getItem: () => null });
  cards.showCalculator("hulk", { damage: 8, conditions: ["Root"] });
  cards.setCalculator("opponent", "hood");
  cards.setCalculator("second", { form: 1, side: "back", damage: 2 });
  cards.setCalculator("distance", 3);
  const old = cards.calculator;
  cards.setCalculator("source", "doctor-voodoo");
  assert.equal(cards.calculator.source, "doctor-voodoo");
  assert.equal(cards.calculator.first.damage, 0);
  assert.equal(cards.calculator.first.special, true);
  assert.deepEqual(cards.calculator.first.conditions, []);
  assert.strictEqual(cards.calculator.second, old.second);
  assert.equal(cards.calculator.opponent, "hood");
  assert.equal(cards.calculator.distance, 3);
  assert.equal(old.first.damage, 8);
  const currentFirst = cards.calculator.first;
  cards.setCalculator("opponent", "wong");
  assert.strictEqual(cards.calculator.first, currentFirst);
  assert.equal(cards.calculator.second.form, 0);
  assert.equal(cards.calculator.second.damage, 0);
  cards.setCalculator("source", "");
  assert.equal(cards.calculator.opponent, "wong");
});
test("a calculator page starts empty, and clearing page inputs never acts as closing an overlay", async () => {
  const { CardStore } = await import("../frontend/src/stores/cards.js"),
    { closingOverlay } = await import("../frontend/src/navigation/routes.js");
  const cards = new CardStore({ getItem: () => null });
  cards.showCalculator();
  assert.equal(cards.calculator.source, "");
  assert.equal(cards.calculator.opponent, "");
  assert.equal(
    closingOverlay(
      "#screen=calculator&calculator=wong&opponent=hulk",
      "#screen=calculator&opponent=hulk",
    ),
    false,
  );
  assert.equal(
    closingOverlay("#screen=catalog&card=hulk", "#screen=catalog"),
    true,
  );
});

test("legacy calculator navigation still guards a dirty roster whose old URL uses the same editor id", async () => {
  const { createRoutes } = await import("../frontend/src/navigation/routes.js");
  const routes = createRoutes({
    catalog: { byId: new Map([["hulk", {}]]) },
    rosters: { dirty: true, draft: { id: "same" } },
  });
  assert.equal(routes.needsGuard("#screen=rosters&roster=same"), false);
  assert.equal(
    routes.needsGuard("#screen=rosters&roster=same&calculator=hulk"),
    true,
  );
  assert.equal(
    routes.needsGuard("#screen=rosters&roster=same&calculator=unknown"),
    false,
  );
  assert.equal(routes.needsGuard("#screen=calculator&calculator=hulk"), true);
});
