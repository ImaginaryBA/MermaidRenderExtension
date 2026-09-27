import { BLOCK_VIEWS, type BlockView } from "./block-view";

/** Sent by a content script to have the background script inject the Mermaid bundle into it. */
export const LOAD_MERMAID = "load-mermaid";
/** The background script's answer to LOAD_MERMAID: true once injected, or why it couldn't be. */
export type LoadMermaidReply = true | { error: string };

/** Sent by the popup to ask how many Mermaid Blocks the page has. */
export const GET_BLOCK_COUNT = "get-block-count";
/** Sent by the popup for a Bulk Action: every block to Diagram View ("Render all") or to Code View ("Show all code"). */
export const SET_ALL_VIEWS = "set-all-views";

export type PopupMessage = { type: typeof GET_BLOCK_COUNT } | { type: typeof SET_ALL_VIEWS; view: BlockView };

/** What the page answers the popup with, after any Bulk Action. */
export interface PopupReply {
  /** How many Mermaid Blocks the page has. */
  count: number;
  /** Whether the page's site is a Disabled Site, where no blocks are detected. */
  siteDisabled: boolean;
}

export function isPopupMessage(message: unknown): message is PopupMessage {
  const { type, view } = (message ?? {}) as { type?: unknown; view?: unknown };
  return type === GET_BLOCK_COUNT || (type === SET_ALL_VIEWS && (BLOCK_VIEWS as readonly unknown[]).includes(view));
}
