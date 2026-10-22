import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { observer } from "mobx-react-lite";
import {
  CHARACTER_ROLES,
  characterRoles,
  squadRoles,
} from "./character-roles.js";
import { count } from "./common.jsx";

function RoleGlyph({ icon }) {
  return <i className={"fa-solid fa-" + icon} aria-hidden="true" />;
}
function RoleBadge({ role, aggregate, pressed, onToggle }) {
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState(null);
  const button = useRef(null),
    tooltip = useRef(null),
    timer = useRef(null);
  const id = useId();
  const cancelClose = () => clearTimeout(timer.current);
  const show = () => {
    cancelClose();
    setOpen(true);
  };
  const hide = () => {
    cancelClose();
    setOpen(false);
  };
  const deferHide = () => {
    cancelClose();
    timer.current = setTimeout(() => setOpen(false), 100);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const rect = button.current.getBoundingClientRect();
    const width = Math.min(320, innerWidth - 24);
    setPosition({
      left: Math.max(12, Math.min(rect.left, innerWidth - width - 12)),
      top: rect.bottom + 7,
      width,
    });
    const closeOutside = (e) => {
      if (
        !button.current?.contains(e.target) &&
        !tooltip.current?.contains(e.target)
      )
        hide();
    };
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        hide();
      }
    };
    document.addEventListener("pointerdown", closeOutside, true);
    window.addEventListener("keydown", key, true);
    const scroll = (e) => {
      if (!(e.target instanceof Node) || !tooltip.current?.contains(e.target))
        hide();
    };
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", hide);
    };
  }, [open]);
  useEffect(() => {
    if (!open || !position || !tooltip.current) return;
    const height = tooltip.current.getBoundingClientRect().height;
    if (position.top + height > innerHeight - 12) {
      const rect = button.current.getBoundingClientRect();
      setPosition((p) => ({ ...p, top: Math.max(12, rect.top - height - 7) }));
    }
  }, [open, position?.left, position?.width]);
  // Native dialogs live in the top layer: keep their tooltip in that dialog.
  const portal =
    button.current?.closest("dialog") ||
    (typeof document === "undefined" ? null : document.body);
  return (
    <>
      <button
        ref={button}
        type="button"
        className={
          "character-role role-" + role.id + (pressed ? " is-selected" : "")
        }
        data-role-icon={role.id}
        aria-label={role.label}
        aria-pressed={pressed}
        aria-describedby={open && position ? id : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType !== "touch") show();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "touch") deferHide();
        }}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle?.(role.id);
          show();
        }}
      >
        <RoleGlyph icon={role.icon} />
      </button>
      {open &&
        position &&
        portal &&
        createPortal(
          <div
            id={id}
            ref={tooltip}
            role="tooltip"
            className={
              "character-role-tooltip" +
              (onToggle ? " role-filter-tooltip" : "")
            }
            style={position}
            onPointerEnter={cancelClose}
            onPointerLeave={deferHide}
          >
            <strong>
              {role.label}
              {aggregate &&
                " · " +
                  count(
                    role.members.length,
                    "персонаж",
                    "персонажа",
                    "персонажей",
                  )}
            </strong>
            <p>{role.description}</p>
            {role.members.map((m) => (
              <div className="role-provider" key={m.slug}>
                {aggregate && <b>{m.name}</b>}
                {m.note && <span>{m.note}</span>}
              </div>
            ))}
          </div>,
          portal,
        )}
    </>
  );
}
export const RoleIcons = observer(function RoleIcons({
  slug,
  slugs,
  tactics,
  leaderSlug,
  context = "character",
  owner,
  compact = false,
}) {
  const roles = slug
    ? characterRoles(slug)
    : squadRoles(slugs, { tactics, leaderSlug });
  if (!roles.length) return null;
  return (
    <span
      className={"character-roles" + (compact ? " compact" : "")}
      role="group"
      aria-label={
        slug
          ? "Роли персонажа"
          : context === "roster"
            ? "Роли ростера"
            : "Роли отряда"
      }
      data-role-context={context}
      data-role-owner={owner || slug}
      onClick={(e) => e.stopPropagation()}
    >
      {roles.map((role) => (
        <RoleBadge key={role.id} role={role} aggregate={!slug} />
      ))}
    </span>
  );
});

export function RoleFilterChoices({ selected, onToggle }) {
  return (
    <fieldset className="catalog-choice-field">
      <legend>Роли персонажа</legend>
      <div
        className="character-roles role-filter-options"
        role="group"
        aria-label="Фильтр по ролям"
      >
        {CHARACTER_ROLES.map((r) => (
          <RoleBadge
            key={r.id}
            role={{ ...r, members: [] }}
            pressed={selected.includes(r.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </fieldset>
  );
}
