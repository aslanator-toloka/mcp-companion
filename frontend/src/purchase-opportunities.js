// A purchase is useful only when it adds missing models to a complete,
// finished tournament roster. Variants remain separate published rosters.
export function createPurchaseOpportunities(archive, boxes, availability) {
  const characters = new Map((archive?.characters || []).map((c) => [c.id, c]));
  const inventories = new Map(),
    providers = new Map();
  for (const box of boxes) {
    const ids = new Set((box.characters || []).map((c) => c.slug));
    inventories.set(box.code, ids);
    for (const id of ids) {
      if (!providers.has(id)) providers.set(id, new Set());
      providers.get(id).add(box.code);
    }
  }
  const seen = new Set();
  const rosters = (archive?.rosters || []).filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return (
      !r.provisional &&
      r.inventoryComplete &&
      Number.isInteger(r.wins) &&
      Number.isInteger(r.losses) &&
      r.wins >= 0 &&
      r.losses >= 0 &&
      ((r.wins >= 4 && r.losses <= 1) || (r.wins >= 3 && r.losses === 0)) &&
      r.characters?.length > 0 &&
      r.characters.every((c) => characters.has(c.id))
    );
  });
  const candidates = (missing) => {
    const codes = new Set();
    for (const item of missing)
      for (const id of characters.get(item.id).inventoryIds || [item.id])
        for (const code of providers.get(id) || []) codes.add(code);
    return codes;
  };
  return {
    eligible: rosters.length,
    evaluate(owned) {
      const result = new Map(
        boxes.map((b) => [
          b.code,
          {
            unlocked: [],
            almost: [],
            complements: new Map(),
          },
        ]),
      );
      const afterPurchase = new Map();
      const withBox = (code) => {
        if (!afterPurchase.has(code))
          afterPurchase.set(
            code,
            new Set([...owned, ...inventories.get(code)]),
          );
        return afterPurchase.get(code);
      };
      for (const roster of rosters) {
        const before = availability(roster, characters, owned);
        if (!before.complete || before.ready) continue;
        for (const code of candidates(before.missing)) {
          const after = availability(roster, characters, withBox(code));
          if (after.have <= before.have) continue;
          const stats = result.get(code);
          if (after.ready) {
            stats.unlocked.push(roster.id);
            continue;
          }
          let almost = false;
          // Any finishing box must supply at least the first missing entry.
          for (const extra of candidates(after.missing.slice(0, 1))) {
            if (extra === code) continue;
            const combined = new Set([
              ...withBox(code),
              ...inventories.get(extra),
            ]);
            if (!availability(roster, characters, combined).ready) continue;
            if (!stats.complements.has(extra)) stats.complements.set(extra, []);
            stats.complements.get(extra).push(roster.id);
            almost = true;
          }
          if (almost) stats.almost.push(roster.id);
        }
      }
      return result;
    },
  };
}
