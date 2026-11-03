import { makeAutoObservable, observableRef, runInAction } from "mobx";
import {
  createPhotoCatalog,
  findPhotoCards,
  mergePhotoCards,
  searchPhotoCatalog,
  PHOTO_KINDS,
} from "./matching.js";
import { PhotoRecognizer, PHOTO_LIMIT } from "./recognizer.js";
import {
  photoTargetState,
  photoCardProblem,
  validatePhotoSelection,
  applyPhotoSelection,
} from "./application.js";
export class PhotoImportStore {
  target = null;
  photos = [];
  rows = [];
  busy = false;
  applying = false;
  progress = 0;
  stage = "";
  error = "";
  query = "";
  manualText = "";
  manualOpen = false;
  activePhoto = null;
  session = 0;
  decision = 0;
  index = null;
  constructor(deps, recognizer = new PhotoRecognizer()) {
    this.deps = deps;
    this.recognizer = recognizer;
    makeAutoObservable(
      this,
      {
        deps: false,
        recognizer: false,
        index: false,
        session: false,
        decision: false,
        target: observableRef,
        photos: observableRef,
        rows: observableRef,
      },
      { autoBind: true },
    );
  }
  get native() {
    return this.recognizer.native;
  }
  get state() {
    return photoTargetState(this.deps, this.target);
  }
  openRoster(kind) {
    if (!this.deps.rosters.draft) return;
    this.open({
      type: "roster",
      kind: kind || this.deps.rosters.tab,
      id: this.deps.rosters.draft.id,
    });
  }
  openBattle(side, kind, mission = null) {
    if (!this.deps.battle.current) return;
    this.open({
      type: "battle",
      kind,
      side,
      mission,
      id: this.deps.battle.current.id,
    });
  }
  open(target) {
    if (!PHOTO_KINDS.includes(target.kind) || this.applying) return;
    this.close();
    this.target = Object.freeze(target);
    const { catalog, rosters } = this.deps;
    this.index = createPhotoCatalog({
      characters: catalog.rows,
      ...rosters.cards,
    });
  }
  close() {
    if (this.applying) return false;
    this.session++;
    this.target = null;
    this.recognizer.cancel();
    this.recognizer.release(this.photos);
    this.photos = [];
    this.rows = [];
    this.busy = false;
    this.progress = 0;
    this.stage = "";
    this.error = "";
    this.query = "";
    this.manualText = "";
    this.manualOpen = false;
    this.activePhoto = null;
    return true;
  }
  get selected() {
    const unique = new Map();
    for (const r of this.rows)
      if (r.checked && r.slug && !this.problem(r)) unique.set(r.slug, r);
    return [...unique.values()];
  }
  get pendingCount() {
    return this.selected.filter((r) => !this.state.existing?.has(r.slug))
      .length;
  }
  get uncertainCount() {
    return this.rows.filter((r) => !r.exact || r.ambiguous).length;
  }
  get selectionProblem() {
    if (!this.target) return "";
    try {
      validatePhotoSelection(
        this.deps,
        this.target,
        this.selected.map((r) => r.slug),
      );
      return "";
    } catch (e) {
      return e.message;
    }
  }
  get missionChanges() {
    if (
      this.target?.type !== "battle" ||
      this.target.kind !== "crises" ||
      !this.state.match
    )
      return [];
    return this.selected.flatMap((r) => {
      const card = this.deps.rosters.card("crises", r.slug),
        old = this.state.match[card.type === "Secure" ? "secure" : "extract"];
      return old && this.deps.rosters.canonical("crises", old.slug) !== r.slug
        ? [`${old.name} → ${card.name}`]
        : [];
    });
  }
  entry(row) {
    return this.index?.byKey.get(`${this.target?.kind}:${row.slug}`);
  }
  problem(row) {
    const card = this.entry(row);
    return card
      ? photoCardProblem(this.state, this.target, card)
      : row.slug
        ? "Карта больше не доступна"
        : "Выберите подходящую карту";
  }
  existing(row) {
    return !!row.slug && !!this.state.existing?.has(row.slug);
  }
  setQuery(value) {
    this.query = value;
  }
  setManualText(value) {
    this.manualText = value;
  }
  toggleManual() {
    this.manualOpen = !this.manualOpen;
  }
  get suggestions() {
    return this.index && this.target
      ? searchPhotoCatalog(this.index, this.target.kind, this.query)
      : [];
  }
  chooseRow(key, slug) {
    const card = this.index?.byKey.get(`${this.target.kind}:${slug}`);
    if (!card) return;
    this.rows = this.rows.map((r) =>
      r.key === key
        ? {
            ...r,
            slug,
            name: card.name,
            checked: true,
            touched: true,
            decision: ++this.decision,
            ambiguous: false,
          }
        : r,
    );
    this.rows = mergePhotoCards([], this.rows);
    this.enforceMissionChoice(key);
  }
  toggleRow(key, checked) {
    this.rows = this.rows.map((r) =>
      r.key === key
        ? { ...r, checked, touched: true, decision: ++this.decision }
        : r,
    );
    if (checked) this.enforceMissionChoice(key);
  }
  enforceMissionChoice(key) {
    if (this.target.type !== "battle" || this.target.kind !== "crises") return;
    const selected = this.rows.find((r) => r.key === key),
      type = this.entry(selected || {})?.type;
    this.rows = this.rows.map((r) =>
      r.key !== key && this.entry(r)?.type === type
        ? { ...r, checked: false }
        : r,
    );
  }
  addManual(slug) {
    const card = this.index.byKey.get(`${this.target.kind}:${slug}`);
    if (!card) return;
    const key = `${this.target.kind}:${slug}`,
      row = this.rows.find((r) => r.slug === slug);
    if (row) {
      this.rows = this.rows.map((r) =>
        r === row ? { ...r, manual: true } : r,
      );
      this.toggleRow(row.key, true);
    } else
      this.rows = [
        ...this.rows,
        {
          key,
          kind: this.target.kind,
          slug,
          name: card.name,
          checked: true,
          touched: true,
          manual: true,
          decision: ++this.decision,
          exact: true,
          confidence: 1,
          ambiguous: false,
          options: [card],
          evidence: [],
        },
      ];
    this.enforceMissionChoice(row?.key || key);
    this.query = "";
  }
  rebuildRows() {
    const old = new Map(
      this.rows.flatMap((r) => (r.sourceKeys || [r.key]).map((k) => [k, r])),
    );
    let rows = this.rows
      .filter((r) => r.manual)
      .map((r) => ({ ...r, evidence: [] }));
    for (const p of this.photos)
      if (p.result)
        rows = mergePhotoCards(
          rows,
          findPhotoCards(this.index, this.target.kind, p.result, p.id),
        );
    rows = rows.map((r) =>
      old.get(r.key)?.touched
        ? { ...r, ...old.get(r.key), evidence: r.evidence }
        : r,
    );
    rows = mergePhotoCards([], rows);
    if (this.target.type === "battle" && this.target.kind === "crises") {
      // Several photographed Secure cards are a roster, not a choice of mission.
      // Require the user to choose rather than silently taking the first one.
      for (const type of ["Secure", "Extraction"]) {
        const group = rows.filter(
          (r) =>
            r.checked &&
            this.index.byKey.get(`crises:${r.slug}`)?.type === type,
        );
        if (group.length > 1) {
          const explicit = group.find((r) => r.touched);
          rows = rows.map((r) =>
            group.includes(r) && r !== explicit ? { ...r, checked: false } : r,
          );
        }
      }
    }
    this.rows = rows;
  }
  async chooseNative(source) {
    if (this.busy || this.applying || !this.target) return;
    if (this.photos.length >= PHOTO_LIMIT) {
      this.error = "За один раз можно обработать до 12 фото.";
      return;
    }
    const session = this.session;
    this.busy = true;
    this.stage = "Выберите фотографию";
    this.error = "";
    try {
      const photos = await this.recognizer.choose(
        source,
        PHOTO_LIMIT - this.photos.length,
      );
      if (session !== this.session) {
        this.recognizer.release(photos);
        return;
      }
      await this.readPhotos(photos, session);
    } catch (e) {
      if (session === this.session && e.code !== "SCAN_CANCELLED")
        runInAction(() => {
          this.error = e.message || "Не удалось открыть фото.";
        });
    } finally {
      if (session === this.session)
        runInAction(() => {
          this.busy = false;
          this.stage = "";
        });
    }
  }
  async addFiles(files) {
    if (this.busy || this.applying || !this.target) return;
    this.error = "";
    const session = this.session;
    try {
      const room = PHOTO_LIMIT - this.photos.length;
      if (files.length > room)
        throw Error(
          `За один раз можно обработать до ${PHOTO_LIMIT} фото. Осталось мест: ${room}.`,
        );
      const photos = this.recognizer.fromFiles(files);
      await this.readPhotos(photos, session);
    } catch (e) {
      if (session === this.session)
        runInAction(() => {
          this.error = e.message || "Не удалось открыть фото.";
        });
    }
  }
  async readPhotos(photos, session = this.session) {
    if (!photos.length) return;
    runInAction(() => {
      this.photos = [...this.photos, ...photos];
      this.busy = true;
    });
    try {
      for (let i = 0; i < photos.length; i++) {
        if (session !== this.session) return;
        const photo = photos[i];
        runInAction(() => {
          this.activePhoto = photo.id;
          this.progress = i / photos.length;
          this.stage = `Распознаю фото ${i + 1} из ${photos.length}`;
        });
        try {
          const result = await this.recognizer.recognize(photo, (p) => {
            if (session === this.session)
              runInAction(() => {
                this.progress = (i + p.value) / photos.length;
              });
          });
          if (session !== this.session) return;
          runInAction(() => {
            this.photos = this.photos.map((p) =>
              p.id === photo.id ? { ...p, result, error: "" } : p,
            );
            this.rebuildRows();
          });
        } catch (e) {
          if (session !== this.session) return;
          runInAction(() => {
            this.photos = this.photos.map((p) =>
              p.id === photo.id
                ? { ...p, error: e.message || "Не удалось прочитать фото." }
                : p,
            );
          });
        }
      }
    } finally {
      if (session === this.session)
        runInAction(() => {
          this.busy = false;
          this.progress = 1;
          this.stage = "";
        });
    }
  }
  async rotate(id, delta) {
    if (this.busy || this.applying) return;
    const photo = this.photos.find((p) => p.id === id);
    if (!photo) return;
    const next = {
      ...photo,
      rotation: (photo.rotation + delta + 360) % 360,
      result: null,
      error: "",
    };
    this.photos = this.photos.filter((p) => p.id !== id);
    this.rebuildRows();
    await this.readPhotos([next]);
  }
  removePhoto(id) {
    if (this.busy || this.applying) return;
    const photo = this.photos.find((p) => p.id === id);
    if (!photo) return;
    this.photos = this.photos.filter((p) => p.id !== id);
    this.recognizer.release([photo]);
    this.rebuildRows();
    if (this.activePhoto === id) this.activePhoto = this.photos[0]?.id || null;
  }
  recognizeText() {
    if (!this.manualText.trim() || this.busy || this.applying) return;
    if (this.photos.length >= PHOTO_LIMIT) {
      this.error = "Уберите один из снимков, чтобы добавить текст.";
      return;
    }
    const id = crypto.randomUUID();
    this.photos = [
      ...this.photos,
      {
        id,
        name: "Вставленный текст",
        rotation: 0,
        result: { text: this.manualText },
        textOnly: true,
      },
    ];
    this.manualText = "";
    this.rebuildRows();
  }
  async apply() {
    if (
      this.busy ||
      this.applying ||
      this.selectionProblem ||
      !this.pendingCount
    )
      return;
    this.applying = true;
    this.error = "";
    try {
      const result = await applyPhotoSelection(
        this.deps,
        this.target,
        this.selected.map((r) => r.slug),
      );
      runInAction(() => {
        this.applying = false;
        this.close();
        this.deps.ui.notify(
          result.count
            ? `Добавлено по фото: ${result.count}`
            : "Все выбранные карты уже добавлены.",
        );
      });
    } catch (e) {
      runInAction(() => {
        this.applying = false;
        this.error = e.message || "Не удалось добавить карты.";
      });
    }
  }
}
