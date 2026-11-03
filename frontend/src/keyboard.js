import { useEffect } from "react";
// Tabs keep one Tab stop; arrow keys select their adjacent preloaded panel.
export function navigateTabs(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const current = event.target.closest('[role="tab"]');
  if (!current || current.parentElement !== event.currentTarget) return;
  const tabs = [
    ...event.currentTarget.querySelectorAll(':scope > [role="tab"]'),
  ].filter((tab) => !tab.disabled && !tab.hidden);
  const index = tabs.indexOf(current);
  const direction =
    getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
  const move =
    event.key === "ArrowRight"
      ? direction
      : event.key === "ArrowLeft"
        ? -direction
        : 0;
  const next =
    event.key === "Home"
      ? tabs[0]
      : event.key === "End"
        ? tabs.at(-1)
        : move
          ? tabs[(index + move + tabs.length) % tabs.length]
          : null;
  if (!next) return;
  event.preventDefault();
  next.focus({ preventScroll: true });
  next.click();
}

// An opener can disappear when a new workspace mounts. Announce its heading
// without moving the user's scroll or stealing an already chosen control.
export function useEntryFocus(ref, key) {
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (
        document.activeElement === document.body &&
        ref.current?.isConnected &&
        !document.querySelector("dialog[open]")
      )
        ref.current.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [key]);
}
