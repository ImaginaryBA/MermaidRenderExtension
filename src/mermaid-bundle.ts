import mermaid from "mermaid";
import type { RenderOptions, RenderResult } from "./ports";

// `strict` keeps a hostile page from using a Diagram to run script (ADR 0002).
// HTML labels are off so every Diagram is plain SVG.
const config = {
  startOnLoad: false,
  securityLevel: "strict",
  htmlLabels: false,
  suppressErrorRendering: true,
} as const;

let renders = 0;

globalThis.mermaidRenderExtension ??= {
  async render(source: string, { theme }: RenderOptions): Promise<RenderResult> {
    try {
      mermaid.initialize({ ...config, theme });
      const { svg } = await mermaid.render(`mermaid-render-extension-${++renders}`, source);
      return { ok: true, svg };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  },
};
