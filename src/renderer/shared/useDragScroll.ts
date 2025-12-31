import { useCallback, useRef } from "react";

function isInteractiveTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return Boolean(
    el.closest(
      [
        "button",
        "a",
        "input",
        "textarea",
        "select",
        "[role='button']",
        "[data-no-drag-scroll='true']"
      ].join(",")
    )
  );
}

export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const drag = useRef<{
    pointerId: number;
    startY: number;
    startScrollTop: number;
    dragging: boolean;
  } | null>(null);
  const didDrag = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<T>) => {
    if (e.button !== 0) return; // left mouse only
    if (isInteractiveTarget(e.target)) return;

    const el = e.currentTarget;
    drag.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startScrollTop: el.scrollTop,
      dragging: false
    };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    didDrag.current = false;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    const d = drag.current;
    if (!d) return;
    if (e.pointerId !== d.pointerId) return;
    const el = e.currentTarget;
    const dy = e.clientY - d.startY;
    if (!d.dragging) {
      if (Math.abs(dy) < 4) return; // treat as a click until user meaningfully drags
      d.dragging = true;
      didDrag.current = true;
      el.style.cursor = "grabbing";
      el.style.userSelect = "none";
    }
    e.preventDefault();
    el.scrollTop = d.startScrollTop - dy;
  }, []);

  const end = useCallback((e: React.PointerEvent<T>) => {
    const d = drag.current;
    if (!d) return;
    if (e.pointerId !== d.pointerId) return;
    const el = e.currentTarget;
    drag.current = null;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    el.style.cursor = "";
    el.style.userSelect = "";
  }, []);

  const onClickCapture = useCallback((e: React.SyntheticEvent<T>) => {
    if (!didDrag.current) return;
    // If we dragged to scroll, suppress the click that would otherwise fire on a card.
    e.preventDefault();
    e.stopPropagation();
    didDrag.current = false;
  }, []);

  return { ref, onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onClickCapture };
}


