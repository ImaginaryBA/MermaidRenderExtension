import { describe, expect, test } from "vitest";
import { HOST_TAG } from "../src/controller";
import type { RenderResult } from "../src/ports";
import { diagram, renderError, fakeRenderer, fakeSettings, hosts, isHidden, mountPage, settle, toggles, waitFor } from "./page";

const MARKED = `<p>Intro</p><pre id="code"><code class="language-mermaid">graph TD; A-->B</code></pre><p>Outro</p>`;

describe("Render Toggle", () => {
  test("flipping the toggle shows the Diagram in place of the code", async () => {
    await mountPage(MARKED);

    toggles()[0].click();

    await waitFor(() => expect(diagram()?.textContent).toBe("graph TD; A-->B"));
    expect(isHidden(document.getElementById("code")!)).toBe(true);
  });

  test("flipping back restores the page's original content exactly", async () => {
    await mountPage(`<pre id="code" style="color: red"><code class="language-mermaid">graph TD; A-->B</code></pre>
      <pre id="plain"><code class="language-mermaid">graph TD; C-->D</code></pre>`);
    const before = [document.getElementById("code")!.outerHTML, document.getElementById("plain")!.outerHTML];

    for (const t of toggles()) t.click();
    await waitFor(() => expect(diagram(1)).not.toBeNull());
    for (const t of toggles()) t.click();

    expect([document.getElementById("code")!.outerHTML, document.getElementById("plain")!.outerHTML]).toEqual(before);
    expect(diagram(0)).toBeNull();
    expect(diagram(1)).toBeNull();
  });

  test("the toggle is a pressable button whose label names the view it switches to", async () => {
    await mountPage(MARKED);
    const [toggle] = toggles();

    expect(toggle.tagName).toBe("BUTTON");
    expect([toggle.getAttribute("aria-pressed"), toggle.textContent]).toEqual(["false", "Show diagram"]);
    toggle.click();
    expect([toggle.getAttribute("aria-pressed"), toggle.textContent]).toEqual(["true", "Show code"]);
  });

  test("each block's toggle is independent", async () => {
    await mountPage(`<pre id="one"><code class="language-mermaid">graph TD; one</code></pre>
      <pre id="two"><code class="language-mermaid">graph TD; two</code></pre>`);

    toggles()[1].click();

    await waitFor(() => expect(diagram(1)?.textContent).toBe("graph TD; two"));
    expect(diagram(0)).toBeNull();
    expect(isHidden(document.getElementById("one")!)).toBe(false);
  });

  test("flipping back before drawing finishes never shows a stale Diagram", async () => {
    let finish!: () => void;
    const slow = fakeRenderer();
    const render = slow.render;
    slow.render = async (source) => {
      await new Promise<void>((resolve) => (finish = resolve));
      return render(source);
    };
    await mountPage(MARKED, { renderer: slow });

    toggles()[0].click();
    toggles()[0].click();
    finish();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(diagram()).toBeNull();
    expect(isHidden(document.getElementById("code")!)).toBe(false);
  });
});

describe("Sniffed Blocks", () => {
  test("toggle between code and Diagram like Marked Blocks", async () => {
    await mountPage(`<pre id="code">sequenceDiagram\n  A->>B: hi</pre>`);

    toggles()[0].click();
    await waitFor(() => expect(diagram()?.textContent).toBe("sequenceDiagram\n  A->>B: hi"));
    expect(isHidden(document.getElementById("code")!)).toBe(true);

    toggles()[0].click();
    expect(isHidden(document.getElementById("code")!)).toBe(false);
  });
});

describe("Text Fences", () => {
  const FENCE = `<p>Intro</p><p id="open">\`\`\`mermaid</p><p id="l1">graph TD</p><p id="l2">A --&gt; B</p><p id="close">\`\`\`</p><p id="outro">Outro</p>`;
  const lines = () => ["open", "l1", "l2", "close"].map((id) => document.getElementById(id)!);

  test("the toggle bar sits just before the opening fence line", async () => {
    await mountPage(FENCE);

    expect(toggles()).toHaveLength(1);
    expect(document.getElementById("open")!.previousElementSibling?.tagName).toBe(HOST_TAG.toUpperCase());
  });

  test("Diagram View hides every line of the fence and shows the Diagram", async () => {
    await mountPage(FENCE);

    toggles()[0].click();

    await waitFor(() => expect(diagram()?.textContent).toBe("graph TD\nA --> B"));
    expect(lines().map(isHidden)).toEqual([true, true, true, true]);
    expect(isHidden(document.getElementById("outro")!)).toBe(false);
  });

  test("Code View restores every line unchanged", async () => {
    await mountPage(FENCE);
    const before = lines().map((el) => el.outerHTML);

    toggles()[0].click();
    await waitFor(() => expect(diagram()).not.toBeNull());
    toggles()[0].click();

    expect(lines().map((el) => el.outerHTML)).toEqual(before);
  });
});

describe("Render Error", () => {
  const failOn = (bad: string) =>
    fakeRenderer((source) =>
      source.includes(bad)
        ? { ok: false, message: "Parse error on line 2:\n  A -->\n------^" }
        : { ok: true, svg: `<svg><text>${source}</text></svg>` },
    );

  test("shows a summary with Mermaid's message in an expandable section, instead of a Diagram", async () => {
    await mountPage(MARKED, { renderer: failOn("A-->B") });

    toggles()[0].click();

    await waitFor(() => expect(renderError()).not.toBeNull());
    expect(renderError()!.summary).toContain("Could not render this diagram");
    expect(renderError()!.detail).toBe("Parse error on line 2:\n  A -->\n------^");
    expect(diagram()).toBeNull();
  });

  test("affects only its own block", async () => {
    await mountPage(
      `<pre id="bad"><code class="language-mermaid">graph TD; broken</code></pre>
       <pre id="good"><code class="language-mermaid">graph TD; A-->B</code></pre>`,
      { renderer: failOn("broken") },
    );

    for (const t of toggles()) t.click();

    await waitFor(() => expect(diagram(1)?.textContent).toBe("graph TD; A-->B"));
    expect(renderError(0)).not.toBeNull();
    expect(renderError(1)).toBeNull();
  });

  test("the Render Toggle still switches back to Code View", async () => {
    await mountPage(MARKED, { renderer: failOn("A-->B") });

    toggles()[0].click();
    await waitFor(() => expect(renderError()).not.toBeNull());
    toggles()[0].click();

    expect(renderError()).toBeNull();
    expect(isHidden(document.getElementById("code")!)).toBe(false);
  });

  test("says when Source Repair changed the block", async () => {
    await mountPage(
      `<pre><code class="language-mermaid">graph TD;\u00a0broken</code></pre>
       <pre><code class="language-mermaid">graph TD; broken</code></pre>`,
      { renderer: failOn("broken") },
    );

    for (const t of toggles()) t.click();

    await waitFor(() => expect(renderError(1)).not.toBeNull());
    expect(renderError(0)!.summary).toMatch(/spaces or quotes .* fixed/i);
    expect(renderError(1)!.summary).not.toMatch(/fixed/i);
  });
});

describe("Source Repair", () => {
  test("the Diagram is drawn from the repaired source", async () => {
    const renderer = fakeRenderer();
    await mountPage(`<pre><code class="language-mermaid">graph TD;\u00a0A[\u201cStart\u201d]</code></pre>`, { renderer });

    toggles()[0].click();

    await waitFor(() => expect(renderer.calls).toEqual(['graph TD; A["Start"]']));
  });
});

describe("Diagram safety", () => {
  test("a renderer that throws shows a Render Error instead of getting stuck", async () => {
    const renderer = fakeRenderer(() => {
      throw new Error("Mermaid failed to load");
    });
    await mountPage(MARKED, { renderer });

    toggles()[0].click();

    await waitFor(() => expect(renderError()?.detail).toBe("Mermaid failed to load"));
  });

  test("script hooks in the drawn SVG are stripped before it reaches the page", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><a href="javascript:alert(2)"><text onclick="alert(3)">A</text></a><script>alert(4)</script><foreignObject><img src="x" onerror="alert(5)"></foreignObject></svg>`;
    await mountPage(MARKED, { renderer: fakeRenderer(() => ({ ok: true, svg })) });

    toggles()[0].click();

    await waitFor(() => expect(diagram()).not.toBeNull());
    const html = diagram()!.outerHTML;
    expect(html).not.toMatch(/on(load|click|error)=|javascript:|<script|<foreignObject|<img/i);
    expect(diagram()!.textContent).toBe("A");
  });
});

describe("pages without Mermaid", () => {
  test("get no toggles and never draw anything", async () => {
    const renderer = fakeRenderer();
    await mountPage(`<pre><code class="language-js">const graph = 1;</code></pre>`, { renderer });

    expect(toggles()).toEqual([]);
    expect(renderer.calls).toEqual([]);
  });
});

describe("Disabled Site", () => {
  test("gets no toggles", async () => {
    await mountPage(MARKED, { settings: fakeSettings({ disabled: true }) });

    expect(toggles()).toEqual([]);
  });
});

describe("Editing Surfaces", () => {
  /** `html` as the page serializes it once parsed. */
  const serialized = (html: string) => Object.assign(document.createElement("div"), { innerHTML: html }).innerHTML;

  test("a block in Diagram View returns to Code View and loses its toggle when its region becomes editable", async () => {
    await mountPage(`<div id="region">${MARKED}</div>`);
    toggles()[0].click();
    await waitFor(() => expect(diagram()).not.toBeNull());

    document.getElementById("region")!.setAttribute("contenteditable", "true");

    await waitFor(() => expect(toggles()).toEqual([]));
    expect(document.getElementById("region")!.innerHTML).toBe(serialized(MARKED));
    expect(isHidden(document.getElementById("code")!)).toBe(false);
  });

  test("a block still rendering when its region becomes editable never shows the Diagram", async () => {
    let finish!: (result: RenderResult) => void;
    const renderer = { calls: [], render: () => new Promise<RenderResult>((done) => (finish = done)) };
    await mountPage(`<div id="region">${MARKED}</div>`, { renderer });
    toggles()[0].click();

    document.getElementById("region")!.setAttribute("contenteditable", "");
    await waitFor(() => expect(toggles()).toEqual([]));
    finish({ ok: true, svg: `<svg xmlns="http://www.w3.org/2000/svg"></svg>` });
    // Nothing should change, so there is no condition to wait for: give the render time to land.
    await new Promise((r) => setTimeout(r, 10));

    expect(document.getElementById("region")!.innerHTML).toBe(serialized(MARKED));
  });

  test("a block moved into an editable region after mount loses its toggle", async () => {
    await mountPage(`<div id="region">${MARKED}</div><div id="editor" contenteditable="true"></div>`);

    document.getElementById("editor")!.append(document.getElementById("region")!);

    await waitFor(() => expect(toggles()).toEqual([]));
  });

  test("blocks outside the region that became editable keep their toggles", async () => {
    await mountPage(`<div id="region">${MARKED}</div><div>${MARKED.replace('id="code"', 'id="other"')}</div>`);

    document.getElementById("region")!.setAttribute("contenteditable", "true");

    await waitFor(() => expect(toggles()).toHaveLength(1));
    expect(toggles()[0].getRootNode()).toBe(
      document.getElementById("other")!.previousElementSibling!.shadowRoot,
    );
  });
});

describe("Dynamic pages", () => {
  const code = (id = "code") => document.getElementById(id)!.querySelector("code")!;

  test("a block added after mount gets exactly one toggle", async () => {
    await mountPage(`<p>Intro</p>`);

    document.body.insertAdjacentHTML("beforeend", MARKED.replace('id="code"', 'id="late"'));

    await waitFor(() => expect(toggles()).toHaveLength(1));
    await settle();
    expect(hosts()).toHaveLength(1);
  });

  test("the extension's own insertions never add toggles or trigger renders", async () => {
    const renderer = fakeRenderer();
    await mountPage(MARKED, { renderer });

    toggles()[0].click();
    await waitFor(() => expect(diagram()).not.toBeNull());
    toggles()[0].click();
    toggles()[0].click();
    await waitFor(() => expect(diagram()).not.toBeNull());
    await settle();

    expect(hosts()).toHaveLength(1);
    expect(renderer.calls).toHaveLength(2);
  });

  test("a block in Diagram View redraws when its source changes", async () => {
    const renderer = fakeRenderer();
    await mountPage(MARKED, { renderer });
    toggles()[0].click();
    await waitFor(() => expect(diagram()?.textContent).toBe("graph TD; A-->B"));

    code().textContent = "graph TD; A-->C";

    await waitFor(() => expect(diagram()?.textContent).toBe("graph TD; A-->C"));
    expect(renderer.calls).toEqual(["graph TD; A-->B", "graph TD; A-->C"]);
  });

  test("a stream of source changes causes a bounded number of redraws, ending with the final source", async () => {
    const renderer = fakeRenderer();
    await mountPage(MARKED, { renderer });
    toggles()[0].click();
    await waitFor(() => expect(diagram()).not.toBeNull());

    let source = "graph TD; A-->B";
    for (let i = 0; i < 30; i++) {
      source += `; N${i}-->A`;
      code().textContent = source;
      await new Promise((r) => setTimeout(r, 5));
    }

    await waitFor(() => expect(diagram()?.textContent).toBe(source));
    await settle();
    expect(renderer.calls.length).toBeLessThanOrEqual(6);
    expect(renderer.calls.at(-1)).toBe(source);
  });

  test("a block in Code View whose source changes is not redrawn until the toggle is flipped", async () => {
    const renderer = fakeRenderer();
    await mountPage(MARKED, { renderer });

    code().textContent = "graph TD; A-->C";
    await settle();
    expect(renderer.calls).toEqual([]);

    toggles()[0].click();
    await waitFor(() => expect(renderer.calls).toEqual(["graph TD; A-->C"]));
  });

  test("removing a block removes the toggle and diagram inserted for it", async () => {
    await mountPage(MARKED);
    toggles()[0].click();
    await waitFor(() => expect(diagram()).not.toBeNull());

    document.getElementById("code")!.remove();

    await waitFor(() => expect(hosts()).toEqual([]));
  });

  test("a block whose content stops being Mermaid returns to Code View and loses its toggle", async () => {
    await mountPage(MARKED);
    toggles()[0].click();
    await waitFor(() => expect(diagram()).not.toBeNull());

    code().className = "language-js";

    await waitFor(() => expect(hosts()).toEqual([]));
    expect(isHidden(document.getElementById("code")!)).toBe(false);
  });

  test("a partial Text Fence becomes a block when its closing line arrives", async () => {
    const renderer = fakeRenderer();
    await mountPage(`<div id="chat"><p>\`\`\`mermaid</p><p>graph TD; A-->B</p></div>`, { renderer });
    expect(toggles()).toEqual([]);

    document.getElementById("chat")!.insertAdjacentHTML("beforeend", "<p>```</p>");

    await waitFor(() => expect(toggles()).toHaveLength(1));
    toggles()[0].click();
    await waitFor(() => expect(renderer.calls).toEqual(["graph TD; A-->B"]));
  });

  test("a block gets its toggle back when its region stops being editable", async () => {
    await mountPage(`<div id="region" contenteditable="true">${MARKED}</div>`);
    expect(toggles()).toEqual([]);

    document.getElementById("region")!.removeAttribute("contenteditable");

    await waitFor(() => expect(toggles()).toHaveLength(1));
  });
});

describe("Dynamic pages: the page removing the extension's elements", () => {
  test("a block whose toggle the page removed gets it back, still showing its Diagram", async () => {
    await mountPage(MARKED);
    toggles()[0].click();
    await waitFor(() => expect(diagram()?.textContent).toBe("graph TD; A-->B"));

    hosts()[0].remove();

    await waitFor(() => expect(toggles()).toHaveLength(1));
    expect(diagram()?.textContent).toBe("graph TD; A-->B");
    expect(document.getElementById("code")!.previousElementSibling).toBe(hosts()[0]);
  });
});
