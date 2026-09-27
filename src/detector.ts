import { startsWithDiagramKeyword } from "./diagram-keywords";
import { isInEditingSurface } from "./editing-surfaces";
import { repairSource } from "./source-repair";
import { findTextFences } from "./text-fences";

export type MermaidBlockKind = "marked" | "sniffed" | "text-fence";

export interface MermaidBlock {
  kind: MermaidBlockKind;
  /** The Mermaid Source, exactly as the page shows it. */
  source: string;
  /** The Mermaid Source after Source Repair; this is what gets drawn. */
  repairedSource: string;
  /** The page elements the block covers; hidden while in Diagram View. */
  elements: Element[];
}

/** A detected block before Source Repair. */
type Candidate = { kind: MermaidBlockKind; elements: Element[]; source: string };

/** Finds the Mermaid Blocks under `root`, in document order, leaving out any inside an Editing Surface. */
export function findMermaidBlocks(root: Element): MermaidBlock[] {
  const found = findMarked(root);
  found.push(...findSniffed(root, found));
  for (const fence of findTextFences(root)) {
    if (!found.some((f) => overlaps(f.elements, fence.elements))) found.push({ kind: "text-fence", ...fence });
  }
  return found
    .filter((f) => !isInEditingSurface(f.elements[0]))
    .sort((a, b) => documentOrder(a.elements[0], b.elements[0]))
    .map(({ kind, elements, source }) => ({ kind, source, repairedSource: repairSource(source), elements }));
}

const MARKED_CANDIDATES = '[class*="mermaid" i], [lang="mermaid" i], [data-lang="mermaid" i]';
const LANGUAGE_CLASS = /^(?:language|lang)-(.+)$/i;
/** Language labels that say nothing about the content, so the block still counts as unlabelled. */
const PLAIN_LANGUAGES = new Set(["text", "plaintext", "plain", "txt", "none", "nohighlight"]);

function findMarked(root: ParentNode): Candidate[] {
  const found: Candidate[] = [];
  for (const el of root.querySelectorAll(MARKED_CANDIDATES)) {
    if (!languageLabels(el).includes("mermaid")) continue;
    const container = codeContainer(el);
    if (found.some((f) => f.elements[0].contains(container))) continue;
    found.push({ kind: "marked", elements: [container], source: container.textContent ?? "" });
  }
  return found;
}

/** Unlabelled <pre> elements whose text starts with a Mermaid diagram keyword. */
function findSniffed(root: ParentNode, marked: Candidate[]): Candidate[] {
  const found: Candidate[] = [];
  for (const pre of root.querySelectorAll("pre")) {
    if (marked.some((m) => overlaps(m.elements, [pre])) || isLabelledOtherLanguage(pre)) continue;
    const source = pre.textContent ?? "";
    if (startsWithDiagramKeyword(source)) found.push({ kind: "sniffed", elements: [pre], source });
  }
  return found;
}

/** The lower-cased language names an element is labelled with, via class, `lang` or `data-lang`. */
function languageLabels(el: Element): string[] {
  const labels = [...el.classList].flatMap((c) => LANGUAGE_CLASS.exec(c)?.[1] ?? []);
  for (const attr of ["lang", "data-lang"]) {
    const value = el.getAttribute(attr);
    if (value) labels.push(value);
  }
  return labels.map((l) => l.toLowerCase());
}

function isLabelledOtherLanguage(pre: Element): boolean {
  return [pre, ...pre.querySelectorAll("code")]
    .flatMap(languageLabels)
    .some((label) => label !== "mermaid" && !PLAIN_LANGUAGES.has(label));
}

/** Whether any element of `a` contains, or is contained by, any element of `b`. */
function overlaps(a: Element[], b: Element[]): boolean {
  return a.some((x) => b.some((y) => x.contains(y) || y.contains(x)));
}

function documentOrder(a: Element, b: Element): number {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/** A labelled <code> inside a <pre> is shown by the <pre>, so the block covers the <pre>. */
function codeContainer(el: Element): Element {
  const parent = el.parentElement;
  return el.tagName === "CODE" && parent?.tagName === "PRE" ? parent : el;
}
