import { findMermaidBlocks, type MermaidBlock } from "./detector";
import { isInEditingSurface } from "./editing-surfaces";
import type { Renderer, RenderResult, Settings } from "./ports";
import { strings } from "./strings";

export interface Ports {
  renderer: Renderer;
  settings: Settings;
}

/** Finds the Mermaid Blocks on the page and gives each one a Render Toggle. */
export async function mount(doc: Document, { renderer, settings }: Ports): Promise<void> {
  if (await settings.isSiteDisabled(doc.location.hostname)) return;
  const attached = new Map<MermaidBlock, Detach>();
  for (const block of findMermaidBlocks(doc.body)) attached.set(block, attach(doc, block, renderer));
  detachWhenEditable(doc, attached);
}

/** Puts a block back in Code View and removes everything the extension inserted for it. */
type Detach = () => void;

/**
 * Detaches any block that ends up inside an Editing Surface, whether its region becomes editable
 * (say, a wiki switching to edit mode) or it is moved into an editor, so the editor can't save
 * anything the extension inserted or hid. A switch to design mode isn't observable, so it's not caught.
 */
function detachWhenEditable(doc: Document, attached: Map<MermaidBlock, Detach>): void {
  if (attached.size === 0) return;
  const observer = new MutationObserver(() => {
    for (const [block, detach] of attached) {
      if (!isInEditingSurface(block.elements[0])) continue;
      detach();
      attached.delete(block);
    }
    if (attached.size === 0) observer.disconnect();
  });
  observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["contenteditable"] });
}

export const HOST_TAG = "mermaid-render-block";

const STYLE = `
:host { display: block; position: relative; }
button {
  position: absolute; top: calc(var(--mre-offset, 0px) + 6px); right: 6px; z-index: 2147483647;
  display: inline-flex; align-items: center; gap: 8px;
  font: 500 13px/1 system-ui, sans-serif; letter-spacing: 0.01em; color: #fff;
  padding: 5px 16px 5px 5px; cursor: pointer;
  border: 1px solid #3d8bf033; border-radius: 999px;
  background: linear-gradient(90deg, #16233d 0%, #1a4f8f 55%, #1f74d6 100%);
  box-shadow: 0 2px 8px #0b1a3366, inset 0 1px 0 #ffffff1f;
  opacity: 0; transition: opacity 0.1s, filter 0.1s, box-shadow 0.1s;
}
/* The icon: a ring with a plus to show the Diagram, or a minus to go back to the code. */
button::before {
  content: ""; flex: none; width: 18px; height: 18px; border: 1.5px solid #fff; border-radius: 50%;
  background:
    linear-gradient(#fff, #fff) center / 8px 1.5px no-repeat,
    linear-gradient(#fff, #fff) center / 1.5px 8px no-repeat;
}
button[aria-pressed="true"]::before { background: linear-gradient(#fff, #fff) center / 8px 1.5px no-repeat; }
button:hover { filter: brightness(1.12); box-shadow: 0 3px 12px #0b1a3380, inset 0 1px 0 #ffffff26; }
button:active { filter: brightness(0.95); }
button:focus-visible { outline: 2px solid #7cb7ff; outline-offset: 2px; }
:host([data-hover]) button, button:focus-visible, button[aria-pressed="true"] { opacity: 1; }
.diagram:empty { display: none; }
.diagram { padding: 8px 0; overflow: hidden; }
.error { font: 13px/1.4 system-ui, sans-serif; border-left: 3px solid #d33; padding: 4px 8px; }
.error p { margin: 0 0 4px; }
.error summary { cursor: pointer; }
.error pre { white-space: pre-wrap; font: 12px/1.4 ui-monospace, monospace; margin: 4px 0 0; }
.diagram svg { display: block; max-width: 100%; height: auto; margin: 0 auto; }
`;

/**
 * Inserts a Render Toggle before the block; the block's own elements are only hidden and shown (ADR 0003).
 */
function attach(doc: Document, block: MermaidBlock, renderer: Renderer): Detach {
  const host = doc.createElement(HOST_TAG);
  const root = host.attachShadow({ mode: "open" });
  const style = doc.createElement("style");
  style.textContent = STYLE;
  const toggle = doc.createElement("button");
  toggle.type = "button";
  const diagram = doc.createElement("div");
  diagram.className = "diagram";
  root.append(style, toggle, diagram);
  block.elements[0].before(host);

  const hidden = new Map<Element, string | null>();
  let showingDiagram = false;
  let generation = 0;

  const setPressed = (pressed: boolean) => {
    toggle.setAttribute("aria-pressed", String(pressed));
    toggle.textContent = pressed ? strings.showCode : strings.showDiagram;
  };
  setPressed(false);

  const showCode = () => {
    diagram.replaceChildren();
    for (const [el, style] of hidden) restoreStyle(el, style);
    hidden.clear();
  };

  toggle.addEventListener("click", async () => {
    showingDiagram = !showingDiagram;
    const current = ++generation;
    setPressed(showingDiagram);
    if (!showingDiagram) return showCode();
    for (const el of block.elements) {
      hidden.set(el, el.getAttribute("style"));
      (el as HTMLElement).style.setProperty("display", "none", "important");
    }
    diagram.textContent = strings.rendering;
    const result = await renderSafely(renderer, block.repairedSource);
    const svg = result.ok ? parseSvg(doc, result.svg) : null;
    if (current !== generation) return;
    if (svg) diagram.replaceChildren(svg);
    else diagram.replaceChildren(renderErrorView(doc, result.ok ? strings.notSvg : result.message, block.repairedSource !== block.source));
  });

  const first = block.elements[0];
  const hover = (on: boolean) => () => {
    // Line the toggle up with the block's top edge, wherever margin collapsing has put the host.
    if (on) {
      const offset = first.getBoundingClientRect().top - host.getBoundingClientRect().top;
      host.style.setProperty("--mre-offset", `${Math.max(0, offset)}px`);
    }
    host.toggleAttribute("data-hover", on);
  };
  const hoverOn = hover(true);
  const hoverOff = hover(false);
  for (const el of [host, ...block.elements]) {
    el.addEventListener("mouseenter", hoverOn);
    el.addEventListener("mouseleave", hoverOff);
  }

  return () => {
    // A render still in flight sees a newer generation and discards its result.
    ++generation;
    showCode();
    for (const el of block.elements) {
      el.removeEventListener("mouseenter", hoverOn);
      el.removeEventListener("mouseleave", hoverOff);
    }
    host.remove();
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

async function renderSafely(renderer: Renderer, source: string): Promise<RenderResult> {
  try {
    return await renderer.render(source);
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
