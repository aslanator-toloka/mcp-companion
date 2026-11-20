import { makeAutoObservable } from "mobx";
import {
  ALBUM_PAGES,
  ALBUM_POCKETS,
  collectTactics,
  matchesQuery,
  numberAlbum,
  searchAlbum,
} from "../tactics-album.js";
export class AlbumStore {
  page = 1;
  query = "";
  highlight = null;
  constructor(library, purchases, rosters, catalog) {
    this.library = library;
    this.purchases = purchases;
    this.rosters = rosters;
    this.catalog = catalog;
    makeAutoObservable(
      this,
      { library: false, purchases: false, rosters: false, catalog: false },
      { autoBind: true },
    );
  }
  collect(includeManual = true) {
    return collectTactics(
      [...this.library.bought.keys()],
      (code) => {
        const set = this.purchases.byCode.get(code);
        return includeManual || !set?.manualTactics ? set : null;
      },
      (slug) => this.rosters.card("tactics", slug),
      this.catalog.rows,
      includeManual ? this.library.looseTactics : [],
    );
  }
  get layout() {
    // cardIndex is not observable; `cards` is replaced together with it on load.
    if (!this.rosters.cards.tactics.length)
      return { slots: [], order: this.library.albumOrder, added: [] };
    // Hand-entered box contents arrived after album numbers existed: never let them reshuffle a first layout.
    const order = this.library.albumOrder.length
      ? this.library.albumOrder
      : numberAlbum(this.collect(false)).order;
    return numberAlbum(this.collect(), order);
  }
  get slots() {
    return this.layout.slots;
  }
  /** Cards that have no saved pocket yet; bootstrap persists them at the end. */
  get added() {
    // With no saved order yet, the whole first layout must be saved, not only new cards.
    return this.library.albumOrder.length
      ? this.layout.added
      : this.layout.order;
  }
  get pageSlots() {
    return this.slots.filter((s) => s.page === this.page);
  }
  get results() {
    return searchAlbum(this.slots, this.query);
  }
  /** Cards matching the search that are not in the album yet and can be added by hand. */
  get addable() {
    if (!this.query.trim()) return [];
    const inAlbum = new Set(this.slots.map((s) => s.key));
    return this.rosters.cards.tactics
      .filter(
        (c) =>
          !inAlbum.has(c.cardFamily || c.slug) &&
          matchesQuery(c.name, this.query),
      )
      .slice(0, 12);
  }
  addLoose(slug) {
    if (!this.library.setLooseTactic(slug, true)) return false;
    const slot = this.slots.find((s) => s.slug === slug && s.loose);
    if (slot) this.jump(slot.number);
    return true;
  }
  get usedPages() {
    return Math.ceil(this.layout.order.length / ALBUM_POCKETS);
  }
  get lastPage() {
    return Math.max(ALBUM_PAGES, this.usedPages);
  }
  setPage(page) {
    this.page = Math.min(this.lastPage, Math.max(1, Number(page) || 1));
    this.highlight = null;
  }
  setQuery(query) {
    this.query = query;
  }
  jump(number) {
    const slot = this.slots.find((s) => s.number === number);
    if (!slot) return;
    this.query = "";
    this.page = slot.page;
    this.highlight = number;
  }
}
