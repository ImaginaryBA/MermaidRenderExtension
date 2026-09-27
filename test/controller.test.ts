import { describe, expect, test } from "vitest";
import { diagram, renderError, fakeRenderer, fakeSettings, isHidden, mountPage, toggles, waitFor } from "./page";

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
