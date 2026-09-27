import { iconButton } from "./buttons";
import { panZoom, ZOOM_STEP } from "./pan-zoom";
import { strings } from "./strings";

const MAX_SCALE = 8;

/** The styles for the zoomable frame; the controller adds them to each block's shadow root. */
export const ZOOM_STYLE = `
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
 * Inline zoom for a Diagram inside `frame`, which keeps the size the fitted Diagram gave it. Scale 1
 * is fitted to the block's width, and zooming out stops there. Ctrl+wheel zooms around the cursor,
 * and dragging or the arrow keys pan while zoomed in, without ever showing space beyond the Diagram.
 * A plain wheel is left alone, so it still scrolls the page.
 */
export function inlineZoom(doc: Document, frame: HTMLElement): InlineZoom {
  const zoomOut = iconButton(doc, strings.zoomOut, "zoom-out", () => zoom.zoomBy(1 / ZOOM_STEP));
  const zoomIn = iconButton(doc, strings.zoomIn, "zoom-in", () => zoom.zoomBy(ZOOM_STEP));
  const fitButton = iconButton(doc, strings.fitToWidth, "fit", () => zoom.fit());
  const buttons = [zoomOut, zoomIn, fitButton];

  const zoom = panZoom(frame, frame, {
    wheelZooms: (event) => event.ctrlKey,
    fitted: () => ({ scale: 1, x: 0, y: 0 }),
    limits: () => [1, MAX_SCALE],
    canPan: (view) => view.scale > 1,
    // Keep the scaled canvas covering the frame, so panning never shows empty space.
    constrain(view, canvas) {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      view.x = Math.min(0, Math.max(width - width * view.scale, view.x));
      view.y = Math.min(0, Math.max(height - height * view.scale, view.y));
    },
    changed(view) {
      zoomOut.setAttribute("aria-disabled", String(view.scale === 1));
      fitButton.setAttribute("aria-disabled", String(view.scale === 1));
      zoomIn.setAttribute("aria-disabled", String(view.scale === MAX_SCALE));
      frame.classList.toggle("zoomed", view.scale > 1);
      // Only a zoomed-in frame has anything to pan, so only then is it a tab stop.
      frame.tabIndex = view.scale > 1 ? 0 : -1;
    },
  });

  const setCanvas = (canvas: HTMLElement | null) => {
    for (const el of buttons) el.hidden = !canvas;
    zoom.setCanvas(canvas);
  };
  setCanvas(null);
  return { buttons, setCanvas, fit: zoom.fit };
}
