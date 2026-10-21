import { observer } from "mobx-react-lite";
import { library, actions } from "./stores/index.js";
import React, { memo, useState } from "react";
export const number = (value, digits = 1) =>
  Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: digits });
export const count = (n, one, few, many) =>
  `${n} ${n % 100 >= 11 && n % 100 <= 14 ? many : n % 10 === 1 ? one : n % 10 >= 2 && n % 10 <= 4 ? few : many}`;
export const Avatar = memo(function Avatar({ character: c, large = false }) {
  const [failed, setFailed] = useState(false);
  const initials = c.name
    .split(/[\s,-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span
      className={`avatar ${large ? "large" : ""} ${c.portrait && !failed ? "has-image" : ""}`}
    >
      <span className="initials" aria-hidden="true">
        {initials}
      </span>
      {c.portrait && !failed && (
        <img
          src={c.portrait}
          onError={() => setFailed(true)}
          alt={"Портрет " + c.name}
          loading={large ? undefined : "lazy"}
          decoding="async"
        />
      )}
    </span>
  );
});
export function Control({ as = "input", children, ...props }) {
  return React.createElement(as, props, children);
}
export const OwnedCheckbox = observer(function OwnedCheckbox({
  character,
  owned,
  boxOwned,
  detail = false,
}) {
  owned = library.owned.has(character.slug);
  boxOwned = library.boxOwned.has(character.slug);
  return (
    <label className="check">
      <Control
        type="checkbox"
        id={detail ? "detail-owned" : "owned-" + character.slug}
        data-owned={character.slug}
        onChange={(event) => {
          event.stopPropagation();
          if (!library.setOwned(character.slug, event.target.checked)) {
            event.target.checked = library.owned.has(character.slug);
            if (library.error) actions.notify(library.error);
          }
        }}
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
