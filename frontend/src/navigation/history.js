// Browser history owns navigation only; game commands and durable saves are never replayed.
export class BrowserNavigation {
  constructor({
    window,
    read,
    apply,
    context = () => null,
    needsGuard = () => false,
    guard = (next) => next(),
    prompt = () => false,
    closing = () => false,
  }) {
    Object.assign(this, {
      window,
      read,
      apply,
      context,
      needsGuard,
      guard,
      prompt,
      closing,
    });
    this.entries = new Map();
    this.lowestIndex = 0;
    this.current = null;
    this.applying = false;
    this.queued = false;
    this.bouncing = false;
    this.traveling = false;
    this.pending = null;
    this.authorized = null;
    this.serial = 0;
    this.onLocation = this.onLocation.bind(this);
    this.onScroll = this.onScroll.bind(this);
  }
  key() {
    return (
      this.window.location.hash +
      "|" +
      (this.window.history.state?.mcpNavigation?.id || "")
    );
  }
  write(entry, replace = false) {
    const state = { ...this.window.history.state, mcpNavigation: entry };
    this.window.history[replace ? "replaceState" : "pushState"](
      state,
      "",
      entry.hash,
    );
    this.entries.set(entry.index, entry);
    if (!replace) {
      this.lowestIndex = Math.max(
        this.lowestIndex,
        entry.index - this.window.history.length + 1,
      );
      for (const index of this.entries.keys())
        if (index < this.lowestIndex) this.entries.delete(index);
    }
    this.current = entry;
    this.lastLocation = this.key();
  }
  start() {
    const existing = this.window.history.state?.mcpNavigation;
    this.session = existing?.session || this.window.crypto.randomUUID();
    this.applying = true;
    let loaded;
    try {
      loaded = this.apply(this.window.location.hash, existing);
    } finally {
      this.applying = false;
    }
    const entry = {
      session: this.session,
      id: existing?.id || this.window.crypto.randomUUID(),
      index: existing?.index || 0,
      hash: this.read(),
      context: this.context(),
      scroll: existing?.scroll || this.positions(),
    };
    this.write(entry, true);
    this.window.history.scrollRestoration = "manual";
    this.window.addEventListener("popstate", this.onLocation);
    this.window.addEventListener("hashchange", this.onLocation);
    this.window.document.addEventListener("scroll", this.onScroll, {
      capture: true,
      passive: true,
    });
    this.window.addEventListener("pagehide", () => this.saveCurrent());
    this.restoreAfter(loaded, entry, !!existing);
  }
  positions() {
    const nodes = {};
    for (const el of this.window.document.querySelectorAll(
      "[id],.picker-results,.stat-card-surface,.battle-character-scroll,.battle-fighter-strip-scroll,.battle-tactics-strip,.map-canvas-scroll",
    )) {
      if (!el.scrollTop && !el.scrollLeft) continue;
      const host = el.id ? el : el.closest("[id]");
      if (!host) continue;
      const selector = el.id
        ? "#" + this.window.CSS.escape(el.id)
        : "#" + this.window.CSS.escape(host.id) + " ." + [...el.classList][0];
      nodes[selector] = [el.scrollLeft, el.scrollTop];
    }
    return { x: this.window.scrollX, y: this.window.scrollY, nodes };
  }
  onScroll() {
    if (
      this.current &&
      !this.applying &&
      !this.traveling &&
      !this.bouncing &&
      this.read() === this.current.hash
    )
      this.current.scroll = this.positions();
  }
  saveCurrent() {
    if (!this.current) return;
    if (
      !this.applying &&
      !this.traveling &&
      !this.bouncing &&
      this.read() === this.current.hash
    )
      this.current.scroll = this.positions();
    this.current.context = this.context();
    this.entries.set(this.current.index, this.current);
    if (this.window.history.state?.mcpNavigation?.id === this.current.id)
      this.write(this.current, true);
  }
  schedule() {
    if (this.queued || !this.current) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      this.commit();
    });
  }
  commit() {
    if (this.applying || this.bouncing || this.traveling) return;
    if (this.pending) {
      if (this.prompt()) return;
      this.pending = null;
    }
    const hash = this.read();
    if (hash === this.current.hash) return;
    this.saveCurrent();
    if (this.closing(this.current.hash, hash)) {
      const parent = [...this.entries.values()]
        .filter((e) => e.index < this.current.index && e.hash === hash)
        .sort((a, b) => b.index - a.index)[0];
      if (parent) {
        this.traveling = true;
        this.authorized = parent.id;
        this.window.history.go(parent.index - this.current.index);
        return;
      }
    }
    const before = new URLSearchParams(this.current.hash.slice(1)),
      after = new URLSearchParams(hash.slice(1)),
      changed = [...new Set([...before.keys(), ...after.keys()])].filter(
        (k) =>
          JSON.stringify(before.getAll(k)) !== JSON.stringify(after.getAll(k)),
      );
    const replace =
      changed.length > 0 &&
      changed.every((k) => k === "q" || k.endsWith("-query"));
    const entry = {
      session: this.session,
      id: replace ? this.current.id : this.window.crypto.randomUUID(),
      index: this.current.index + (replace ? 0 : 1),
      hash,
      context: this.context(),
      scroll: { x: 0, y: 0, nodes: {} },
    };
    if (!replace)
      for (const index of this.entries.keys())
        if (index >= entry.index) this.entries.delete(index);
    const samePage =
      before.get("screen") === after.get("screen") &&
      before.get("roster") === after.get("roster") &&
      before.get("match") === after.get("match") &&
      before.get("view") === after.get("view");
    if (samePage) entry.scroll = { ...this.current.scroll, nodes: {} };
    this.write(entry, replace);
    this.restoreAfter(null, entry, !samePage);
  }
  onLocation() {
    if (this.lastLocation === this.key()) return;
    this.lastLocation = this.key();
    const raw = this.window.history.state?.mcpNavigation;
    if (this.bouncing) {
      this.bouncing = false;
      this.lastLocation = this.key();
      const target = this.pending;
      this.guard(() => {
        if (!target) return;
        this.current.context = this.context();
        this.write(this.current, true);
        this.pending = null;
        this.traveling = true;
        this.authorized = target.id;
        this.window.history.go(target.index - this.current.index);
      });
      return;
    }
    let entry =
      raw?.session === this.session
        ? this.entries.get(raw.index) || raw
        : {
            session: this.session,
            id: this.window.crypto.randomUUID(),
            index: this.current.index + 1,
            hash: this.window.location.hash,
            context: null,
            scroll: { x: 0, y: 0, nodes: {} },
          };
    const allowed = this.authorized === entry.id;
    this.authorized = null;
    this.traveling = false;
    if (!allowed && this.needsGuard(entry.hash)) {
      this.pending = entry;
      this.bouncing = true;
      // Assign an index to a manually entered hash before returning to the source.
      if (!raw)
        this.window.history.replaceState(
          { ...this.window.history.state, mcpNavigation: entry },
          "",
          entry.hash,
        );
      this.lastLocation = this.key();
      this.window.history.go(this.current.index - entry.index);
      return;
    }
    this.entries.set(this.current.index, {
      ...this.current,
      context: this.context(),
    });
    this.pending = null;
    this.applying = true;
    let loaded;
    try {
      loaded = this.apply(entry.hash, entry);
    } finally {
      this.applying = false;
    }
    entry = { ...entry, hash: this.read(), context: this.context() };
    this.write(entry, true);
    this.restoreAfter(loaded, entry, true);
  }
  restoreAfter(loaded, entry, restore) {
    const serial = ++this.serial;
    Promise.resolve(loaded)
      .catch(() => {})
      .then(() =>
        this.window.requestAnimationFrame(() => {
          if (serial !== this.serial || this.current?.id !== entry.id) return;
          if (restore || entry.scroll?.y) {
            const pos = entry.scroll || {};
            this.window.scrollTo(pos.x || 0, pos.y || 0);
          }
          if (restore)
            for (const [selector, [left, top]] of Object.entries(
              entry.scroll?.nodes || {},
            )) {
              const el = this.window.document.querySelector(selector);
              if (el) {
                el.scrollLeft = left;
                el.scrollTop = top;
              }
            }
          this.current.scroll = this.positions();
        }),
      );
  }
}
