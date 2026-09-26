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

describe("Source Repair", () => {
  /** The source that gets drawn, and whether Source Repair changed it. */
  function sourceOf(text: string) {
    const [block] = findMermaidBlocks(page(`<pre><code class="language-mermaid">${text}</code></pre>`));
    return { source: block.repairedSource, repaired: block.repairedSource !== block.source };
  }

  test("source without editor substitutions is left alone", () => {
    expect(sourceOf(`graph TD\n  A["It's fine"] --> B`)).toEqual({
      source: `graph TD\n  A["It's fine"] --> B`,
      repaired: false,
    });
  });

  test.each([
    ["non-breaking spaces", "graph\u00a0TD\n\u00a0\u00a0A --> B"],
    ["narrow and figure spaces", "graph\u202fTD\n\u2007\u2007A --> B"],
    ["em and thin spaces", "graph\u2003TD\n\u2009\u2009A --> B"],
    ["ideographic spaces", "graph\u3000TD\n\u3000\u3000A --> B"],
  ])("%s become normal spaces", (_name, text) => {
    expect(sourceOf(text)).toEqual({ source: "graph TD\n  A --> B", repaired: true });
  });

  test("invisible zero-width spaces are removed", () => {
    expect(sourceOf("graph\u200b TD\n  A\ufeff --> B\u2060")).toEqual({ source: "graph TD\n  A --> B", repaired: true });
  });

  test("zero-width joiners that shape emoji and scripts are kept", () => {
    const text = "graph TD\n  A[\u{1F468}\u200d\u{1F469}\u200d\u{1F467}] --> B[\u0645\u06cc\u200c\u062e\u0648\u0627\u0645]";
    expect(sourceOf(text)).toEqual({ source: text, repaired: false });
  });

  test("low and reversed curly quotes become straight quotes", () => {
    expect(sourceOf("graph TD\n  A[\u201eStart\u201f] --> B[\u201aok\u201b]")).toEqual({
      source: `graph TD\n  A["Start"] --> B['ok']`,
      repaired: true,
    });
  });

  test("curly quotes inside an already-quoted label are part of its text and are kept", () => {
    const text = 'graph TD\n  A["She said \u201chi\u201d and \u2018bye\u2019"] --> B';
    expect(sourceOf(text)).toEqual({ source: text, repaired: false });
  });

  test("curly quotes become straight quotes", () => {
    expect(sourceOf("graph TD\n  A[\u201cStart\u201d] --> B[Don\u2019t \u2018stop\u2019]")).toEqual({
      source: `graph TD\n  A["Start"] --> B[Don't 'stop']`,
      repaired: true,
    });
  });
});
