/**
 * The pan and zoom behaviour shared by inline zoom and the Diagram Viewer. A canvas inside a frame is
 * moved with a CSS transform (translate, then scale, from its top-left corner), so zooming and
 * panning never change the size of anything in the page's layout.
 */

/** Each zoom step multiplies or divides the scale by this. A 100px wheel notch does the same. */
export const ZOOM_STEP = 1.25;
/** How far one arrow key press pans. */
const PAN_STEP_PX = 40;
/** Wheel deltas in lines or pages are converted to roughly equivalent pixels. */
const WHEEL_UNIT_PX = [1, 40, 800];

export interface View {
  scale: number;
  x: number;
  y: number;
}

export interface PanZoomRules {
  /** Whether this wheel event zooms. Any other wheel event is left to scroll the page. */
  wheelZooms(event: WheelEvent): boolean;
  /** The view that shows the whole canvas; `fit()` returns to it. */
  fitted(canvas: HTMLElement): View;
  /** The smallest and largest scale allowed. */
  limits(canvas: HTMLElement): [min: number, max: number];
  /** Whether panning is allowed right now (inline zoom only pans once zoomed in). */
  canPan(view: View): boolean;
  /** Adjusts a view before it's shown, such as keeping the canvas covering the frame. */
  constrain?(view: View, canvas: HTMLElement): void;
  /** Called after every change, to update buttons and the like. */
  changed?(view: View): void;
}

export interface PanZoom {
  readonly view: Readonly<View>;
  /** Zooms or pans `canvas` from now on (keeping the current view), or nothing when there's none. */
  setCanvas(canvas: HTMLElement | null): void;
  /** Zooms by `factor` around the frame's centre. */
  zoomBy(factor: number): void;
  /** Back to the fitted view. */
  fit(): void;
}

/**
 * Zooms and pans a canvas inside `frame`: the wheel zooms around the cursor when the rules allow it,
 * and dragging or the arrow keys (while `keyTarget` has focus) pan.
 */
export function panZoom(frame: HTMLElement, keyTarget: HTMLElement, rules: PanZoomRules): PanZoom {
  let canvas: HTMLElement | null = null;
  const view: View = { scale: 1, x: 0, y: 0 };

  const apply = () => {
    if (canvas) {
      const [min, max] = rules.limits(canvas);
      view.scale = Math.min(max, Math.max(min, view.scale));
      rules.constrain?.(view, canvas);
      canvas.style.transformOrigin = "0 0";
      canvas.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    }
    rules.changed?.(view);
  };

  /** Zooms by `factor`, keeping the point under (`clientX`, `clientY`) on screen where it is. */
  const zoomAt = (factor: number, clientX: number, clientY: number) => {
    if (!canvas) return;
    // The canvas's box on screen includes the translation, so subtract it to get its unscaled origin.
    const box = canvas.getBoundingClientRect();
    const px = clientX - (box.left - view.x);
    const py = clientY - (box.top - view.y);
    const [min, max] = rules.limits(canvas);
    const next = Math.min(max, Math.max(min, view.scale * factor));
    view.x = px - ((px - view.x) * next) / view.scale;
    view.y = py - ((py - view.y) * next) / view.scale;
    view.scale = next;
    apply();
  };

  frame.addEventListener(
    "wheel",
    (event) => {
      if (!canvas || event.deltaY === 0 || !rules.wheelZooms(event)) return;
      event.preventDefault();
      // The step follows the wheel distance, so a trackpad pinch's many small events zoom smoothly.
      const pixels = event.deltaY * WHEEL_UNIT_PX[event.deltaMode];
      zoomAt(ZOOM_STEP ** (-pixels / 100), event.clientX, event.clientY);
    },
    { passive: false },
  );

  keyTarget.addEventListener("keydown", (event) => {
    if (!canvas || !rules.canPan(view)) return;
    const [dx, dy] = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key] ?? [0, 0];
    if (dx === 0 && dy === 0) return;
    event.preventDefault();
    view.x += dx * PAN_STEP_PX;
    view.y += dy * PAN_STEP_PX;
    apply();
  });

  let drag: { pointer: number; startX: number; startY: number; fromX: number; fromY: number } | null = null;
  frame.addEventListener("pointerdown", (event) => {
    if (!canvas || event.button !== 0 || !rules.canPan(view)) return;
    event.preventDefault();
    keyTarget.focus({ preventScroll: true });
    frame.setPointerCapture(event.pointerId);
    drag = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, fromX: view.x, fromY: view.y };
  });
  frame.addEventListener("pointermove", (event) => {
    if (drag?.pointer !== event.pointerId) return;
    view.x = drag.fromX + event.clientX - drag.startX;
    view.y = drag.fromY + event.clientY - drag.startY;
    apply();
  });
  const endDrag = (event: PointerEvent) => {
    if (drag?.pointer === event.pointerId) drag = null;
  };
  frame.addEventListener("pointerup", endDrag);
  frame.addEventListener("pointercancel", endDrag);

  const fit = () => {
    if (canvas) Object.assign(view, rules.fitted(canvas));
    else Object.assign(view, { scale: 1, x: 0, y: 0 });
    apply();
  };

  apply();
  return {
    view,
    setCanvas(next) {
      canvas = next;
      apply();
    },
    zoomBy(factor) {
      const box = frame.getBoundingClientRect();
      zoomAt(factor, box.left + box.width / 2, box.top + box.height / 2);
    },
    fit,
  };
}
