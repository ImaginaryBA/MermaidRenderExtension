import type { RenderOptions, Renderer, RenderResult } from "../ports";
import { LOAD_MERMAID } from "../messages";

declare global {
  /** Set by the Mermaid bundle once the background script has injected it into this content script's world. */
  var mermaidRenderExtension: { render(source: string, options: RenderOptions): Promise<RenderResult> } | undefined;
}

/**
 * Draws Diagrams with the bundled Mermaid. Mermaid is several megabytes, so it's only
 * injected into the page the first time a block is rendered.
 */
export function mermaidRenderer(): Renderer {
  let loading: Promise<unknown> | undefined;
  return {
    async render(source, options) {
      try {
        loading ??= browser.runtime.sendMessage({ type: LOAD_MERMAID });
        await loading;
      } catch (error) {
        loading = undefined;
        return { ok: false, message: `Mermaid failed to load: ${String(error)}` };
      }
      const mermaid = globalThis.mermaidRenderExtension;
      if (!mermaid) {
        loading = undefined;
        return { ok: false, message: "Mermaid failed to load." };
      }
      return mermaid.render(source, options);
    },
  };
}
