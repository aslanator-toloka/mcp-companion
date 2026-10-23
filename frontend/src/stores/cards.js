import {
  makeAutoObservable,
  observable,
  observableRef,
  runInAction,
} from "mobx";
import { initialState, state } from "../combat/profile.js";
import { ruleReference } from "../rule-references.js";
export class CardStore {
  layers = observable.map({}, { deep: false });
  game = null;
  condition = null;
  reference = null;
  metadata = null;
  calculator = null;
  constructor(storage) {
    this.storage = storage;
    try {
      runInAction(() => {
        for (const [slug, layers] of Object.entries(
          JSON.parse(
            storage.getItem("mcp-companion-card-skin-layers-v1") || "{}",
          ),
        ))
          this.layers.set(slug, layers);
      });
    } catch {}
    makeAutoObservable(
      this,
      {
        storage: false,
        metadata: observableRef,
        game: observableRef,
        calculator: observableRef,
      },
      { autoBind: true },
    );
  }
  showCalculator(source = "", face = {}) {
    this.calculator = {
      source,
      opponent: "",
      first: state({ ...initialState(source), ...face }),
      second: initialState(""),
      distance: 2,
    };
  }
  setCalculator(field, value) {
    if (!this.calculator) return;
    if (field === "source")
      this.calculator = {
        ...this.calculator,
        source: value,
        first: initialState(value),
      };
    else if (field === "opponent")
      this.calculator = {
        ...this.calculator,
        opponent: value,
        second: initialState(value),
      };
    else if (field === "distance")
      this.calculator = {
        ...this.calculator,
        distance: Math.max(1, Math.min(5, Number(value) || 2)),
      };
    else if (["first", "second"].includes(field))
      this.calculator = { ...this.calculator, [field]: state(value) };
  }
  configure(metadata) {
    this.metadata = metadata;
  }
  setLayers(slug, value) {
    const next = { ...(this.layers.get(slug) || {}), ...value };
    try {
      this.storage.setItem(
        "mcp-companion-card-skin-layers-v1",
        JSON.stringify({ ...Object.fromEntries(this.layers), [slug]: next }),
      );
      this.layers.set(slug, next);
      return true;
    } catch {
      return false;
    }
  }
  showGame(card, kind, metadata = "") {
    this.game = { card, kind, metadata, side: "front" };
  }
  gameSide(side) {
    if (this.game) this.game = { ...this.game, side };
  }
  closeGame() {
    this.game = null;
  }
  showCondition(key) {
    if (this.metadata?.conditions[key]) this.condition = key;
  }
  closeCondition() {
    this.condition = null;
  }
  showReference(id) {
    if (ruleReference(id)) this.reference = id;
  }
  closeReference() {
    this.reference = null;
  }
}
