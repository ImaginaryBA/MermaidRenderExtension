/**
 * Text Fences: ```mermaid … ``` written as plain page text, outside any code element.
 * Either every line of the fence is a consecutive sibling element under one parent, or the
 * whole fence is one element with <br> line breaks, so hiding it never hides unrelated content.
 */

const OPENING = "```mermaid";
const CLOSING = "```";
/** Text inside these is never page prose. Code elements are Marked or Sniffed Blocks instead. */
const NOT_PROSE = "pre, code, script, style, textarea, noscript, template";
/** Table cells and rows are separate parents, even though they're siblings in the DOM. */
const TABLE_PARTS = new Set(["TABLE", "CAPTION", "COLGROUP", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH"]);
const BLOCK_TAGS = [
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DETAILS", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION",
  "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL",
  "P", "PRE", "SECTION", "SUMMARY", "UL", ...TABLE_PARTS,
];
const BLOCK_SELECTOR = BLOCK_TAGS.join(",");
const BLOCKS = new Set(BLOCK_TAGS);
/** Stop following an unclosed fence after this many lines. */
const MAX_LINES = 2000;

export interface TextFence {
  elements: Element[];
  source: string;
}

export function findTextFences(root: Element): TextFence[] {
  if (!root.textContent?.includes(OPENING)) return [];
  const fences: TextFence[] = [];
  const tried = new Set<Element>();
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.includes("`")) continue;
    // The opening marker may be split by inline formatting, so look at the nearest line-sized element.
    const line = node.parentElement?.closest(BLOCK_SELECTOR) ?? node.parentElement;
    if (!line || tried.has(line) || !root.contains(line) || line.closest(NOT_PROSE)) continue;
    tried.add(line);
    if (!line.textContent?.includes(OPENING) || fences.some((f) => f.elements.some((el) => el.contains(line)))) continue;
    const fence = siblingFence(line, root) ?? singleElementFence(line, root);
    if (fence) fences.push(fence);
  }
  return fences;
}

/** A fence whose lines are consecutive sibling elements, starting at `start` or an ancestor holding only it. */
function siblingFence(start: Element, root: Element): TextFence | null {
  if (start.textContent?.trim() !== OPENING) return null;
  let opening = start;
  while (opening.parentElement && opening.parentElement !== root && opening.parentElement.textContent?.trim() === OPENING) {
    opening = opening.parentElement;
  }
  if (TABLE_PARTS.has(opening.tagName)) return null;

  const elements = [opening];
  const lines: string[] = [];
  for (let sibling = opening.nextSibling; sibling && lines.length <= MAX_LINES; sibling = sibling.nextSibling) {
    if (sibling.nodeType === Node.TEXT_NODE && sibling.textContent?.trim()) return null;
    if (!(sibling instanceof Element)) continue;
    if (sibling.matches(NOT_PROSE) || sibling.querySelector(NOT_PROSE)) return null;
    const text = lineText(sibling);
    elements.push(sibling);
    if (text.trim() === CLOSING) return { elements, source: lines.join("\n") };
    if (text.trim() === OPENING) return null;
    lines.push(...text.split("\n"));
  }
  return null;
}

/** A fence that is the entire content of one element, with <br> between its lines. */
function singleElementFence(start: Element, root: Element): TextFence | null {
  for (let el: Element | null = start; el && el !== root; el = el.parentElement) {
    // Lines held in block-level children are sibling lines, which siblingFence already ruled out.
    if (TABLE_PARTS.has(el.tagName) || el.querySelector(BLOCK_SELECTOR)) return null;
    const lines = lineText(el).split("\n");
    const open = lines.findIndex((line) => line.trim() === OPENING);
    const close = lines.findIndex((line, i) => i > open && line.trim() === CLOSING);
    if (open === -1 || close === -1) continue;
    const outside = [...lines.slice(0, open), ...lines.slice(close + 1)];
    return outside.every((line) => line.trim() === "") ? { elements: [el], source: lines.slice(open + 1, close).join("\n") } : null;
  }
  return null;
}

const BREAK = "\u0000";
const EDGE_BREAKS = new RegExp(`^${BREAK}+|${BREAK}+$`, "g");
const INNER_BREAKS = new RegExp(`${BREAK}+`, "g");

/** An element's text as lines: <br> and block-level children start new lines. */
function lineText(node: Node): string {
  const walk = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? "";
    if (!(n instanceof Element)) return "";
    if (n.tagName === "BR") return "\n";
    let inner = [...n.childNodes].map(walk).join("");
    // A trailing <br> ends the line rather than starting a new one, as browsers render it.
    if (n.lastChild instanceof Element && n.lastChild.tagName === "BR") inner = inner.slice(0, -1);
    return BLOCKS.has(n.tagName) ? `${BREAK}${inner}${BREAK}` : inner;
  };
  return walk(node).replace(EDGE_BREAKS, "").replace(INNER_BREAKS, "\n");
}
