const MAX_CODE_LENGTH = 20000;
const MAX_ITEMS = 200;
const kinds = ["characters", "tactics", "crises"];
const labels = { characters: "Персонаж", tactics: "Тактика", crises: "Кризис" };

// Exchange only roster membership and labels, never local IDs, groups or ownership.
export function createRosterCodeCodec({
  characters,
  cards,
  canonical = (_kind, slug) => slug,
}) {
  const bySlug = new Map();
  const byCode = new Map();
  for (const kind of kinds) {
    for (const row of kind === "characters" ? characters : cards[kind]) {
      const slug = kind === "characters" ? row.slug : canonical(kind, row.slug);
      bySlug.set(kind + ":" + row.slug, { ...row, slug });
      if (!/^\d{8}$/.test(row.exportCode ?? "")) continue;
      const entry = {
        kind,
        slug,
        name: row.name,
        unsupported: row.isGrunt || row.isInfinityGem,
      };
      const old = byCode.get(row.exportCode);
      if (old?.unsupported && entry.unsupported) continue;
      if (old && (old.kind !== kind || old.slug !== slug)) old.ambiguous = true;
      else if (!old) byCode.set(row.exportCode, entry);
    }
  }

  function normalize(roster) {
    if (
      !roster ||
      typeof roster !== "object" ||
      typeof roster.name !== "string" ||
      roster.name.length > 100 ||
      typeof roster.affiliation !== "string" ||
      roster.affiliation.length > 150
    )
      throw Error("В коде некорректное название или аффилиация ростера.");
    const result = {
      name: roster.name,
      affiliation: roster.affiliation,
      groups: [],
    };
    for (const kind of kinds) {
      const ids = roster[kind];
      if (
        !Array.isArray(ids) ||
        ids.length > MAX_ITEMS ||
        ids.some((id) => typeof id !== "string" || id.length > 150)
      )
        throw Error("В коде некорректный состав ростера.");
      result[kind] = [];
      for (const id of ids) {
        const row = bySlug.get(kind + ":" + id);
        if (!row) throw Error(`${labels[kind]} не найден в каталоге: ${id}`);
        if (row.isGrunt || row.isInfinityGem)
          throw Error(
            "Эта карта не поддерживается в составе ростера: " + row.name,
          );
        if (result[kind].includes(row.slug)) {
          if (kind === "characters")
            throw Error("Повторяется персонаж: " + row.name);
          continue; // Different printings of a tactic/crisis are one roster member.
        }
        result[kind].push(row.slug);
      }
    }
    return result;
  }

  function encode(roster, format = "mct") {
    const value = normalize(roster);
    let code;
    if (format === "companion") {
      const bytes = new TextEncoder().encode(
        JSON.stringify([
          value.name,
          value.affiliation,
          ...kinds.map((kind) => value[kind]),
        ]),
      );
      if (bytes.length > MAX_CODE_LENGTH)
        throw Error("Ростер слишком большой для кода.");
      code =
        "MCP1." +
        btoa(String.fromCharCode(...bytes))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
    } else if (format === "mct") {
      const missing = [];
      const tokens = kinds.flatMap((kind) =>
        value[kind].map((slug) => {
          const row = bySlug.get(kind + ":" + slug);
          if (!row?.exportCode || byCode.get(row.exportCode)?.ambiguous)
            missing.push(row?.name || slug);
          return row?.exportCode;
        }),
      );
      if (missing.length)
        throw Error(
          "Нет кода Jarvis для: " +
            missing.join(", ") +
            ". Выберите формат MCP Companion.",
        );
      if (!tokens.length)
        throw Error("Сначала добавьте в ростер персонажей или карты.");
      if (tokens.length > MAX_ITEMS)
        throw Error("Ростер слишком большой для кода Jarvis.");
      code = tokens.join(",");
    } else throw Error("Неизвестный формат кода ростера.");
    if (code.length > MAX_CODE_LENGTH)
      throw Error("Ростер слишком большой для кода.");
    return code;
  }

  function decode(text) {
    if (typeof text !== "string" || text.length > MAX_CODE_LENGTH)
      throw Error("Код ростера слишком длинный.");
    let code = text.trim();
    if (!code) throw Error("Вставьте код ростера.");
    if (/^MCP\d+\./.test(code)) {
      if (!code.startsWith("MCP1."))
        throw Error("Эта версия кода ростера пока не поддерживается.");
      let value;
      try {
        if (!/^MCP1\.[A-Za-z0-9_-]+$/.test(code)) throw Error();
        const binary = atob(
          code.slice(5).replace(/-/g, "+").replace(/_/g, "/"),
        );
        value = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(
            Uint8Array.from(binary, (c) => c.charCodeAt(0)),
          ),
        );
      } catch {
        throw Error("Код MCP Companion повреждён. Скопируйте его целиком.");
      }
      if (!Array.isArray(value) || value.length !== 5)
        throw Error("В коде некорректный состав ростера.");
      const [name, affiliation, characters, tactics, crises] = value;
      return normalize({ name, affiliation, characters, tactics, crises });
    }
    if (/^https?:\/\//i.test(code)) {
      try {
        const url = new URL(code);
        if (
          url.hostname !== "www.jarvis-protocol.com" &&
          url.hostname !== "jarvis-protocol.com"
        )
          throw Error();
        code = url.searchParams.get("mctCode") || "";
      } catch {
        throw Error("Вставьте код ростера или ссылку Jarvis с mctCode.");
      }
    }
    const tokens = code.split(",").map((token) => token.trim());
    if (
      tokens.length > MAX_ITEMS ||
      tokens.some((token) => !/^\d{8}$/.test(token))
    )
      throw Error(
        "Код Jarvis — восемь цифр на карту, разделённых запятыми. Проверьте, что скопирован весь код.",
      );
    const unknown = tokens.filter((token) => !byCode.has(token));
    if (unknown.length)
      throw Error("Неизвестные коды карт: " + [...new Set(unknown)].join(", "));
    const roster = {
      name: "Ростер по коду",
      affiliation: "",
      characters: [],
      tactics: [],
      crises: [],
    };
    for (const token of tokens) {
      const item = byCode.get(token);
      if (item.ambiguous) throw Error("Неоднозначный код карты: " + token);
      if (item.unsupported)
        throw Error(
          "Эта карта не поддерживается в составе ростера: " + item.name,
        );
      roster[item.kind].push(item.slug);
    }
    return normalize(roster);
  }
  return { encode, decode };
}
