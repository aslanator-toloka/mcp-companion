import data from "../../data/character-roles.json" with { type: "json" };

export const CHARACTER_ROLES = Object.freeze(
  data.roles.map((r) => Object.freeze(r)),
);
const records = data.characters;
export function roleProfile(character) {
  const candidates =
    typeof character === "string"
      ? [character]
      : [character?.slug, ...(character?.inventoryIds || []), character?.id];
  const slug = candidates.find(
    (id) => typeof id === "string" && Object.hasOwn(records, id),
  );
  return slug ? { slug, ...records[slug] } : null;
}
export function characterRoles(character) {
  const p = roleProfile(character);
  if (!p || p.grunt) return [];
  return CHARACTER_ROLES.filter((r) => p.roles.includes(r.id)).map((r) => ({
    ...r,
    members: [{ slug: p.slug, name: p.name, note: p.notes?.[r.id] || "" }],
  }));
}

// A role is counted once per distinct model, not once per matching trait/form.
// Unknown identities and Grunts never create invented or duplicate providers.
export function squadRoles(characters, { tactics, leaderSlug } = {}) {
  const profiles = new Map();
  for (const c of characters || []) {
    const p = roleProfile(c);
    if (p && !p.grunt) profiles.set(p.slug, p);
  }
  const tacticIds =
    tactics === undefined
      ? null
      : new Set(
          tactics
            .map((t) => (typeof t === "string" ? t : t.slug))
            .map((id) =>
              String(id)
                .toLowerCase()
                .normalize("NFKD")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, ""),
            ),
        );
  return CHARACTER_ROLES.map((role) => ({
    ...role,
    members: [...profiles.values()]
      .filter((p) => {
        if (!p.roles.includes(role.id)) return false;
        const requires = p.requires?.[role.id];
        return (
          (!requires?.ally || profiles.has(requires.ally)) &&
          (!requires?.tactic ||
            tacticIds === null ||
            tacticIds.has(requires.tactic)) &&
          (!requires?.leader ||
            leaderSlug === undefined ||
            leaderSlug === requires.leader)
        );
      })
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        note: p.notes?.[role.id] || "",
      })),
  })).filter((r) => r.members.length);
}
