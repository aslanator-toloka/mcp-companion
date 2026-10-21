import { makeAutoObservable, observable, observableRef } from "mobx";
const unique = (value) => [...new Set(value || [])];
function reconcile(map, values) {
  const next = new Set(values);
  for (const key of map.keys()) if (!next.has(key)) map.delete(key);
  for (const key of next) if (!map.has(key)) map.set(key, true);
}
// Durable data is explicitly serialized. Per-entity indexes let rows subscribe to
// their own ownership rather than to a replacement snapshot of the whole library.
export class LibraryStore {
  snapshot = {
    version: 1,
    owned: [],
    manuallyOwned: [],
    purchasedSets: [],
    wishlist: [],
    rosters: [],
    groups: [],
  };
  owned = observable.map({}, { deep: false });
  boxOwned = observable.map({}, { deep: false });
  plannedCharacters = observable.map({}, { deep: false });
  bought = observable.map({}, { deep: false });
  wishlist = observable.map({}, { deep: false });
  boxes = new Map();
  characters = new Map();
  error = "";
  blocked = false;
  constructor({ write = () => {}, validate = () => {} } = {}) {
    this.write = write;
    this.validate = validate;
    makeAutoObservable(
      this,
      {
        snapshot: observableRef,
        boxes: false,
        characters: false,
        write: false,
        validate: false,
      },
      { autoBind: true },
    );
  }
  configure({ boxes, characters, write, validate }) {
    if (boxes) this.boxes = boxes;
    if (characters) this.characters = characters;
    if (write) this.write = write;
    if (validate) this.validate = validate;
    const blocked = this.blocked;
    this.replace(this.snapshot);
    this.blocked = blocked;
  }
  boxCharacters(codes) {
    return unique(
      codes.flatMap((code) =>
        (this.boxes.get(code)?.characters || []).map((c) => c.slug),
      ),
    );
  }
  normalize(value) {
    const purchasedSets = unique(value.purchasedSets),
      manuallyOwned = unique(value.manuallyOwned ?? value.owned);
    return {
      version: 1,
      manuallyOwned,
      purchasedSets,
      owned: unique([
        ...manuallyOwned,
        ...this.boxCharacters(purchasedSets).filter((slug) =>
          this.characters.has(slug),
        ),
      ]),
      wishlist: unique(value.wishlist),
      rosters: value.rosters.map((r) => ({
        ...r,
        affiliation: r.affiliation || "",
        characters: [...r.characters],
        tactics: [...(r.tactics || [])],
        crises: [...(r.crises || [])],
        groups: [...(r.groups || [])],
      })),
      groups: (value.groups || []).map((g) => ({ ...g })),
    };
  }
  blockWrites() {
    this.blocked = true;
  }
  replace(value) {
    this.blocked = false;
    const next = this.normalize(value);
    this.snapshot = next;
    reconcile(this.owned, next.owned);
    reconcile(this.boxOwned, this.boxCharacters(next.purchasedSets));
    reconcile(this.plannedCharacters, this.boxCharacters(next.wishlist));
    reconcile(this.bought, next.purchasedSets);
    reconcile(this.wishlist, next.wishlist);
    this.error = "";
    return next;
  }
  commit(value) {
    if (this.blocked) {
      this.error =
        "Сохранение повреждено. Восстановите данные из экспорта, прежде чем изменять коллекцию.";
      return false;
    }
    try {
      const next = this.normalize(value);
      this.validate(next);
      this.write(JSON.stringify(next)); // Publish only after a successful durable write.
      this.replace(next);
      return true;
    } catch (error) {
      this.error =
        error.message || "Браузер не сохранил изменения. Экспортируйте данные.";
      return false;
    }
  }
  setOwned(slug, include) {
    if (!this.characters.has(slug) || this.boxOwned.has(slug)) return false;
    const manual = this.snapshot.manuallyOwned;
    return this.commit({
      ...this.snapshot,
      manuallyOwned: include
        ? unique([...manual, slug])
        : manual.filter((s) => s !== slug),
    });
  }
  toggleWishlist(code) {
    if (
      this.bought.has(code) ||
      (!this.boxes.has(code) && !this.wishlist.has(code))
    )
      return false;
    return this.commit({
      ...this.snapshot,
      wishlist: this.wishlist.has(code)
        ? this.snapshot.wishlist.filter((c) => c !== code)
        : [...this.snapshot.wishlist, code],
    });
  }
  togglePurchased(code) {
    if (!this.boxes.has(code) && !this.bought.has(code)) return false;
    const bought = this.bought.has(code);
    return this.commit({
      ...this.snapshot,
      purchasedSets: bought
        ? this.snapshot.purchasedSets.filter((c) => c !== code)
        : [...this.snapshot.purchasedSets, code],
      wishlist: bought
        ? this.snapshot.wishlist
        : this.snapshot.wishlist.filter((c) => c !== code),
    });
  }
  status(slugs, ownedOverride) {
    const ids = Array.isArray(slugs) ? slugs : [slugs];
    if (
      ownedOverride ??
      ids.some((s) => this.owned.has(s) || this.boxOwned.has(s))
    )
      return { kind: "owned", label: "Есть у меня" };
    if (ids.some((s) => this.plannedCharacters.has(s)))
      return { kind: "planned", label: "Запланирован" };
    return { kind: "missing", label: "Нет в коллекции" };
  }
  serialize() {
    return this.normalize(this.snapshot);
  }
}
