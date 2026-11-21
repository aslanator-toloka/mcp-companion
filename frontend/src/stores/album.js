import { makeAutoObservable, observableRef } from "mobx";
import {
  ALBUM_PAGES,
  ALBUM_POCKETS,
  collectTactics,
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
      {
        library: false,
        purchases: false,
        rosters: false,
        catalog: false,
        data: observableRef,
      },
      { autoBind: true },
    );
  }
  /** data/tactics-album.json: the binder's boxes, loose cards and frozen pocket order. */
  data = null;
  error = "";
  load(data, error = "") {
    this.data = data;
    this.error = error;
  }
  get layout() {
    // cardIndex is not observable; `cards` is replaced together with it on load.
    if (!this.data || !this.rosters.cards.tactics.length)
      return { slots: [], order: [], added: [] };
    return numberAlbum(
      collectTactics(
        this.data.sets || [],
        (code) => this.purchases.byCode.get(code),
        (slug) => this.rosters.card("tactics", slug),
        this.catalog.rows,
        this.data.loose || [],
      ),
      this.data.order || [],
    );
  }
  get slots() {
    return this.layout.slots;
  }
  get pageSlots() {
    return this.slots.filter((s) => s.page === this.page);
  }
  get results() {
    return searchAlbum(this.slots, this.query);
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
