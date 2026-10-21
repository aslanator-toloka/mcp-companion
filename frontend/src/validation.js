export function validateLibrary(data, characters) {
  if (
    data?.version !== 1 ||
    !Array.isArray(data.owned) ||
    !Array.isArray(data.rosters)
  )
    throw Error("Файл не подходит этому приложению.");
  if (data.owned.some((slug) => !characters.has(slug)))
    throw Error("В файле есть неизвестные персонажи.");
  const ids = new Set();
  for (const r of data.rosters) {
    if (
      typeof r.id !== "string" ||
      ids.has(r.id) ||
      typeof r.name !== "string" ||
      (r.affiliation !== undefined && typeof r.affiliation !== "string") ||
      !Array.isArray(r.characters) ||
      r.characters.some((slug) => !characters.has(slug))
    )
      throw Error("Не удалось прочитать ростеры.");
    ids.add(r.id);
  }
  if (data.groups !== undefined && !Array.isArray(data.groups))
    throw Error("Не удалось прочитать группы.");
  const groupIds = new Set();
  for (const g of data.groups || []) {
    if (
      typeof g.id !== "string" ||
      groupIds.has(g.id) ||
      typeof g.name !== "string"
    )
      throw Error("Некорректная группа ростеров.");
    groupIds.add(g.id);
  }
  for (const r of data.rosters) {
    for (const field of ["tactics", "crises", "groups"])
      if (
        r[field] !== undefined &&
        (!Array.isArray(r[field]) ||
          r[field].some((id) => typeof id !== "string"))
      )
        throw Error("Некорректный состав ростера.");
    if ((r.groups || []).some((id) => !groupIds.has(id)))
      throw Error("В ростере указана неизвестная группа.");
  }
  for (const field of ["wishlist", "purchasedSets"]) {
    const value = data[field];
    if (
      value !== undefined &&
      (!Array.isArray(value) ||
        value.length > 2000 ||
        value.some(
          (code) => typeof code !== "string" || !/^[A-Z0-9]{1,32}$/.test(code),
        ))
    )
      throw Error("Не удалось прочитать запланированные покупки.");
  }
  if (
    data.manuallyOwned !== undefined &&
    (!Array.isArray(data.manuallyOwned) ||
      data.manuallyOwned.length > 2000 ||
      data.manuallyOwned.some((slug) => !characters.has(slug)))
  )
    throw Error("Не удалось прочитать отметки коллекции.");
}
export function latestCards(rows) {
  const families = new Map(),
    rank = (c) =>
      Number(!c.updatedBy && !c.replacedBy) * 8 +
      Number(!c.variantOf) * 4 +
      Number(c.setSymbol === c.latestSetSymbol);
  for (const c of rows) {
    if (c.isInfinityGem) continue;
    const family = c.cardFamily || c.name,
      old = families.get(family);
    if (!old || rank(c) > rank(old)) families.set(family, c);
  }
  return [...families.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  );
}
