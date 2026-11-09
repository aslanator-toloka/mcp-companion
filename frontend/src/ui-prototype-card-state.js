// Native card components, isolated from production storage and initialization.
import { LibraryStore } from "./stores/library.js";
import { CatalogStore } from "./stores/catalog.js";
import { CardStore } from "./stores/cards.js";

const memory = new Map();
export const catalog = new CatalogStore(new LibraryStore());
export const cardViews = new CardStore({
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
});
cardViews.configure({
  layout: window.MCP_CARD_LAYOUT,
  art: window.MCP_CARD_ART,
  skins: {},
  conditions: window.MCPCardConditions?.definitions || {},
});
