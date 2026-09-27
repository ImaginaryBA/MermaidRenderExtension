import { BUTTON_STYLE, iconButton } from "./buttons";
import { panZoom, ZOOM_STEP, type View } from "./pan-zoom";
import type { Theme } from "./ports";
import { strings } from "./strings";

export const VIEWER_TAG = "mermaid-render-viewer";

/** Fitting to the window never enlarges a Diagram beyond this multiple of its natural size. */
const MAX_FIT_SCALE = 2;

const STYLE = `
${BUTTON_STYLE}
.viewer {
  position: fixed; inset: 0; z-index: 2147483647; background: #fff;
  font: 13px/1.4 system-ui, sans-serif;
}
.viewer[data-theme="dark"] { background: #1b1d23; }
.viewer:focus { outline: none; }
.stage { position: absolute; inset: 0; overflow: hidden; cursor: grab; touch-action: none; user-select: none; }
.stage:active { cursor: grabbing; }
.stage:focus-visible { outline: 2px solid #7cb7ff; outline-offset: -4px; }
.canvas { display: inline-block; }
.canvas svg { display: block; }
.toolbar { position: absolute; top: 12px; right: 12px; display: flex; gap: 6px; }
`;

/** Closes the open viewer, if any; only one is open at a time. */
let closeOpenViewer: (() => void) | null = null;

/**
 * Opens the Diagram Viewer: a full-screen overlay showing a copy of `svg`, the Diagram already drawn,
 * so Mermaid isn't asked to draw it again. It's a modal dialog in its own shadow root, out of the
 * page's CSS: focus stays inside it, the plain wheel zooms around the cursor, dragging pans freely,
 * and Esc or the close button closes it and returns focus to `opener`.
 */
export function openViewer(doc: Document, svg: SVGSVGElement, theme: Theme, opener: HTMLElement): void {
  closeOpenViewer?.();

  const overlay = doc.createElement(VIEWER_TAG);
  const root = overlay.attachShadow({ mode: "open" });
  const style = doc.createElement("style");
  style.textContent = STYLE;
  const dialog = doc.createElement("div");
  dialog.className = "viewer";
  dialog.dataset.theme = theme;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", strings.viewerLabel);
  dialog.tabIndex = -1;
  const stage = doc.createElement("div");
  stage.className = "stage";
  stage.tabIndex = 0;
  const canvas = doc.createElement("div");
  canvas.className = "canvas";
  canvas.append(naturalSizeCopy(svg));
  stage.append(canvas);

  const zoom = panZoom(stage, dialog, {
    wheelZooms: () => true,
    fitted: (el) => fitToWindow(stage, el),
    limits(el) {
      const fit = fitToWindow(stage, el).scale;
      return [fit / 4, Math.max(8, fit * 8)];
    },
    canPan: () => true,
  });
  const close = () => {
    overlay.remove();
    closeOpenViewer = null;
    if (opener.isConnected) opener.focus();
  };
  const toolbar = doc.createElement("div");
  toolbar.className = "toolbar";
  toolbar.append(
    iconButton(doc, strings.zoomOut, "zoom-out", () => zoom.zoomBy(1 / ZOOM_STEP)),
    iconButton(doc, strings.zoomIn, "zoom-in", () => zoom.zoomBy(ZOOM_STEP)),
    iconButton(doc, strings.fitToWindow, "fit", () => zoom.fit()),
    iconButton(doc, strings.closeViewer, "close", close),
  );
  dialog.append(stage, toolbar);
  root.append(style, dialog);

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      keepFocusInside(event, root, [stage, ...toolbar.querySelectorAll("button")]);
    } else if (SCROLL_KEYS.has(event.key) && !(event.target instanceof HTMLButtonElement)) {
      // The page behind must not scroll while the viewer covers it.
      event.preventDefault();
    }
  });

  doc.body.append(overlay);
  closeOpenViewer = close;
  zoom.setCanvas(canvas);
  zoom.fit();
  dialog.focus();
}

const SCROLL_KEYS = new Set([" ", "PageUp", "PageDown", "Home", "End"]);

/** Wraps Tab from the last focusable element to the first, and Shift+Tab from the first to the last. */
function keepFocusInside(event: KeyboardEvent, root: ShadowRoot, focusable: HTMLElement[]): void {
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = root.activeElement;
  const wrapTo = event.shiftKey ? (active === first || !focusable.includes(active as HTMLElement) ? last : null) : active === last ? first : null;
  if (!wrapTo) return;
  event.preventDefault();
  wrapTo.focus();
}

/** A copy of the drawn Diagram at its natural size, rather than fitted to the block's width. */
function naturalSizeCopy(svg: SVGSVGElement): SVGSVGElement {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const [, , width, height] = (copy.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  copy.style.removeProperty("max-width");
  if (width > 0 && height > 0) {
    copy.setAttribute("width", String(width));
    copy.setAttribute("height", String(height));
  }
  return copy;
}

/** The view that shows the whole canvas centred in the stage, enlarged at most to MAX_FIT_SCALE. */
function fitToWindow(stage: HTMLElement, canvas: HTMLElement): View {
  const { clientWidth: stageWidth, clientHeight: stageHeight } = stage;
  const { offsetWidth: width, offsetHeight: height } = canvas;
  if (!stageWidth || !stageHeight || !width || !height) return { scale: 1, x: 0, y: 0 };
  const scale = Math.min(stageWidth / width, stageHeight / height, MAX_FIT_SCALE);
  return { scale, x: (stageWidth - width * scale) / 2, y: (stageHeight - height * scale) / 2 };
}
