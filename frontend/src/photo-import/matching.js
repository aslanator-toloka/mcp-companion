// Recognition is a lookup against our known catalogue, never a generator of card data.
// Keep this module independent of the OCR vendor, browser, MobX and Android bridge.
export const PHOTO_KINDS = Object.freeze(["characters", "tactics", "crises"]);
export const normalizeCardText = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const compact = (value) => normalizeCardText(value).replace(/ /g, "");
const grams = (s) =>
  new Set(
    Array.from({ length: Math.max(0, s.length - 2) }, (_, i) =>
      s.slice(i, i + 3),
    ),
  );
const keyOf = (c) => `${c.kind}:${c.slug}`;
function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        row[j] + 1,
        next[j - 1] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
}
export function createPhotoCatalog({
  characters = [],
  tactics = [],
  crises = [],
  aliases = {},
}) {
  const entries = [],
    exact = new Map(),
    trigrams = new Map();
  for (const kind of PHOTO_KINDS)
    for (const card of { characters, tactics, crises }[kind]) {
      if (!card?.slug || !card.name || card.isGrunt || card.isInfinityGem)
        continue;
      const entry = {
        kind,
        slug: card.slug,
        name: card.name,
        alterEgo: card.alterEgo || "",
        type: card.type || "",
        threat: card.threatLevel,
        portrait: card.portrait || "",
        status: card.standardTimelineStatus || "",
      };
      const names = new Set([
        card.name,
        ...(aliases[card.slug]?.aliases || []),
      ]);
      // A full "identity (alter ego)" is useful; an alter ego alone must not silently
      // choose between different versions of Peter Parker, Steve Rogers, etc.
      if (card.alterEgo) names.add(`${card.name} ${card.alterEgo}`);
      entry.names = [...names]
        .map(compact)
        .filter((s) => s.length >= 3 && s.length <= 140);
      const index = entries.push(entry) - 1;
      for (const name of new Set(entry.names)) {
        const exKey = `${kind}:${name}`;
        if (!exact.has(exKey)) exact.set(exKey, new Set());
        exact.get(exKey).add(index);
        for (const g of grams(name)) {
          const k = `${kind}:${g}`;
          if (!trigrams.has(k)) trigrams.set(k, new Set());
          trigrams.get(k).add(index);
        }
      }
    }
  return {
    entries,
    exact,
    trigrams,
    byKey: new Map(entries.map((c) => [keyOf(c), c])),
  };
}
function adjacent(a, b) {
  if (a.block !== undefined && b.block !== undefined && a.block !== b.block)
    return false;
  if (!a.box || !b.box) return true;
  const ah = a.box.h || 1,
    bh = b.box.h || 1;
  // Never join text from neighbouring cards/columns or a heading to tiny rules.
  const overlap =
    Math.min(a.box.x + a.box.w, b.box.x + b.box.w) - Math.max(a.box.x, b.box.x);
  return (
    overlap > Math.min(a.box.w, b.box.w) * 0.2 &&
    b.box.y >= a.box.y - ah * 0.3 &&
    b.box.y - a.box.y <= Math.max(ah, bh) * 3 &&
    Math.min(ah, bh) / Math.max(ah, bh) >= 0.45
  );
}
function spansFrom(result) {
  const lines = (
    Array.isArray(result.lines) && result.lines.length
      ? result.lines
      : String(result.text || "")
          .split(/\r?\n/)
          .map((text) => ({ text }))
  )
    .slice(0, 1500)
    .map((line, i) =>
      typeof line === "string" ? { text: line, id: i } : { ...line, id: i },
    )
    .filter((line) => normalizeCardText(line.text));
  const spans = [];
  for (let i = 0; i < lines.length; i++) {
    let text = "";
    for (let n = 0; n < 4 && i + n < lines.length; n++) {
      if (n && !adjacent(lines[i + n - 1], lines[i + n])) break;
      text += (n ? " " : "") + lines[i + n].text;
      const name = compact(text);
      if (name.length > 140) break;
      if (name.length < 3) continue;
      const first = lines[i],
        last = lines[i + n];
      const box =
        first.box && last.box
          ? {
              x: Math.min(first.box.x, last.box.x),
              y: Math.min(first.box.y, last.box.y),
              w:
                Math.max(first.box.x + first.box.w, last.box.x + last.box.w) -
                Math.min(first.box.x, last.box.x),
              h:
                Math.max(first.box.y + first.box.h, last.box.y + last.box.h) -
                Math.min(first.box.y, last.box.y),
            }
          : null;
      spans.push({
        text,
        name,
        from: i,
        to: i + n,
        box,
        confidence: Math.min(
          ...lines
            .slice(i, i + n + 1)
            .map((l) => (Number.isFinite(l.confidence) ? l.confidence : 100)),
        ),
      });
    }
  }
  return spans;
}
export function findPhotoCards(index, kind, result = {}, photoId = "photo") {
  if (!PHOTO_KINDS.includes(kind)) throw Error("Неизвестный тип карт.");
  const spans = spansFrom(result),
    hits = [];
  for (const span of spans) {
    const exact = index.exact.get(`${kind}:${span.name}`);
    if (exact) {
      hits.push({
        ...span,
        exact: true,
        confidence: 1,
        options: [...exact].map((i) => ({ ...index.entries[i], score: 1 })),
      });
      continue;
    }
    // Limit expensive edit-distance checks to plausible trigram neighbours.
    if (span.name.length < 6 || span.confidence < 25) continue;
    const counts = new Map(),
      queryGrams = grams(span.name);
    for (const g of queryGrams)
      for (const i of index.trigrams.get(`${kind}:${g}`) || [])
        counts.set(i, (counts.get(i) || 0) + 1);
    const shortlist = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8),
      options = [];
    for (const [i, matches] of shortlist) {
      if (matches < Math.max(2, queryGrams.size * 0.4)) continue;
      const entry = index.entries[i];
      const score = Math.max(
        ...entry.names.map((name) => {
          if (span.name.length >= 12 && name.startsWith(span.name))
            return 0.8 + (0.1 * span.name.length) / name.length;
          if (
            Math.min(name.length, span.name.length) /
              Math.max(name.length, span.name.length) <
            0.72
          )
            return 0;
          return (
            1 -
            distance(name, span.name) / Math.max(name.length, span.name.length)
          );
        }),
      );
      if (score >= 0.78 && (span.name.length > 8 || score >= 0.85))
        options.push({ ...entry, score });
    }
    options.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    if (options.length)
      hits.push({
        ...span,
        exact: false,
        confidence: options[0].score,
        options: options.slice(0, 4),
      });
  }
  // "ULTIMATE / SPIDER-MAN" is one character, not Ultimate Spider-Man plus Spider-Man.
  const uncovered = hits.filter(
    (hit) =>
      !hits.some(
        (other) =>
          other !== hit &&
          other.exact &&
          other.from <= hit.from &&
          other.to >= hit.to &&
          other.name.length > hit.name.length,
      ),
  );
  const found = new Map();
  for (const hit of uncovered.sort(
    (a, b) => Number(b.exact) - Number(a.exact) || b.confidence - a.confidence,
  )) {
    const best = hit.options[0],
      ambiguous =
        hit.options.length > 1 && hit.options[1].score >= best.score - 0.035;
    const key = ambiguous ? `${kind}:ambiguous:${hit.name}` : keyOf(best);
    const evidence = { photoId, text: hit.text, box: hit.box };
    const previous = found.get(key);
    if (previous) {
      previous.evidence.push(evidence);
      continue;
    }
    found.set(key, {
      key,
      kind,
      slug: best.slug,
      name: best.name,
      exact: hit.exact,
      confidence: hit.confidence,
      ambiguous,
      checked: true,
      options: hit.options.map(({ names, ...option }) => option),
      evidence: [evidence],
    });
  }
  return [...found.values()].slice(0, 60);
}
export function searchPhotoCatalog(index, kind, query) {
  const q = normalizeCardText(query),
    tokens = q.split(" ").filter(Boolean);
  if (!tokens.length) return [];
  return index.entries
    .filter(
      (c) =>
        c.kind === kind &&
        tokens.every((t) =>
          normalizeCardText(`${c.name} ${c.alterEgo}`).includes(t),
        ),
    )
    .sort(
      (a, b) =>
        Number(compact(b.name) === compact(query)) -
          Number(compact(a.name) === compact(query)) ||
        a.name.localeCompare(b.name, "en"),
    )
    .slice(0, 25);
}
export function mergePhotoCards(previous, incoming) {
  const merged = new Map();
  for (const row of [...previous, ...incoming]) {
    const identity = row.slug ? `${row.kind}:${row.slug}` : row.key;
    const old = merged.get(identity);
    if (!old) {
      merged.set(identity, row);
      continue;
    }
    const preferred =
      row.touched && (!old.touched || (row.decision || 0) > (old.decision || 0))
        ? row
        : old;
    merged.set(identity, {
      ...row,
      ...preferred,
      exact: old.exact || row.exact,
      confidence: Math.max(old.confidence, row.confidence),
      evidence: [...old.evidence, ...row.evidence],
      sourceKeys: [
        ...new Set([
          ...(old.sourceKeys || [old.key]),
          ...(row.sourceKeys || [row.key]),
        ]),
      ],
      manual: old.manual || row.manual,
      checked: preferred.touched
        ? preferred.checked
        : old.checked || row.checked,
    });
  }
  return [...merged.values()];
}
