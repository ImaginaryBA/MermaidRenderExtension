import { vi } from "vitest";
import { HOST_TAG, mount } from "../src/controller";
import type { Renderer, RenderResult, Settings } from "../src/ports";

export interface FakeRenderer extends Renderer {
  calls: string[];
}

/** A renderer that "draws" a Diagram as an <svg> whose text is the Mermaid Source. */
export function fakeRenderer(result?: (source: string) => RenderResult): FakeRenderer {
  const calls: string[] = [];
  return {
    calls,
    async render(source) {
      calls.push(source);
      if (result) return result(source);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text>${source}</text></svg>`;
      return { ok: true, svg };
    },
  };
}

export function fakeSettings({ disabled = false } = {}): Settings {
  return { isSiteDisabled: async () => disabled };
}

export async function mountPage(
  html: string,
  { renderer = fakeRenderer(), settings = fakeSettings() } = {},
): Promise<void> {
  document.body.innerHTML = html;
  await mount(document, { renderer, settings });
}

/** Every Render Toggle on the page, in document order. */
export function toggles(): HTMLButtonElement[] {
  return hosts().flatMap((h) => [...h.shadowRoot!.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")]);
}

/** The Diagram (the drawn <svg>) shown for the n-th block, if any. */
export function diagram(n = 0): SVGElement | null {
  return hosts()[n]?.shadowRoot!.querySelector("svg") ?? null;
}

export function isHidden(el: Element): boolean {
  return getComputedStyle(el).display === "none";
}

export function waitFor(assertion: () => void): Promise<void> {
  return vi.waitFor(assertion, { timeout: 1000, interval: 5 });
}

function hosts(): Element[] {
  return [...document.querySelectorAll(HOST_TAG)];
}
