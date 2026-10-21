import React, { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Markup, managedTargets } from "./markup.jsx";
const regions = new Map();
function Region({ store }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.read);
  return snapshot ? <snapshot.View {...snapshot.props} /> : null;
}
function getRegion(element) {
  if (typeof element === "string") element = document.querySelector(element);
  if (!element) throw Error("React view host missing");
  if (managedTargets.has(element)) return managedTargets.get(element);
  let region = regions.get(element);
  if (region) return region;
  let snapshot = null;
  const listeners = new Set();
  region = {
    element,
    root: createRoot(element),
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    read: () => snapshot,
    update: (next) => {
      snapshot = next;
      listeners.forEach((fn) => fn());
    },
  };
  regions.set(element, region);
  flushSync(() => region.root.render(<Region store={region} />));
  return region;
}
export function render(element, View, props = {}) {
  const region = getRegion(element),
    previous = region.read();
  if (previous?.View === View && previous.props === props) return;
  flushSync(() => region.update({ View, props }));
}
export function html(element, markup) {
  const region = getRegion(element);
  if (region.read()?.props.html === markup && region.read()?.View === Markup)
    return;
  render(element, Markup, { html: String(markup ?? "") });
}
export function append(element, markup) {
  const initial = element.innerHTML;
  html(element, (getRegion(element).read()?.props.html ?? initial) + markup);
}
const bindings = new WeakMap();
export function listen(element, type, name, callback) {
  let entries = bindings.get(element);
  if (!entries) {
    entries = new Map();
    bindings.set(element, entries);
  }
  const key = type + ":" + name,
    old = entries.get(key);
  if (old) element.removeEventListener(type, old);
  entries.set(key, callback);
  element.addEventListener(type, callback);
}
// Region hosts can live inside list entries or dialogs which later leave the tree.
let cleanupFrame = 0;
new MutationObserver(() => {
  if (cleanupFrame) return;
  cleanupFrame = requestAnimationFrame(() => {
    cleanupFrame = 0;
    for (const [element, region] of regions)
      if (!element.isConnected) {
        region.root.unmount();
        regions.delete(element);
      }
  });
}).observe(document.documentElement, { childList: true, subtree: true });
export function diagnostics() {
  return { engine: "react", version: React.version, regions: regions.size };
}
