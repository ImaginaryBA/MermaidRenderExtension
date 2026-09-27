# Mermaid Render Extension

A browser extension that finds Mermaid code on web pages and lets the reader swap each piece of code for the diagram it describes, one block at a time.

## Language

### Finding blocks

**Mermaid Block**:
A single run of Mermaid source on a page that the extension has detected and can offer to render.
_Avoid_: code block (too broad; most code blocks aren't Mermaid), snippet

**Mermaid Source**:
The text of a Mermaid Block: the diagram description exactly as the page shows it.
_Avoid_: mermaid code, markup

**Marked Block**:
A Mermaid Block the page itself labels as Mermaid, e.g. a code element tagged with the Mermaid language.

**Source Repair**:
The fixes applied to Mermaid Source before drawing it, limited to undoing editor substitutions that can't change meaning: odd spaces become normal spaces, invisible zero-width spaces are removed, and curly quotes become straight ones unless they sit inside a label that is already in straight quotes.

**Sniffed Block**:
A Mermaid Block found in an unlabelled preformatted code element because its text starts with a Mermaid diagram keyword.

**Text Fence**:
A Mermaid Block written as plain page text between a ```` ```mermaid ```` line and a closing ```` ``` ```` line, outside any code element. Either all of its lines are consecutive sibling elements under one parent (never spread across table cells), or the whole fence is one element with line breaks between its lines.
_Avoid_: fenced block, markdown block

### Showing blocks

**Diagram**:
The picture Mermaid draws from a block's Mermaid Source.
_Avoid_: image, render, chart

**Block View**:
What a Mermaid Block currently shows: either the **Code View** (the page's original content) or the **Diagram View**. Every block starts in Code View on page load and nothing is remembered across reloads.
_Avoid_: enabled/disabled, on/off

**Render Toggle**:
The per-block control that switches a Mermaid Block between Code View and Diagram View.
_Avoid_: switch, button (when naming the concept)

**Diagram Viewer**:
A full-screen overlay that shows one Diagram at a time and lets the user zoom and pan it freely. It sits alongside inline zoom on the Diagram in the page.
_Avoid_: lightbox, modal, popup

**Bulk Action**:
A popup action that sets the Block View of every Mermaid Block on the current page at once: "Render all" or "Show all code". Like any Block View, it isn't remembered after a reload.

**Render Error**:
What a block in Diagram View shows in place of a Diagram when its Mermaid Source can't be drawn.

**Editing Surface**:
Any part of a page where the user is editing content, such as a wiki editor or a text box. The extension never detects Mermaid Blocks inside one.

**Disabled Site**:
A site on which the user has turned the extension off; no Mermaid Blocks are detected there.
_Avoid_: blocked site, excluded site
