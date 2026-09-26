/**
 * Source Repair: undoes editor substitutions that can't change a diagram's meaning.
 * Dashes are deliberately left alone until Confluence samples show they need repairing (#14).
 */
const ODD_SPACES = /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g;
/** Invisible characters with no meaning in text. Zero-width joiners are kept: they shape emoji and some scripts. */
const ZERO_WIDTH_SPACES = /[\u200b\u2060\ufeff]/g;
const CURLY_DOUBLE = "\u201c\u201d\u201e\u201f";
const CURLY_SINGLE = "\u2018\u2019\u201a\u201b";

/** Returns the Mermaid Source with Source Repair applied. */
export function repairSource(source: string): string {
  return source.split("\n").map(straightenQuotes).join("\n").replace(ODD_SPACES, " ").replace(ZERO_WIDTH_SPACES, "");
}

/**
 * Straightens curly quotes, except inside a label that is already in straight quotes,
 * where curly quotes are part of the label's text.
 */
function straightenQuotes(line: string): string {
  let openedBy: "straight" | "curly" | null = null;
  let result = "";
  for (const ch of line) {
    if (ch === '"' || (CURLY_DOUBLE.includes(ch) && openedBy !== "straight")) {
      if (openedBy === null) openedBy = ch === '"' ? "straight" : "curly";
      else openedBy = null;
      result += '"';
    } else if (CURLY_SINGLE.includes(ch) && openedBy !== "straight") {
      result += "'";
    } else {
      result += ch;
    }
  }
  return result;
}
