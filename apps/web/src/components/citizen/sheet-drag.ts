import { useRef, type PointerEvent as ReactPointerEvent } from "react";

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.6; // px per ms

/** The dialog the grab zone belongs to: found from the event, so no ref is needed. */
const sheetOf = (event: ReactPointerEvent<HTMLElement>) =>
  event.currentTarget.closest<HTMLElement>('[role="dialog"]');

/**
 * Drag-to-dismiss for a bottom sheet, from its handle or header only (the content scrolls and
 * must keep doing so). The sheet follows the finger 1:1 through an inline transform, with no
 * React render per move; letting go either flings it away or springs it back, by distance or
 * speed. Pulling upwards is rubber-banded. Interrupting the spring-back catches the sheet where
 * it is, because the next touch starts from its current position.
 */
export function useSheetDrag(onDismiss: () => void) {
  const drag = useRef<{ id: number; startY: number; startAt: number; dy: number } | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const el = sheetOf(event);
    if (!el || (event.pointerType === "mouse" && event.button !== 0)) return;
    // From sm up the sheet is a card or a side panel: nothing to pull down.
    if (window.matchMedia("(min-width: 640px)").matches) return;
    // A close or any other control inside the header keeps its own tap.
    if ((event.target as HTMLElement).closest("button, a, input, textarea")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const current = new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;
    drag.current = {
      id: event.pointerId,
      startY: event.clientY - current,
      startAt: event.timeStamp,
      dy: current,
    };
    el.style.transition = "none";
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const el = sheetOf(event);
    const d = drag.current;
    if (!el || !d || d.id !== event.pointerId) return;
    const raw = event.clientY - d.startY;
    d.dy = raw < 0 ? raw / 6 : raw;
    el.style.transform = `translate3d(0, ${d.dy}px, 0)`;
  };

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    const el = sheetOf(event);
    const d = drag.current;
    if (!el || !d || d.id !== event.pointerId) return;
    drag.current = null;
    const speed = d.dy / Math.max(1, event.timeStamp - d.startAt);
    if (d.dy > DISMISS_DISTANCE || (d.dy > 24 && speed > DISMISS_VELOCITY)) {
      el.style.transition = "transform 200ms var(--ease-out)";
      el.style.transform = "translate3d(0, 100%, 0)";
      onDismiss();
    } else {
      el.style.transition = "transform 320ms var(--ease-drawer)";
      el.style.transform = "";
    }
  };

  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end };
}
