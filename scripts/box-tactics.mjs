// Team Tactics printings shipped in a Jarvis box (each artwork is a separate physical card).
export function boxTactics(detail) {
  return (detail.content || [])
    .filter((c) => c.itemType === "TeamTacticsCard")
    .map((c) => ({
      slug: c.itemSlug,
      name: c.name,
      amount: c.amount ?? 1,
      ...(c.artworkName ? { artwork: c.artworkName } : {}),
    }));
}
