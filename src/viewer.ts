import { BUTTON_STYLE, iconButton } from "./buttons";
import { panZoom, UNZOOMED, ZOOM_STEP, type View } from "./pan-zoom";
import type { Theme } from "./ports";
import { strings } from "./strings";

export const VIEWER_TAG = "mermaid-render-viewer";

/** Fitting to the window never enlarges a Diagram beyond this multiple of its natural size. */
const MAX_FIT_SCALE = 2;
/** Space kept clear around the fitted Diagram; the top leaves room for the toolbar. */
const FIT_MARGIN = { top: 60, right: 24, bottom: 24, left: 24 };

const STYLE = `
${BUTTON_STYLE}
.viewer {
  position: fixed; inset: 0; width: auto; height: auto; max-width: none; max-height: none;
  margin: 0; padding: 0; border: 0; z-index: 2147483647; background: #fff; touch-action: none;
  font: 13px/1.4 system-ui, sans-serif;
}
.viewer::backdrop { background: transparent; }
.viewer[data-theme="dark"] { background: #1b1d23; }
.viewer:focus { outline: none; }
.stage { position: absolute; inset: 0; overflow: hidden; cursor: grab; user-select: none; }
.stage:active { cursor: grabbing; }
.stage:focus-visible { outline: 2px solid #7cb7ff; outline-offset: -4px; }
.canvas { display: inline-block; }
.canvas svg { display: block; }
.toolbar { position: absolute; top: 12px; right: 12px; display: flex; gap: 6px; }
`;

/**
 * Inline styles that keep page CSS from hiding or restyling the overlay's host element, which sits in
 * the page's DOM (its contents are in a shadow root the page can't reach).
 */
const HOST_STYLE: [string, string][] = [
  ["display", "block"],
  ["visibility", "visible"],
  ["opacity", "1"],
  ["transform", "none"],
  ["filter", "none"],
];

export interface OpenViewer {
  /** Closes the viewer, if it's still open. */
  close(): void;
}

/** The viewer that's open, if any; only one is open at a time. */
let openNow: OpenViewer | null = null;

/**
 * Opens the Diagram Viewer: a full-screen overlay showing a copy of `svg`, the Diagram already drawn,
 * so Mermaid isn't asked to draw it again. It's a modal <dialog> in the browser's top layer, inside
 * its own shadow root, so neither the page's CSS nor its stacking can hide it. Focus stays inside it,
 * the plain wheel zooms around the cursor, dragging pans freely, the page behind never scrolls, and
 * Esc or the close button closes it. `onClose` then puts focus back where it belongs.
 */
export function openViewer(doc: Document, svg: SVGSVGElement, theme: Theme, onClose: () => void): OpenViewer {
  openNow?.close();
  const win = doc.defaultView!;

  const overlay = doc.createElement(VIEWER_TAG);
  for (const [property, value] of HOST_STYLE) overlay.style.setProperty(property, value, "important");
  const root = overlay.attachShadow({ mode: "open" });
  const style = doc.createElement("style");
  style.textContent = STYLE;
  const dialog = doc.createElement("dialog");
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

  // The page behind must not scroll while the viewer covers it, whether by wheel, keys, touch or its
  // scrollbar. Rather than changing the page's own styles, the viewer holds its scroll position.
  const scrollX = win.scrollX;
  const scrollY = win.scrollY;
  const holdScroll = () => win.scrollTo(scrollX, scrollY);
  const refit = () => zoom.fit();

  let closed = false;
  const handle: OpenViewer = {
    close() {
      if (closed) return;
      closed = true;
      win.removeEventListener("scroll", holdScroll);
      win.removeEventListener("resize", refit);
      overlay.remove();
      if (openNow === handle) openNow = null;
      onClose();
    },
  };

  const toolbar = doc.createElement("div");
  toolbar.className = "toolbar";
  toolbar.append(
    iconButton(doc, strings.zoomOut, "zoom-out", () => zoom.zoomBy(1 / ZOOM_STEP)),
    iconButton(doc, strings.zoomIn, "zoom-in", () => zoom.zoomBy(ZOOM_STEP)),
    iconButton(doc, strings.fitToWindow, "fit", refit),
    iconButton(doc, strings.closeViewer, "close", handle.close),
  );
  dialog.append(stage, toolbar);
  root.append(style, dialog);

  // Wheel events the stage didn't use for zooming (over the toolbar, or sideways) still mustn't scroll the page.
  dialog.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
  // A native modal dialog closes itself on Esc; close it the viewer's way instead, so focus is restored.
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    handle.close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      handle.close();
    } else if (event.key === "Tab") {
      keepFocusInside(event, root, [stage, ...toolbar.querySelectorAll("button")]);
    } else if (SCROLL_KEYS.has(event.key) && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
    }
  });

  doc.body.append(overlay);
  showInTopLayer(dialog);
  win.addEventListener("scroll", holdScroll);
  win.addEventListener("resize", refit);
  openNow = handle;
  zoom.setCanvas(canvas);
  zoom.fit();
  dialog.focus();
  return handle;
}

const SCROLL_KEYS = new Set([" ", "PageUp", "PageDown", "Home", "End"]);

/** Opens the dialog as a modal in the top layer, above anything the page stacks; falls back to a plain open dialog. */
function showInTopLayer(dialog: HTMLDialogElement): void {
  try {
    dialog.showModal();
  } catch {
    dialog.setAttribute("open", "");
  }
}

/** Wraps Tab from the last focusable element to the first, and Shift+Tab from the first (or the dialog itself) to the last. */
function keepFocusInside(event: KeyboardEvent, root: ShadowRoot, focusable: HTMLElement[]): void {
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = root.activeElement as HTMLElement | null;
  const inside = active !== null && focusable.includes(active);
  const wrapTo = event.shiftKey ? (active === first || !inside ? last : null) : active === last ? first : null;
  if (!wrapTo) return;
  event.preventDefault();
  wrapTo.focus();
}

/** A copy of the drawn Diagram at its natural size, rather than fitted to the block's width. */
function naturalSizeCopy(svg: SVGSVGElement): SVGSVGElement {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const [, , viewWidth, viewHeight] = (copy.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  // Mermaid always gives a viewBox; without one, the inline Diagram's drawn size is the best guess.
  const drawn = svg.getBoundingClientRect();
  const width = viewWidth > 0 ? viewWidth : drawn.width;
  const height = viewHeight > 0 ? viewHeight : drawn.height;
  copy.style.removeProperty("max-width");
  if (width > 0 && height > 0) {
    copy.setAttribute("width", String(width));
    copy.setAttribute("height", String(height));
  }
  return copy;
}

/** The view that shows the whole canvas centred in the stage, clear of the toolbar, enlarged at most to MAX_FIT_SCALE. */
function fitToWindow(stage: HTMLElement, canvas: HTMLElement): View {
  const room = {
    width: stage.clientWidth - FIT_MARGIN.left - FIT_MARGIN.right,
    height: stage.clientHeight - FIT_MARGIN.top - FIT_MARGIN.bottom,
  };
  const { offsetWidth: width, offsetHeight: height } = canvas;
  if (room.width <= 0 || room.height <= 0 || !width || !height) return UNZOOMED;
  const scale = Math.min(room.width / width, room.height / height, MAX_FIT_SCALE);
  return {
    scale,
    x: FIT_MARGIN.left + (room.width - width * scale) / 2,
    y: FIT_MARGIN.top + (room.height - height * scale) / 2,
  };
}
