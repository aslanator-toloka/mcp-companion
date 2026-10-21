import {
  makeAutoObservable,
  observable,
  observableRef,
  runInAction,
} from "mobx";
export const words = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
export class CatalogStore {
  selected = null;
  selectedForm = 0;
  selectedSide = "front";
  detailError = "";
  rows = [];
  byId = new Map();
  fetchedAt = "";
  ready = false;
  error = "";
  query = "";
  affiliation = "";
  threat = "";
  onlyOwned = false;
  details = observable.map({}, { deep: false });
  requests = new Map();
  constructor(library, fetcher = (...args) => fetch(...args)) {
    this.library = library;
    this.fetcher = fetcher;
    makeAutoObservable(
      this,
      {
        rows: observableRef,
        byId: false,
        library: false,
        fetcher: false,
        requests: false,
      },
      { autoBind: true },
    );
  }
  load(data) {
    this.rows = data.characters;
    this.byId.clear();
    for (const c of this.rows) this.byId.set(c.slug, c);
    this.fetchedAt = data.fetchedAt;
    this.ready = true;
    this.error = "";
  }
  async open(slug, reset = true) {
    if (!this.byId.has(slug)) return;
    this.selected = slug;
    if (reset) {
      this.selectedForm = 0;
      this.selectedSide = "front";
    }
    this.detailError = "";
    try {
      await this.detail(slug);
    } catch (e) {
      runInAction(() => {
        if (this.selected === slug) this.detailError = e.message;
      });
    }
  }
  close() {
    this.selected = null;
  }
  selectFace(field, value) {
    if (field === "form") {
      this.selectedForm = value;
      this.selectedSide = "front";
    } else this.selectedSide = value;
  }
  retryDetail() {
    const slug = this.selected;
    if (slug) {
      this.details.delete(slug);
      this.open(slug, false);
    }
  }
  fail(error) {
    this.error = error;
    this.ready = false;
  }
  setFilter(name, value) {
    if (["query", "affiliation", "threat", "onlyOwned"].includes(name))
      this[name] = value;
  }
  reset(onlyOwned = false) {
    this.query = "";
    this.affiliation = "";
    this.threat = "";
    this.onlyOwned = onlyOwned;
  }
  get affiliations() {
    return [
      ...new Set(this.rows.flatMap((c) => c.affiliations.map((a) => a.name))),
    ].sort();
  }
  get threats() {
    return [
      ...new Set(this.rows.map((c) => c.threatLevel).filter((n) => n != null)),
    ].sort((a, b) => a - b);
  }
  get filtered() {
    const query = words(this.query);
    return this.rows.filter((c) => {
      const name = words(c.name + " " + (c.alterEgo || ""));
      return (
        query.every((q) => name.some((w) => w.startsWith(q))) &&
        (!this.affiliation ||
          c.affiliations.some((a) => a.name === this.affiliation)) &&
        (!this.threat || String(c.threatLevel) === this.threat) &&
        (!this.onlyOwned || this.library.owned.has(c.slug))
      );
    });
  }
  async detail(slug) {
    if (this.details.has(slug)) return this.details.get(slug);
    if (!this.requests.has(slug)) {
      const request = (async () => {
        const response = await this.fetcher(
          "data/cards/" + encodeURIComponent(slug) + ".json",
        );
        if (!response.ok) throw Error("Полная карта недоступна.");
        const detail = await response.json();
        runInAction(() => this.details.set(slug, detail));
        return detail;
      })().finally(() => this.requests.delete(slug));
      this.requests.set(slug, request);
    }
    return this.requests.get(slug);
  }
}
