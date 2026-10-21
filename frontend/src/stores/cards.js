import {
  makeAutoObservable,
  observable,
  observableRef,
  runInAction,
} from "mobx";
export class CardStore {
  layers = observable.map({}, { deep: false });
  game = null;
  condition = null;
  metadata = null;
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
      { storage: false, metadata: observableRef, game: observableRef },
      { autoBind: true },
    );
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
}
