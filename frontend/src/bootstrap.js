import { reaction } from "mobx";
import { BrowserNavigation } from "./navigation/history.js";
import { createRoutes } from "./navigation/routes.js";
import Core from "../../battle-core.js";
import Geometry from "../../map-geometry.js";
import Phase from "../../power-phase.js";
import Summary from "../../battle-card-summary.js";
import State from "../../battle-character-state.js";
import RoomCore from "../../room-core.js";
import PeerLink from "../../peer-link.js";
import AtlasCore from "../../tournaments/core.js";
import CollectionCore from "../../tournaments/collection-core.js";
import TournamentImport from "../../tournament-import.js";
import Insights from "../../roster-card-insights.js";
import Conditions from "../../card-conditions.js";
import { validateLibrary, latestCards } from "./validation.js";
import { normalizeRoster } from "./stores/rosters.js";
import { createPeerProtocol } from "./peer-protocol.js";
import {
  library,
  catalog,
  purchases,
  rosters,
  tournaments,
  cardViews,
  battle,
  peer,
  map,
  ui,
} from "./stores/index.js";
const KEY = "mcp-companion-catalog-v1";
let navigation;
const json = async (path, options) => {
  const r = await fetch(path, options);
  if (!r.ok) throw Error("Не удалось загрузить " + path);
  return r.json();
};
const closeTransient = () => {
  catalog.close();
  purchases.select(null);
  ui.setMembership(false);
  rosters.closePicker();
  rosters.closeDialog();
  cardViews.closeGame();
  cardViews.closeCondition();
  cardViews.closeReference();
  battle.closeDialog();
  battle.closePicker();
};
function route(screen, onlyOwned = false, keepDraft = false) {
  closeTransient();
  if (!keepDraft) rosters.reset();
  ui.activate(screen, onlyOwned);
  if (screen === "catalog") catalog.reset(onlyOwned);
}
function navigate(action) {
  if (!ui.ready) return;
  rosters.requestLeave(() => {
    if (action === "all" || action === "mine")
      route("catalog", action === "mine");
    else if (action === "battle") {
      battle.setLocation("view", "home");
      battle.setLocation("matchId", null);
      route("battle");
    } else route(action);
  });
}
async function loadBoxes() {
  try {
    const data = await json("data/box-sets.json");
    purchases.load(data);
  } catch (e) {
    const sets = [...new Set(catalog.rows.flatMap((c) => c.boxSets || []))]
      .sort()
      .map((code) => ({
        code,
        name: code,
        characters: catalog.rows
          .filter((c) => c.boxSets?.includes(code))
          .map((c) => ({ slug: c.slug, name: c.name, amount: 1 })),
        image: null,
      }));
    purchases.load({ sets }, e.message);
  }
}
function save(value) {
  if (library.commit(value)) return true;
  ui.notify(
    library.error || "Браузер не сохранил изменения. Экспортируйте данные.",
  );
  return false;
}
function exportData() {
  const value = { ...library.serialize(), battles: battle.serialize() },
    url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = "mcp-companion-catalog.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  ui.notify("Данные экспортированы");
}
async function readImport(file) {
  try {
    const value = JSON.parse(await file.text());
    validateLibrary(value, catalog.byId);
    if (value.battles) battle.validate(value.battles);
    ui.confirmImport(value);
  } catch (e) {
    ui.notify(e.message || "Не удалось прочитать файл.");
  }
}
function restore() {
  const imported = ui.pendingImport;
  if (!imported) return;
  try {
    validateLibrary(imported, catalog.byId);
    if (imported.battles) battle.validate(imported.battles);
    const next = library.normalize(imported),
      keys = [
        [KEY, JSON.stringify(next)],
        ...(imported.battles
          ? [["mcp-companion-battles-v1", JSON.stringify(imported.battles)]]
          : []),
      ],
      previous = keys.map(([key]) => [key, localStorage.getItem(key)]);
    try {
      for (const [key, value] of keys) localStorage.setItem(key, value);
    } catch (e) {
      for (const [key, value] of previous) {
        try {
          value === null
            ? localStorage.removeItem(key)
            : localStorage.setItem(key, value);
        } catch {}
      }
      throw e;
    }
    library.replace(next);
    if (imported.battles) battle.replace(imported.battles, { persist: false });
    rosters.reset();
    battle.setLocation("view", "home");
    battle.setLocation("matchId", null);
    ui.closeData();
    ui.notify("Данные восстановлены");
  } catch (e) {
    ui.notify("Данные не восстановлены: " + e.message);
  }
}
function membership(id, slug, include) {
  const records = library.snapshot.rosters.map((r) =>
    r.id === id
      ? {
          ...r,
          characters: include
            ? [...new Set([...r.characters, slug])]
            : r.characters.filter((s) => s !== slug),
          updatedAt: new Date().toISOString(),
        }
      : r,
  );
  if (
    save({ ...library.snapshot, rosters: records }) &&
    rosters.draft?.id === id
  )
    rosters.syncMembership(
      library.snapshot.rosters.find((r) => r.id === id),
      slug,
      include,
    );
}
function createMembershipRoster(slug) {
  const name = ui.rosterName.trim();
  if (!name) return;
  const r = normalizeRoster({
    id: crypto.randomUUID(),
    name,
    affiliation: catalog.byId.get(slug).affiliations[0]?.name || "",
    characters: [slug],
    updatedAt: new Date().toISOString(),
  });
  if (
    save({ ...library.snapshot, rosters: [...library.snapshot.rosters, r] })
  ) {
    ui.setRosterName("");
    ui.notify("Ростер создан, персонаж добавлен");
  }
}
ui.configure({
  notify: ui.notify,
  scrollTop: () => window.scrollTo(0, 0),
  navigate,
  openCharacter: catalog.open,
  openCatalogCharacter: (slug) => {
    if (!catalog.byId.has(slug)) {
      ui.notify("Этой версии персонажа пока нет в каталоге.");
      return;
    }
    rosters.requestLeave(() => {
      route("catalog");
      catalog.setFilter("query", catalog.byId.get(slug).name);
      catalog.open(slug);
    });
  },
  openRoster: (id) => rosters.open(id),
  showRosterList: (keep) => route("rosters", false, !!keep),
  showBattleScreen: () => route("battle"),
  openBattleMap: map.open,
  openTournamentDraft: (row) =>
    rosters.requestLeave(() => {
      closeTransient();
      const draft = TournamentImport.draft(
        row,
        tournaments.index.characters,
        library.snapshot.owned,
        catalog.rows,
        rosters.cards,
      );
      rosters.setDraft({ ...draft, id: crypto.randomUUID() }, false, "");
      route("rosters", false, true);
    }),
  openBoxSet: (code) => {
    if (
      purchases.byCode.has(code) ||
      library.wishlist.has(code) ||
      library.bought.has(code)
    )
      purchases.select(code);
  },
  closeBoxSet: () => purchases.select(null),
  retryBoxes: async () => {
    await loadBoxes();
    library.configure({ boxes: purchases.byCode });
  },
  relatedCard: Insights.related,
  showGameCard: (kind, slug) => {
    const c = rosters.card(kind, slug);
    if (c) cardViews.showGame(c, kind);
  },
  catalogMode: (mine) => {
    ui.activate(ui.screen, mine);
  },
  showData: () => ui.setDataDialog("main"),
  pickRoster: () => ui.setMembership(true),
  membership,
  createMembershipRoster,
  export: exportData,
  readImport,
  restore,
  retry: initialize,
});
let started = false;
export async function initialize() {
  try {
    const data = await json("data/catalog.json", { cache: "no-cache" });
    data.characters.sort(
      (a, b) =>
        a.name.localeCompare(b.name, "en") ||
        String(a.alterEgo || "").localeCompare(String(b.alterEgo || ""), "en"),
    );
    catalog.load(data);
    let cardLists = { tactics: [], crises: [] },
      cardError = "";
    try {
      cardLists = await json("data/roster-cards.json");
    } catch (e) {
      cardError = e.message;
    }
    const lists = {
        tactics: latestCards(cardLists.tactics),
        crises: latestCards(cardLists.crises),
      },
      index = new Map();
    for (const kind of ["tactics", "crises"]) {
      const latest = new Map(
        lists[kind].map((c) => [c.cardFamily || c.name, c]),
      );
      for (const c of cardLists[kind])
        index.set(kind + ":" + c.slug, latest.get(c.cardFamily || c.name) || c);
    }
    await loadBoxes();
    library.configure({
      boxes: purchases.byCode,
      characters: catalog.byId,
      write: (text) => localStorage.setItem(KEY, text),
      validate: (value) => validateLibrary(value, catalog.byId),
    });
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        validateLibrary(saved, catalog.byId);
        library.replace(saved);
      } else {
        const old = localStorage.getItem("mcp-roster-atlas-collection-v1");
        if (old) {
          const saved = JSON.parse(old);
          if (
            Array.isArray(saved.owned) &&
            saved.owned.every((id) => typeof id === "string")
          )
            library.replace({
              version: 1,
              owned: saved.owned.filter((id) => catalog.byId.has(id)),
              rosters: [],
              groups: [],
            });
        }
      }
    } catch {
      ui.notify(
        "Сохранение не удалось прочитать. Исходная запись не изменена.",
      );
      library.blockWrites();
    }
    const archive = window.ROSTER_ATLAS;
    rosters.configure({
      cards: lists,
      index,
      error: cardError,
      insights: Insights.create({
        archive,
        catalog: catalog.rows,
        cardLists: lists,
        core: AtlasCore,
        resolveCard: TournamentImport.resolveCard,
      }),
      archiveAffiliations: [
        ...new Set(archive.rosters.flatMap((r) => r.affiliations)),
      ].sort((a, b) => a.localeCompare(b)),
    });
    tournaments.configure(archive, AtlasCore, CollectionCore);
    cardViews.configure({
      layout: window.MCP_CARD_LAYOUT,
      art: window.MCP_CARD_ART,
      skins: window.MCP_CARD_SKINS,
      game: window.MCP_GAME_CARD_DATA,
      conditions: Conditions.definitions,
    });
    const protocol = createPeerProtocol(
      {
        Core,
        Geometry,
        Power: Phase,
        RoomCore,
        PeerLink,
        characters: catalog.byId,
        cards: catalog.details,
        battle,
        library,
        catalog,
        ui,
      },
      peer,
    );
    peer.bind(protocol);
    window.NetworkBattle = protocol;
    battle.configure({ Core, Geometry, Phase, Summary, State }, protocol);
    battle.load();
    try {
      map.load(await json("data/map-layouts.json"));
    } catch (e) {
      map.load({ layouts: {} }, e.message);
    }
    ui.setReady(
      "Снимок " + new Date(catalog.fetchedAt).toLocaleDateString("ru-RU"),
    );
    const routes = createRoutes({
      library,
      catalog,
      purchases,
      rosters,
      tournaments,
      cardViews,
      battle,
      peer,
      map,
      ui,
    });
    navigation = new BrowserNavigation({ window, ...routes });
    navigation.start();
    reaction(
      () => ({ hash: routes.read(), prompt: rosters.dialog?.type }),
      () => navigation.schedule(),
    );
    if (!started) {
      started = true;
      installBrowserEvents();
    }
  } catch (e) {
    catalog.fail(e.message || "Проверьте соединение и попробуйте ещё раз.");
  }
}
function installBrowserEvents() {
  window.addEventListener("storage", (event) => {
    if (!event.newValue) return;
    try {
      if (event.key === KEY) {
        const value = JSON.parse(event.newValue);
        validateLibrary(value, catalog.byId);
        library.replace(value);
        rosters.externalChanged();
      } else if (event.key === "mcp-companion-battles-v1")
        battle.replace(JSON.parse(event.newValue), { persist: false });
    } catch {
      ui.notify("Из другой вкладки пришли некорректные данные.");
    }
  });
  window.addEventListener("beforeunload", (event) => {
    navigation?.saveCurrent();
    if (rosters.dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "/" &&
      !["INPUT", "TEXTAREA", "SELECT"].includes(
        document.activeElement.tagName,
      ) &&
      ui.screen === "catalog" &&
      !document.querySelector("dialog[open]")
    ) {
      event.preventDefault();
      document.getElementById("search")?.focus();
    }
  });
}
