import { runInAction } from "mobx";
const bool = (v) => v === "1",
  one = (v, values, fallback) => (values.includes(v) ? v : fallback);
const positive = (v, fallback, max = 10000) =>
  Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= max
    ? Number(v)
    : fallback;
const pickerFields = {
  query: "query",
  affiliation: "affiliation",
  owned: "owned",
  type: "type",
  available: "available",
  challenger: "challenger",
  sort: "sort",
  statsAffiliation: "stats-affiliation",
  statsCharacter: "stats-character",
  relatedTo: "character",
  relatedOnly: "related",
};
const overlayKeys = [
  "preview",
  "remove-side",
  "mission",
  "card",
  "form",
  "face",
  "box",
  "game",
  "game-side",
  "condition",
  "reference",
  "data",
  "membership",
  "dialog",
  "panel",
  "fighter",
  "preview-form",
  "preview-face",
  "pick",
  "connect",
  "roster-dialog",
  "group-edit",
  "map-dialog",
];
export function closingOverlay(from, to) {
  const a = new URLSearchParams(from.slice(1)),
    b = new URLSearchParams(to.slice(1));
  if (
    a.get("screen") !== b.get("screen") ||
    a.get("roster") !== b.get("roster") ||
    a.get("match") !== b.get("match")
  )
    return false;
  let removed = false;
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    if (JSON.stringify(a.getAll(key)) === JSON.stringify(b.getAll(key)))
      continue;
    if ((overlayKeys.includes(key) || key.startsWith("pick-")) && !b.has(key)) {
      removed = true;
      continue;
    }
    return false;
  }
  return removed;
}
export function createRoutes(s) {
  const {
    ui,
    catalog,
    purchases,
    rosters,
    tournaments: t,
    cardViews: cards,
    battle: b,
    peer,
    map,
  } = s;
  function read() {
    const p = new URLSearchParams(),
      put = (key, value, fallback = "") => {
        if (
          value !== fallback &&
          value !== null &&
          value !== undefined &&
          value !== false
        )
          p.set(key, value === true ? "1" : String(value));
      };
    const screen =
      ui.screen === "catalog" && catalog.onlyOwned ? "mine" : ui.screen;
    put("screen", screen);
    if (ui.screen === "catalog") {
      put("q", catalog.query);
      put("affiliation", catalog.affiliation);
      put("threat", catalog.threat);
    }
    if (ui.screen === "purchases") {
      put("tab", purchases.tab, "wishlist");
      put("q", purchases.query);
    }
    if (ui.screen === "rosters") {
      put("q", rosters.filters.query);
      put("affiliation", rosters.filters.affiliation);
      put("group", rosters.filters.group);
      put("owned", rosters.filters.owned);
      if (rosters.draft) {
        put(
          "roster",
          (rosters.records.some((r) => r.id === rosters.draft.id)
            ? ""
            : "new:") + rosters.draft.id,
        );
        put("tab", rosters.tab, "characters");
        if (rosters.picker) {
          put("pick", rosters.picker.kind);
          for (const [field, key] of Object.entries(pickerFields))
            put(
              "pick-" + key,
              rosters.picker[field],
              field === "sort"
                ? rosters.picker.kind === "characters"
                  ? "name"
                  : "popularity"
                : field === "challenger"
                  ? rosters.picker.kind === "crises"
                  : "",
            );
          if (rosters.picker.kind === "crises" && !rosters.picker.challenger)
            p.set("pick-challenger", "0");
        }
      }
      if (
        rosters.dialog &&
        ["groups", "group", "delete", "delete-group"].includes(
          rosters.dialog.type,
        )
      ) {
        put("roster-dialog", rosters.dialog.type);
        put("group-edit", rosters.dialog.id);
      }
    }
    if (ui.screen === "tournaments") {
      if (t.collectionMode) put("collection", "ready");
      else if (!t.playerMode) put("character", t.selected);
      put("player", t.selectedPlayer);
      for (const aff of t.selectedAffiliations) p.append("affiliation", aff);
      put("q", t.characterQuery);
      put("sort", t.characterSort, "points");
      put("only-used", t.onlyUsed);
      put("result-query", t.resultQuery);
      put("result-sort", t.resultSort, "recent");
      put("limit", t.limit, 20);
      put("player-query", t.playerQuery);
      put("player-sort", t.playerSort, "points");
      put("player-affiliation", t.playerAffiliation);
      put("country", t.playerCountry);
      put("player-limit", t.playerLimit, 60);
      put("affiliation-sort", t.affiliationSort, "points");
      put("dialog", t.dialog);
    }
    if (ui.screen === "battle" && b.current && b.view !== "home") {
      put("match", b.matchId);
      put("side", b.team, "mine");
      if (b.view === "map") {
        put("view", "map");
        put("point", map.selected);
        put("measure", map.distanceMode, "objects");
        put("unit", map.unit, "in");
        put("method", map.mode, "bases");
        put("zoom", map.zoom, 1);
        if (!map.lines) p.set("lines", "0");
        if (map.renaming) put("map-dialog", "rename");
      }
      if (b.dialog) {
        put("panel", b.dialog.type);
        put("fighter", b.dialog.id);
        if (b.dialog.type === "fighter" && !b.dialog.followActual) {
          put("preview-form", b.dialog.form, 0);
          put("preview-face", b.dialog.side, "front");
          p.set("preview", "1");
        }
        if (b.dialog.type === "remove") put("remove-side", b.dialog.side);
      }
      if (b.picker) {
        put("pick", b.picker.kind);
        put("pick-side", b.picker.side);
        put("mission", b.picker.mission);
        put("pick-query", b.picker.query);
        put("pick-affiliation", b.picker.affiliation);
        put("pick-owned", b.picker.owned);
        put("pick-available", b.picker.available);
      }
    } else if (ui.screen === "battle" && b.dialog?.type === "choose-roster")
      put("panel", "choose-roster");
    if (catalog.selected) {
      put("card", catalog.selected);
      put("form", catalog.selectedForm, 0);
      put("face", catalog.selectedSide, "front");
      if (ui.membership) put("membership", true);
    }
    put("box", purchases.selected);
    if (cards.game) {
      put("game", cards.game.kind + ":" + cards.game.card.slug);
      put("game-side", cards.game.side, "front");
    }
    put("condition", cards.condition);
    put("reference", cards.reference);
    if (ui.dataDialog) put("data", true);
    if (peer.dialog && peer.dialog !== "loading")
      put("connect", peer.dialog === "choose" ? peer.form.mode : peer.dialog);
    return "#" + p.toString();
  }
  function context() {
    return {
      draft:
        ui.screen === "rosters" && rosters.draft
          ? JSON.parse(
              JSON.stringify({
                value: rosters.draft,
                base: rosters.base,
                wasSaved: rosters.wasSaved,
              }),
            )
          : null,
      groupName: rosters.dialog?.type === "group" ? rosters.dialog.name : null,
    };
  }
  function editorId(hash) {
    const p = new URLSearchParams(hash.slice(1));
    return p.get("screen") === "rosters"
      ? p.get("roster")?.replace(/^new:/, "")
      : null;
  }
  function needsGuard(hash) {
    return rosters.dirty && editorId(hash) !== rosters.draft?.id;
  }
  function apply(hash, entry) {
    const p = new URLSearchParams(hash.slice(1));
    let loaded;
    runInAction(() => {
      const requested = p.get("screen"),
        screen = one(
          requested,
          ["catalog", "mine", "rosters", "tournaments", "battle", "purchases"],
          "tournaments",
        ),
        oldDraft = rosters.draft;
      ui.activate(screen === "mine" ? "catalog" : screen, screen === "mine");
      const preserve = screen === "rosters" && oldDraft?.id === editorId(hash);
      if (!preserve) rosters.reset();
      t.closeDialog();
      rosters.closePicker();
      rosters.closeDialog();
      b.closePicker();
      b.closeDialog();
      map.setField("renaming", false);
      cards.closeGame();
      cards.closeCondition();
      cards.closeReference();
      purchases.select(null);
      peer.close();
      ui.setMembership(false);
      ui.closeData();
      if (screen === "catalog" || screen === "mine") {
        catalog.reset(screen === "mine");
        catalog.setFilter("query", p.get("q") || "");
        catalog.setFilter("affiliation", p.get("affiliation") || "");
        catalog.setFilter("threat", p.get("threat") || "");
      }
      if (screen === "purchases") {
        purchases.setTab(
          one(p.get("tab"), ["all", "purchased", "wishlist"], "wishlist"),
        );
        purchases.setQuery(p.get("q") || "");
      }
      if (screen === "rosters") {
        for (const [field, key] of Object.entries({
          query: "q",
          affiliation: "affiliation",
          group: "group",
          owned: "owned",
        }))
          rosters.setFilter(
            field,
            field === "owned" ? bool(p.get(key)) : p.get(key) || "",
          );
        if (p.has("roster")) {
          const id = p.get("roster").replace(/^new:/, ""),
            saved = rosters.records.find((r) => r.id === id),
            snapshot = entry?.context?.draft;
          if (!preserve) {
            if (snapshot?.value.id === id) {
              rosters.setDraft(
                snapshot.value,
                snapshot.wasSaved,
                snapshot.base,
              );
              rosters.externalChanged();
            } else if (saved) rosters.setDraft(saved, true);
            else if (p.get("roster").startsWith("new:"))
              rosters.setDraft({ id, name: "", characters: [] });
            else ui.notify("Ростер больше не существует.");
          }
          if (rosters.draft) {
            rosters.setTab(
              one(
                p.get("tab"),
                ["characters", "tactics", "crises"],
                "characters",
              ),
            );
            if (["characters", "tactics", "crises"].includes(p.get("pick"))) {
              rosters.openPicker(p.get("pick"));
              for (const [field, key] of Object.entries(pickerFields)) {
                const value = p.get("pick-" + key);
                if (value !== null)
                  rosters.setPicker(
                    field,
                    [
                      "owned",
                      "available",
                      "challenger",
                      "relatedOnly",
                    ].includes(field)
                      ? bool(value)
                      : value,
                  );
              }
            }
          }
        }
        const dialog = p.get("roster-dialog"),
          id = p.get("group-edit");
        if (dialog === "groups") rosters.showGroups();
        else if (dialog === "group") {
          rosters.groupForm(id || undefined);
          if (entry?.context?.groupName)
            rosters.editGroupName(entry.context.groupName);
        } else if (dialog === "delete") rosters.remove(id);
        else if (dialog === "delete-group") rosters.removeGroup(id);
      }
      if (screen === "tournaments") {
        t.applyRoute(p);
        t.clearAffiliations();
        for (const a of p.getAll("affiliation"))
          if (t.affiliationNames.includes(a)) t.toggleAffiliation(a, true);
        for (const [field, key, fallback] of [
          ["characterQuery", "q", ""],
          ["characterSort", "sort", "points"],
          ["resultQuery", "result-query", ""],
          ["resultSort", "result-sort", "recent"],
          ["playerQuery", "player-query", ""],
          ["playerSort", "player-sort", "points"],
          ["playerAffiliation", "player-affiliation", ""],
          ["playerCountry", "country", ""],
          ["affiliationSort", "affiliation-sort", "points"],
        ])
          t.setField(field, p.get(key) || fallback);
        t.setField("onlyUsed", bool(p.get("only-used")));
        t.setField("limit", positive(p.get("limit"), 20));
        t.setField("playerLimit", positive(p.get("player-limit"), 60));
        t.openDialog(one(p.get("dialog"), ["player", "affiliation"], null));
      }
      if (screen === "battle") {
        const id = p.get("match");
        if (id) {
          if (b.network?.isPeer?.(id) && peer.room?.id !== id) {
            try {
              b.network.openSaved(id);
            } catch (e) {
              ui.notify(e.message);
            }
          }
          if (b.matches.has(id) || peer.room?.id === id) {
            b.setLocation("matchId", id);
            b.setLocation(
              "team",
              one(p.get("side"), ["mine", "opponent"], "mine"),
            );
            b.setLocation(
              "view",
              p.get("view") === "map"
                ? "map"
                : b.current?.status === "preparing"
                  ? "setup"
                  : "play",
            );
            if (b.view === "map") {
              map.setField("matchId", id);
              map.setField("selected", p.get("point") || "");
              map.setField(
                "distanceMode",
                one(p.get("measure"), ["objects", "boundaries"], "objects"),
              );
              map.setField("unit", one(p.get("unit"), ["in", "cm"], "in"));
              map.setField(
                "mode",
                one(p.get("method"), ["bases", "centers"], "bases"),
              );
              map.setField(
                "zoom",
                [1, 1.5, 2, 2.5, 3].includes(Number(p.get("zoom")))
                  ? Number(p.get("zoom"))
                  : 1,
              );
              map.setField("lines", p.get("lines") !== "0");
              if (p.get("map-dialog") === "rename") map.rename();
              map.updateCoordinates();
            }
            const panel = p.get("panel"),
              fighter = p.get("fighter");
            if (panel === "fighter" && b.fighter(fighter)) {
              b.fighterCard(fighter);
              if (p.get("preview") === "1")
                b.preview(
                  p.get("preview-form") === "1" ? 1 : 0,
                  one(p.get("preview-face"), ["front", "back"], "front"),
                );
            } else if (
              ["conditions", "objectives", "remove"].includes(panel) &&
              b.fighter(fighter)
            ) {
              b.openDialog(panel, fighter);
              if (panel === "remove")
                b.dialog.side = one(
                  p.get("remove-side"),
                  ["mine", "opponent"],
                  "mine",
                );
            } else if (
              ["missions", "log", "power", "round", "finish"].includes(panel)
            )
              b.openDialog(panel);
            if (["characters", "tactics", "crises"].includes(p.get("pick"))) {
              b.openPicker(
                one(p.get("pick-side"), ["mine", "opponent"], b.ownSide),
                p.get("pick"),
                one(p.get("mission"), ["secure", "extract"], null),
              );
              for (const [field, key] of Object.entries({
                query: "pick-query",
                affiliation: "pick-affiliation",
                owned: "pick-owned",
                available: "pick-available",
              }))
                b.setPicker(
                  field,
                  ["owned", "available"].includes(field)
                    ? bool(p.get(key))
                    : p.get(key) || "",
                );
            }
          } else {
            b.setLocation("matchId", null);
            b.setLocation("view", "home");
            ui.notify("Партия больше не существует.");
          }
        } else {
          b.setLocation("matchId", null);
          b.setLocation("view", "home");
          if (p.get("panel") === "choose-roster") b.openDialog("choose-roster");
        }
      }
      const slug = p.get("card");
      if (slug && catalog.byId.has(slug)) {
        loaded = catalog.open(slug, false);
        catalog.selectFace("form", p.get("form") === "1" ? 1 : 0);
        catalog.selectFace(
          "side",
          one(p.get("face"), ["front", "back"], "front"),
        );
        ui.setMembership(bool(p.get("membership")));
      } else catalog.close();
      const box = p.get("box");
      if (
        box &&
        (purchases.byCode.has(box) ||
          s.library.wishlist.has(box) ||
          s.library.bought.has(box))
      )
        purchases.select(box);
      const game = p.get("game");
      if (game) {
        const split = game.indexOf(":"),
          kind = game.slice(0, split),
          id = game.slice(split + 1);
        if (["tactics", "crises"].includes(kind)) {
          const match = b.current,
            card =
              kind === "tactics"
                ? [
                    ...(match?.mine.tactics || []),
                    ...(match?.opponent.tactics || []),
                  ].find((t) => t.slug === id)?.card
                : [match?.secure, match?.extract].find((c) => c?.slug === id);
          const found = card || rosters.card(kind, id);
          if (found) {
            cards.showGame(found, kind);
            cards.gameSide(one(p.get("game-side"), ["front", "back"], "front"));
          }
        }
      }
      if (p.has("condition")) cards.showCondition(p.get("condition"));
      if (p.has("reference")) cards.showReference(p.get("reference"));
      if (bool(p.get("data"))) ui.setDataDialog("main");
      const connect = p.get("connect");
      if (["create", "join"].includes(connect))
        peer.protocol?.showChoose(connect);
      else if (connect === "offer" && peer.offerText) peer.show("offer");
      else if (connect === "answer" && peer.answerText) peer.show("answer");
    });
    return loaded;
  }
  return {
    read,
    apply,
    context,
    needsGuard,
    guard: (next) => rosters.requestLeave(next),
    prompt: () => !!rosters.dialog,
    closing: closingOverlay,
  };
}
