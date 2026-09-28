import { vi } from "vitest";
import { HOST_TAG, mount, RESCAN_DELAY_MS, type Mounted } from "../src/controller";
import type { Renderer, RenderResult, Settings, Theme } from "../src/ports";
import { strings } from "../src/strings";
import { VIEWER_TAG } from "../src/viewer";

export interface FakeRenderer extends Renderer {
  calls: string[];
  /** The theme each call asked for, in the same order as `calls`. */
  themes: Theme[];
  /** The width each call asked for, in the same order as `calls`. */
  widths: (number | undefined)[];
}

/** A renderer that "draws" a Diagram as an <svg> whose text is the Mermaid Source. */
export function fakeRenderer(result?: (source: string) => RenderResult): FakeRenderer {
  const calls: string[] = [];
  const themes: Theme[] = [];
  const widths: (number | undefined)[] = [];
  return {
    calls,
    themes,
    widths,
    async render(source, { theme, width }) {
      calls.push(source);
      themes.push(theme);
      widths.push(width);
      if (result) return result(source);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text>${source}</text></svg>`;
      return { ok: true, svg };
    },
  };
}

export interface FakeSettings extends Settings {
  /** The hostnames asked about, in order. */
  asked: string[];
  /** Turns the site off or on, telling anyone listening, as a change in extension storage would. */
  setDisabled(disabled: boolean): void;
}

/** Settings where the page's site is disabled or not, changeable during a test. */
export function fakeSettings({ disabled = false } = {}): FakeSettings {
  let current = disabled;
  const asked: string[] = [];
  const listeners = new Set<() => void>();
  return {
    asked,
    async isSiteDisabled(hostname) {
      asked.push(hostname);
      return current;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setDisabled(next) {
      current = next;
      for (const listener of listeners) listener();
    },
  };
}

/** The page mounted by the previous test, which keeps watching the shared document until unmounted. */
let mounted: Mounted | undefined;

export async function mountPage(
  html: string,
  { renderer = fakeRenderer(), settings = fakeSettings() }: { renderer?: Renderer; settings?: Settings } = {},
): Promise<Mounted> {
  mounted?.unmount();
  document.body.innerHTML = html;
  mounted = await mount(document, { renderer, settings });
  return mounted;
}

/** Every Render Toggle on the page, in document order. */
export function toggles(): HTMLButtonElement[] {
  return hosts().flatMap((h) => [...h.shadowRoot!.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")]);
}

/** The Diagram (the drawn <svg>) shown for the n-th block, if any. */
export function diagram(n = 0): SVGElement | null {
  return hosts()[n]?.shadowRoot!.querySelector("svg") ?? null;
}

/** What the n-th block's Render Error says, or null if it isn't showing one. */
export function renderError(n = 0) {
  const error = hosts()[n]?.shadowRoot!.querySelector("[role=status]");
  if (!error) return null;
  const details = error.querySelector("details");
  return {
    /** The text shown before the expandable section is opened. */
    summary: [...error.children].filter((c) => c !== details).map((c) => c.textContent).join(" "),
    /** The text inside the expandable section. */
    detail: details ? [...details.childNodes].filter((c) => c.nodeName !== "SUMMARY").map((c) => c.textContent).join("") : null,
  };
}

/** The n-th block's zoom buttons, found by their labels. */
export function zoomButtons(n = 0) {
  const root = hosts()[n]!.shadowRoot!;
  const button = (label: string) => root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  return { zoomIn: button(strings.zoomIn), zoomOut: button(strings.zoomOut), fit: button(strings.fitToWidth) };
}

/** How the n-th block's Diagram is zoomed and panned: scale 1 is fitted to the block's width. */
export function zoomState(n = 0): { scale: number; x: number; y: number } {
  const transform = (diagram(n)!.parentElement as HTMLElement).style.transform;
  const [, x = "0", y = "0", scale = "1"] = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec(transform) ?? [];
  return { scale: Number(scale), x: Number(x), y: Number(y) };
}

export function zoomLevel(n = 0): number {
  return zoomState(n).scale;
}

/** The n-th block's button that opens the Diagram Viewer. */
export function viewerButton(n = 0): HTMLButtonElement {
  return hosts()[n]!.shadowRoot!.querySelector<HTMLButtonElement>(`button[aria-label="${strings.openViewer}"]`)!;
}

/** The open Diagram Viewer's parts, or null if none is open. */
export function viewer() {
  const overlays = document.querySelectorAll(VIEWER_TAG);
  if (overlays.length === 0) return null;
  const root = overlays[overlays.length - 1].shadowRoot!;
  const button = (label: string) => root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  return {
    count: overlays.length,
    root,
    dialog: root.querySelector<HTMLElement>("[role=dialog]")!,
    svg: root.querySelector("svg"),
    close: button(strings.closeViewer),
    zoomIn: button(strings.zoomIn),
    zoomOut: button(strings.zoomOut),
    fit: button(strings.fitToWindow),
    /** The scale the viewer shows its Diagram at. */
    scale: () => Number(/scale\(([\d.]+)\)/.exec((root.querySelector("svg")!.parentElement as HTMLElement).style.transform)?.[1]),
  };
}

export function isHidden(el: Element): boolean {
  return getComputedStyle(el).display === "none";
}

export function waitFor(assertion: () => void, timeout = 1000): Promise<void> {
  return vi.waitFor(assertion, { timeout, interval: 5 });
}

/** Waits long enough for the controller to have reacted to any page changes, for checks that nothing happened. */
export function settle(): Promise<void> {
  return new Promise((done) => setTimeout(done, RESCAN_DELAY_MS * 3));
}

export function hosts(): Element[] {
  return [...document.querySelectorAll(HOST_TAG)];
}
