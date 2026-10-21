import { makeAutoObservable, observableRef } from "mobx";
const rounded = (value) => Number(value.toFixed(2));
export class MapStore {
  matchId = null;
  selected = "";
  distanceMode = "objects";
  unit = "in";
  mode = "bases";
  lines = true;
  zoom = 1;
  data = { layouts: {} };
  error = "";
  drag = null;
  skipClick = false;
  x = "";
  y = "";
  renaming = false;
  name = "";
  constructor(battle, catalog, ui) {
    Object.assign(this, { battle, catalog, ui });
    makeAutoObservable(
      this,
      {
        battle: false,
        catalog: false,
        ui: false,
        data: observableRef,
        drag: observableRef,
      },
      { autoBind: true },
    );
  }
  load(data, error = "") {
    this.data = data;
    this.error = error;
  }
  get geometry() {
    return this.battle.domain.Geometry;
  }
  get match() {
    return this.battle.current;
  }
  get state() {
    return (
      this.match?.map || {
        edge: "south",
        positions: {},
        objectives: {},
        pins: [],
      }
    );
  }
  ensure(match) {
    return (
      match.map ||
      (match.map = { edge: "south", positions: {}, objectives: {}, pins: [] })
    );
  }
  get points() {
    if (!this.match || !this.geometry) return [];
    return this.geometry
      .points(this.match, this.data.layouts, this.catalog.byId)
      .filter((p) => p.kind !== "fighter");
  }
  get origin() {
    return (
      this.points.find((p) => p.id === this.selected) ||
      this.points.find((p) => p.kind === "objective")
    );
  }
  get displayPoints() {
    return this.points.map((p) =>
      p.id === this.drag?.id && this.drag?.preview
        ? { ...p, ...this.drag.preview }
        : p,
    );
  }
  get displayOrigin() {
    return this.displayPoints.find((p) => p.id === this.origin?.id);
  }
  pointName(p) {
    return p.kind === "objective" ? p.code + " · " + p.name : p.name;
  }
  zoneLabel(side) {
    return side === this.battle.ownSide ? "Моя зона" : "Зона противника";
  }
  text(n) {
    return (
      (this.unit === "cm" ? n * 2.54 : n).toLocaleString("ru-RU", {
        maximumFractionDigits: 2,
      }) + (this.unit === "cm" ? " см" : "″")
    );
  }
  open() {
    if (!this.match) return;
    if (this.matchId !== this.match.id) {
      this.matchId = this.match.id;
      this.selected = "";
      this.distanceMode = "objects";
      this.unit = "in";
      this.mode = "bases";
      this.lines = true;
      this.zoom = 1;
    }
    this.battle.setLocation("view", "map");
    this.updateCoordinates();
  }
  back() {
    this.battle.setLocation(
      "view",
      this.match.status === "preparing" ? "setup" : "play",
    );
  }
  setField(name, value) {
    this[name] = value;
    if (["selected", "unit"].includes(name)) this.updateCoordinates();
  }
  updateCoordinates() {
    const p = this.origin,
      factor = this.unit === "cm" ? 2.54 : 1;
    this.x = p ? String(rounded(p.x * factor)) : "";
    this.y = p ? String(rounded(p.y * factor)) : "";
  }
  setEdge(edge) {
    this.battle.edit(
      "Карта: выбран мой край",
      (next) => (this.ensure(next).edge = edge),
    );
  }
  zoomBy(delta) {
    this.zoom = Math.max(1, Math.min(3, this.zoom + delta));
  }
  move(id, position) {
    const p = this.points.find((p) => p.id === id);
    if (!p || this.match.status === "finished") return;
    this.battle.edit("Карта: перемещена " + this.pointName(p), (next) => {
      const state = this.ensure(next);
      if (p.kind === "objective") state.objectives[p.id] = position;
      else
        Object.assign(
          state.pins.find((t) => t.id === p.id),
          position,
        );
    });
    this.updateCoordinates();
  }
  add() {
    if (
      !this.match ||
      this.match.status === "finished" ||
      this.distanceMode !== "objects"
    )
      return false;
    const id = "pin:" + crypto.randomUUID(),
      names = new Set(this.state.pins.map((p) => p.name));
    let n = 1;
    while (names.has("Доп. точка " + n)) n++;
    const count = this.state.pins.length,
      position = {
        x: Math.min(30, 18 + (count % 4) * 2),
        y: Math.min(30, 18 + (Math.floor(count / 4) % 4) * 2),
      };
    if (
      this.battle.edit("Карта: дополнительная точка добавлена", (next) =>
        this.ensure(next).pins.push({
          id,
          name: "Доп. точка " + n,
          ...position,
        }),
      )
    ) {
      this.selected = id;
      this.updateCoordinates();
      return true;
    }
    return false;
  }
  remove(id = this.selected) {
    const p = this.points.find((p) => p.id === id);
    if (!p || p.kind !== "pin" || this.match.status === "finished")
      return false;
    if (
      this.battle.edit("Карта: удалена " + p.name, (next) => {
        const state = this.ensure(next);
        state.pins = state.pins.filter((p) => p.id !== id);
      })
    ) {
      this.selected = "";
      this.updateCoordinates();
      return true;
    }
    return false;
  }
  applyCoordinates() {
    const p = this.origin,
      factor = this.unit === "cm" ? 2.54 : 1,
      x = Number(this.x) / factor,
      y = Number(this.y) / factor;
    if (!p) return;
    if (
      this.x === "" ||
      this.y === "" ||
      ![x, y].every((n) => Number.isFinite(n) && n >= 0 && n <= 36)
    ) {
      this.ui.notify("Координаты должны находиться внутри поля 36″ × 36″.");
      return;
    }
    this.move(p.id, { x: rounded(x), y: rounded(y) });
  }
  resetPoint() {
    const p = this.origin;
    if (p)
      this.battle.edit(
        "Карта: восстановлена цель " + p.code,
        (next) => delete this.ensure(next).objectives[p.id],
      );
    this.updateCoordinates();
  }
  rename() {
    if (this.origin?.kind === "pin") {
      this.name = this.origin.name;
      this.renaming = true;
    }
  }
  saveName() {
    const id = this.origin?.id,
      name = this.name.trim();
    if (!name || !id) return;
    if (
      this.battle.edit(
        "Карта: название метки изменено",
        (next) => (this.ensure(next).pins.find((p) => p.id === id).name = name),
      )
    )
      this.renaming = false;
  }
  position(event, svg) {
    const r = svg.getBoundingClientRect();
    return {
      x: rounded(
        Math.max(
          0,
          Math.min(36, (((event.clientX - r.left) / r.width) * 440 - 40) / 10),
        ),
      ),
      y: rounded(
        Math.max(
          0,
          Math.min(36, (((event.clientY - r.top) / r.height) * 440 - 40) / 10),
        ),
      ),
    };
  }
  pointerDown(event, svg, id) {
    if (event.button !== 0 || this.match.status === "finished") return;
    const p = this.points.find((p) => p.id === id);
    if (!p) return;
    this.drag = {
      id,
      start: { x: p.x, y: p.y },
      pointer: this.position(event, svg),
      client: { x: event.clientX, y: event.clientY },
      preview: null,
      pointerId: event.pointerId,
    };
    svg.setPointerCapture(event.pointerId);
    svg.focus();
  }
  pointerMove(event, svg) {
    const d = this.drag;
    if (!d || event.pointerId !== d.pointerId) return;
    if (
      Math.hypot(event.clientX - d.client.x, event.clientY - d.client.y) < 4 &&
      !d.preview
    )
      return;
    const p = this.position(event, svg);
    this.drag = {
      ...d,
      preview: {
        x: rounded(Math.max(0, Math.min(36, d.start.x + p.x - d.pointer.x))),
        y: rounded(Math.max(0, Math.min(36, d.start.y + p.y - d.pointer.y))),
      },
    };
  }
  pointerUp(event) {
    const d = this.drag;
    if (!d || event.pointerId !== d.pointerId) return;
    this.drag = null;
    this.selected = d.id;
    if (d.preview) this.move(d.id, d.preview);
    else this.updateCoordinates();
  }
  cancelDrag() {
    this.drag = null;
  }
}
