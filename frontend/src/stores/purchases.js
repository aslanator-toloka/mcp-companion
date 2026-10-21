import { makeAutoObservable, observable, observableRef } from "mobx";
import { words } from "./catalog.js";
export class PurchaseStore {
  rows = [];
  byCode = new Map();
  error = "";
  selected = null;
  tab = "wishlist";
  query = "";
  constructor(library) {
    this.library = library;
    makeAutoObservable(
      this,
      { rows: observableRef, byCode: false, library: false },
      { autoBind: true },
    );
  }
  load(data, error = "") {
    this.rows = data.sets;
    this.byCode = new Map(this.rows.map((s) => [s.code, s]));
    this.error = error;
  }
  select(code) {
    this.selected = code;
  }
  setTab(tab) {
    this.tab = tab;
    this.query = "";
  }
  setQuery(query) {
    this.query = query;
  }
  box(code) {
    return (
      this.byCode.get(code) || {
        code,
        name: "Набор " + code,
        characters: [],
        image: null,
        missing: true,
      }
    );
  }
  get filtered() {
    const rows =
      this.tab === "all"
        ? this.rows
        : [
            ...(this.tab === "purchased"
              ? this.library.bought
              : this.library.wishlist
            ).keys(),
          ].map((code) => this.box(code));
    const terms = words(this.query);
    return rows
      .filter((s) => {
        const name = words(
          s.code +
            " " +
            s.name +
            " " +
            s.characters.map((c) => c.name).join(" "),
        );
        return terms.every((t) => name.some((w) => w.startsWith(t)));
      })
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name, "en") || a.code.localeCompare(b.code),
      );
  }
}
