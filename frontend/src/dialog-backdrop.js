import { useRef } from "react";

// A drag that starts inside a card must not dismiss it on release outside.
export function useDialogBackdrop(onClose) {
  const start = useRef(null);
  const outside = (event) => {
    if (event.target !== event.currentTarget) return false;
    const r = event.currentTarget.getBoundingClientRect();
    return (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    );
  };
  return {
    onPointerDown(event) {
      start.current =
        event.isPrimary && event.button === 0 && outside(event)
          ? event.pointerId
          : null;
    },
    onPointerUp(event) {
      const dismiss = start.current === event.pointerId && outside(event);
      start.current = null;
      if (dismiss) {
        event.stopPropagation();
        onClose?.(event);
      }
    },
    onPointerCancel() {
      start.current = null;
    },
  };
}
