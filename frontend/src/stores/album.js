import { makeAutoObservable } from "mobx";
import {
  ALBUM_PAGES,
  buildTacticsAlbum,
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
  get slots() {
    // cardIndex is not observable; `cards` is replaced together with it on load.
    if (!this.rosters.cards.tactics.length) return [];
    return buildTacticsAlbum(
      [...this.library.bought.keys()],
      (code) => this.purchases.byCode.get(code),
      (slug) => this.rosters.card("tactics", slug),
      this.catalog.rows,
    );
  }
  get pageSlots() {
    return this.slots.filter((s) => s.page === this.page);
  }
  get results() {
    return searchAlbum(this.slots, this.query);
  }
  get usedPages() {
    return this.slots.length ? this.slots[this.slots.length - 1].page : 0;
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
