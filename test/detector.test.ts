import { describe, expect, test } from "vitest";
import { findMermaidBlocks } from "../src/detector";

function page(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

describe("Marked Blocks", () => {
  test("a pre > code.language-mermaid is one Marked Block covering the pre", () => {
    const root = page(`<pre id="p"><code class="language-mermaid">graph TD
  A --> B</code></pre>`);

    const blocks = findMermaidBlocks(root);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("marked");
    expect(blocks[0].source).toBe("graph TD\n  A --> B");
    expect(blocks[0].elements).toEqual([document.getElementById("p")]);
  });

  test.each([
    ["pre.language-mermaid", `<pre id="b" class="language-mermaid">graph LR; A-->B</pre>`],
    ["pre > code.lang-mermaid", `<pre id="b"><code class="lang-mermaid">graph LR; A-->B</code></pre>`],
    ["pre[lang=mermaid]", `<pre id="b" lang="mermaid"><code>graph LR; A-->B</code></pre>`],
    ["pre[data-lang=mermaid]", `<pre id="b" data-lang="mermaid">graph LR; A-->B</pre>`],
    ["div[data-lang=mermaid]", `<div id="b" data-lang="mermaid">graph LR; A-->B</div>`],
    ["pre and code both labelled", `<pre id="b" lang="mermaid"><code class="language-mermaid">graph LR; A-->B</code></pre>`],
    ["upper-case label", `<pre id="b"><code class="language-Mermaid">graph LR; A-->B</code></pre>`],
  ])("%s is one Marked Block covering the labelled container", (_name, html) => {
    const blocks = findMermaidBlocks(page(html));

    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("marked");
    expect(blocks[0].source).toBe("graph LR; A-->B");
    expect(blocks[0].elements).toEqual([document.getElementById("b")]);
  });

  test("code blocks in other languages are not Mermaid Blocks", () => {
    const root = page(`
      <pre><code class="language-js">graph TD</code></pre>
      <pre lang="python"><code>print(1)</code></pre>
      <pre><code class="language-mermaidish">graph TD</code></pre>`);

    expect(findMermaidBlocks(root)).toEqual([]);
  });

  test("several blocks are returned in document order", () => {
    const root = page(`
      <pre><code class="language-mermaid">graph TD; one</code></pre>
      <p>text</p>
      <pre><code class="language-mermaid">graph TD; two</code></pre>`);

    expect(findMermaidBlocks(root).map((b) => b.source)).toEqual(["graph TD; one", "graph TD; two"]);
  });
});
