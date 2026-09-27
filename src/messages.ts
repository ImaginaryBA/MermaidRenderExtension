import type { BlockView, Mounted } from "./controller";

/** Sent by a content script to have the background script inject the Mermaid bundle into it. */
export const LOAD_MERMAID = "load-mermaid";

/** Sent by the popup to ask how many Mermaid Blocks the page has. */
export const GET_BLOCK_COUNT = "get-block-count";
/** Sent by the popup for a Bulk Action: every block to Diagram View ("Render all") or to Code View ("Show all code"). */
export const SET_ALL_VIEWS = "set-all-views";

export type PopupMessage = { type: typeof GET_BLOCK_COUNT } | { type: typeof SET_ALL_VIEWS; view: BlockView };

/** What the page answers the popup with: the number of Mermaid Blocks, after any Bulk Action. */
export interface PopupReply {
  count: number;
}

/** The page's answer to a message from the popup, or undefined if the message isn't the popup's. */
export function answerPopup(mounted: Mounted, message: unknown): PopupReply | undefined {
  if (!isPopupMessage(message)) return undefined;
  if (message.type === SET_ALL_VIEWS) mounted.setAllViews(message.view);
  return { count: mounted.blockCount() };
}

export function isPopupMessage(message: unknown): message is PopupMessage {
  const { type, view } = (message ?? {}) as { type?: unknown; view?: unknown };
  return type === GET_BLOCK_COUNT || (type === SET_ALL_VIEWS && (view === "diagram" || view === "code"));
}
