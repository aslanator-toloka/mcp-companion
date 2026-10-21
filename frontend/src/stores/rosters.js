import { makeAutoObservable, observableRef } from "mobx";
import { words } from "./catalog.js";
export const normalizeRoster = (r) => ({
  ...r,
  affiliation: r.affiliation || "",
  characters: [...r.characters],
  tactics: [...(r.tactics || [])],
  crises: [...(r.crises || [])],
  groups: [...(r.groups || [])],
});
export const cardStatus = (c) =>
  ({
    legal: "Standard: доступна",
    restricted: "Standard: Restricted",
    banned: "Standard: запрещена",
    rotated: "Вне Standard",
  })[c?.standardTimelineStatus] || "Статус не указан";
export class RosterStore {
  draft = null;
  base = "";
  wasSaved = false;
  conflict = false;
  tab = "characters";
  error = "";
  filters = { query: "", affiliation: "", group: "", owned: false };
  picker = null;
  dialog = null;
  leave = null;
  cards = { tactics: [], crises: [] };
  cardIndex = new Map();
  cardError = "";
  insights = null;
  archiveAffiliations = [];
  constructor(library, catalog, ui) {
    this.library = library;
    this.catalog = catalog;
    this.ui = ui;
    makeAutoObservable(
      this,
      {
        library: false,
        catalog: false,
        ui: false,
        cards: observableRef,
        cardIndex: false,
        insights: false,
        archiveAffiliations: observableRef,
        leave: false,
      },
      { autoBind: true },
    );
  }
  configure({ cards, index, error, insights, archiveAffiliations }) {
    this.cards = cards;
    this.cardIndex = index;
    this.cardError = error;
    this.insights = insights;
    this.archiveAffiliations = archiveAffiliations;
  }
  card(kind, slug) {
    return this.cardIndex.get(kind + ":" + slug);
  }
  canonical(kind, slug) {
    return this.card(kind, slug)?.slug || slug;
  }
  get dirty() {
    return !!this.draft && JSON.stringify(this.draft) !== this.base;
  }
  get records() {
    return this.library.snapshot.rosters;
  }
  get groups() {
    return this.library.snapshot.groups;
  }
  get affiliations() {
    return this.catalog.affiliations;
  }
  get visible() {
    return this.records
      .filter(
        (r) =>
          words(this.filters.query).every((q) =>
            words(r.name).some((w) => w.startsWith(q)),
          ) &&
          (!this.filters.affiliation ||
            r.affiliation === this.filters.affiliation) &&
          (!this.filters.group ||
            (this.filters.group === "__none__"
              ? !r.groups.length
              : r.groups.includes(this.filters.group))) &&
          (!this.filters.owned || (r.characters.length && !this.missing(r))),
      )
      .slice()
      .sort(
        (a, b) =>
          String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) ||
          a.name.localeCompare(b.name),
      );
  }
  missing(r) {
    return [...new Set(r.characters)].filter(
      (slug) => !this.library.owned.has(slug),
    ).length;
  }
  crisisCount(r, type) {
    return r.crises.filter((slug) => this.card("crises", slug)?.type === type)
      .length;
  }
  setFilter(name, value) {
    this.filters[name] = value;
  }
  resetFilters() {
    this.filters = { query: "", affiliation: "", group: "", owned: false };
  }
  reset() {
    this.draft = null;
    this.conflict = false;
    this.picker = null;
    this.resetFilters();
  }
  setField(name, value) {
    if (!this.draft) return;
    this.draft[name] = value;
    this.error = "";
  }
  setGroup(id, include) {
    if (this.draft)
      this.draft.groups = include
        ? [...new Set([...this.draft.groups, id])]
        : this.draft.groups.filter((g) => g !== id);
  }
  setTab(tab) {
    this.tab = tab;
  }
  requestLeave(next) {
    if (!this.dirty) {
      next();
      return;
    }
    this.leave = next;
    this.dialog = {
      type: "leave",
      title: "Есть несохранённые изменения",
      description: "Сохраните ростер или выйдите без сохранения.",
    };
  }
  navigate() {
    this.requestLeave(() => {
      this.draft = null;
      this.ui.actions.showRosterList();
    });
  }
  open(id) {
    this.requestLeave(() => {
      const r = id ? this.records.find((r) => r.id === id) : null;
      if (id && !r) {
        this.ui.notify("Ростер больше не существует.");
        return;
      }
      this.setDraft(
        r || { id: crypto.randomUUID(), name: "", characters: [] },
        !!r,
      );
      this.ui.actions.showRosterList(true);
    });
  }
  setDraft(r, saved = false, base = null) {
    this.draft = normalizeRoster(r);
    this.base = base ?? JSON.stringify(this.draft);
    this.wasSaved = saved;
    this.conflict = false;
    this.tab = "characters";
    this.error = "";
  }
  externalChanged() {
    if (!this.draft) return;
    const saved = this.records.find((r) => r.id === this.draft.id);
    if (
      (saved && JSON.stringify(normalizeRoster(saved)) !== this.base) ||
      (!saved && this.wasSaved)
    )
      this.conflict = true;
  }
  save(force = false) {
    if (!this.draft) return false;
    if (!this.draft.name.trim()) {
      this.error = "Дайте ростеру название.";
      return false;
    }
    if (this.conflict && !force) {
      this.dialog = {
        type: "conflict",
        title: "Ростер изменён в другой вкладке",
        description:
          "Можно открыть актуальную версию или сохранить ваши правки поверх неё.",
      };
      return false;
    }
    const saved = normalizeRoster({
        ...this.draft,
        name: this.draft.name.trim(),
        updatedAt: new Date().toISOString(),
      }),
      records = this.records.slice(),
      index = records.findIndex((r) => r.id === saved.id);
    if (index < 0) records.unshift(saved);
    else records[index] = saved;
    if (!this.library.commit({ ...this.library.snapshot, rosters: records })) {
      this.ui.notify(this.library.error);
      return false;
    }
    this.draft = null;
    this.conflict = false;
    this.ui.notify("Ростер сохранён");
    return true;
  }
  duplicate(id) {
    const r = this.records.find((r) => r.id === id);
    if (!r) return;
    this.requestLeave(() => {
      const copy = normalizeRoster({
        ...r,
        id: crypto.randomUUID(),
        name: r.name + " · копия",
        updatedAt: new Date().toISOString(),
      });
      if (
        !this.library.commit({
          ...this.library.snapshot,
          rosters: [copy, ...this.records],
        })
      ) {
        this.ui.notify(this.library.error);
        return;
      }
      this.setDraft(copy, true);
      this.ui.actions.showRosterList(true);
      this.ui.notify("Копия ростера создана");
    });
  }
  remove(id) {
    const r = this.records.find((r) => r.id === id);
    if (r)
      this.dialog = {
        type: "delete",
        id,
        title: "Удалить ростер?",
        description:
          r.name + " будет удалён. Коллекция и остальные ростеры останутся.",
      };
  }
  confirmRemove(id) {
    if (
      !this.library.commit({
        ...this.library.snapshot,
        rosters: this.records.filter((r) => r.id !== id),
      })
    ) {
      this.ui.notify(this.library.error);
      return;
    }
    this.draft = null;
    this.dialog = null;
    this.ui.actions.showRosterList();
    this.ui.notify("Ростер удалён");
  }
  openPicker(kind = this.tab, relatedTo = null) {
    this.picker = {
      kind,
      query: "",
      affiliation: "",
      owned: false,
      type: "",
      available: false,
      challenger: kind === "crises",
      sort: kind === "characters" ? "name" : "popularity",
      statsAffiliation: "",
      statsCharacter: relatedTo || "",
      relatedTo,
      relatedOnly: !!relatedTo,
    };
  }
  closePicker() {
    this.picker = null;
  }
  setPicker(name, value) {
    if (!this.picker) return;
    this.picker[name] = value;
    if (name === "relatedTo") this.picker.relatedOnly = !!value;
  }
  choose(kind, slug, include) {
    if (!this.draft) return;
    this.draft[kind] = include
      ? [...new Set([...this.draft[kind], slug])]
      : this.draft[kind].filter((s) =>
          kind === "characters" ? s !== slug : this.canonical(kind, s) !== slug,
        );
  }
  removeItem(kind, slug) {
    this.choose(kind, slug, false);
  }
  get coverage() {
    const p = this.picker;
    return p && p.kind !== "characters"
      ? this.insights?.statistics(p.kind, {
          affiliation: p.statsAffiliation,
          character: p.statsCharacter,
        })
      : null;
  }
  get pickerItems() {
    const p = this.picker;
    if (!p || !this.draft) return [];
    const kind = p.kind,
      coverage = this.coverage;
    let rows = (
      kind === "characters"
        ? this.catalog.rows.filter((c) => !c.isGrunt)
        : this.cards[kind]
    ).filter(
      (c) =>
        words(p.query).every((q) =>
          words(c.name + " " + (c.alterEgo || "")).some((w) => w.startsWith(q)),
        ) &&
        (!p.affiliation ||
          (kind === "characters"
            ? c.affiliations.some((a) => a.name === p.affiliation)
            : c.affiliation?.name === p.affiliation)) &&
        (!p.owned || this.library.owned.has(c.slug)) &&
        (!p.type || c.type === p.type) &&
        (!p.available ||
          ["legal", "restricted"].includes(c.standardTimelineStatus)) &&
        (!p.challenger || c.challengerStatus === "legal") &&
        (!p.relatedOnly ||
          this.ui.actions.relatedCard(c, this.catalog.byId.get(p.relatedTo))),
    );
    if (kind !== "characters")
      rows = rows.slice().sort((a, b) => {
        const av = coverage?.cards.get(a.slug),
          bv = coverage?.cards.get(b.slug),
          metric =
            p.sort === "points"
              ? "points"
              : p.sort === "average"
                ? "average"
                : "share";
        return (
          (p.sort === "name" ? 0 : (bv?.[metric] || 0) - (av?.[metric] || 0)) ||
          a.name.localeCompare(b.name, "en") ||
          a.slug.localeCompare(b.slug)
        );
      });
    return rows.map((c) => ({
      card: c,
      chosen: this.draft[kind].some((s) =>
        kind === "characters"
          ? s === c.slug
          : this.canonical(kind, s) === c.slug,
      ),
      stats: coverage?.cards.get(c.slug),
      owners: kind === "tactics" ? this.insights?.owners(c.slug) || [] : [],
      status:
        kind === "characters" ? this.library.status(c.slug) : cardStatus(c),
    }));
  }
  get notes() {
    const r = this.draft;
    if (!r) return [];
    const notes = [];
    if (r.tournamentSource) {
      const s = r.tournamentSource;
      if (s.incomplete)
        notes.push(
          "Оригинальный список распознан не полностью. Сверьте состав с источником.",
        );
      if (s.unresolved?.length)
        notes.push("Не удалось перенести: " + s.unresolved.join("; ") + ".");
      if (s.gems?.length)
        notes.push(
          "Камни из оригинала: " +
            s.gems.map((c) => c.name + ": " + c.gems.join(", ")).join("; ") +
            ". Сохранены в данных источника.",
        );
    }
    if (
      r.characters.length > 10 ||
      r.tactics.length > 10 ||
      this.crisisCount(r, "Secure") > 5 ||
      this.crisisCount(r, "Extraction") > 5
    )
      notes.push("В составе больше позиций, чем в обычном ростере.");
    const restricted = r.tactics
      .map((s) => this.card("tactics", s))
      .filter((c) => c?.standardTimelineStatus === "restricted");
    if (restricted.length)
      notes.push(
        "Restricted тактики: " +
          restricted.map((c) => c.name).join(", ") +
          ". Проверьте ограничения выбранного формата.",
      );
    for (const kind of ["tactics", "crises"]) {
      const bad = r[kind]
        .map((s) => this.card(kind, s))
        .filter(
          (c) =>
            c && !["legal", "restricted"].includes(c.standardTimelineStatus),
        );
      if (bad.length)
        notes.push(
          (kind === "tactics" ? "Тактики" : "Кризисы") +
            " вне Standard: " +
            bad.map((c) => c.name).join(", ") +
            ".",
        );
    }
    return notes;
  }
  showGroups() {
    this.dialog = {
      type: "groups",
      title: "Группы ростеров",
      description: "Один ростер может быть в нескольких группах.",
    };
  }
  groupForm(id) {
    const g = this.groups.find((g) => g.id === id);
    this.dialog = {
      type: "group",
      id,
      name: g?.name || "",
      title: g ? "Переименовать группу" : "Новая группа",
      description: "Например: турнир, тесты или любимые составы.",
    };
  }
  editGroupName(name) {
    if (this.dialog) this.dialog.name = name;
  }
  saveGroup() {
    const { id } = this.dialog,
      name = this.dialog.name.trim();
    if (!name) return;
    if (
      this.groups.some(
        (g) => g.id !== id && words(g.name).join(" ") === words(name).join(" "),
      )
    ) {
      this.ui.notify("Группа с таким названием уже есть.");
      return;
    }
    const group = { id: id || crypto.randomUUID(), name };
    const groups = id
      ? this.groups.map((g) => (g.id === id ? group : g))
      : [...this.groups, group];
    if (!this.library.commit({ ...this.library.snapshot, groups })) {
      this.ui.notify(this.library.error);
      return;
    }
    if (!id && this.draft) this.setGroup(group.id, true);
    this.dialog = null;
    this.ui.notify(id ? "Группа переименована" : "Группа создана");
  }
  removeGroup(id) {
    const g = this.groups.find((g) => g.id === id);
    if (g)
      this.dialog = {
        type: "delete-group",
        id,
        title: "Удалить группу?",
        description:
          g.name + ". Ростеры останутся; у них исчезнет только эта метка.",
      };
  }
  confirmRemoveGroup(id) {
    const next = {
      ...this.library.snapshot,
      groups: this.groups.filter((g) => g.id !== id),
      rosters: this.records.map((r) => ({
        ...r,
        groups: r.groups.filter((g) => g !== id),
      })),
    };
    if (!this.library.commit(next)) {
      this.ui.notify(this.library.error);
      return;
    }
    if (this.draft) this.setGroup(id, false);
    if (this.filters.group === id) this.filters.group = "";
    this.showGroups();
  }
  closeDialog() {
    this.dialog = null;
    this.leave = null;
  }
  leaveWith(save) {
    if (save && !this.save()) return;
    if (!save) this.draft = null;
    const next = this.leave;
    this.dialog = null;
    this.leave = null;
    next?.();
  }
  forceSave() {
    if (!this.save(true)) return;
    const next = this.leave;
    this.dialog = null;
    this.leave = null;
    if (next) next();
    else this.ui.actions.showRosterList();
  }
  reloadDraft() {
    const id = this.draft.id;
    this.draft = null;
    this.closeDialog();
    this.open(id);
  }
}
