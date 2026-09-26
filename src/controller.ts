import { findMermaidBlocks, type MermaidBlock } from "./detector";
import type { Renderer, RenderResult, Settings } from "./ports";
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

export const HOST_TAG = "mermaid-render-block";

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
    const result = await renderSafely(renderer, block.source);
    const svg = result.ok ? parseSvg(doc, result.svg) : null;
    if (current !== generation) return;
    if (svg) diagram.replaceChildren(svg);
    else {
      diagram.classList.add("error");
      diagram.textContent = `${strings.renderError}:\n${result.ok ? strings.notSvg : result.message}`;
    }
  });

  const first = block.elements[0];
  const hover = (on: boolean) => () => {
    // Line the toggle up with the block's top edge rather than its top margin.
    if (on) host.style.setProperty("--mre-offset", getComputedStyle(first).marginTop);
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
