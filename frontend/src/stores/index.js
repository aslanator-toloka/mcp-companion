import { configure } from "mobx";
import { LibraryStore } from "./library.js";
import { CatalogStore } from "./catalog.js";
import { PurchaseStore } from "./purchases.js";
import { RosterStore } from "./rosters.js";
import { TournamentStore } from "./tournaments.js";
import { CardStore } from "./cards.js";
import { BattleStore } from "./battle.js";
import { PeerSessionStore } from "./peer.js";
import { MapStore } from "./map.js";
import { UIStore } from "./ui.js";
configure({ enforceActions: "always" });
export const library = new LibraryStore();
export const catalog = new CatalogStore(library);
export const purchases = new PurchaseStore(library);
export const ui = new UIStore(window.localStorage);
export const rosters = new RosterStore(library, catalog, ui);
export const tournaments = new TournamentStore(library, ui);
export const cardViews = new CardStore(window.localStorage);
export const battle = new BattleStore(
  library,
  catalog,
  rosters,
  ui,
  cardViews,
  window.localStorage,
);
export const peer = new PeerSessionStore(ui);
export const map = new MapStore(battle, catalog, ui);
export const actions = new Proxy(
  {},
  {
    get:
      (_, key) =>
      (...args) =>
        ui.actions[key]?.(...args),
  },
);
window.MCPStores = {
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
};
