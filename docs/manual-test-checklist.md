# Manual test checklist

Covers what the automated tests can't: real drawing by Mermaid, how things look, browser prompts, and real sites. Run it before each release (see the README's Release section), in Firefox.

**Setup:** run `npm start`, or install the signed `.xpi` for the "installed build" items. The test pages are served at the address `npm start` prints, under `/test-pages/`.

## Detecting and drawing (`mermaid-blocks.html`)

- [ ] Every block shows a half-faded "Show diagram" toggle in its top-right corner, in full on hover. Tab reaches it, and Enter or Space flips it.
- [ ] The Marked Blocks (the flowchart and the sequence diagram) draw. "Show code" brings back the original block exactly.
- [ ] The invalid block shows a Render Error: "Could not render this diagram.", with Mermaid's message under **Details**.
- [ ] The curly-quote block draws after Source Repair. The invalid, repaired block's error says spaces or quotes were fixed.
- [ ] The Sniffed Block (`stateDiagram-v2` in an unlabelled `<pre>`) draws. The Graphviz block has no toggle.
- [ ] The paragraph Text Fence shows its toggle when you hover over any of its lines, and Diagram View hides every line. The `<br>` Text Fence draws, and the Python fence has no toggle.
- [ ] Mermaid loads only on the first click. In the page's Developer Tools → Debugger, `elk.js` and `mermaid.js` appear under the extension's `moz-extension://` source only after the first "Show diagram".

## Presentation, zoom and the Diagram Viewer (`presentation.html`)

This page's own CSS hides every `svg`, turns buttons pink and puts red dotted borders on every `div`. None of it may reach a Diagram or its controls.

- [ ] A wide diagram fits the column. A small one stays at its natural size. The tall sequence diagram draws.
- [ ] The Gantt chart fills the block's width, with readable dates.
- [ ] −, + and fit appear next to the toggle once a Diagram shows. − and fit look dimmed at fitted size, but keep focus.
- [ ] Ctrl+wheel over a Diagram zooms around the cursor, and a trackpad pinch zooms smoothly. A plain wheel scrolls the page.
- [ ] When zoomed in, dragging pans. Tab reaches the Diagram, and the arrow keys pan it. The text below never moves.
- [ ] Switch Firefox to dark (Settings → General → Website appearance), then flip a Diagram off and on. It's drawn in Mermaid's dark theme on a dark frame. Back in light, it's drawn in the default theme.
- [ ] The corner-brackets button opens the Diagram Viewer, fitted to the window and clear of the toolbar.
- [ ] In the viewer, the plain wheel zooms around the cursor, dragging pans freely, fit returns to the whole Diagram, and resizing the window re-fits it.
- [ ] The page behind never scrolls while the viewer is open, whether you use the wheel, keys or the scrollbar.
- [ ] Tab and Shift+Tab stay inside the viewer. Esc or × closes it, and focus returns to the button that opened it.

## Pages that change (`dynamic.html`)

- [ ] "Add a block" adds a block with exactly one toggle, however often you click it.
- [ ] Streaming into a block in Diagram View redraws a few times per second, not once per character. It keeps the last good Diagram while the source is cut off mid-arrow, and ends with every node.
- [ ] "Add the closing line" gives the partial Text Fence a toggle.
- [ ] "Remove the first block" removes the block, its toggle and its Diagram. "Relabel as JavaScript" returns the block to its code with no toggle.
- [ ] "Toggle edit mode": while the region is editable, its block shows code with no toggle. The toggle comes back afterwards.

## Popup, Disabled Sites and permissions

- [ ] On `mermaid-blocks.html`, the popup shows the right block count. **Render all** and **Show all code** switch every block.
- [ ] On an `about:` page, the popup explains the extension can't run there.
- [ ] With `mermaid-blocks.html` open in two tabs, turning the site off in the popup removes every toggle and Diagram in both tabs at once. Turning it back on brings them back, without a reload.
- [ ] **Installed build:** a turned-off site stays off after restarting Firefox.
- [ ] **Installed build, fresh install:** Firefox's install prompt asks for access to all websites, and after accepting, the extension works on newly loaded pages.
- [ ] **Installed build, access revoked** (`about:addons` → Mermaid Render → Permissions, turn off access to all websites): the popup asks for access, and **Allow on all websites** shows Firefox's prompt. After granting, reopen the popup. A page that was already open may need a reload, and the popup says so.

## Real sites

- [ ] **Confluence Data Center:** on a page with Mermaid in a code macro and as a paragraph fence, the toggles appear, Diagram View draws, and toggling back restores the page. In edit mode there are no toggles, and nothing the extension inserted is saved into the page. See #14 for what else to look for.
- [ ] A GitHub-style page with ```` ```mermaid ```` code blocks, and one chat-style page where an answer streams in, both behave like the test pages.
