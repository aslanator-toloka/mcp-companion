// Physical binder for owned Team Tactics: one slot per printed card from purchased boxes.
export const ALBUM_SHEETS = 20,
  ALBUM_POCKETS = 8,
  ALBUM_PAGES = ALBUM_SHEETS * 2;
export const GENERAL_GROUP = "Общие карты";
const ART_HOST = "https://d15s9aja3f2wkq.cloudfront.net/card_backs/";
export const artUrl = (art) => (art ? ART_HOST + encodeURIComponent(art) + ".png" : "");
const characterKeys = [
  "mandatory_character",
  "mandatory_character_with_alter_ego",
  "optional_character",
];
const alterEgoKeys = ["mandatory_alter_ego", "optional_alter_ego"];
const slugOf = (value) =>
  typeof value === "string"
    ? value
    : value?.character || value?.slug || Object.values(value || {})[0];
// The first character a card names, with every catalog version of that character.
function namedCharacter(requirements, characters) {
  for (const key of characterKeys) {
    const slug = slugOf(requirements[key]?.[0]);
    if (!slug) continue;
    const versions = characters.filter(
      (c) => c.slug === slug || c.slug.startsWith(slug + "-"),
    );
    if (versions.length)
      return { label: versions[0].name.split(",")[0], versions };
  }
  for (const key of alterEgoKeys) {
    const alterEgo = requirements[key]?.[0];
    if (!alterEgo) continue;
    const versions = characters.filter((c) => c.alterEgo === alterEgo);
    if (versions.length) return { label: alterEgo, versions };
  }
  return null;
}
export const pageLabel = (page) =>
  `Лист ${Math.ceil(page / 2)} · сторона ${page % 2 ? "А" : "Б"}`;
/**
 * @param {string[]} codes purchased box codes
 * @param {(code: string) => object|undefined} box box with `tactics: [{slug,name,amount,artwork}]`
 * @param {(slug: string) => object|undefined} card Team Tactics card by printing slug
 * @param {object[]} characters catalog rows with `affiliations`
 */
// Characters a card names (for search): catalog names of required slugs plus alter egos.
function namedForSearch(requirements, characters) {
  const names = [];
  for (const values of Object.values(requirements || {}))
    for (const value of values || []) {
      const [slug, alterEgo] = String(slugOf(value) || "").split("|");
      const match = characters.find((c) => c.slug === slug);
      names.push(match ? match.name : slug, alterEgo || "");
    }
  return names.filter(Boolean).join(" ");
}
/** Owned Team Tactics in canonical order, one entry per distinct artwork (`key`). */
export function collectTactics(codes, box, card, characters) {
  // One pocket per distinct artwork: copies with the same picture share a slot.
  const slots = [],
    seen = new Set();
  for (const code of [...codes].sort()) {
    const set = box(code);
    for (const t of set?.tactics || []) {
      const c = card(t.slug) || null,
        art = t.artwork || c?.cardFamily || t.slug;
      if (seen.has(art)) continue;
      seen.add(art);
      slots.push({
        key: art,
        slug: t.slug,
        name: c?.name || t.name,
        card: c,
        box: code,
        boxName: set.name || "",
        artwork: t.artwork || "",
        art: artUrl(art),
      });
    }
  }
  // Character cards join the affiliation that already holds most of the owner's affiliation cards.
  const weight = new Map();
  for (const s of slots) {
    const name = s.card?.affiliation?.name;
    if (name) weight.set(name, (weight.get(name) || 0) + 1);
  }
  for (const s of slots) {
    const c = s.card;
    if (c?.affiliation) {
      Object.assign(s, { group: c.affiliation.name, rank: 0, character: "" });
      continue;
    }
    const named = c && namedCharacter(c.requirementsItems || {}, characters);
    if (!named) {
      Object.assign(s, { group: GENERAL_GROUP, rank: 2, character: "" });
      continue;
    }
    const affiliations = [
      ...new Set(
        named.versions.flatMap((v) => (v.affiliations || []).map((a) => a.name)),
      ),
    ].sort(
      (a, b) =>
        (weight.get(b) || 0) - (weight.get(a) || 0) || a.localeCompare(b, "en"),
    );
    Object.assign(s, {
      group: affiliations[0] || GENERAL_GROUP,
      rank: 1,
      character: named.label,
    });
  }
  slots.sort(
    (a, b) =>
      (a.group === GENERAL_GROUP) - (b.group === GENERAL_GROUP) ||
      a.group.localeCompare(b.group, "en") ||
      a.rank - b.rank ||
      a.character.localeCompare(b.character, "en") ||
      a.name.localeCompare(b.name, "en") ||
      a.box.localeCompare(b.box, "en") ||
      a.artwork.localeCompare(b.artwork, "en"),
  );
  return slots.map(({ rank, ...s }) => ({
    ...s,
    searchText: [
      s.name,
      s.character,
      namedForSearch(s.card?.requirementsItems, characters),
    ].join(" "),
  }));
}
/**
 * Numbers follow the saved order; cards not in it yet go to the end (in canonical order),
 * so existing pockets never move. Saved keys that are no longer owned leave empty pockets.
 */
export function numberAlbum(sorted, order = []) {
  const known = new Set(order),
    added = sorted.map((s) => s.key).filter((k) => !known.has(k)),
    full = [...order, ...added],
    index = new Map(full.map((k, i) => [k, i + 1]));
  const slots = sorted
    .map((s) => {
      const number = index.get(s.key),
        page = Math.ceil(number / ALBUM_POCKETS);
      return {
        ...s,
        number,
        page,
        sheet: Math.ceil(page / 2),
        side: page % 2 ? "А" : "Б",
        pocket: ((number - 1) % ALBUM_POCKETS) + 1,
      };
    })
    .sort((a, b) => a.number - b.number);
  return { slots, order: full, added };
}
export function buildTacticsAlbum(codes, box, card, characters, order = []) {
  return numberAlbum(collectTactics(codes, box, card, characters), order).slots;
}
const fold = (text) =>
  String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’`´]/g, "'")
    .trim();
export function searchAlbum(slots, query) {
  const term = fold(query);
  return term
    ? slots.filter((s) => fold(s.searchText || s.name).includes(term))
    : [];
}
