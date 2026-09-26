# Diagram View hides the original content instead of replacing it

Switching to Diagram View hides the page's original elements and inserts the Diagram next to them. The original elements are never modified or removed. Sites such as Confluence re-render their own DOM, and outside changes to that DOM break them. Keeping the original elements also makes switching back to Code View exact. Don't "simplify" this into replacing the element's contents.
