import { makeAutoObservable, observable, observableRef } from "mobx";
export class TournamentStore {
  data = null;
  index = null;
  core = null;
  collectionCore = null;
  selected = null;
  selectedPlayer = null;
  collectionMode = false;
  playerMode = false;
  affiliations = observable.set();
  affiliationSort = "points";
  characterQuery = "";
  characterSort = "points";
  onlyUsed = false;
  resultQuery = "";
  resultSort = "recent";
  limit = 20;
  playerQuery = "";
  playerSort = "points";
  playerAffiliation = "";
  playerCountry = "";
  playerLimit = 60;
  dialog = null;
  constructor(library, ui) {
    this.library = library;
    this.ui = ui;
    makeAutoObservable(
      this,
      {
        data: observableRef,
        index: false,
        core: false,
        collectionCore: false,
        library: false,
        ui: false,
      },
      { autoBind: true },
    );
  }
  configure(data, core, collectionCore) {
    this.index = core.createIndex(data);
    this.core = core;
    this.collectionCore = collectionCore;
    this.data = data;
    this.applyRoute(new URLSearchParams(location.hash.slice(1)));
  }
  get allPlayers() {
    return this.data ? this.core.playerList(this.index, "", "name") : [];
  }
  get playersById() {
    return new Map(this.allPlayers.map((p) => [p.id, p]));
  }
  get affiliationNames() {
    return this.data
      ? [...new Set(this.data.rosters.flatMap((r) => r.affiliations))].sort(
          (a, b) => a.localeCompare(b),
        )
      : [];
  }
  get selectedAffiliations() {
    return this.affiliationNames.filter((a) => this.affiliations.has(a));
  }
  get affiliationRows() {
    return this.data
      ? this.core.affiliationList(this.index, this.affiliationSort)
      : [];
  }
  get scopedCharacters() {
    return this.data
      ? this.core.scopedCharacters(
          this.data,
          this.index,
          [...this.affiliations],
          this.selectedPlayer,
        )
      : [];
  }
  get characterRows() {
    return this.data
      ? this.core.characterList(
          { characters: this.scopedCharacters },
          this.characterQuery,
          this.onlyUsed,
          this.characterSort,
        )
      : [];
  }
  get playerRows() {
    return this.data
      ? this.core.playerList(
          this.index,
          this.playerQuery,
          this.playerSort,
          this.playerAffiliation,
          this.playerCountry,
        )
      : [];
  }
  get countries() {
    const countries = new Map();
    for (const p of this.allPlayers)
      if (p.countryCode) {
        const c = countries.get(p.countryCode) || { name: p.country, count: 0 };
        c.count++;
        countries.set(p.countryCode, c);
      }
    return [...countries].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }
  get owned() {
    return new Set(this.library.owned.keys());
  }
  availability(row) {
    return this.collectionCore.availability(
      row,
      this.index.characters,
      this.owned,
    );
  }
  get readyRows() {
    return this.data
      ? this.data.rosters.filter((r) => this.availability(r).ready)
      : [];
  }
  get rosterRows() {
    if (!this.data) return [];
    const rows = this.core.rosterList(
      this.index,
      this.collectionMode || this.playerMode ? null : this.selected,
      this.resultQuery,
      this.resultSort,
      [...this.affiliations],
      this.selectedPlayer,
    );
    return this.collectionMode
      ? rows.filter((r) => this.availability(r).ready)
      : rows;
  }
  get total() {
    if (!this.data) return 0;
    const rows = this.collectionMode
      ? this.readyRows
      : this.playerMode
        ? this.data.rosters
        : this.index.byCharacter.get(this.selected) || [];
    return this.core.scopeRows(rows, [], this.selectedPlayer).length;
  }
  get overview() {
    if (!this.data) return null;
    const affiliations = [...this.affiliations],
      common = {
        affiliations,
        playerName: this.selectedPlayer
          ? this.playersById.get(this.selectedPlayer).name
          : null,
      };
    if (this.collectionMode) {
      const rows = this.core.scopeRows(
        this.readyRows,
        affiliations,
        this.selectedPlayer,
      );
      return {
        ...common,
        mode: "collection",
        available: {
          count: rows.length,
          events: new Set(rows.map((r) => r.eventId)).size,
          players: new Set(rows.map((r) => r.playerId)).size,
        },
      };
    }
    if (this.playerMode && this.selectedPlayer !== null)
      return {
        ...common,
        mode: "player",
        stats: this.core.playerStats(
          this.index,
          this.selectedPlayer,
          affiliations,
        ),
        profileAffiliations: this.playersById.get(this.selectedPlayer)
          .affiliationCounts,
      };
    const scope = this.core.scopeRows(
        this.data.rosters,
        affiliations,
        this.selectedPlayer,
      ),
      character = this.index.characters.get(this.selected),
      stats = this.core.statistics(
        this.index,
        this.selected,
        scope.length,
        affiliations,
        this.selectedPlayer,
      ),
      ids = character.inventoryIds || [character.id];
    return {
      ...common,
      mode: "character",
      character,
      stats,
      inventorySlug: ids.find((id) => this.library.owned.has(id)) || ids[0],
      ownership: this.library.status(ids),
      peers: stats.peers.map(([id, count]) => ({
        id,
        count,
        name: this.index.characters.get(id).name,
      })),
    };
  }
  body(row) {
    const entries =
        row.kind === "encoded"
          ? row.characters
          : row.characterIds.map((id) => ({ id, gems: [] })),
      statuses = row.kind === "encoded" ? this.availability(row).entries : null;
    return {
      row,
      selected: this.selected,
      hasCollection: true,
      characters: entries.map((entry, i) => {
        const info = this.index.characters.get(entry.id),
          ids = info?.inventoryIds || [entry.id];
        return {
          entry,
          info,
          inventorySlug: ids.find((id) => this.library.owned.has(id)) || ids[0],
          status: this.library.status(ids, statuses?.[i]?.owned),
        };
      }),
    };
  }
  setField(name, value) {
    this[name] = value;
    if (name.startsWith("player")) this.playerLimit = 60;
    if (["resultQuery", "resultSort"].includes(name)) this.limit = 20;
  }
  toggleAffiliation(name, include) {
    include ? this.affiliations.add(name) : this.affiliations.delete(name);
    this.limit = 20;
  }
  clearAffiliations() {
    this.affiliations.clear();
    this.limit = 20;
  }
  openDialog(dialog) {
    this.dialog = dialog;
  }
  closeDialog() {
    this.dialog = null;
  }
  morePlayers() {
    this.playerLimit += 60;
  }
  moreRosters() {
    this.limit += 20;
  }
  choosePlayer(id, allRosters = false) {
    this.selectedPlayer =
      id !== null && this.playersById.has(String(id)) ? String(id) : null;
    if (allRosters) this.collectionMode = false;
    this.playerMode = this.selectedPlayer !== null && !this.collectionMode;
    this.limit = 20;
    if (this.selectedPlayer !== null || allRosters) this.resultQuery = "";
    this.updateRoute();
  }
  chooseCharacter(id, clearSearch = false) {
    if (!this.index.characters.has(id)) return;
    this.selected = id;
    this.limit = 20;
    this.resultQuery = "";
    this.collectionMode = false;
    this.playerMode = false;
    if (clearSearch) this.characterQuery = "";
    this.updateRoute();
  }
  chooseCollection() {
    this.collectionMode = true;
    this.playerMode = false;
    this.limit = 20;
    this.resultQuery = "";
    this.updateRoute();
  }
  updateRoute() {
    const params = new URLSearchParams();
    if (this.collectionMode) params.set("collection", "ready");
    else if (!this.playerMode) params.set("character", this.selected);
    if (this.selectedPlayer !== null) params.set("player", this.selectedPlayer);
    history.replaceState(null, "", "#" + params.toString());
  }
  applyRoute(params) {
    if (!this.data) return;
    this.selectedPlayer = this.playersById.has(params.get("player"))
      ? params.get("player")
      : null;
    this.collectionMode = params.get("collection") === "ready";
    this.playerMode =
      this.selectedPlayer !== null &&
      !this.collectionMode &&
      !params.has("character");
    const id = params.get("character");
    this.selected = this.index.characters.has(id)
      ? id
      : this.core.characterList(this.data)[0].id;
    this.limit = 20;
  }
  async share() {
    try {
      await navigator.clipboard.writeText(location.href);
      this.ui.notify("Ссылка на персонажа скопирована");
    } catch {
      this.ui.notify("Ссылка на персонажа находится в адресной строке");
    }
  }
}
