import { findMermaidBlocks, type MermaidBlock } from "./detector";
import type { Renderer, Settings } from "./ports";
import { strings } from "./strings";

export interface Ports {
  renderer: Renderer;
  settings: Settings;
}

/** Finds the Mermaid Blocks on the page and gives each one a Render Toggle. */
export async function mount(doc: Document, { renderer, settings }: Ports): Promise<void> {
  if (await settings.isSiteDisabled(doc.location.hostname)) return;
  for (const block of findMermaidBlocks(doc.body)) attach(doc, block, renderer);
}

const HOST_TAG = "mermaid-render-block";

const STYLE = `
:host { display: block; position: relative; }
button {
  position: absolute; top: calc(var(--mre-offset, 0px) + 4px); right: 4px; z-index: 2147483647;
  font: 12px/1.4 system-ui, sans-serif; padding: 2px 8px; cursor: pointer;
  border: 1px solid #8888; border-radius: 4px; background: Canvas; color: CanvasText;
  opacity: 0; transition: opacity 0.1s;
}
:host([data-hover]) button, button:focus-visible, button[aria-pressed="true"] { opacity: 1; }
.diagram:empty { display: none; }
.diagram { padding: 8px 0; overflow: hidden; }
.diagram.error { white-space: pre-wrap; font: 12px/1.4 ui-monospace, monospace; }
.diagram svg { display: block; max-width: 100%; height: auto; margin: 0 auto; }
`;

/** Inserts a Render Toggle before the block; the block's own elements are only hidden and shown (ADR 0003). */
function attach(doc: Document, block: MermaidBlock, renderer: Renderer): void {
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

  toggle.addEventListener("click", async () => {
    showingDiagram = !showingDiagram;
    const current = ++generation;
    setPressed(showingDiagram);
    if (!showingDiagram) {
      diagram.replaceChildren();
      for (const [el, style] of hidden) restoreStyle(el, style);
      hidden.clear();
      return;
    }
    for (const el of block.elements) {
      hidden.set(el, el.getAttribute("style"));
      (el as HTMLElement).style.setProperty("display", "none", "important");
    }
    diagram.classList.remove("error");
    diagram.textContent = strings.rendering;
    const result = await renderer.render(block.source);
    if (current !== generation) return;
    if (result.ok) diagram.replaceChildren(parseSvg(doc, result.svg));
    else {
      diagram.classList.add("error");
      diagram.textContent = `${strings.renderError}:\n${result.message}`;
    }
  });

  const offset = block.elements[0];
  const hover = (on: boolean) => () => {
    if (on) host.style.setProperty("--mre-offset", getComputedStyle(offset).marginTop);
    host.toggleAttribute("data-hover", on);
  };
  for (const el of [host, ...block.elements]) {
    el.addEventListener("mouseenter", hover(true));
    el.addEventListener("mouseleave", hover(false));
  }
}

function restoreStyle(el: Element, style: string | null): void {
  if (style === null) el.removeAttribute("style");
  else el.setAttribute("style", style);
}

/** Parses SVG markup inertly (the HTML parser never runs scripts) and returns it for insertion. */
function parseSvg(doc: Document, svg: string): Node {
  const parsed = new DOMParser().parseFromString(svg, "text/html");
  const el = parsed.querySelector("svg");
  return el ? doc.adoptNode(el) : doc.createTextNode(strings.renderError);
}
