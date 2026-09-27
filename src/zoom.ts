import { strings } from "./strings";

/** Each button press multiplies or divides the scale by this. A 100px wheel notch does the same. */
const STEP = 1.25;
const MAX_SCALE = 8;
/** How far one arrow key press pans a zoomed-in Diagram. */
const PAN_STEP_PX = 40;
/** Wheel deltas in lines or pages are converted to roughly equivalent pixels. */
const WHEEL_UNIT_PX = [1, 40, 800];

/** The styles for the zoom buttons and the zoomable frame; the controller adds them to each block's shadow root. */
export const ZOOM_STYLE = `
.zoom { width: 30px; height: 30px; padding: 0; background: #16233d; }
.zoom-in::before {
  background:
    linear-gradient(#fff, #fff) center / 8px 1.5px no-repeat,
    linear-gradient(#fff, #fff) center / 1.5px 8px no-repeat;
}
.zoom-out::before { background: linear-gradient(#fff, #fff) center / 8px 1.5px no-repeat; }
/* Fit: four corner brackets, the usual "fit to frame" symbol. Positions are within the ring's 15px inner box. */
.zoom-fit::before {
  background:
    linear-gradient(#fff, #fff) 3.5px 3.5px / 3px 1.5px no-repeat,
    linear-gradient(#fff, #fff) 3.5px 3.5px / 1.5px 3px no-repeat,
    linear-gradient(#fff, #fff) 8.5px 3.5px / 3px 1.5px no-repeat,
    linear-gradient(#fff, #fff) 10px 3.5px / 1.5px 3px no-repeat,
    linear-gradient(#fff, #fff) 3.5px 10px / 3px 1.5px no-repeat,
    linear-gradient(#fff, #fff) 3.5px 8.5px / 1.5px 3px no-repeat,
    linear-gradient(#fff, #fff) 8.5px 10px / 3px 1.5px no-repeat,
    linear-gradient(#fff, #fff) 10px 8.5px / 1.5px 3px no-repeat;
}
.zoom[aria-disabled="true"] { cursor: default; filter: saturate(0.4); }
.zoomed { cursor: grab; touch-action: none; user-select: none; }
.zoomed:active { cursor: grabbing; }
.zoomed:focus-visible { outline: 2px solid #7cb7ff; outline-offset: -2px; }
`;

export interface InlineZoom {
  /** The −, + and fit buttons, to sit next to the Render Toggle. */
  readonly buttons: HTMLButtonElement[];
  /** Zooms `canvas` (the element holding the drawn Diagram) from now on, or hides the buttons when there's none. */
  setCanvas(canvas: HTMLElement | null): void;
  /** Back to fitted: scale 1, no panning. */
  fit(): void;
}

/**
 * Inline zoom for a Diagram inside `frame`. The canvas is scaled with a CSS transform, so the frame
 * keeps the size the fitted Diagram gave it and the page never reflows. Scale 1 is fitted to the
 * block's width; zooming out stops there. Ctrl+wheel zooms around the cursor, and dragging or the
 * arrow keys pan while zoomed in. A plain wheel is left alone, so it still scrolls the page.
 */
export function inlineZoom(doc: Document, frame: HTMLElement): InlineZoom {
  let canvas: HTMLElement | null = null;
  let scale = 1;
  let x = 0;
  let y = 0;

  const canvasSize = () => ({ width: canvas?.offsetWidth ?? 0, height: canvas?.offsetHeight ?? 0 });

  const button = (label: string, className: string, onClick: () => void) => {
    const el = doc.createElement("button");
    el.type = "button";
    el.className = `zoom ${className}`;
    el.setAttribute("aria-label", label);
    el.title = label;
    el.hidden = true;
    // `aria-disabled` rather than `disabled`, so a button that reaches its limit keeps keyboard focus.
    el.addEventListener("click", () => {
      if (el.getAttribute("aria-disabled") !== "true") onClick();
    });
    return el;
  };

  /** Keeps the scaled canvas covering the frame, so panning never shows empty space. */
  const clampPan = () => {
    const { width, height } = canvasSize();
    x = Math.min(0, Math.max(width - width * scale, x));
    y = Math.min(0, Math.max(height - height * scale, y));
  };

  const apply = () => {
    clampPan();
    zoomOut.setAttribute("aria-disabled", String(scale === 1));
    fitButton.setAttribute("aria-disabled", String(scale === 1));
    zoomIn.setAttribute("aria-disabled", String(scale === MAX_SCALE));
    frame.classList.toggle("zoomed", scale > 1);
    // Only a zoomed-in frame has anything to pan, so only then is it a tab stop.
    frame.tabIndex = scale > 1 ? 0 : -1;
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

  const zoomAroundCentre = (factor: number) => {
    const { width, height } = canvasSize();
    zoomTo(scale * factor, width / 2, height / 2);
  };

  const fit = () => {
    scale = 1;
    x = y = 0;
    apply();
  };

  const zoomOut = button(strings.zoomOut, "zoom-out", () => zoomAroundCentre(1 / STEP));
  const zoomIn = button(strings.zoomIn, "zoom-in", () => zoomAroundCentre(STEP));
  const fitButton = button(strings.fitToWidth, "zoom-fit", fit);
  const buttons = [zoomOut, zoomIn, fitButton];

  frame.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey || !canvas || event.deltaY === 0) return;
      event.preventDefault();
      // The step follows the wheel distance, so a trackpad pinch's many small events zoom smoothly.
      const pixels = event.deltaY * WHEEL_UNIT_PX[event.deltaMode];
      // The canvas's box on screen includes the pan translation, so subtract it to get its unscaled origin.
      const box = canvas.getBoundingClientRect();
      zoomTo(scale * STEP ** (-pixels / 100), event.clientX - (box.left - x), event.clientY - (box.top - y));
    },
    { passive: false },
  );

  frame.addEventListener("keydown", (event) => {
    if (scale === 1) return;
    const [dx, dy] = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key] ?? [0, 0];
    if (dx === 0 && dy === 0) return;
    event.preventDefault();
    x += dx * PAN_STEP_PX;
    y += dy * PAN_STEP_PX;
    apply();
  });

  let drag: { pointer: number; startX: number; startY: number; fromX: number; fromY: number } | null = null;
  frame.addEventListener("pointerdown", (event) => {
    if (scale === 1 || !canvas || event.button !== 0) return;
    event.preventDefault();
    frame.focus({ preventScroll: true });
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
    buttons,
    setCanvas(next) {
      canvas = next;
      for (const el of buttons) el.hidden = !canvas;
      apply();
    },
    fit,
  };
}
