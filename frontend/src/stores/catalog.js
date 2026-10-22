import {
  makeAutoObservable,
  observable,
  observableRef,
  runInAction,
} from "mobx";
import {
  defaultFilters,
  normalizeFilters,
  compactFilters,
  matchesFilters,
  sortCharacters,
  blankAttack,
} from "../catalog-filters.js";
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
  filters = defaultFilters();
  filtersOpen = false;
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
        filters: observableRef,
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
    if (name === "affiliation")
      this.filters = { ...this.filters, affiliations: [] };
    if (name === "threat")
      this.filters = { ...this.filters, minThreat: "", maxThreat: "" };
    if (name === "onlyOwned" && value)
      this.filters = { ...this.filters, missing: false };
    if (
      ["query", "affiliation", "threat", "onlyOwned", "filtersOpen"].includes(
        name,
      )
    )
      this[name] = value;
  }
  replaceFilters(value) {
    this.filters = normalizeFilters(value);
    if (this.activeFilterCount) this.filtersOpen = true;
    if (this.filters.missing) this.onlyOwned = false;
  }
  setAdvanced(name, value) {
    this.filters = normalizeFilters({
      ...this.filters,
      ...(name === "hobbyStage" && value ? { missing: false } : {}),
      [name]: value,
    });
    if (["minThreat", "maxThreat"].includes(name)) this.threat = "";
    if (name === "missing" && value) this.onlyOwned = false;
  }
  toggleAdvanced(name, value) {
    const selected = this.filters[name];
    this.setAdvanced(
      name,
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }
  toggleAffiliation(name) {
    const selected = this.selectedAffiliations;
    this.affiliation = "";
    this.setAdvanced(
      "affiliations",
      selected.includes(name)
        ? selected.filter((v) => v !== name)
        : [...selected, name],
    );
  }
  get selectedAffiliations() {
    return this.filters.affiliations.length
      ? this.filters.affiliations
      : this.affiliation
        ? [this.affiliation]
        : [];
  }
  updateAttack(id, name, value) {
    this.setAdvanced(
      "attacks",
      this.filters.attacks.map((a) =>
        a.id === id ? { ...a, [name]: value } : a,
      ),
    );
  }
  addAttack() {
    this.setAdvanced("attacks", [
      ...this.filters.attacks,
      blankAttack(Math.max(...this.filters.attacks.map((a) => a.id)) + 1),
    ]);
  }
  removeAttack(id) {
    this.setAdvanced(
      "attacks",
      this.filters.attacks.length === 1
        ? [blankAttack(id)]
        : this.filters.attacks.filter((a) => a.id !== id),
    );
  }
  get activeFilterCount() {
    return Object.entries(compactFilters(this.filters)).reduce(
      (n, [key, value]) =>
        n +
        ([
          "sort",
          "descending",
          "allAttacks",
          "allAffiliations",
          "allRoles",
        ].includes(key)
          ? 0
          : Array.isArray(value)
            ? value.length
            : 1),
      0,
    );
  }
  get tags() {
    return [...new Set(this.rows.flatMap((c) => c.tags || []))].sort();
  }
  reset(onlyOwned = false) {
    this.query = "";
    this.affiliation = "";
    this.threat = "";
    this.onlyOwned = onlyOwned;
    this.filters = defaultFilters();
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
    return sortCharacters(
      this.rows.filter((c) =>
        matchesFilters(c, this.filters, {
          query: this.query,
          affiliation: this.affiliation,
          threat: this.threat,
          onlyOwned: this.onlyOwned,
          owned:
            (this.onlyOwned ||
              this.filters.missing ||
              this.filters.hobbyStage) &&
            this.library.owned.has(c.slug),
          modelStage: this.filters.hobbyStage
            ? this.library.hobby.get(c.slug) || ""
            : "",
        }),
      ),
      this.filters,
    );
  }
  async detail(slug) {
    if (this.details.has(slug)) return this.details.get(slug);
    if (!this.requests.has(slug)) {
      const request = (async () => {
        const response = await this.fetcher(
          "data/cards/" + encodeURIComponent(slug) + ".json",
          { cache: "no-cache" },
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
