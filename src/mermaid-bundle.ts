import mermaid from "mermaid";
import type { RenderResult } from "./ports";

// `strict` keeps a hostile page from using a Diagram to run script (ADR 0002).
// HTML labels are off so every Diagram is plain SVG.
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  htmlLabels: false,
  suppressErrorRendering: true,
});

let renders = 0;

globalThis.mermaidRenderExtension ??= {
  async render(source: string): Promise<RenderResult> {
    try {
      const { svg } = await mermaid.render(`mermaid-render-extension-${++renders}`, source);
      return { ok: true, svg };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  },
};
