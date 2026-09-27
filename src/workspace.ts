/**
 * The render workspace: an off-screen element under <body> that Mermaid draws and measures each
 * Diagram in. Mermaid's diagram renderers look their SVG up from `document.body`, so it can't live
 * in a shadow root. Instead it carries its own stylesheet that keeps page CSS such as
 * `svg { display: none }` from stopping Mermaid measuring text, which would draw empty Diagrams or fail.
 * The finished Diagram is shown in the block's shadow root, out of the page's reach.
 */
export const WORKSPACE_TAG = "mermaid-render-workspace";

/**
 * Keeps Mermaid's SVGs displayed however the page styles `svg`: the one it draws in the workspace, and
 * the bare one it appends to <body> to measure text. The workspace is moved to the end of <body> before
 * each render, so while it's marked as rendering, SVGs after it are Mermaid's; page SVGs are never matched.
 */
const STYLE = `
${WORKSPACE_TAG} svg, ${WORKSPACE_TAG}[data-rendering] ~ svg { display: block !important; visibility: visible !important; }
`;

let rendering = 0;

/** Runs `draw` with the container Mermaid should draw in, creating the workspace the first time. */
export async function inRenderWorkspace<T>(doc: Document, draw: (container: HTMLElement) => Promise<T>): Promise<T> {
  const workspace = doc.querySelector(WORKSPACE_TAG) ?? createWorkspace(doc);
  if (doc.body.lastElementChild !== workspace) doc.body.append(workspace);
  rendering++;
  workspace.setAttribute("data-rendering", "");
  try {
    return await draw(workspace.lastElementChild as HTMLElement);
  } finally {
    if (--rendering === 0) workspace.removeAttribute("data-rendering");
  }
}

/** Removes the workspace, when the extension stops on a page; the next render creates it again. */
export function removeRenderWorkspace(doc: Document): void {
  doc.querySelector(WORKSPACE_TAG)?.remove();
}

function createWorkspace(doc: Document): Element {
  const workspace = doc.createElement(WORKSPACE_TAG);
  workspace.setAttribute("aria-hidden", "true");
  for (const [property, value] of [
    ["display", "block"],
    ["position", "absolute"],
    ["left", "-100000px"],
    ["top", "0"],
    ["pointer-events", "none"],
  ]) {
    workspace.style.setProperty(property, value, "important");
  }
  const style = doc.createElement("style");
  style.textContent = STYLE;
  // Mermaid clears the container it's given, so the stylesheet sits beside it rather than inside.
  workspace.append(style, doc.createElement("div"));
  return workspace;
}
