/**
 * Editing Surfaces: parts of the page where the user is editing content. Nothing the extension
 * inserts or hides may end up in them, or it could be saved into what the user is writing.
 */

/** `contenteditable` values that make an element editable. "false" and unknown values don't. */
const EDITABLE_VALUES = new Set(["", "true", "plaintext-only"]);

/**
 * Whether `el` is inside an Editing Surface: an editable element (including through an ancestor,
 * and inside a `contenteditable="false"` island within one), a <textarea>, or a document in design mode.
 * Checks attributes rather than `isContentEditable` so the answer doesn't depend on layout.
 */
export function isInEditingSurface(el: Element): boolean {
  if (el.ownerDocument.designMode?.toLowerCase() === "on") return true;
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.tagName === "TEXTAREA") return true;
    const value = node.getAttribute("contenteditable");
    if (value !== null && EDITABLE_VALUES.has(value.toLowerCase())) return true;
  }
  return false;
}
