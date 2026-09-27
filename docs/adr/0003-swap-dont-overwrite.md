# Diagram View hides the original content instead of replacing it

Switching to Diagram View hides the page's original elements and inserts the Diagram next to them. The original elements are never removed, and their content is never changed. Sites such as Confluence re-render their own DOM, and outside changes to that DOM break them. Keeping the original elements also makes switching back to Code View exact. Don't "simplify" this into replacing the element's contents.

## Consequences

- Hiding means adding an inline `display: none !important` to each covered element while it's in Diagram View. Code View restores the element's previous `style` attribute exactly. This is the only change made to the page's own elements.
- The Render Toggle lives in an element inserted as a sibling just before the block. It stays there in Code View too, so CSS selectors that depend on sibling order (such as `h2 + pre`) can match differently on pages with Mermaid Blocks. The one exception is a block that ends up inside an Editing Surface: its Render Toggle is removed, so an editor never saves it.
- Once the first Diagram is drawn, an off-screen render workspace (`<mermaid-render-workspace>`) stays at the end of `<body>`. Mermaid has to draw and measure in the page's own DOM, and the workspace's stylesheet keeps page CSS from breaking that. It holds nothing visible, and the finished Diagram is shown in the block's shadow root.
