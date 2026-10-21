import React, {
  memo,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
// Rules/layout generators produce trusted escaped markup. This adapter turns it into
// keyed React elements; it never replaces a live container with innerHTML.
export const managedTargets = new WeakMap();
const cache = new Map(),
  parser = new DOMParser();
const booleanAttrs = new Set([
  "checked",
  "disabled",
  "hidden",
  "multiple",
  "required",
  "readOnly",
  "autoFocus",
  "open",
  "selected",
  "noValidate",
  "formNoValidate",
  "controls",
  "loop",
  "muted",
]);
const names = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  readonly: "readOnly",
  autofocus: "autoFocus",
  maxlength: "maxLength",
  minlength: "minLength",
  colspan: "colSpan",
  rowspan: "rowSpan",
  spellcheck: "spellCheck",
  contenteditable: "contentEditable",
  crossorigin: "crossOrigin",
  srcset: "srcSet",
  usemap: "useMap",
  formnovalidate: "formNoValidate",
  novalidate: "noValidate",
  autoplay: "autoPlay",
  playsinline: "playsInline",
  viewbox: "viewBox",
};
const camel = (s) =>
  s.startsWith("--")
    ? s
    : s.replace(/^-ms-/, "ms-").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function styleObject(element) {
  const result = {};
  for (const key of element.style)
    result[key === "float" ? "cssFloat" : camel(key)] =
      element.style.getPropertyValue(key);
  return result;
}
function semanticKey(el) {
  if (el.id) return "id:" + el.id;
  for (const key of [
    "data-fighter",
    "data-map-key",
    "data-roster",
    "data-box-set",
    "data-card-slug",
    "data-card-view",
    "data-ability-name",
    "data-purchased-code",
    "data-wishlist-code",
  ])
    if (el.hasAttribute(key)) return key + ":" + el.getAttribute(key);
  if (el.hasAttribute("data-slug"))
    return (
      el.tagName +
      ":" +
      (el.getAttribute("data-action") || el.getAttribute("data-rs") || "") +
      ":" +
      el.getAttribute("data-slug")
    );
  if (el.hasAttribute("data-character"))
    return "character:" + el.getAttribute("data-character");
  if (el.matches("input[type=checkbox],input[type=radio]"))
    return "input:" + (el.name || "") + ":" + el.value;
  if (el.matches(".selected-row,.picker-result,.at-character-entry,li")) {
    const child = el.querySelector("[data-slug],[data-character],input[value]");
    if (child)
      return (
        el.tagName +
        ":" +
        (child.getAttribute("data-slug") ||
          child.getAttribute("data-character") ||
          child.getAttribute("value"))
      );
  }
  if (el.matches(".sc-ability"))
    return "ability:" + (el.querySelector("h4")?.textContent || "");
  if (el.matches(".battle-tactic-card"))
    return (
      "tactic:" +
      (el.getAttribute("data-card") ||
        el.querySelector("[data-tactic]")?.getAttribute("data-tactic") ||
        "")
    );
  return (
    el.localName +
    ":" +
    (el.classList[0] ||
      el.getAttribute("data-stat") ||
      el.getAttribute("data-rs") ||
      el.getAttribute("data-bt") ||
      "")
  );
}
function describeChildren(parent) {
  const counts = new Map();
  return Array.from(parent.childNodes).flatMap((node) => {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1 || ["script", "style"].includes(node.localName))
      return [];
    const base = semanticKey(node),
      index = counts.get(base) || 0;
    counts.set(base, index + 1);
    const props = {};
    for (const attr of node.attributes) {
      if (/^on/i.test(attr.name) || attr.name === "selected") continue;
      const key =
        names[attr.name] ||
        (node.namespaceURI.includes("svg") &&
        !attr.name.startsWith("data-") &&
        !attr.name.startsWith("aria-")
          ? camel(attr.name)
          : attr.name);
      props[key] =
        attr.name === "style"
          ? styleObject(node)
          : booleanAttrs.has(key)
            ? true
            : attr.value;
    }
    let value = props.value,
      checked = props.checked;
    if (["input", "select", "textarea"].includes(node.localName)) {
      delete props.value;
      delete props.checked;
    }
    if (node.matches("input[type=checkbox],input[type=radio]"))
      checked = node.hasAttribute("checked");
    if (node.localName === "select") {
      const choices = Array.from(node.querySelectorAll("option[selected]")).map(
        (o) => o.value,
      );
      value = node.multiple
        ? choices
        : (choices[0] ?? node.querySelector("option")?.value ?? "");
    }
    if (node.localName === "textarea") value = node.textContent;
    return {
      key: base + ":" + index,
      tag: node.localName,
      props,
      value,
      checked,
      fingerprint: node.outerHTML,
      innerMarkup: node.innerHTML,
      children: node.localName === "textarea" ? [] : describeChildren(node),
    };
  });
}
export function parseMarkup(html) {
  html = String(html ?? "");
  if (cache.has(html)) return cache.get(html);
  const nodes = describeChildren(
    parser.parseFromString("<!doctype html><body>" + html, "text/html").body,
  );
  cache.set(html, nodes);
  if (cache.size > 24) cache.delete(cache.keys().next().value);
  return nodes;
}
const FormElement = memo(
  function FormElement({ node }) {
    const ref = useRef(null),
      { tag, props, value, checked } = node;
    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      if (value !== undefined) {
        if (tag === "select" && props.multiple) {
          for (const option of el.options)
            option.selected = value.includes(option.value);
        } else if (el.value !== String(value)) el.value = String(value);
      }
      if (checked !== undefined && el.checked !== checked) el.checked = checked;
    }, [value, checked, props.multiple, tag]);
    return React.createElement(
      tag,
      {
        ...props,
        ref,
        ...(value !== undefined ? { defaultValue: value } : {}),
        ...(checked !== undefined ? { defaultChecked: checked } : {}),
      },
      tag === "input" || tag === "textarea"
        ? undefined
        : node.children.map((child) =>
            typeof child === "string" ? (
              child
            ) : (
              <MarkupNode key={child.key} node={child} />
            ),
          ),
    );
  },
  (a, b) => a.node.fingerprint === b.node.fingerprint,
);
const BoundaryElement = memo(
  function BoundaryElement({ node }) {
    const parent = useRef(node.fingerprint);
    parent.current = node.fingerprint;
    const store = useRef(null);
    if (!store.current) {
      let value = null;
      const listeners = new Set();
      store.current = {
        subscribe: (fn) => {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
        read: () => (value?.parent === parent.current ? value : null),
        update: (next) => {
          value = { ...next, parent: parent.current };
          listeners.forEach((fn) => fn());
        },
      };
    }
    const override = useSyncExternalStore(
      store.current.subscribe,
      store.current.read,
    );
    const attach = useRef(null);
    if (!attach.current)
      attach.current = (element) => {
        if (element) managedTargets.set(element, store.current);
      };
    const Content = override?.View;
    return React.createElement(
      node.tag,
      { ...node.props, ref: attach.current },
      Content && Content !== Markup ? (
        <Content {...override.props} />
      ) : (
        <Markup html={override?.props.html ?? node.innerMarkup} />
      ),
    );
  },
  (a, b) => a.node.fingerprint === b.node.fingerprint,
);
const MarkupNode = memo(
  function MarkupNode({ node }) {
    if (
      ["stat-card-viewer", "at-roster-body"].some((c) =>
        (node.props.className || "").split(" ").includes(c),
      )
    )
      return <BoundaryElement node={node} />;
    if (["input", "select", "textarea"].includes(node.tag))
      return <FormElement node={node} />;
    return React.createElement(
      node.tag,
      node.props,
      ...node.children.map((child) =>
        typeof child === "string" ? (
          child
        ) : (
          <MarkupNode key={child.key} node={child} />
        ),
      ),
    );
  },
  (a, b) => a.node.fingerprint === b.node.fingerprint,
);
export const Markup = memo(function Markup({ html }) {
  return (
    <>
      {parseMarkup(html).map((node, i) =>
        typeof node === "string" ? (
          node
        ) : (
          <MarkupNode key={node.key} node={node} />
        ),
      )}
    </>
  );
});

export function MarkupSlot({ as = "div", html = "", ...props }) {
  const node = {
    tag: as,
    props,
    innerMarkup: html,
    fingerprint: JSON.stringify(props) + html,
  };
  return <BoundaryElement node={node} />;
}
