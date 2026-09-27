/**
 * Text Fences: ```mermaid … ``` written as plain page text, outside any code element.
 * Every line of a fence must be a consecutive sibling under one parent, or the whole fence
 * must be a single element with <br> line breaks, so hiding it never hides unrelated content.
 */

const OPENING = "```mermaid";
const CLOSING = "```";
/** Text inside these is never page prose. Code elements are Marked or Sniffed Blocks instead. */
const NOT_PROSE = "pre, code, script, style, textarea, noscript, template";
const BLOCK_TAGS = new Set(["P", "DIV", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "SECTION", "TABLE", "TR"]);

export interface TextFence {
  elements: Element[];
  source: string;
}

export function findTextFences(root: Element): TextFence[] {
  if (!root.textContent?.includes(OPENING)) return [];
  const fences: TextFence[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!node.textContent?.includes(OPENING) || !parent || parent.closest(NOT_PROSE)) continue;
    if (fences.some((f) => f.elements.some((el) => el.contains(node)))) continue;
    const fence = siblingFence(parent, root) ?? singleElementFence(parent, root);
    if (fence) fences.push(fence);
  }
  return fences;
}

/** A fence whose lines are consecutive sibling elements, starting at the element holding `start`. */
function siblingFence(start: Element, root: Element): TextFence | null {
  let opening = start;
  while (opening.parentElement && opening.parentElement !== root && lineText(opening.parentElement).trim() === OPENING) {
    opening = opening.parentElement;
  }
  if (opening === root || lineText(opening).trim() !== OPENING) return null;

  const elements = [opening];
  const lines: string[] = [];
  for (let sibling = opening.nextSibling; sibling; sibling = sibling.nextSibling) {
    if (!(sibling instanceof Element)) {
      if (sibling.textContent?.trim()) return null;
      continue;
    }
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
  for (let el: Element | null = start; el && el !== root && root.contains(el); el = el.parentElement) {
    // Lines held in block-level children are sibling lines, which siblingFence already ruled out.
    if ([...el.querySelectorAll("*")].some((child) => BLOCK_TAGS.has(child.tagName))) return null;
    const lines = lineText(el).split("\n");
    const open = lines.findIndex((line) => line.trim() === OPENING);
    const close = lines.findIndex((line, i) => i > open && line.trim() === CLOSING);
    if (close === -1) continue;
    const outside = [...lines.slice(0, open), ...lines.slice(close + 1)];
    return outside.every((line) => line.trim() === "") ? { elements: [el], source: lines.slice(open + 1, close).join("\n") } : null;
  }
  return null;
}

/** An element's text as lines: <br> and block-level children start new lines. */
function lineText(node: Node): string {
  const BREAK = "\u0000";
  const walk = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? "";
    if (!(n instanceof Element)) return "";
    if (n.tagName === "BR") return "\n";
    const inner = [...n.childNodes].map(walk).join("");
    return BLOCK_TAGS.has(n.tagName) ? `${BREAK}${inner}${BREAK}` : inner;
  };
  return walk(node)
    .replace(new RegExp(`^${BREAK}+|${BREAK}+$`, "g"), "")
    .replace(new RegExp(`${BREAK}+`, "g"), "\n");
}
