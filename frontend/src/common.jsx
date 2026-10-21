import React, { memo, useLayoutEffect, useRef } from "react";
export { Markup } from "./markup.jsx";
export const number = (value, digits = 1) =>
  Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: digits });
export const count = (n, one, few, many) =>
  `${n} ${n % 100 >= 11 && n % 100 <= 14 ? many : n % 10 === 1 ? one : n % 10 >= 2 && n % 10 <= 4 ? few : many}`;
export const Avatar = memo(function Avatar({ character: c, large = false }) {
  const initials = c.name
    .split(/[\s,-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span
      className={`avatar ${large ? "large" : ""} ${c.portrait ? "has-image" : ""}`}
    >
      <span className="initials" aria-hidden="true">
        {initials}
      </span>
      {c.portrait && (
        <img
          src={c.portrait}
          alt={"Портрет " + c.name}
          loading={large ? undefined : "lazy"}
          decoding="async"
        />
      )}
    </span>
  );
});
// The legacy command layer listens to native bubbling events. Keep form elements
// uncontrolled during the event, then synchronize only changed model properties.
export function Control({ as = "input", value, checked, children, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value !== undefined && el.value !== String(value))
      el.value = String(value);
    if (checked !== undefined && el.checked !== checked) el.checked = checked;
  }, [value, checked]);
  return React.createElement(
    as,
    {
      ...props,
      ref,
      ...(value !== undefined ? { defaultValue: value } : {}),
      ...(checked !== undefined ? { defaultChecked: checked } : {}),
    },
    children,
  );
}
export const OwnedCheckbox = memo(function OwnedCheckbox({
  character,
  owned,
  boxOwned,
  detail = false,
}) {
  return (
    <label className="check">
      <Control
        type="checkbox"
        id={detail ? "detail-owned" : "owned-" + character.slug}
        data-owned={character.slug}
        checked={owned}
        disabled={boxOwned}
        title={
          boxOwned
            ? "Входит в купленный набор. Отметка управляется в карточке набора."
            : undefined
        }
        aria-label={"Есть у меня: " + character.name}
      />
      <span>Есть у меня</span>
    </label>
  );
});
export const CollectionStatus = memo(
  function CollectionStatus({ status }) {
    return (
      <span className={"character-collection-status is-" + status.kind}>
        {status.label}
      </span>
    );
  },
  (a, b) =>
    a.status.kind === b.status.kind && a.status.label === b.status.label,
);
