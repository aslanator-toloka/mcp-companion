import references from "../../data/card-references.json" with { type: "json" };

export function ruleReference(id) {
  const separator = String(id || "").indexOf(":");
  if (separator < 0) return null;
  const type = id.slice(0, separator),
    key = id.slice(separator + 1);
  if (type === "token" && Object.hasOwn(references.tokens, key))
    return { type, key, ...references.tokens[key] };
  if (type === "note" && Object.hasOwn(references.annotations, key))
    return { type, key, ...references.annotations[key] };
  if (type === "character" && references.characters.includes(key))
    return { type, key };
  if (type === "map" && /^[A-Z]$/.test(key))
    return { type, key, name: "Map " + key };
  return null;
}
export function annotationReference(title, body) {
  return Object.entries(references.annotations).find(
    ([, note]) => note.name === title && note.body === body,
  )?.[0];
}
