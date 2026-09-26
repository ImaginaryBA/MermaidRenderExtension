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

**Sniffed Block**:
A Mermaid Block found in an unlabelled code element because its text starts with a Mermaid diagram keyword.

**Text Fence**:
A Mermaid Block written as plain page text between a ```` ```mermaid ```` line and a closing ```` ``` ```` line, outside any code element.
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

**Render Error**:
What a block in Diagram View shows in place of a Diagram when its Mermaid Source can't be drawn.

**Disabled Site**:
A site on which the user has turned the extension off; no Mermaid Blocks are detected there.
_Avoid_: blocked site, excluded site
