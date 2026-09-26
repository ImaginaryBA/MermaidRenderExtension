# Diagram View hides the original content instead of replacing it

Switching to Diagram View hides the page's original elements and inserts the Diagram next to them. The original elements are never removed, and their content is never changed. Sites such as Confluence re-render their own DOM, and outside changes to that DOM break them. Keeping the original elements also makes switching back to Code View exact. Don't "simplify" this into replacing the element's contents.

## Consequences

- Hiding means adding an inline `display: none !important` to each covered element while it's in Diagram View. Code View restores the element's previous `style` attribute exactly. This is the only change made to the page's own elements.
- The Render Toggle lives in an element inserted as a sibling just before the block. It stays there in Code View too, so CSS selectors that depend on sibling order (such as `h2 + pre`) can match differently on pages with Mermaid Blocks.
