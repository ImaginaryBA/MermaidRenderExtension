export type MermaidBlockKind = "marked";

export interface MermaidBlock {
  kind: MermaidBlockKind;
  /** The Mermaid Source, exactly as the page shows it. */
  source: string;
  /** The page elements the block covers; hidden while in Diagram View. */
  elements: Element[];
}

const MARKED_CANDIDATES = '[class*="mermaid" i], [lang="mermaid" i], [data-lang="mermaid" i]';
const MARKED_CLASS = /^(language|lang)-mermaid$/i;

/** Finds the Mermaid Blocks under `root`, in document order. */
export function findMermaidBlocks(root: ParentNode): MermaidBlock[] {
  const covered: Element[] = [];
  for (const el of root.querySelectorAll(MARKED_CANDIDATES)) {
    if (!isMarked(el)) continue;
    const container = markedContainer(el);
    if (covered.some((c) => c.contains(container))) continue;
    covered.push(container);
  }
  return covered.map((el) => ({ kind: "marked", source: el.textContent ?? "", elements: [el] }));
}

function isMarked(el: Element): boolean {
  return (
    [...el.classList].some((c) => MARKED_CLASS.test(c)) ||
    el.getAttribute("lang")?.toLowerCase() === "mermaid" ||
    el.getAttribute("data-lang")?.toLowerCase() === "mermaid"
  );
}

/** A labelled <code> inside a <pre> is shown by the <pre>, so the block covers the <pre>. */
function markedContainer(el: Element): Element {
  const parent = el.parentElement;
  return el.tagName === "CODE" && parent?.tagName === "PRE" ? parent : el;
}
