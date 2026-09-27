/**
 * Whether text starts the way Mermaid Source does: optional blank lines, front matter and `%%`
 * comments or directives, then a diagram keyword followed by what Mermaid expects after it.
 * The checks are strict enough to reject look-alikes such as Graphviz's `graph G {`.
 */
export function startsWithDiagramKeyword(text: string): boolean {
  const first = firstDiagramLine(text.split("\n"));
  return first !== undefined && DIAGRAM_START.some((pattern) => pattern.test(first));
}

const DIAGRAM_START: RegExp[] = [
  // `graph` and `flowchart` take an optional direction, then a line end or `;`.
  /^(graph|flowchart|flowchart-elk)(\s+(TB|TD|BT|RL|LR))?\s*(;.*)?$/,
  // Keywords that are unlikely to start anything else.
  /^(sequenceDiagram|classDiagram(-v2)?|stateDiagram(-v2)?|erDiagram|gitGraph|requirementDiagram|quadrantChart|zenuml|C4(Context|Container|Component|Dynamic|Deployment))(?=$|[\s:;])/,
  // Keywords that are also ordinary words must stand alone, apart from the options Mermaid allows.
  /^pie(\s+showData)?(\s+title\s.*)?$/,
  /^xychart(-beta)?(\s+horizontal)?$/,
  /^(gantt|journey|mindmap|timeline|kanban|sankey(-beta)?|block(-beta)?|packet(-beta)?|architecture(-beta)?|radar-beta|treemap-beta)$/,
];

/** The first line after any leading blank lines, front matter and `%%` comments or directives. */
function firstDiagramLine(lines: string[]): string | undefined {
  let i = 0;
  const skipBlankAndComments = () => {
    while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("%%"))) i++;
  };
  while (i < lines.length && lines[i].trim() === "") i++;
  if (lines[i]?.trim() === "---") {
    const end = lines.findIndex((line, j) => j > i && line.trim() === "---");
    if (end === -1) return undefined;
    i = end + 1;
  }
  skipBlankAndComments();
  return lines[i]?.trim();
}
