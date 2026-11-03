import { runInAction } from "mobx";
import { PHOTO_KINDS } from "./matching.js";
const validSides = new Set(["mine", "opponent"]);
export function photoTargetState({ catalog, rosters, battle }, target) {
  if (!target || !PHOTO_KINDS.includes(target.kind))
    return { error: "Неизвестный тип карт." };
  const kind = target.kind;
  if (target.type === "roster") {
    const draft = rosters.draft;
    if (!draft || draft.id !== target.id)
      return {
        error:
          "Открыт другой ростер. Закройте распознавание и повторите добавление.",
      };
    return {
      existing: new Set(
        draft[kind].map((s) =>
          kind === "characters" ? s : rosters.canonical(kind, s),
        ),
      ),
      allowed: null,
      title: draft.name || "Новый ростер",
      draft,
    };
  }
  const match = battle.current;
  if (
    target.type !== "battle" ||
    !validSides.has(target.side) ||
    !match ||
    match.id !== target.id
  )
    return {
      error:
        "Открыта другая партия. Закройте распознавание и повторите добавление.",
    };
  if (match.status === "finished")
    return { error: "Завершённую партию нельзя менять." };
  if (
    battle.activeNetwork &&
    match.status === "preparing" &&
    target.side !== battle.ownSide &&
    kind !== "crises"
  )
    return { error: "При сетевой подготовке можно менять только свой отряд." };
  const roster =
    battle.network?.roster?.(target.side) ||
    (target.side === "mine" ? match.sourceRoster : null);
  const allowed =
    kind !== "crises" && roster
      ? new Set(
          (roster[kind] || []).map((s) =>
            kind === "characters" ? s : rosters.canonical(kind, s),
          ),
        )
      : null;
  const team = match[target.side];
  const existing = new Set(
    kind === "characters"
      ? team.fighters.map((f) => f.slug)
      : kind === "tactics"
        ? team.tactics.map((t) => rosters.canonical(kind, t.slug))
        : [match.secure, match.extract]
            .filter(Boolean)
            .map((c) => rosters.canonical(kind, c.slug)),
  );
  return {
    match,
    team,
    existing,
    allowed,
    title: `${battle.label(target.side)} · ${match.name}`,
  };
}
export function photoCardProblem(state, target, card) {
  if (state.error) return state.error;
  if (state.allowed && !state.allowed.has(card.slug))
    return "Нет в ростере этой стороны";
  if (
    target.mission &&
    card.type !== (target.mission === "secure" ? "Secure" : "Extraction")
  )
    return "Другой тип кризиса";
  return "";
}
export function validatePhotoSelection(deps, target, slugs) {
  const state = photoTargetState(deps, target);
  if (state.error) throw Error(state.error);
  const { catalog, rosters } = deps,
    kind = target.kind;
  const unique = [
    ...new Set(
      slugs.map((s) =>
        kind === "characters" ? s : rosters.canonical(kind, s),
      ),
    ),
  ];
  if (!unique.length || unique.length > 60)
    throw Error("Выберите карты для добавления.");
  const cards = unique.map((slug) =>
    kind === "characters" ? catalog.byId.get(slug) : rosters.card(kind, slug),
  );
  for (const card of cards) {
    if (!card || card.isGrunt || card.isInfinityGem)
      throw Error("В выборе есть неизвестная или неподдерживаемая карта.");
    const problem = photoCardProblem(state, target, card);
    if (problem) throw Error(`${card.name}: ${problem}.`);
  }
  const added = unique.filter((s) => !state.existing.has(s));
  if (target.type === "battle") {
    if (kind === "tactics" && state.team.tactics.length + added.length > 5)
      throw Error(
        `В бой можно добавить ещё ${Math.max(0, 5 - state.team.tactics.length)} тактик. Снимите лишние отметки.`,
      );
    if (kind === "characters" && state.team.fighters.length + added.length > 20)
      throw Error("В отряде слишком много бойцов. Снимите лишние отметки.");
    if (kind === "crises")
      for (const type of ["Secure", "Extraction"])
        if (cards.filter((c) => c.type === type).length > 1)
          throw Error("Для боя выберите по одной карте Secure и Extract.");
  }
  return { state, cards, slugs: unique, added };
}
export async function applyPhotoSelection(deps, target, slugs) {
  const { catalog, rosters, battle } = deps;
  let plan = validatePhotoSelection(deps, target, slugs);
  if (!plan.added.length) return { count: 0 };
  if (target.type === "roster") {
    runInAction(() => {
      for (const slug of plan.added) rosters.choose(target.kind, slug, true);
    });
    return { count: plan.added.length };
  }
  const details = new Map();
  if (target.kind === "characters") {
    // Every reference must load before one atomic, undoable change is submitted.
    const loaded = await Promise.all(
      plan.added.map(async (slug) => [slug, await catalog.detail(slug)]),
    );
    for (const [slug, detail] of loaded) details.set(slug, detail);
  }
  // The user or peer may change matches/rosters while images/references load.
  plan = validatePhotoSelection(deps, target, slugs);
  if (!plan.added.length) return { count: 0 };
  if (
    target.kind === "characters" &&
    plan.added.some((slug) => !details.has(slug))
  )
    throw Error("Состав партии изменился. Повторите добавление.");
  const label = `${battle.label(target.side)}: добавлено по фото ${plan.added.length}`,
    Core = battle.domain.Core;
  const mutate = (m) => {
    if (m.id !== target.id || m.status === "finished")
      throw Error("Партия изменилась.");
    const team = m[target.side];
    for (const slug of plan.added) {
      if (target.kind === "characters") {
        if (team.fighters.some((f) => f.slug === slug)) continue;
        const detail = details.get(slug);
        m.references[slug] = Core.clone({
          statCard: {
            frontSide: detail.statCard.frontSide,
            backSide: detail.statCard.backSide,
          },
          secondStatCard: detail.secondStatCard
            ? {
                frontSide: detail.secondStatCard.frontSide,
                backSide: detail.secondStatCard.backSide,
              }
            : null,
        });
        team.fighters.push(
          Core.fighter(catalog.byId.get(slug), detail, crypto.randomUUID()),
        );
      } else if (target.kind === "tactics") {
        if (
          team.tactics.some(
            (t) => rosters.canonical("tactics", t.slug) === slug,
          )
        )
          continue;
        const card = rosters.card("tactics", slug);
        team.tactics.push({
          slug,
          name: card.name,
          played: false,
          card: Core.clone(card),
        });
      } else {
        const card = rosters.card("crises", slug);
        m[card.type === "Secure" ? "secure" : "extract"] = Core.clone(card);
      }
    }
  };
  if (battle.activeNetwork) await battle.network.editAsync(label, mutate);
  else if (!battle.edit(label, mutate))
    throw Error(battle.error || "Не удалось сохранить изменения партии.");
  return { count: plan.added.length };
}
