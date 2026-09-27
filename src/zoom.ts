import { strings } from "./strings";

/** Each zoom step multiplies or divides the scale by this. */
const STEP = 1.25;
const MAX_SCALE = 8;

export interface InlineZoom {
  /** The +, − and reset buttons, to sit next to the Render Toggle. */
  readonly buttons: HTMLButtonElement[];
  /** Zooms `canvas` (the element holding the drawn Diagram) from now on, or hides the buttons when there's none. */
  show(canvas: HTMLElement | null): void;
  /** Back to fitted: scale 1, no panning. */
  reset(): void;
}

/**
 * Inline zoom for a Diagram inside `frame`. The canvas is scaled with a CSS transform, so the frame
 * keeps the size the fitted Diagram gave it and the page never reflows. Scale 1 is fitted to the
 * block's width; zooming out stops there. Ctrl+wheel zooms around the cursor, and dragging pans
 * while zoomed in. A plain wheel is left alone, so it still scrolls the page.
 */
export function inlineZoom(doc: Document, frame: HTMLElement): InlineZoom {
  let canvas: HTMLElement | null = null;
  let scale = 1;
  let x = 0;
  let y = 0;

  const button = (label: string, className: string, onClick: () => void) => {
    const el = doc.createElement("button");
    el.type = "button";
    el.className = `zoom ${className}`;
    el.setAttribute("aria-label", label);
    el.title = label;
    el.hidden = true;
    el.addEventListener("click", onClick);
    return el;
  };

  /** Keeps the scaled canvas covering the frame, so panning never shows empty space. */
  const clampPan = () => {
    const width = canvas?.offsetWidth ?? 0;
    const height = canvas?.offsetHeight ?? 0;
    x = Math.min(0, Math.max(width - width * scale, x));
    y = Math.min(0, Math.max(height - height * scale, y));
  };

  const apply = () => {
    clampPan();
    zoomOut.disabled = reset.disabled = scale === 1;
    zoomIn.disabled = scale === MAX_SCALE;
    frame.classList.toggle("zoomed", scale > 1);
    if (!canvas) return;
    canvas.style.transformOrigin = "0 0";
    canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  };

  /** Zooms to `next`, keeping the point (`px`, `py`) of the canvas's unscaled box where it is. */
  const zoomTo = (next: number, px: number, py: number) => {
    next = Math.min(MAX_SCALE, Math.max(1, next));
    x = px - ((px - x) * next) / scale;
    y = py - ((py - y) * next) / scale;
    scale = next;
    apply();
  };

  const zoomAroundCentre = (factor: number) =>
    zoomTo(scale * factor, (canvas?.offsetWidth ?? 0) / 2, (canvas?.offsetHeight ?? 0) / 2);

  const zoomIn = button(strings.zoomIn, "zoom-in", () => zoomAroundCentre(STEP));
  const zoomOut = button(strings.zoomOut, "zoom-out", () => zoomAroundCentre(1 / STEP));
  const reset = button(strings.resetZoom, "zoom-reset", () => {
    scale = 1;
    apply();
  });

  frame.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey || !canvas) return;
      event.preventDefault();
      const box = frame.getBoundingClientRect();
      const px = event.clientX - box.left - canvas.offsetLeft;
      const py = event.clientY - box.top - canvas.offsetTop;
      zoomTo(scale * (event.deltaY < 0 ? STEP : 1 / STEP), px, py);
    },
    { passive: false },
  );

  let drag: { pointer: number; startX: number; startY: number; fromX: number; fromY: number } | null = null;
  frame.addEventListener("pointerdown", (event) => {
    if (scale === 1 || !canvas || event.button !== 0) return;
    event.preventDefault();
    frame.setPointerCapture(event.pointerId);
    drag = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, fromX: x, fromY: y };
  });
  frame.addEventListener("pointermove", (event) => {
    if (drag?.pointer !== event.pointerId) return;
    x = drag.fromX + event.clientX - drag.startX;
    y = drag.fromY + event.clientY - drag.startY;
    apply();
  });
  const endDrag = (event: PointerEvent) => {
    if (drag?.pointer === event.pointerId) drag = null;
  };
  frame.addEventListener("pointerup", endDrag);
  frame.addEventListener("pointercancel", endDrag);

  apply();
  return {
    buttons: [zoomOut, zoomIn, reset],
    show(next) {
      canvas = next;
      for (const el of [zoomOut, zoomIn, reset]) el.hidden = !canvas;
      apply();
    },
    reset() {
      scale = 1;
      x = y = 0;
      apply();
    },
  };
}
