/** A block's Block View: its Diagram, or the page's original code. */
export const BLOCK_VIEWS = ["diagram", "code"] as const;
export type BlockView = (typeof BLOCK_VIEWS)[number];
