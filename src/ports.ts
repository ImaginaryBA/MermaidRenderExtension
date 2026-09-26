/** What drawing a Mermaid Source produces: a Diagram as SVG markup, or a Render Error. */
export type RenderResult = { ok: true; svg: string } | { ok: false; message: string };

/** Draws Diagrams. The real adapter wraps Mermaid; tests use a fake. */
export interface Renderer {
  render(source: string): Promise<RenderResult>;
}

/** The user's settings. The real adapter reads extension storage; tests use a fake. */
export interface Settings {
  isSiteDisabled(hostname: string): Promise<boolean>;
}
