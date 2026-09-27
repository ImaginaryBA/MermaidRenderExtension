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

describe("Sniffed Blocks", () => {
  function sniff(text: string) {
    const pre = document.createElement("pre");
    pre.textContent = text;
    document.body.replaceChildren(pre);
    return findMermaidBlocks(document.body);
  }

  test.each([
    "graph TD\n  A --> B",
    "graph LR; A-->B",
    "graph\n  A --> B",
    "flowchart TB\n  A --> B",
    "flowchart-elk RL\n  A --> B",
    "sequenceDiagram\n  A->>B: hi",
    "classDiagram\n  Animal <|-- Duck",
    "classDiagram-v2\n  class A",
    "stateDiagram\n  [*] --> Still",
    "stateDiagram-v2\n  [*] --> Still",
    "erDiagram\n  CUSTOMER ||--o{ ORDER : places",
    "gantt\n  title Plan",
    "pie\n  \"Dogs\" : 386",
    "pie showData\n  \"Dogs\" : 386",
    "pie title Pets\n  \"Dogs\" : 386",
    "journey\n  title My day",
    "gitGraph\n  commit",
    "mindmap\n  root",
    "timeline\n  title History",
    "quadrantChart\n  title Reach",
    "requirementDiagram\n  requirement r {\n  }",
    "C4Context\n  title System",
    "C4Container\n  title System",
    "sankey-beta\n  A,B,10",
    "xychart-beta\n  title Sales",
    "xychart-beta horizontal\n  title Sales",
    "block-beta\n  columns 3",
    "packet-beta\n  0-15: \"Port\"",
    "kanban\n  Todo",
    "architecture-beta\n  service db(database)[DB]",
  ])("an unlabelled code block starting %j is a Sniffed Block", (text) => {
    const blocks = sniff(text);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("sniffed");
    expect(blocks[0].source).toBe(text);
    expect(blocks[0].elements).toEqual([document.querySelector("pre")]);
  });

  test.each([
    ["leading blank lines", "\n\n  graph TD\n  A --> B"],
    ["leading %% comments", "%% the login flow\n%% second note\ngraph TD\n  A --> B"],
    ["front matter", "---\ntitle: Login\nconfig:\n  theme: forest\n---\nflowchart LR\n  A --> B"],
    ["an init directive", "%%{init: {'theme': 'dark'}}%%\nsequenceDiagram\n  A->>B: hi"],
  ])("%s before the keyword are allowed", (_name, text) => {
    expect(sniff(text).map((b) => b.kind)).toEqual(["sniffed"]);
  });

  test.each([
    ["Graphviz graph", "graph G {\n  a -- b;\n}"],
    ["Graphviz digraph", "digraph G {\n  a -> b;\n}"],
    ["a Python assignment", "graph = build_graph()\nprint(graph)"],
    ["prose starting with Graph", "Graph theory is the study of graphs."],
    ["prose starting with a keyword word", "pie is my favourite dessert"],
    ["a keyword inside a longer word", "graphviz dot -Tpng in.dot"],
    ["a keyword that isn't first", "print('graph TD')"],
    ["an empty block", "   \n  "],
    ["unfinished front matter", "---\ntitle: x\nflowchart LR"],
  ])("%s is not a Sniffed Block", (_name, text) => {
    expect(sniff(text)).toEqual([]);
  });

  test("a block labelled with another language is not sniffed", () => {
    const root = page(`<pre><code class="language-python">graph TD</code></pre><pre lang="js">graph TD</pre>`);

    expect(findMermaidBlocks(root)).toEqual([]);
  });

  test.each(["text", "plaintext", "none", "nohighlight"])(
    "a block labelled %s counts as unlabelled",
    (lang) => {
      const root = page(`<pre><code class="language-${lang}">graph TD\n  A --> B</code></pre>`);

      expect(findMermaidBlocks(root).map((b) => b.kind)).toEqual(["sniffed"]);
    },
  );

  test("a block that is both labelled and keyword-matched is reported once, as marked", () => {
    const root = page(`<pre><code class="language-mermaid">graph TD\n  A --> B</code></pre>`);

    expect(findMermaidBlocks(root).map((b) => b.kind)).toEqual(["marked"]);
  });

  test("Marked and Sniffed Blocks are returned together in document order", () => {
    const root = page(`
      <pre>graph TD; one</pre>
      <pre><code class="language-mermaid">graph TD; two</code></pre>
      <pre>sequenceDiagram
  A->>B: three</pre>`);

    expect(findMermaidBlocks(root).map((b) => [b.kind, b.source.split(";")[0].split("\n")[0]])).toEqual([
      ["sniffed", "graph TD"],
      ["marked", "graph TD"],
      ["sniffed", "sequenceDiagram"],
    ]);
  });
});
