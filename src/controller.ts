import { findMermaidBlocks, type MermaidBlock } from "./detector";
import { isInEditingSurface } from "./editing-surfaces";
import type { RenderOptions, Renderer, RenderResult, Settings } from "./ports";
import { strings } from "./strings";
import { inlineZoom, ZOOM_STYLE } from "./zoom";

export interface Ports {
  renderer: Renderer;
  settings: Settings;
}

export interface Mounted {
  /** Stops watching the page and puts every block back as the page had it. */
  unmount(): void;
}

/** Page changes are gathered for this long before the page is scanned again, so a stream of changes causes few rescans and redraws. */
export const RESCAN_DELAY_MS = 150;

/** How long a redraw's source must stay unchanged before its Render Error replaces the last good Diagram. */
export const ERROR_SETTLE_MS = 1000;

/**
 * Finds the Mermaid Blocks on the page and gives each one a Render Toggle, then keeps watching:
 * blocks added later get a toggle, blocks in Diagram View redraw when their source changes, and
 * blocks that are removed, stop being Mermaid or end up in an Editing Surface lose their toggle.
 */
export async function mount(doc: Document, { renderer, settings }: Ports): Promise<Mounted> {
  if (await settings.isSiteDisabled(doc.location.hostname)) return { unmount() {} };
  // Keyed by the block's first element, which stays the same while a block's source changes.
  const attached = new Map<Element, AttachedBlock>();

  const detachWhere = (shouldDetach: (key: Element) => boolean) => {
    for (const [key, block] of attached) {
      if (!shouldDetach(key)) continue;
      block.detach();
      attached.delete(key);
    }
  };

  const rescan = () => {
    const found = new Set<Element>();
    for (const block of findMermaidBlocks(doc.body)) {
      const key = block.elements[0];
      found.add(key);
      const existing = attached.get(key);
      if (existing) existing.update(block);
      else attached.set(key, attach(doc, block, renderer));
    }
    detachWhere((key) => !found.has(key));
  };

  /** Whether a page change is only the extension inserting, moving or removing its own elements. */
  const isOwnChange = (record: MutationRecord): boolean => {
    if (record.type !== "childList") return false;
    if (![...record.addedNodes, ...record.removedNodes].every((n) => n instanceof Element && n.localName === HOST_TAG)) return false;
    // The extension only removes a block's elements once the block is gone, or moves them (so they're
    // still connected). A block that's still attached but whose elements left the page lost them to the page.
    const live = new Set([...attached.values()].map((b) => b.host));
    return [...record.removedNodes].every((n) => !live.has(n as Element) || n.isConnected);
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver((records) => {
    const changes = records.filter((r) => !isOwnChange(r) && canAffectBlocks(r));
    if (changes.length === 0) return;
    // Nothing the extension inserted or hid may stay in an Editing Surface, even for the rescan delay,
    // or an editor could save it. A switch to design mode isn't observable, so it's not caught.
    detachWhere(isInEditingSurface);
    timer ??= setTimeout(() => {
      timer = undefined;
      rescan();
    }, RESCAN_DELAY_MS);
  });

  rescan();
  observer.observe(doc.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ["contenteditable", ...LABEL_ATTRIBUTES],
  });

  return {
    unmount() {
      observer.disconnect();
      clearTimeout(timer);
      detachWhere(() => true);
    },
  };
}

/** Attributes the Detector reads a language label from. */
const LABEL_ATTRIBUTES = ["class", "lang", "data-lang"];

/**
 * Whether a page change could add, change or remove a Mermaid Block. Label changes only matter on
 * code elements (which Sniffed Blocks read labels from) or when a Mermaid label comes or goes, so
 * pages that restyle elements all the time don't cause constant rescans.
 */
function canAffectBlocks(record: MutationRecord): boolean {
  if (record.type !== "attributes" || record.attributeName === "contenteditable") return true;
  const target = record.target as Element;
  if (target.localName === "pre" || target.localName === "code") return true;
  return [record.oldValue, target.getAttribute(record.attributeName!)].some((v) => v && /mermaid/i.test(v));
}

interface AttachedBlock {
  /** The element the extension inserted before the block, holding its Render Toggle and Diagram. */
  readonly host: Element;
  /** Takes the block as it's now found on the page, redrawing it if it's in Diagram View and its source changed. */
  update(block: MermaidBlock): void;
  /** Puts the block back in Code View and removes everything the extension inserted for it. */
  detach(): void;
}

export const HOST_TAG = "mermaid-render-block";

const STYLE = `
:host { display: block; position: relative; }
[hidden] { display: none !important; }
.controls {
  position: absolute; top: calc(var(--mre-offset, 0px) + 6px); right: 6px; z-index: 2147483647;
  display: flex; align-items: center; gap: 6px;
}
button {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;
  font: 500 13px/1 system-ui, sans-serif; letter-spacing: 0.01em; color: #fff;
  border: 1px solid #3d8bf033; border-radius: 999px;
  background: linear-gradient(90deg, #16233d 0%, #1a4f8f 55%, #1f74d6 100%);
  box-shadow: 0 2px 8px #0b1a3366, inset 0 1px 0 #ffffff1f;
  opacity: 0; transition: opacity 0.1s, filter 0.1s, box-shadow 0.1s;
}
.toggle { padding: 5px 16px 5px 5px; }
/* Icons are drawn in CSS so each button's text is exactly its label. */
.toggle::before, .zoom::before {
  content: ""; flex: none; width: 18px; height: 18px; border: 1.5px solid #fff; border-radius: 50%; box-sizing: border-box;
}
.toggle::before {
  background:
    linear-gradient(#fff, #fff) center / 8px 1.5px no-repeat,
    linear-gradient(#fff, #fff) center / 1.5px 8px no-repeat;
}
.toggle[aria-pressed="true"]::before { background: linear-gradient(#fff, #fff) center / 8px 1.5px no-repeat; }
button:hover:not([aria-disabled="true"]) { filter: brightness(1.12); box-shadow: 0 3px 12px #0b1a3380, inset 0 1px 0 #ffffff26; }
button:active:not([aria-disabled="true"]) { filter: brightness(0.95); }
button:focus-visible { outline: 2px solid #7cb7ff; outline-offset: 2px; }
:host([data-hover]) button, .controls:focus-within button, .toggle[aria-pressed="true"], .zoom { opacity: 1; }
.diagram:empty { display: none; }
/* The frame: its size is set by the fitted Diagram, and a zoomed Diagram is clipped to it. */
.diagram { overflow: hidden; border-radius: 8px; }
.diagram[data-theme="dark"] { background: #1b1d23; }
.canvas { padding: 8px 0; }
.error { font: 13px/1.4 system-ui, sans-serif; border-left: 3px solid #d33; padding: 4px 8px; }
.error p { margin: 0 0 4px; }
.error summary { cursor: pointer; }
.error pre { white-space: pre-wrap; font: 12px/1.4 ui-monospace, monospace; margin: 4px 0 0; }
/* Fitted to the block's width, but never enlarged beyond the Diagram's natural size. */
.canvas svg { display: block; max-width: 100%; height: auto; margin: 0 auto; }
${ZOOM_STYLE}`;

/**
 * Inserts a Render Toggle before the block; the block's own elements are only hidden and shown (ADR 0003).
 */
function attach(doc: Document, initial: MermaidBlock, renderer: Renderer): AttachedBlock {
  let block = initial;
  const host = doc.createElement(HOST_TAG);
  const root = host.attachShadow({ mode: "open" });
  const style = doc.createElement("style");
  style.textContent = STYLE;
  const toggle = doc.createElement("button");
  toggle.type = "button";
  toggle.className = "toggle";
  const diagram = doc.createElement("div");
  diagram.className = "diagram";
  const zoom = inlineZoom(doc, diagram);
  const controls = doc.createElement("div");
  controls.className = "controls";
  controls.append(...zoom.buttons, toggle);
  root.append(style, controls, diagram);
  block.elements[0].before(host);

  const hidden = new Map<Element, string | null>();
  let showingDiagram = false;
  // Bumped whenever a render's result stops being wanted, so a slower, older render never wins.
  let generation = 0;

  const setPressed = (pressed: boolean) => {
    toggle.setAttribute("aria-pressed", String(pressed));
    toggle.textContent = pressed ? strings.showCode : strings.showDiagram;
  };
  setPressed(false);

  const hideCode = () => {
    for (const el of block.elements) {
      if (hidden.has(el)) continue;
      hidden.set(el, el.getAttribute("style"));
      (el as HTMLElement).style.setProperty("display", "none", "important");
    }
  };

  const showCode = () => {
    ++generation;
    diagram.replaceChildren();
    zoom.setCanvas(null);
    zoom.fit();
    for (const [el, style] of hidden) restoreStyle(el, style);
    hidden.clear();
  };

  const draw = async () => {
    const current = ++generation;
    const drawn = block;
    // A redraw keeps the previous Diagram on screen until the new one is ready.
    if (!diagram.hasChildNodes()) diagram.textContent = strings.rendering;
    const theme = prefersDark(doc) ? "dark" : "default";
    const result = await renderSafely(renderer, drawn.repairedSource, { theme });
    const svg = result.ok ? parseSvg(doc, result.svg) : null;
    if (current !== generation) return;
    if (svg) {
      const canvas = doc.createElement("div");
      canvas.className = "canvas";
      canvas.append(svg);
      diagram.dataset.theme = theme;
      diagram.replaceChildren(canvas);
      return zoom.setCanvas(canvas);
    }
    const showError = () => {
      if (current !== generation) return;
      zoom.setCanvas(null);
      zoom.fit();
      diagram.replaceChildren(renderErrorView(doc, result.ok ? strings.notSvg : result.message, drawn.repairedSource !== drawn.source));
    };
    // A source that's still streaming is often briefly invalid, so keep the last good Diagram and only
    // show the error if the source then stops changing (any change starts a newer generation).
    if (diagram.querySelector("svg")) setTimeout(showError, ERROR_SETTLE_MS);
    else showError();
  };

  toggle.addEventListener("click", () => {
    showingDiagram = !showingDiagram;
    setPressed(showingDiagram);
    if (!showingDiagram) return showCode();
    hideCode();
    void draw();
  });

  const hover = (on: boolean) => () => {
    // Line the toggle up with the block's top edge, wherever margin collapsing has put the host.
    if (on) {
      const offset = block.elements[0].getBoundingClientRect().top - host.getBoundingClientRect().top;
      host.style.setProperty("--mre-offset", `${Math.max(0, offset)}px`);
    }
    host.toggleAttribute("data-hover", on);
  };
  const hoverOn = hover(true);
  const hoverOff = hover(false);
  const listen = (els: Element[], on: boolean) => {
    for (const el of els) {
      const method = on ? "addEventListener" : "removeEventListener";
      el[method]("mouseenter", hoverOn);
      el[method]("mouseleave", hoverOff);
    }
  };
  listen([host, ...block.elements], true);

  return {
    host,
    update(next) {
      // The page may have removed or moved the host (say, a framework re-rendering the parent).
      if (host.nextElementSibling !== next.elements[0]) next.elements[0].before(host);
      const sourceChanged = next.source !== block.source;
      const gone = block.elements.filter((el) => !next.elements.includes(el));
      const added = next.elements.filter((el) => !block.elements.includes(el));
      if (!sourceChanged && gone.length === 0 && added.length === 0) return;
      block = next;
      listen(gone, false);
      listen(added, true);
      for (const el of gone) {
        if (!hidden.has(el)) continue;
        restoreStyle(el, hidden.get(el)!);
        hidden.delete(el);
      }
      if (!showingDiagram) return;
      hideCode();
      if (sourceChanged) void draw();
    },
    detach() {
      showCode();
      listen(block.elements, false);
      host.remove();
    },
  };
}

function restoreStyle(el: Element, style: string | null): void {
  if (style === null) el.removeAttribute("style");
  else el.setAttribute("style", style);
}

/** A Render Error: a short summary, a note if Source Repair was involved, and Mermaid's message in an expandable section. */
function renderErrorView(doc: Document, message: string, repaired: boolean): HTMLElement {
  const error = doc.createElement("div");
  error.className = "error";
  error.setAttribute("role", "status");
  const summary = doc.createElement("p");
  summary.textContent = strings.renderError;
  error.append(summary);
  if (repaired) {
    const note = doc.createElement("p");
    note.textContent = strings.sourceRepaired;
    error.append(note);
  }
  const details = doc.createElement("details");
  const label = doc.createElement("summary");
  label.textContent = strings.errorDetails;
  const pre = doc.createElement("pre");
  pre.textContent = message;
  details.append(label, pre);
  error.append(details);
  return error;
}

/** Whether the browser asks for a dark colour scheme, which Diagrams are then drawn to match. */
function prefersDark(doc: Document): boolean {
  return doc.defaultView?.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

async function renderSafely(renderer: Renderer, source: string, options: RenderOptions): Promise<RenderResult> {
  try {
    return await renderer.render(source, options);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

const UNSAFE_ELEMENTS = "script, foreignObject, iframe, object, embed, img, image, audio, video";

/**
 * Parses SVG markup inertly (the HTML parser never runs scripts) and strips anything that could
 * run script once it's in the page. Mermaid's strict mode already sanitizes; this is defence in depth.
 */
function parseSvg(doc: Document, svg: string): SVGSVGElement | null {
  const parsed = new DOMParser().parseFromString(svg, "text/html");
  const el = parsed.querySelector("svg");
  if (!el) return null;
  for (const unsafe of el.querySelectorAll(UNSAFE_ELEMENTS)) unsafe.remove();
  for (const node of [el, ...el.querySelectorAll("*")]) {
    for (const attr of [...node.attributes]) {
      const isHandler = attr.name.toLowerCase().startsWith("on");
      const isScriptUrl = /^\s*javascript:/i.test(attr.value.replace(/[\u0000-\u001f]/g, ""));
      if (isHandler || isScriptUrl) node.removeAttribute(attr.name);
    }
  }
  return doc.adoptNode(el);
}
