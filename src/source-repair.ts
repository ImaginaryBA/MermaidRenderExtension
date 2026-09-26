/**
 * Source Repair: undoes editor substitutions that can't change a diagram's meaning.
 * Dashes are deliberately left alone (see the Confluence ticket).
 */
const REPAIRS: [RegExp, string][] = [
  [/[   -   　]/g, " "],
  [/[​-‍⁠﻿]/g, ""],
  [/[“”„‟]/g, '"'],
  [/[‘’‚‛]/g, "'"],
];

export function repairSource(text: string): { source: string; repaired: boolean } {
  const source = REPAIRS.reduce((s, [pattern, replacement]) => s.replace(pattern, replacement), text);
  return { source, repaired: source !== text };
}
