const bits = (value) => {
  let n = 0;
  for (; value; value &= value - 1) n++;
  return n;
};

// Exact minimum set cover of the missing physical inventory, computed only
// for an opened roster. Keep a few alternative plans, not every permutation.
export function planRosterPurchases(
  roster,
  characters,
  boxes,
  inventories,
  owned,
  availability,
) {
  const before = availability(roster, characters, owned);
  const groups = new Map();
  for (const item of before.missing) {
    if (!groups.has(item.id))
      groups.set(item.id, { id: item.id, name: item.name, count: 0 });
    groups.get(item.id).count++;
  }
  const missing = [...groups.values()];
  if (!before.complete || roster.characters.some((c) => !characters.has(c.id)))
    return { complete: false, missing, minimum: null, plans: [], choices: [] };
  if (before.ready)
    return { complete: true, missing: [], minimum: 0, plans: [], choices: [] };
  const choices = missing.map((c) => {
    const ids = characters.get(c.id).inventoryIds || [c.id];
    return {
      ...c,
      boxes: boxes.filter((b) =>
        ids.some((id) => !owned.has(id) && inventories.get(b.code).has(id)),
      ),
    };
  });
  const ids = [
    ...new Set(
      choices.flatMap((c) => characters.get(c.id).inventoryIds || [c.id]),
    ),
  ].filter((id) => !owned.has(id));
  if (ids.length > 18 || choices.some((c) => !c.boxes.length))
    return { complete: true, missing, minimum: null, plans: [], choices };
  const masks = choices.map((c) => ({
    need: c.count,
    mask: ids.reduce(
      (m, id, i) =>
        (characters.get(c.id).inventoryIds || [c.id]).includes(id)
          ? m | (1 << i)
          : m,
      0,
    ),
  }));
  const candidates = boxes
    .map((b) => ({
      box: b,
      mask: ids.reduce(
        (m, id, i) => (inventories.get(b.code).has(id) ? m | (1 << i) : m),
        0,
      ),
    }))
    .filter((c) => c.mask)
    .sort(
      (a, b) =>
        bits(b.mask) - bits(a.mask) || a.box.name.localeCompare(b.box.name),
    );
  const goal = (mask) =>
    masks.every((g) => bits(mask & g.mask) >= g.need) &&
    availability(
      roster,
      characters,
      new Set([...owned, ...ids.filter((id, i) => mask & (1 << i))]),
    ).ready;
  const boxByCode = new Map(boxes.map((b) => [b.code, b]));
  const describe = (codes) => ({
    boxes: codes.map((code) => ({
      ...boxByCode.get(code),
      needed: choices.filter((c) => c.boxes.some((b) => b.code === code)),
    })),
  });
  let layer = new Map([[0, new Map([["", []]])]]);
  const visited = new Set([0]);
  for (
    let depth = 1;
    depth <= missing.reduce((s, c) => s + c.count, 0);
    depth++
  ) {
    const next = new Map();
    for (const [mask, paths] of layer)
      for (const candidate of candidates) {
        const combined = mask | candidate.mask;
        if (combined === mask || visited.has(combined)) continue;
        if (!next.has(combined)) next.set(combined, new Map());
        const target = next.get(combined);
        for (const path of paths.values()) {
          const codes = [...path, candidate.box.code].sort();
          if (target.size < 4) target.set(codes.join("|"), codes);
        }
      }
    if (next.size > 8192)
      return { complete: true, missing, minimum: null, plans: [], choices };
    const solutions = new Map();
    for (const [mask, paths] of next)
      if (goal(mask))
        for (const [key, path] of paths)
          if (solutions.size < 4) solutions.set(key, path);
    if (solutions.size)
      return {
        complete: true,
        missing,
        minimum: depth,
        plans: [...solutions.values()].map(describe),
        choices,
      };
    for (const mask of next.keys()) visited.add(mask);
    layer = next;
    if (!layer.size) break;
  }
  return { complete: true, missing, minimum: null, plans: [], choices };
}
