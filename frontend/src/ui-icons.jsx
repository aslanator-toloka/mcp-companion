import React from "react";

// One 20 px stroke grid for application controls. Game symbols remain separate.
const paths = {
  sun: "M10 1v2M10 17v2M1 10h2M17 10h2M3.6 3.6 5 5M15 15l1.4 1.4M3.6 16.4 5 15M15 5l1.4-1.4M14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  moon: "M17.5 11.5A8 8 0 0 1 8.5 2.5a8 8 0 1 0 9 9Z",
  camera:
    "M3 6h3l1.5-2h5L14 6h3v11H3zM13.5 11.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z",
  image: "M3 3h14v14H3zM3 14l4-4 3 3 3-5 4 6M7 6h.01",
  info: "M10 9v5m0-8h.01M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  chevron: "m5 7.5 5 5 5-5",
  close: "m5 5 10 10M15 5 5 15",
  menu: "M4 5h12M4 10h12M4 15h12",
  external:
    "M11 4h5v5M16 4l-8 8M8 5H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3",
  roster: "M4 4h12v13H4zM7 8h6M7 11h6M7 14h4M7 3v2M13 3v2",
  collection: "m3 6 7-3 7 3-7 3-7-3Zm0 0v8l7 3 7-3V6M10 9v8",
  compare: "M3 6h13m-4-4 4 4-4 4M17 14H4m4-4-4 4 4 4",
  search: "M13.5 13.5 17 17M15 9a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z",
  battle: "M4 3h12v14H4zM7 6h.01M13 6h.01M10 10h.01M7 14h.01M13 14h.01",
};
export function UIIcon({ name, className = "" }) {
  return (
    <svg
      className={"ui-icon " + className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name] || paths.chevron} />
    </svg>
  );
}
export function EmptyIllustration({ name }) {
  return (
    <span className="empty-illustration" aria-hidden="true">
      <UIIcon name={name} />
    </span>
  );
}
